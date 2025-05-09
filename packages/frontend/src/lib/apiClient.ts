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
const EFFECTIVE_BASE_URL = DOCKER_ENV ? '' : API_BASE_URL;

// Log the API base URL to help with debugging
console.log('[apiClient] Environment:', import.meta.env.MODE);
console.log('[apiClient] API_BASE_URL from env:', import.meta.env.VITE_API_BASE_URL);
console.log('[apiClient] Configured API_BASE_URL:', API_BASE_URL);
console.log('[apiClient] EFFECTIVE_BASE_URL:', EFFECTIVE_BASE_URL);
console.log('[apiClient] Config from config.ts:', {
  apiUrl: config.apiUrl,
  apiBaseUrl: config.apiBaseUrl
});

// Create an Axios instance
const apiClient: AxiosInstance = axios.create({
    baseURL: EFFECTIVE_BASE_URL, // Use the effective base URL that handles Docker environment
    timeout: 30000, // Increased timeout to 30 seconds for larger image operations
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
        // Get token from authService with validation and auto-removal if invalid
        const token = getAccessToken(true, true);

        // Only add token if it exists (validation already happened in getAccessToken)
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        config.headers['X-Request-ID'] = requestId;

        // Fix URL path to ensure it starts with /api when in Docker environment
        // This is needed because we're using an empty baseURL to avoid double prefixing
        if (DOCKER_ENV && config.url) {
            // Only add /api prefix if it's not already there and not an absolute URL
            if (!config.url.startsWith('/api') && !config.url.startsWith('http')) {
                const originalUrl = config.url;
                config.url = `/api${config.url.startsWith('/') ? '' : '/'}${config.url}`;
                logger.debug('Fixed API URL path to include /api prefix', {
                    originalUrl,
                    fixedUrl: config.url
                });
            }

            // Handle case where URL has double /api prefix
            if (config.url.startsWith('/api/api/')) {
                const originalUrl = config.url;
                config.url = config.url.replace('/api/api/', '/api/');
                logger.debug('Removed duplicate /api prefix', {
                    originalUrl,
                    fixedUrl: config.url
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
    }
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
            logger.warn('Unauthorized access detected. Clearing tokens.');
            // Use removeTokens from authService instead of directly removing from localStorage
            removeTokens();

            // Handle the error with our error handling system
            handleError(error, {
                context: `API ${method} ${url}`,
                errorInfo: {
                    type: ErrorType.AUTHENTICATION,
                    severity: ErrorSeverity.WARNING,
                    message: 'Your session has expired. Please sign in again.',
                },
                // Show toast for auth errors
                showToast: true,
            });

            // Dispatch auth expired event
            window.dispatchEvent(new CustomEvent('auth:expired'));

            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = '/sign-in';
            }, 1500);

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
    }
);

export default apiClient;