import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { handleError, ErrorType, ErrorSeverity } from '@/utils/errorHandling';
import logger from '@/utils/logger';
import { getAccessToken, removeTokens, isValidToken } from '@/services/authService';

import config from '@/config';

// Determine the base URL for the API
// When running in Docker with a proxy, we need to be careful with URL construction
// We'll use the environment variable if available, otherwise default to '/api'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// For Docker environment, we'll use an empty baseURL and handle prefixing in the interceptor
// This avoids issues with double prefixing when the proxy is already adding /api
const DOCKER_ENV = import.meta.env.VITE_DOCKER_ENV === 'true'; // Read from environment variable

// In Docker, we want to use the empty base URL to avoid double prefixing
// For local development, we want to use the API_BASE_URL
const EFFECTIVE_BASE_URL = '';

// Log the API base URL to help with debugging
console.log('[apiClient] Environment:', import.meta.env.MODE);
console.log('[apiClient] API_BASE_URL from env:', import.meta.env.VITE_API_BASE_URL);
console.log('[apiClient] Configured API_BASE_URL:', API_BASE_URL);
console.log('[apiClient] EFFECTIVE_BASE_URL:', EFFECTIVE_BASE_URL);
console.log('[apiClient] Config from config.ts:', {
  apiUrl: config.apiUrl,
  apiBaseUrl: config.apiBaseUrl,
});

// Create an Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: EFFECTIVE_BASE_URL, // Use the effective base URL that handles Docker environment
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
  // Add withCredentials for CORS requests with cookies
  withCredentials: true,
});

// --- Request Interceptor ---
// Add authorization token to headers if available
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Check if the request data is FormData
    const isFormData = config.data instanceof FormData;
    
    // If it's FormData, remove the default Content-Type header
    // to let axios set it with the proper boundary
    if (isFormData) {
      if (config.headers['Content-Type']) {
        delete config.headers['Content-Type'];
        logger.debug('Removed Content-Type header for FormData request');
      }
      
      // Log FormData details for debugging
      const formDataInfo: any = {};
      if (config.data instanceof FormData) {
        const entries = Array.from(config.data.entries());
        formDataInfo.fields = entries.length;
        formDataInfo.files = entries.filter(([key, value]) => value instanceof File).length;
      }
      
      logger.debug('Processing FormData request', {
        url: config.url,
        method: config.method,
        formDataInfo,
        headers: Object.keys(config.headers)
      });
    }
    
    // Get token from authService with validation and auto-removal if invalid
    const token = getAccessToken(true, true);

    // Only add token if it exists and is valid (validation already happened in getAccessToken)
    if (token && isValidToken(token, false)) {
      config.headers.Authorization = `Bearer ${token}`;
      logger.debug('Added Authorization header with valid token', {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...',
        headerValue: config.headers.Authorization?.substring(0, 30) + '...'
      });
      
      // Extra logging for FormData requests
      if (isFormData) {
        logger.info('Authorization header set for FormData request', {
          url: config.url,
          authHeaderLength: config.headers.Authorization?.length,
          authHeaderPrefix: config.headers.Authorization?.substring(0, 20) + '...'
        });
      }
    } else if (token) {
      // If token exists but is invalid, remove it
      logger.warn('Token exists but is invalid, removing from storage');
      removeTokens();
    }

    // Add request ID for tracking
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    config.headers['X-Request-ID'] = requestId;

    // Fix URL path to ensure it starts with /api when in Docker environment
    // This is needed because we're using an empty baseURL to avoid double prefixing
    if (config.url) {
      // Only add /api prefix if it's not already there and not an absolute URL
      if (!config.url.startsWith('/api') && !config.url.startsWith('http')) {
        const originalUrl = config.url;
        config.url = `/api${config.url.startsWith('/') ? '' : '/'}${config.url}`;
        logger.debug('Fixed API URL path to include /api prefix', {
          originalUrl,
          fixedUrl: config.url,
        });
      }

      // Handle case where URL has double /api prefix
      if (config.url.startsWith('/api/api/')) {
        const originalUrl = config.url;
        config.url = config.url.replace('/api/api/', '/api/');
        logger.debug('Removed duplicate /api prefix', {
          originalUrl,
          fixedUrl: config.url,
        });
      }

      // Add cache buster to GET requests to avoid browser caching
      if (config.method?.toLowerCase() === 'get' && !config.url.includes('_cb=')) {
        const cacheBuster = `_cb=${Date.now()}`;
        config.url = config.url.includes('?') ? `${config.url}&${cacheBuster}` : `${config.url}?${cacheBuster}`;
        logger.debug('Added cache buster to GET request', {
          url: config.url,
        });
      }
    }

    // Log outgoing requests in development
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        requestId,
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
        hasToken: !!token,
        // Don't log request body for security reasons
      });
    }

    return config;
  },
  (error: AxiosError) => {
    // Handle request setup errors
    handleError(error, {
      context: 'API Request Setup',
      errorInfo: {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.ERROR,
        message: 'Failed to set up API request',
      },
      showToast: false, // Don't show toast for request setup errors
    });

    return Promise.reject(error);
  },
);

