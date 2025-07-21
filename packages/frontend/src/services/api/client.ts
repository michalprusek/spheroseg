import { getConfig } from '@/config/app.config';
import { getAccessToken, removeTokens, isValidToken } from '@/services/authService';
import toastService from '@/services/toastService';
import logger from '@/utils/logger';
import { handlePermissionError } from '@/utils/error/permissionErrorHandler';
import { v4 as uuidv4 } from 'uuid';
import type { 
  ApiResult, 
  ApiResponse as SharedApiResponse, 
  ApiErrorResponse 
} from '@spheroseg/shared';

/**
 * Unified API Client for SpherosegV4
 * Provides a consistent interface for all API calls with built-in features:
 * - Automatic authentication with token validation
 * - Request/response interceptors
 * - Comprehensive error handling
 * - Request cancellation and deduplication
 * - Retry logic with exponential backoff
 * - Upload progress tracking
 * - Network state detection
 * - Performance tracking
 */

// Types
export interface ApiRequestConfig extends RequestInit {
  // Custom options
  skipAuth?: boolean;
  showErrorToast?: boolean;
  retryCount?: number;
  timeout?: number;
  onUploadProgress?: (progress: number) => void;
  cancelToken?: AbortController;
  // Request data
  params?: Record<string, unknown>;
  data?: unknown;
  // Additional options
  deduplicate?: boolean; // Enable request deduplication for GET requests
  requestId?: string; // Custom request ID for tracking
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
  config: ApiRequestConfig;
  raw: ApiResult<T>;
  requestId?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  data?: unknown;
  config?: ApiRequestConfig;
  raw?: ApiErrorResponse;
  requestId?: string;
}

// Configuration with dynamic timeout based on request type
const getTimeoutForRequest = (url: string, config: ApiRequestConfig): number => {
  // Longer timeout for auth operations
  if (url.includes('/auth/')) {
    return 15000; // 15 seconds for auth requests
  }
  
  // Longer timeout for file uploads
  if (config.data instanceof FormData) {
    return 300000; // 5 minutes for file uploads
  }
  
  // Default timeout from config or 30 seconds
  return config.timeout || 30000;
};

// Default configuration
const DEFAULT_CONFIG: Partial<ApiRequestConfig> = {
  showErrorToast: true,
  retryCount: 0,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  deduplicate: true, // Enable deduplication by default for GET requests
};

// Retry configuration
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const RETRY_DELAY = 1000; // Base delay in ms
const MAX_RETRY_DELAY = 10000; // Maximum delay in ms

// Track ongoing requests for deduplication
const ongoingRequests = new Map<string, Promise<ApiResponse>>();

// Generate request key for deduplication
function getRequestKey(method: string, url: string, params?: Record<string, unknown>): string {
  const paramStr = params ? JSON.stringify(params) : '';
  return `${method}:${url}:${paramStr}`;
}

// Track auth error timestamps to prevent spam
let lastAuthErrorTime = 0;
const AUTH_ERROR_THROTTLE = 5000; // 5 seconds

class ApiClient {
  private baseURL: string;
  private requestInterceptors: Array<(config: ApiRequestConfig) => ApiRequestConfig | Promise<ApiRequestConfig>> = [];
  private responseInterceptors: Array<{
    onFulfilled?: (response: ApiResponse) => ApiResponse | Promise<ApiResponse>;
    onRejected?: (error: ApiError) => unknown;
  }> = [];
  private activeRequests = new Map<string, AbortController>();

  constructor() {
    this.baseURL = this.getBaseURL();
    this.setupDefaultInterceptors();
  }

  /**
   * Get base URL from configuration
   */
  private getBaseURL(): string {
    const config = getConfig();
    const apiUrl = config.api.baseUrl;
    const apiPrefix = config.api.prefix || '/api';
    return `${apiUrl}${apiPrefix}`;
  }

