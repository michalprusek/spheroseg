import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { handleError, ErrorType, ErrorSeverity } from '@/utils/errorHandling';
import logger from '@/utils/logger';
import { getAccessToken, removeTokens, isValidToken } from '@/services/authService';

// Create a separate axios instance specifically for file uploads
// This avoids conflicts with default headers set for JSON requests
const uploadClient: AxiosInstance = axios.create({
  baseURL: '', // Use empty base URL
  timeout: 300000, // 5 minutes timeout for large file uploads
  // Don't set any default headers - let axios handle them
  withCredentials: true,
});

// Request interceptor - similar to apiClient but optimized for uploads
uploadClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from authService
    const token = getAccessToken(true, true);

    // Add authorization header
    if (token && isValidToken(token, false)) {
      config.headers.Authorization = `Bearer ${token}`;
      logger.info('Upload client: Added Authorization header', {
        url: config.url,
        method: config.method,
        hasFormData: config.data instanceof FormData,
      });
    } else {
      logger.warn('Upload client: No valid token available');
    }

    // Add request ID for tracking
    const requestId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    config.headers['X-Request-ID'] = requestId;

    // Fix URL path to ensure it starts with /api
    if (config.url && !config.url.startsWith('/api') && !config.url.startsWith('http')) {
      config.url = `/api${config.url.startsWith('/') ? '' : '/'}${config.url}`;
    }

    logger.debug(`Upload Request: ${config.method?.toUpperCase()} ${config.url}`, {
      requestId,
      headers: Object.keys(config.headers),
      hasAuth: !!config.headers.Authorization,
    });

    return config;
  },
  (error: AxiosError) => {
    logger.error('Upload request setup error', error);
    return Promise.reject(error);
  },
);

// Response interceptor - handle auth errors same as apiClient
uploadClient.interceptors.response.use(
  (response: AxiosResponse) => {
    logger.debug(`Upload Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();

    logger.error(`Upload Error: ${status || 'Network Error'} ${method} ${url}`, {
      message: error.message,
      responseData: error.response?.data,
    });

    // Handle authentication errors
    if (status === 401) {
      const errorMessage = (error.response?.data as any)?.message?.toLowerCase() || '';

      logger.warn('Upload: Unauthorized access detected', {
        url,
        method,
        errorMessage,
      });

      // Only clear tokens for actual auth failures
      if (
        errorMessage.includes('token') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('unauthorized')
      ) {
        logger.info('Upload: Clearing tokens due to auth error');
        removeTokens();

        handleError(error, {
          context: `Upload ${method} ${url}`,
          errorInfo: {
            type: ErrorType.AUTHENTICATION,
            severity: ErrorSeverity.WARNING,
            message: 'Your session has expired. Please sign in again.',
          },
          showToast: true,
        });

        // Dispatch auth expired event
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }

    return Promise.reject(error);
  },
);

export default uploadClient;
