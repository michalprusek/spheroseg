/**
 * Request Deduplication Utility
 *
 * Prevents duplicate API requests and caches responses
 * to improve performance and reduce server load
 */

import { AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from './logger';

interface PendingRequest {
  promise: Promise<AxiosResponse>;
  timestamp: number;
  abortController?: AbortController;
}

interface CachedResponse {
  data: unknown;
  timestamp: number;
  headers: Record<string, string>;
  status: number;
  statusText: string;
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private responseCache: Map<string, CachedResponse> = new Map();

  // Constants
  private static readonly DEFAULT_CACHE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly DEFAULT_DEDUP_TIMEOUT_MS = 30 * 1000; // 30 seconds
  private static readonly CLEANUP_PROBABILITY = 0.1; // 10% chance
  private static readonly ONE_HOUR_MS = 60 * 60 * 1000;

  private cacheTimeout: number = RequestDeduplicator.DEFAULT_CACHE_TIMEOUT_MS;
  private deduplicationTimeout: number = RequestDeduplicator.DEFAULT_DEDUP_TIMEOUT_MS;

  /**
   * Generate a unique key for the request
   */
  private generateRequestKey(config: AxiosRequestConfig): string {
    const method = config.method || 'get';
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data ? JSON.stringify(config.data) : '';

    // Include auth header in key for user-specific requests
    const authHeader = config.headers?.Authorization || '';

    return `${method}:${url}:${params}:${data}:${authHeader}`;
  }

  /**
   * Check if response is cacheable
   */
  private isCacheable(config: AxiosRequestConfig, response: AxiosResponse): boolean {
    // Only cache successful GET requests
    if (config.method?.toLowerCase() !== 'get') return false;
    if (response.status < 200 || response.status >= 300) return false;

    // Don't cache if explicitly disabled
    if (config.headers?.['Cache-Control'] === 'no-cache') return false;

    // Check response cache headers
    const cacheControl = response.headers['cache-control'];
    if (cacheControl && cacheControl.includes('no-store')) return false;

    return true;
  }

  /**
   * Get cache duration from response headers
   */
  private getCacheDuration(response: AxiosResponse): number {
    const cacheControl = response.headers['cache-control'];
    if (!cacheControl) return this.cacheTimeout;

    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      return parseInt(maxAgeMatch[1]) * 1000;
    }

    return this.cacheTimeout;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean pending requests
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > this.deduplicationTimeout) {
        this.pendingRequests.delete(key);
      }
    });

    // Clean cache
    this.responseCache.forEach((response, key) => {
      if (now - response.timestamp > this.cacheTimeout) {
        this.responseCache.delete(key);
      }
    });
  }

  /**
   * Execute request with deduplication
   */
  async execute(
    config: AxiosRequestConfig,
    requestFn: (config: AxiosRequestConfig) => Promise<AxiosResponse>,
  ): Promise<AxiosResponse> {
    try {
      const key = this.generateRequestKey(config);

      // Check cache first for GET requests
      if (config.method?.toLowerCase() === 'get') {
        const cached = this.responseCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
          logger.debug('Returning cached response', { url: config.url });
          return {
            data: cached.data,
            headers: cached.headers,
            status: cached.status,
            statusText: cached.statusText,
            config,
          } as AxiosResponse;
        }
      }

      // Check if request is already pending
      const pending = this.pendingRequests.get(key);
      if (pending && Date.now() - pending.timestamp < this.deduplicationTimeout) {
        logger.debug('Deduplicating request', { url: config.url });
        return pending.promise;
      }

      // Create abort controller
      const abortController = new AbortController();
      if (config.signal) {
        // Link existing signal to our controller
        try {
          config.signal.addEventListener('abort', () => abortController.abort());
        } catch (error) {
          logger.warn('Failed to link abort signals', error);
        }
      }
      config.signal = abortController.signal;

      // Execute new request
      const promise = requestFn(config)
        .then((response) => {
          // Remove from pending
          this.pendingRequests.delete(key);

          // Cache if appropriate
          try {
            if (this.isCacheable(config, response)) {
              const cacheDuration = this.getCacheDuration(response);
              this.responseCache.set(key, {
                data: response.data,
                timestamp: Date.now(),
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
              });

              // Schedule cache cleanup
              setTimeout(() => {
                this.responseCache.delete(key);
              }, cacheDuration);
            }
          } catch (cacheError) {
            logger.error('Failed to cache response', cacheError);
            // Continue without caching
          }

          return response;
        })
        .catch((error) => {
          // Remove from pending on error
          this.pendingRequests.delete(key);

          // Clean up abort controller
          if (pending?.abortController) {
            try {
              pending.abortController.abort();
            } catch (abortError) {
              logger.warn('Failed to abort pending request', abortError);
            }
          }

          throw error;
        });

      // Store pending request
      this.pendingRequests.set(key, {
        promise,
        timestamp: Date.now(),
        abortController,
      });

      // Periodic cleanup
      if (Math.random() < RequestDeduplicator.CLEANUP_PROBABILITY) {
        this.cleanup();
      }

      return promise;
    } catch (error) {
      // If deduplication logic fails, fall back to direct request
      logger.error('Request deduplication failed, falling back to direct request', error);
      return requestFn(config);
    }
  }

  /**
   * Cancel pending request
   */
  cancel(config: AxiosRequestConfig): void {
    const key = this.generateRequestKey(config);
    const pending = this.pendingRequests.get(key);

    if (pending?.abortController) {
      pending.abortController.abort();
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Clear cache for specific request or all
   */
  clearCache(config?: AxiosRequestConfig): void {
    if (config) {
      const key = this.generateRequestKey(config);
      this.responseCache.delete(key);
    } else {
      this.responseCache.clear();
    }
  }

  /**
   * Update cache settings
   */
  setOptions(options: { cacheTimeout?: number; deduplicationTimeout?: number }): void {
    if (options.cacheTimeout) {
      this.cacheTimeout = options.cacheTimeout;
    }
    if (options.deduplicationTimeout) {
      this.deduplicationTimeout = options.deduplicationTimeout;
    }
  }
}

// Create singleton instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Axios interceptor for request deduplication
 */
export function createDeduplicationInterceptor(axiosInstance: { interceptors: { request: { use: (onSuccess: (config: AxiosRequestConfig) => AxiosRequestConfig, onError: (error: unknown) => Promise<never>) => void }; response: { use: (onSuccess: (response: AxiosResponse) => AxiosResponse, onError: (error: unknown) => Promise<never>) => void } }; request: (config: AxiosRequestConfig) => Promise<AxiosResponse> }) {
  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config: AxiosRequestConfig) => {
      // Add request timestamp
      config.metadata = { startTime: Date.now() };
      return config;
    },
    (error: unknown) => Promise.reject(error),
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log response time
      const duration = Date.now() - (response.config.metadata?.startTime || 0);
      logger.debug('Request completed', {
        url: response.config.url,
        duration,
        status: response.status,
      });
      return response;
    },
    (error: unknown) => {
      // Log error
      const duration = Date.now() - (error.config?.metadata?.startTime || 0);
      logger.error('Request failed', {
        url: error.config?.url,
        duration,
        status: error.response?.status,
        message: error.message,
      });
      return Promise.reject(error);
    },
  );

  // Override request method to use deduplicator
  const originalRequest = axiosInstance.request;
  axiosInstance.request = function (config: AxiosRequestConfig) {
    return requestDeduplicator.execute(config, originalRequest.bind(this));
  };

  return axiosInstance;
}

// Export utilities
export default {
  requestDeduplicator,
  createDeduplicationInterceptor,
};