  /**
   * Setup default interceptors
   */
  private setupDefaultInterceptors() {
    // Request interceptor for authentication and tracking
    this.addRequestInterceptor((config) => {
      // Set dynamic timeout
      config.timeout = getTimeoutForRequest(config.url || '', config);
      
      // Generate or use provided request ID
      const requestId = config.requestId || uuidv4();
      config.requestId = requestId;
      config.headers = {
        ...config.headers,
        'X-Request-ID': requestId,
      };
      
      // Handle FormData - remove Content-Type header
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
        logger.debug('Removed Content-Type header for FormData request', { requestId });
      }
      
      // Add authentication token if not skipped
      if (!config.skipAuth) {
        const token = getAccessToken(true, true); // Validate and auto-remove if invalid
        if (token && isValidToken(token, false)) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`,
          };
          logger.debug('Added Authorization header', { requestId, url: config.url });
        } else if (token) {
          // Token exists but is invalid
          logger.warn('Token exists but is invalid, removing from storage');
          removeTokens();
        }
      }
      
      // Add cache buster to GET requests to avoid browser caching
      if (config.method?.toLowerCase() === 'get' && config.url && !config.url.includes('_cb=')) {
        const cacheBuster = `_cb=${Date.now()}`;
        const separator = config.url.includes('?') ? '&' : '?';
        config.url = `${config.url}${separator}${cacheBuster}`;
      }
      
      // Log request in development
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          requestId,
          method: config.method,
          url: config.url,
          params: config.params,
          hasAuth: !!config.headers.Authorization,
          timeout: config.timeout,
        });
      }
      
      return config;
    });

    // Response interceptor for error handling
    this.addResponseInterceptor(
      // Success handler
      (response) => {
        const requestId = response.config.requestId;
        
        // Log successful response in development
        if (process.env.NODE_ENV !== 'production') {
          logger.debug(`API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            requestId,
            status: response.status,
            method: response.config.method,
            url: response.config.url,
          });
        }
        
        // Add request ID to response
        response.requestId = requestId;
        
