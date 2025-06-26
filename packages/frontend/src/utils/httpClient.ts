/**
 * Centralized HTTP client for making requests
 * This file provides a unified way to make HTTP requests with consistent
 * caching, error handling, logging, and token refresh.
 */

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { toast } from 'sonner';
import logger from '@/utils/logger';
import setupAuthInterceptors from './authInterceptor';

// Define API base URL
// When using a local server directly without proxy, use the full URL
// When the Vite dev server is running, it will proxy requests to the backend
// In Docker, we need to use the proxy path to ensure proper routing
const API_BASE_URL = '/api';
console.log('[httpClient] Using API_BASE_URL:', API_BASE_URL, '(Proxied through frontend)');

// Default configuration for all requests
const defaultConfig: AxiosRequestConfig = {
  timeout: 30000, // 30 seconds for most requests
  headers: {
    'Content-Type': 'application/json',
  },
  baseURL: API_BASE_URL, // Use relative path to work with the proxy
};

// Create axios instance with default configuration
const axiosInstance = axios.create(defaultConfig);

// Setup auth interceptors for token refresh
setupAuthInterceptors(axiosInstance);

// Add request interceptor for logging and cache-busting
axiosInstance.interceptors.request.use(
  (config) => {
    // Fix for URLs
    if (config.url && config.url.startsWith('/api') && config.baseURL?.includes('/api')) {
      // Avoid double /api prefix
      config.url = config.url.substring(4); // Remove /api
      logger.debug('Removed duplicate /api prefix from URL', {
        originalUrl: '/api' + config.url,
        fixedUrl: config.url,
      });
    }

    // Add cache-busting parameter to GET requests
    if (config.method?.toLowerCase() === 'get') {
      const cacheBuster = `_cb=${Date.now()}`;

      // Add cache-busting to URL
      config.url = config.url?.includes('?') ? `${config.url}&${cacheBuster}` : `${config.url}?${cacheBuster}`;

      // Add cache control headers
      if (config.headers) {
        config.headers['Cache-Control'] = 'no-cache';
        config.headers['Pragma'] = 'no-cache';
      }
    }

    // Add CSRF token from cookies for non-GET requests
    if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
      const csrfToken = getCookieValue('XSRF-TOKEN');
      if (csrfToken && config.headers) {
        config.headers['X-XSRF-TOKEN'] = csrfToken;
      }
    }

    // Authorization is now handled by the authInterceptor

    // Log request
    logger.debug(`HTTP ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
      headers: config.headers,
      params: config.params,
      data: config.data,
    });

    return config;
  },
  (error) => {
    logger.error('Request error:', { error });
    return Promise.reject(error);
  },
);

// Add response interceptor for logging and error handling
axiosInstance.interceptors.response.use(
  (response) => {
    // Log successful response
    logger.debug(`HTTP ${response.status} ${response.config.url}`, {
      data: response.data,
    });

    return response;
  },
  (error: AxiosError) => {
    // Log error response
    logger.error(`HTTP Error ${error.response?.status || 'unknown'} ${error.config?.url}`, {
      error,
      response: error.response?.data,
    });

    return Promise.reject(error);
  },
);

/**
 * Makes a GET request with cache-busting
 * @param url URL to request
 * @param config Optional axios config
 * @returns Promise resolving to response
 */
export const get = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return axiosInstance.get<T>(url, config);
};

/**
 * Makes a POST request
 * @param url URL to request
 * @param data Data to send
 * @param config Optional axios config
 * @returns Promise resolving to response
 */
export const post = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  return axiosInstance.post<T>(url, data, config);
};

/**
 * Makes a PUT request
 * @param url URL to request
 * @param data Data to send
 * @param config Optional axios config
 * @returns Promise resolving to response
 */
export const put = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return axiosInstance.put<T>(url, data, config);
};

/**
 * Makes a DELETE request
 * @param url URL to request
 * @param config Optional axios config
 * @returns Promise resolving to response
 */
export const del = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return axiosInstance.delete<T>(url, config);
};

/**
 * Makes a PATCH request
 * @param url URL to request
 * @param data Data to send
 * @param config Optional axios config
 * @returns Promise resolving to response
 */
export const patch = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  return axiosInstance.patch<T>(url, data, config);
};

/**
 * Fetches a file and returns it as a blob
 * @param url URL to fetch
 * @param config Optional axios config
 * @returns Promise resolving to blob
 */
export const fetchBlob = async (url: string, config?: AxiosRequestConfig): Promise<Blob> => {
  const response = await axiosInstance.get(url, {
    ...config,
    responseType: 'blob',
  });

  return response.data;
};

/**
 * Fetches a file and returns it as an array buffer
 * @param url URL to fetch
 * @param config Optional axios config
 * @returns Promise resolving to array buffer
 */
export const fetchArrayBuffer = async (url: string, config?: AxiosRequestConfig): Promise<ArrayBuffer> => {
  const response = await axiosInstance.get(url, {
    ...config,
    responseType: 'arraybuffer',
  });

  return response.data;
};

/**
 * Fetches a file and returns it as a data URL
 * @param url URL to fetch
 * @param config Optional axios config
 * @returns Promise resolving to data URL
 */
export const fetchDataUrl = async (url: string, config?: AxiosRequestConfig): Promise<string | null> => {
  try {
    const blob = await fetchBlob(url, config);
    return URL.createObjectURL(blob);
  } catch (error) {
    logger.error('Error fetching data URL:', { error, url });
    return null;
  }
};

/**
 * Checks if a file exists at the given URL
 * @param url URL to check
 * @param config Optional axios config
 * @returns Promise resolving to true if file exists, false otherwise
 */
export const checkFileExists = async (url: string, config?: AxiosRequestConfig): Promise<boolean> => {
  try {
    const response = await axiosInstance.head(url, config);
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * Helper function to get cookie value by name
 * @param name Cookie name
 * @returns Cookie value or null if not found
 */
const getCookieValue = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
};

/**
 * Makes a request with automatic retry
 * @param requestFn Function that makes the request
 * @param retries Number of retries
 * @param delay Delay between retries in milliseconds
 * @returns Promise resolving to response
 */
export const withRetry = async <T>(
  requestFn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
): Promise<T> => {
  try {
    return await requestFn();
  } catch (error: any) {
    if (retries <= 0) {
      throw error;
    }

    // Don't retry for client errors (4xx) - these are usually not transient
    if (error?.response?.status >= 400 && error?.response?.status < 500) {
      // Special handling for specific client errors that should not be retried
      if (error?.response?.status === 409) {
        logger.warn('User already exists, not retrying', { email: error?.config?.data ? JSON.parse(error.config.data)?.email : 'unknown' });
      }
      throw error;
    }

    logger.warn(`Request failed, retrying in ${delay}ms (${retries} retries left)`, { error });

    // Wait for the specified delay
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Retry with exponential backoff
    return withRetry(requestFn, retries - 1, delay * 2);
  }
};

/**
 * Makes multiple requests in parallel with a concurrency limit
 * @param requests Array of request functions
 * @param concurrency Maximum number of concurrent requests
 * @param onProgress Callback for progress updates
 * @returns Promise resolving to array of results
 */
export const batchRequests = async <T>(
  requests: (() => Promise<T>)[],
  concurrency: number = 3,
  onProgress?: (completed: number, total: number) => void,
): Promise<T[]> => {
  const results: T[] = [];
  let completed = 0;
  const total = requests.length;

  // Process requests in batches
  for (let i = 0; i < total; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (request) => {
        const result = await request();
        completed++;

        if (onProgress) {
          onProgress(completed, total);
        }

        return result;
      }),
    );

    results.push(...batchResults);
  }

  return results;
};

// Export default object with all methods
export default {
  get,
  post,
  put,
  del,
  patch,
  fetchBlob,
  fetchArrayBuffer,
  fetchDataUrl,
  checkFileExists,
  withRetry,
  batchRequests,
  axios: axiosInstance,
};
