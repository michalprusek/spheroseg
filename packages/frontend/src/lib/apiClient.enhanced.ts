/**
 * Enhanced API Client with Structured Error Handling
 * 
 * Features:
 * - Structured error code handling
 * - Automatic retry with exponential backoff
 * - Request/response correlation
 * - Enhanced error context
 * - Network error detection
 */

import axios, { 
  AxiosInstance, 
  InternalAxiosRequestConfig, 
  AxiosResponse, 
  AxiosError,
  AxiosHeaders 
} from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { 
  ERROR_CODES, 
  ErrorResponse, 
  getErrorMessage, 
  requiresReauth 
} from '@/utils/error/structuredErrors';
import { ToastService } from '@/services/ui/unifiedToastService';
import logger from '@/utils/logger';
import { getAccessToken, removeTokens } from '@/services/authService';

// Configuration
const config = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: {
    default: 10000,
    auth: 15000,
    upload: 60000,
  },
  retry: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    maxBackoff: 10000,
  },
};

// Retry configuration per error type
const RETRYABLE_ERROR_CODES = new Set([
  ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE,
  ERROR_CODES.EXTERNAL_ML_SERVICE_ERROR,
  ERROR_CODES.EXTERNAL_DATABASE_ERROR,
  ERROR_CODES.SYSTEM_INTERNAL_ERROR,
]);

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

// Track ongoing requests for deduplication
const ongoingRequests = new Map<string, Promise<any>>();

/**
 * Generate request key for deduplication
 */
function getRequestKey(config: InternalAxiosRequestConfig): string {
  const method = config.method?.toUpperCase() || 'GET';
  const url = config.url || '';
  const params = JSON.stringify(config.params || {});
  return `${method}:${url}:${params}`;
}

/**
 * Enhanced API client instance
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout.default,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/**
 * Request interceptor
 */
apiClient.interceptors.request.use(
  (requestConfig: InternalAxiosRequestConfig) => {
    // Generate request ID
    const requestId = uuidv4();
    requestConfig.headers = requestConfig.headers || new AxiosHeaders();
    requestConfig.headers.set('X-Request-ID', requestId);
    
    // Store request ID in config for response correlation
    (requestConfig as any).requestId = requestId;
    
    // Set appropriate timeout
    if (requestConfig.url?.includes('/auth/')) {
      requestConfig.timeout = config.timeout.auth;
    } else if (requestConfig.data instanceof FormData) {
      requestConfig.timeout = config.timeout.upload;
      // Remove Content-Type for FormData
      requestConfig.headers.delete('Content-Type');
    }
    
    // Add authentication token
    const token = getAccessToken(true, true);
    if (token) {
      requestConfig.headers.set('Authorization', `Bearer ${token}`);
    }
    
    // Log request
    logger.debug('API Request', {
      requestId,
      method: requestConfig.method,
      url: requestConfig.url,
      params: requestConfig.params,
    });
    
    return requestConfig;
  },
  (error) => {
    logger.error('Request interceptor error', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const requestId = (response.config as any).requestId;
    
    logger.debug('API Response', {
      requestId,
      status: response.status,
      url: response.config.url,
    });
    
    return response;
  },
  async (error: AxiosError<ErrorResponse>) => {
    const requestId = (error.config as any)?.requestId;
    
    // Handle network errors
    if (!error.response) {
      const networkError: ErrorResponse = {
        success: false,
        error: {
          code: ERROR_CODES.NETWORK_OFFLINE,
          message: 'Network error. Please check your connection.',
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
      
      if (error.code === 'ECONNABORTED') {
        networkError.error.code = ERROR_CODES.NETWORK_TIMEOUT;
        networkError.error.message = 'Request timed out. Please try again.';
      }
      
      logger.error('Network error', {
        requestId,
        code: networkError.error.code,
        message: error.message,
      });
      
      return Promise.reject(networkError);
    }
    
    // Extract error response
    const errorResponse = error.response.data as ErrorResponse;
    
    // Log error
    logger.warn('API Error', {
      requestId,
      status: error.response.status,
      code: errorResponse?.error?.code,
      message: errorResponse?.error?.message,
      url: error.config?.url,
    });
    
    // Handle authentication errors
    if (requiresReauth(errorResponse)) {
      removeTokens();
      window.location.href = '/signin';
      return Promise.reject(errorResponse);
    }
    
    // Handle rate limiting with retry
    if (errorResponse?.error?.code === ERROR_CODES.SYSTEM_RATE_LIMIT_EXCEEDED) {
      const retryAfter = error.response.headers['retry-after'];
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
      
      ToastService.error(`Rate limit exceeded. Please wait ${Math.ceil(delay / 1000)} seconds.`);
      
      return Promise.reject(errorResponse);
    }
    
    // Retry logic for transient errors
    const shouldRetry = 
      RETRYABLE_ERROR_CODES.has(errorResponse?.error?.code as any) ||
      RETRYABLE_STATUS_CODES.has(error.response.status);
    
    const retryCount = (error.config as any).retryCount || 0;
    
    if (shouldRetry && retryCount < config.retry.maxAttempts && error.config) {
      const backoffDelay = Math.min(
        config.retry.backoffMultiplier ** retryCount * 1000,
        config.retry.maxBackoff
      );
      
      logger.info('Retrying request', {
        requestId,
        retryCount: retryCount + 1,
        delay: backoffDelay,
        url: error.config.url,
      });
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      // Update retry count
      (error.config as any).retryCount = retryCount + 1;
      
      // Retry the request
      return apiClient.request(error.config);
    }
    
    // Show user-friendly error message
    const errorMessage = getErrorMessage(errorResponse?.error?.code || '');
    ToastService.error(errorMessage.message);
    
    return Promise.reject(errorResponse || error);
  }
);

/**
 * Request deduplication wrapper
 */
function withDeduplication<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const existing = ongoingRequests.get(key);
  if (existing) {
    logger.debug('Deduplicating request', { key });
    return existing;
  }
  
  const promise = requestFn()
    .finally(() => {
      ongoingRequests.delete(key);
    });
  
  ongoingRequests.set(key, promise);
  return promise;
}

/**
 * Enhanced API methods with deduplication
 */
export const enhancedApiClient = {
  get<T = any>(url: string, config?: InternalAxiosRequestConfig): Promise<AxiosResponse<T>> {
    const requestConfig = { ...config, method: 'GET', url };
    const key = getRequestKey(requestConfig);
    
    return withDeduplication(key, () => apiClient.get<T>(url, config));
  },
  
  post<T = any>(url: string, data?: any, config?: InternalAxiosRequestConfig): Promise<AxiosResponse<T>> {
    return apiClient.post<T>(url, data, config);
  },
  
  put<T = any>(url: string, data?: any, config?: InternalAxiosRequestConfig): Promise<AxiosResponse<T>> {
    return apiClient.put<T>(url, data, config);
  },
  
  patch<T = any>(url: string, data?: any, config?: InternalAxiosRequestConfig): Promise<AxiosResponse<T>> {
    return apiClient.patch<T>(url, data, config);
  },
  
  delete<T = any>(url: string, config?: InternalAxiosRequestConfig): Promise<AxiosResponse<T>> {
    return apiClient.delete<T>(url, config);
  },
  
  // Original instance for custom configurations
  instance: apiClient,
};

export default enhancedApiClient;