        return response;
      },
      // Error handler
      async (error) => {
        const requestId = error.config?.requestId;
        
        // Handle 401 Unauthorized
        if (error.status === 401 && !error.config?.skipAuth) {
          // Throttle auth errors to prevent spam
          const now = Date.now();
          if (now - lastAuthErrorTime < AUTH_ERROR_THROTTLE) {
            logger.debug('Suppressing duplicate auth error within throttle period');
            throw error;
          }
          lastAuthErrorTime = now;
          
          // Check if page is still loading
          const isPageLoading = window.sessionStorage.getItem('spheroseg_page_loading') === 'true';
          if (isPageLoading) {
            logger.debug('Suppressing token clearing during page load');
            throw error;
          }
          
          // Only clear tokens for legitimate auth failures
          const errorMessage = (error.data?.message || '').toLowerCase();
          const shouldClearTokens = 
            errorMessage.includes('token') ||
            errorMessage.includes('expired') ||
            errorMessage.includes('invalid') ||
            errorMessage.includes('unauthorized');
          
          if (shouldClearTokens) {
            logger.info('Clearing tokens due to auth error');
            removeTokens();
            
            // Dispatch auth expired event
            window.dispatchEvent(new CustomEvent('auth:expired'));
            
            if (error.config?.showErrorToast) {
              toastService.error('Your session has expired. Please sign in again.');
            }
          }
          
          throw error;
        }
        
        // Handle 403 Forbidden - check for permission errors
        if (error.status === 403) {
          if (handlePermissionError({ response: { status: 403, data: error.data } } as any)) {
            logger.debug('Permission error handled by specialized handler');
            throw error;
          }
        }
        
        // Handle 404 Not Found
        if (error.status === 404) {
          // Check if this is a polling request
          const pollingPatterns = [
            '/segmentation-results/',
            '/segmentation/status',
            '/segmentation',
            '/queue-status/',
            '/processing-status/',
          ];
          
          const isPollingRequest = pollingPatterns.some(pattern => 
            error.config?.url?.includes(pattern)
          );
          
          if (!isPollingRequest && error.config?.showErrorToast) {
            const message = error.data?.message || 'The requested resource was not found.';
            toastService.error(message);
          }
          
          throw error;
        }
        
        // Handle rate limiting (429)
        if (error.status === 429) {
          const retryAfter = error.raw?.error?.details?.retryAfter || 60;
          if (error.config?.showErrorToast) {
            toastService.error(`Rate limit exceeded. Please wait ${retryAfter} seconds.`);
          }
          throw error;
        }
        
        // Handle server errors (5xx)
        if (error.status && error.status >= 500) {
          // Don't show toast for metrics endpoints
          const isMetricsEndpoint = error.config?.url?.includes('/metrics/');
          
          if (error.config?.showErrorToast && !isMetricsEndpoint) {
            const message = error.status === 502 
              ? 'The server is temporarily unavailable. Please try again in a few moments.'
              : error.status === 503
              ? 'The service is undergoing maintenance. Please try again later.'
              : 'Server error. Please try again later.';
            toastService.error(message);
          }
          
          throw error;
        }
        
        // Handle network errors
        if (!error.status) {
          let message = 'Network error. Please check your connection.';
          
          if (error.message?.includes('timeout')) {
            message = 'Request timed out. The server may be busy, please try again.';
          } else if (!navigator.onLine) {
            message = 'Network connection lost. Please check your internet connection.';
          }
          
          if (error.config?.showErrorToast) {
            toastService.error(message);
          }
          
          throw error;
        }
        
        // Handle other errors
        if (error.config?.showErrorToast) {
          const message = this.getErrorMessage(error);
          toastService.error(message);
        }
        
        throw error;
      }
    );
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: (config: ApiRequestConfig) => ApiRequestConfig | Promise<ApiRequestConfig>) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(
    onFulfilled?: (response: ApiResponse) => ApiResponse | Promise<ApiResponse>,
    onRejected?: (error: ApiError) => unknown,
  ) {
    this.responseInterceptors.push({ onFulfilled, onRejected });
  }

  /**
   * Make API request
   */
  async request<T = unknown>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    // Merge with default config
    let requestConfig: ApiRequestConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      headers: {
        ...DEFAULT_CONFIG.headers,
        ...config.headers,
      },
    };

    // Build URL with params
    const url = this.buildUrl(config.url || '', config.params);
    const method = config.method || 'GET';
    
    // Check for deduplication (only for GET requests)
    if (method === 'GET' && config.deduplicate !== false) {
      const requestKey = getRequestKey(method, url, config.params);
      const existingRequest = ongoingRequests.get(requestKey);
      
      if (existingRequest) {
        logger.debug('Deduplicating request', { requestKey, url });
        return existingRequest as Promise<ApiResponse<T>>;
      }
    }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      requestConfig = await interceptor(requestConfig);
    }

    // Create abort controller for timeout and cancellation
    const abortController = config.cancelToken || new AbortController();
    const timeoutId = requestConfig.timeout 
      ? setTimeout(() => abortController.abort(), requestConfig.timeout) 
      : undefined;

    // Prepare request body
    const body = this.prepareBody(config.data, requestConfig.headers);

    // Track active request
    const requestKey = `${method} ${url}`;
    this.activeRequests.set(requestKey, abortController);
    
    // Create the request promise
    const requestPromise = (async () => {
      try {
        // Make request
        const response = await fetch(url, {
          ...requestConfig,
          body,
          signal: abortController.signal,
        });

        // Clear timeout
        if (timeoutId) clearTimeout(timeoutId);

        // Parse response
        const responseData = await this.parseResponse<T>(response);

        // Check if response is an error
        if (!responseData.success) {
          const errorResponse = responseData as ApiErrorResponse;
          throw this.createError(
            response.status,
            errorResponse,
            requestConfig
          );
        }

        // Create API response
        let apiResponse: ApiResponse<T> = {
          data: responseData.data,
          status: response.status,
          headers: response.headers,
          config: requestConfig,
          raw: responseData,
          requestId: requestConfig.requestId,
        };

        // Apply response interceptors
        for (const { onFulfilled } of this.responseInterceptors) {
          if (onFulfilled) {
            apiResponse = await onFulfilled(apiResponse);
          }
        }

        return apiResponse;
      } catch (error) {
        // Clear timeout
        if (timeoutId) clearTimeout(timeoutId);

        // Handle abort
        if (error instanceof Error && error.name === 'AbortError') {
          throw this.createError(0, 'Request cancelled', requestConfig);
        }

        // Create API error
        const apiError = this.normalizeError(error, requestConfig);

        // Apply error interceptors
        for (const { onRejected } of this.responseInterceptors) {
          if (onRejected) {
            try {
              const result = await onRejected(apiError);
              return result as ApiResponse<T>;
            } catch (_interceptorError) {
              // Continue with original error if interceptor fails
            }
          }
        }

        // Retry logic with exponential backoff
        const retryCount = config.retryCount || 0;
        if (retryCount > 0 && this.shouldRetry(apiError)) {
          // Calculate exponential backoff delay
          const attemptNumber = (config.retryCount || 3) - retryCount + 1;
          const delay = Math.min(
            RETRY_DELAY * Math.pow(2, attemptNumber - 1),
            MAX_RETRY_DELAY
          );
          
          logger.info(`Retrying request (attempt ${attemptNumber})`, {
            url,
            delay,
            status: apiError.status,
            requestId: requestConfig.requestId,
          });
          
          await new Promise((resolve) => setTimeout(resolve, delay));

          return this.request({
            ...config,
            retryCount: retryCount - 1,
          });
        }

        throw apiError;
      } finally {
        // Clean up active request
        this.activeRequests.delete(requestKey);
      }
    })();

    // Store request promise for deduplication
    if (method === 'GET' && config.deduplicate !== false) {
      const dedupKey = getRequestKey(method, url, config.params);
      ongoingRequests.set(dedupKey, requestPromise);
      
      // Clean up after request completes
      requestPromise.finally(() => {
        ongoingRequests.delete(dedupKey);
      });
    }

    return requestPromise;
  }

  /**
   * GET request
   */
  get<T = unknown>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'GET',
      url,
    });
  }

  /**
   * POST request
   */
  post<T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'POST',
      url,
      data,
    });
  }

  /**
   * PUT request
   */
  put<T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'PUT',
      url,
      data,
    });
  }

  /**
   * PATCH request
   */
  patch<T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'PATCH',
      url,
      data,
    });
  }

  /**
   * DELETE request
   */
  delete<T = unknown>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'DELETE',
      url,
    });
  }

  /**
   * Upload file with progress
   */
  async upload<T = unknown>(url: string, file: File | FormData, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    const formData = file instanceof FormData ? file : new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    }

    // Remove Content-Type header to let browser set it with boundary
    const headers = { ...config?.headers };
    delete headers['Content-Type'];

    return this.request<T>({
      ...config,
      method: 'POST',
      url,
      data: formData,
      headers,
    });
  }

  /**
   * Cancel request
   */
  cancel(url: string, method = 'GET') {
    const requestKey = `${method} ${this.buildUrl(url)}`;
    const controller = this.activeRequests.get(requestKey);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestKey);
    }
  }

  /**
   * Cancel all active requests
   */
  cancelAll() {
    this.activeRequests.forEach((controller) => controller.abort());
    this.activeRequests.clear();
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, unknown>): string {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return `${url}?${searchParams.toString()}`;
  }

  /**
   * Prepare request body
   */
  private prepareBody(data: unknown, headers: Record<string, string>): BodyInit | undefined {
    if (!data) return undefined;

    // FormData should be sent as-is
    if (data instanceof FormData) return data;

    // JSON stringify for JSON content type
    if (headers['Content-Type']?.includes('application/json')) {
      return JSON.stringify(data);
    }

    return data;
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<ApiResult<T>> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      // Check if response follows standardized format
      if ('success' in data && 'data' in data) {
        return data as ApiResult<T>;
      }
      // Wrap legacy responses in standardized format
      if (response.ok) {
        return {
          success: true,
          data: data as T,
          metadata: {
            timestamp: new Date().toISOString()
          }
        } as SharedApiResponse<T>;
      } else {
        return {
          success: false,
          data: null,
          message: data.message || 'An error occurred',
          error: {
            code: data.code || 'UNKNOWN_ERROR',
            message: data.message || 'An error occurred',
            details: data
          },
          metadata: {
            timestamp: new Date().toISOString()
          }
        } as ApiErrorResponse;
      }
    } else if (contentType?.includes('text/')) {
      const text = await response.text();
      return {
        success: true,
        data: text as T,
        metadata: {
          timestamp: new Date().toISOString()
        }
      } as SharedApiResponse<T>;
    } else if (response.status === 204) {
      return {
        success: true,
        data: null as T,
        metadata: {
          timestamp: new Date().toISOString()
        }
      } as SharedApiResponse<T>;
    } else {
      const blob = await response.blob();
      return {
        success: true,
        data: blob as T,
        metadata: {
          timestamp: new Date().toISOString()
        }
      } as SharedApiResponse<T>;
    }
  }

  /**
   * Create API error
   */
  private createError(status: number, data: unknown, config: ApiRequestConfig): ApiError {
    // Handle standardized error response
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      const errorResponse = data as ApiErrorResponse;
      return {
        message: errorResponse.message || this.getErrorMessage({ status }),
        code: errorResponse.error?.code,
        status,
        data: errorResponse.errors || errorResponse.error?.details,
        config,
        raw: errorResponse,
      };
    }

    // Handle legacy error format
    return {
      message: this.getErrorMessage({ status, data }),
      status,
      data,
      config,
    };
  }

  /**
   * Normalize error to ApiError format
   */
  private normalizeError(error: unknown, config: ApiRequestConfig): ApiError {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ApiError;
    }

    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return {
      message: errorMessage,
      status: 0,
      data: error,
      config,
    };
  }

  /**
   * Refresh authentication token
   */
  private async refreshToken(): Promise<void> {
    // This is a placeholder - in a real implementation, this would call the refresh endpoint
    // For now, we'll just throw an error to trigger logout
    throw new Error('Token refresh not implemented');
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: ApiError | { status?: number; data?: unknown }): string {
    // Check for standardized error response
    if (error.data && typeof error.data === 'object') {
      if ('message' in error.data && typeof error.data.message === 'string') {
        return error.data.message;
      }
    }

    if (typeof error.data === 'string') {
      return error.data;
    }

    // Status code messages
    switch (error.status) {
      case 400:
        return 'Bad request. Please check your input.';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return "Access forbidden. You don't have permission.";
      case 404:
        return 'Resource not found.';
      case 409:
        return 'Conflict. The resource already exists.';
      case 422:
        return 'Validation failed. Please check your input.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service unavailable. Please try again later.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(error: ApiError): boolean {
    return RETRY_STATUS_CODES.includes(error.status || 0);
  }

}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Create a specialized upload client with longer timeouts
export const uploadClient = {
  post<T = unknown>(url: string, data: FormData, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return apiClient.post<T>(url, data, {
      ...config,
      timeout: 300000, // 5 minutes for uploads
      retryCount: 2, // Retry uploads up to 2 times
    });
  },
  
  put<T = unknown>(url: string, data: FormData, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return apiClient.put<T>(url, data, {
      ...config,
      timeout: 300000, // 5 minutes for uploads
      retryCount: 2, // Retry uploads up to 2 times
    });
  },
};

// Export types
export type { ApiClient };
export { isApiSuccess, isApiError } from '@spheroseg/shared';
export default apiClient;