// --- Response Interceptor ---
// Handle common responses or errors globally if needed
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log successful responses in development
    if (process.env.NODE_ENV !== 'production') {
      const requestId = response.config.headers?.['X-Request-ID'];
      logger.debug(`API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        requestId,
        status: response.status,
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        // Don't log response data for security reasons
      });
    }

    return response;
  },
  (error: AxiosError) => {
    // Extract request details for logging
    const requestId = error.config?.headers?.['X-Request-ID'] as string;
    const method = error.config?.method?.toUpperCase();
    const url = error.config?.url;
    const status = error.response?.status;

    // Log the error
    logger.error(`API Error: ${status || 'Network Error'} ${method} ${url}`, {
      requestId,
      status,
      method,
      url,
      message: error.message,
      code: error.code,
    });

    // Handle authentication errors
    if (status === 401) {
      // Check if we already handled an auth error recently to prevent spam
      const lastAuthError = window.sessionStorage.getItem('spheroseg_last_auth_error');
      const now = Date.now();
      const AUTH_ERROR_THROTTLE = 5000; // Increased to 5 seconds to reduce spam
      
      if (lastAuthError && (now - parseInt(lastAuthError)) < AUTH_ERROR_THROTTLE) {
        logger.debug('Suppressing duplicate auth error within throttle period');
        return Promise.reject(error);
      }
      
      // Update last auth error timestamp
      window.sessionStorage.setItem('spheroseg_last_auth_error', now.toString());
      
      logger.warn('Unauthorized access detected', {
        url,
        method,
        status,
        message: error.response?.data?.message || error.message
      });

      // Check if page is still loading - don't clear tokens during initial load
      const isPageLoading = window.sessionStorage.getItem('spheroseg_page_loading') === 'true';
      if (isPageLoading) {
        logger.debug('Suppressing token clearing during page load');
        return Promise.reject(error);
      }

      // Only clear tokens if this is a legitimate auth failure
      // Don't clear tokens for malformed requests or other 401 scenarios
      const errorMessage = error.response?.data?.message?.toLowerCase() || '';
      const shouldClearTokens = errorMessage.includes('token') || 
                               errorMessage.includes('expired') || 
                               errorMessage.includes('invalid') ||
                               errorMessage.includes('unauthorized');

      if (shouldClearTokens) {
        logger.info('Clearing tokens due to auth error');
        removeTokens();

        // Handle the error with our error handling system
        handleError(error, {
          context: `API ${method} ${url}`,
          errorInfo: {
            type: ErrorType.AUTHENTICATION,
            severity: ErrorSeverity.WARNING,
            message: 'Your session has expired. Please sign in again.',
          },
          // Only show toast for legitimate auth errors
          showToast: true,
        });

        // Check if we're in page loading phase
        const isPageLoading = window.sessionStorage.getItem('spheroseg_page_loading') === 'true';

        if (!isPageLoading) {
          // Dispatch auth expired event
          window.dispatchEvent(new CustomEvent('auth:expired'));
          logger.info('Auth expired event dispatched');
        } else {
          logger.info('Suppressing auth:expired event during page load');
        }
      } else {
        // For other 401 errors (like missing permissions), don't clear tokens
        logger.info('401 error but not clearing tokens (not a token issue)');
        handleError(error, {
          context: `API ${method} ${url}`,
          errorInfo: {
            type: ErrorType.AUTHORIZATION,
            severity: ErrorSeverity.WARNING,
            message: error.response?.data?.message || 'Access denied',
          },
          showToast: false, // Don't show toast for permission errors
        });
      }

      return Promise.reject(error);
    }

    // Handle forbidden errors
    if (status === 403) {
      handleError(error, {
        context: `API ${method} ${url}`,
        errorInfo: {
          type: ErrorType.AUTHORIZATION,
          severity: ErrorSeverity.WARNING,
          message: 'You do not have permission to perform this action.',
        },
        // Show toast for auth errors
        showToast: true,
      });

      return Promise.reject(error);
    }

    // Handle not found errors
    if (status === 404) {
      handleError(error, {
        context: `API ${method} ${url}`,
        errorInfo: {
          type: ErrorType.NOT_FOUND,
          severity: ErrorSeverity.WARNING,
          message: 'The requested resource was not found.',
        },
        // Don't show toast for 404 errors by default
        showToast: false,
      });

      return Promise.reject(error);
    }

    // Handle server errors
    if (status && status >= 500) {
      handleError(error, {
        context: `API ${method} ${url}`,
        errorInfo: {
          type: ErrorType.SERVER,
          severity: ErrorSeverity.ERROR,
          message: 'Server error. Please try again later.',
        },
        // Show toast for server errors
        showToast: true,
      });

      return Promise.reject(error);
    }

    // Handle network errors
    if (!status) {
      handleError(error, {
        context: `API ${method} ${url}`,
        errorInfo: {
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.ERROR,
          message: 'Network error. Please check your connection.',
        },
        // Show toast for network errors
        showToast: true,
      });

      return Promise.reject(error);
    }

    // Handle all other errors
    handleError(error, {
      context: `API ${method} ${url}`,
      errorInfo: {
        type: ErrorType.API,
        severity: ErrorSeverity.ERROR,
      },
      // Don't show toast for other errors by default
      showToast: false,
    });

    // Return the error to be handled by the calling function
    return Promise.reject(error);
  },
);

export default apiClient;
