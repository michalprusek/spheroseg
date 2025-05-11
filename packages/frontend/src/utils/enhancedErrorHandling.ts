import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import logger from './logger';

/**
 * Enhanced error handling for network errors specific to our API
 */
interface ApiError {
  message: string;
  code?: string;
  details?: any;
  errors?: Array<{ message: string; field?: string }>;
}

/**
 * Types of network errors that can occur
 */
export enum NetworkErrorType {
  SERVER_ERROR = 'SERVER_ERROR', // 5xx errors
  NETWORK_ERROR = 'NETWORK_ERROR', // Connection issues
  AUTH_ERROR = 'AUTH_ERROR', // 401, 403 errors
  CLIENT_ERROR = 'CLIENT_ERROR', // Other 4xx errors
  VALIDATION_ERROR = 'VALIDATION_ERROR', // 400 with validation errors
  TIMEOUT_ERROR = 'TIMEOUT_ERROR', // Request timeout
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR', // 404 errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR', // Fallback
}

/**
 * Get error type based on error detail
 */
export const getErrorType = (error: unknown): NetworkErrorType => {
  if (axios.isAxiosError(error)) {
    // Handle network errors (no response)
    if (!error.response) {
      // Check for timeout
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return NetworkErrorType.TIMEOUT_ERROR;
      }
      // Other connection issues
      return NetworkErrorType.NETWORK_ERROR;
    }

    const status = error.response.status;
    const responseData = error.response.data as ApiError | undefined;

    // Handle specific status codes
    if (status >= 500) {
      return NetworkErrorType.SERVER_ERROR;
    } else if (status === 401 || status === 403) {
      return NetworkErrorType.AUTH_ERROR;
    } else if (status === 404) {
      return NetworkErrorType.NOT_FOUND_ERROR;
    } else if (status === 400) {
      // Check if it's a validation error (has validation details)
      if (responseData?.errors?.length > 0 || responseData?.details) {
        return NetworkErrorType.VALIDATION_ERROR;
      }
      return NetworkErrorType.CLIENT_ERROR;
    } else if (status >= 400) {
      return NetworkErrorType.CLIENT_ERROR;
    }
  }

  return NetworkErrorType.UNKNOWN_ERROR;
};

/**
 * Enhanced error handler that returns a specific error message
 * and takes appropriate action based on the error type
 */
export const handleApiError = (error: unknown): string => {
  let errorMessage = 'An unexpected error occurred. Please try again.';
  let errorType = NetworkErrorType.UNKNOWN_ERROR;

  if (axios.isAxiosError(error)) {
    errorType = getErrorType(error);

    if (errorType === NetworkErrorType.NETWORK_ERROR) {
      errorMessage = 'Unable to connect to the server. Please check your network connection.';
      // Log network error
      logger.error('[Network Error] Failed to connect to server', { error });
    } else if (errorType === NetworkErrorType.TIMEOUT_ERROR) {
      errorMessage = 'The request timed out. Please check your network connection and try again.';
      logger.error('[Timeout Error] Request timed out', {
        url: error.config?.url,
        timeout: error.config?.timeout,
        error,
      });
    } else if (errorType === NetworkErrorType.AUTH_ERROR) {
      const status = error.response?.status;

      if (status === 401) {
        errorMessage = 'Your session has expired. Please sign in again.';
        // Handle expired session
        // Could dispatch to auth store to clear credentials and redirect
      } else if (status === 403) {
        errorMessage = 'You do not have permission to perform this action.';
      }

      logger.warn('[Auth Error]', {
        status,
        url: error.config?.url,
        error: error.response?.data,
      });
    } else if (errorType === NetworkErrorType.SERVER_ERROR) {
      errorMessage = 'The server encountered an error. Our team has been notified.';
      // Log server error
      logger.error('[Server Error]', {
        status: error.response?.status,
        url: error.config?.url,
        error: error.response?.data,
      });
    } else if (errorType === NetworkErrorType.NOT_FOUND_ERROR) {
      errorMessage = 'The requested resource was not found.';
      logger.warn('[Not Found Error]', {
        url: error.config?.url,
        error: error.response?.data,
      });
    } else if (errorType === NetworkErrorType.VALIDATION_ERROR) {
      const data = error.response?.data as ApiError | undefined;
      // Format validation errors in a user-friendly way
      if (data?.errors?.length) {
        // Get first error message
        const firstError = data.errors[0];
        errorMessage = firstError.field ? `${firstError.field}: ${firstError.message}` : firstError.message;

        // If there are multiple errors, indicate this
        if (data.errors.length > 1) {
          errorMessage += ` (and ${data.errors.length - 1} more issues)`;
        }
      } else if (data?.details) {
        errorMessage = data.message || 'There was an error with your submission. Please check your inputs.';
      } else if (data?.message) {
        errorMessage = data.message;
      } else {
        errorMessage = 'There was an error with your submission. Please check your inputs.';
      }

      logger.warn('[Validation Error]', {
        url: error.config?.url,
        error: error.response?.data,
      });
    } else if (errorType === NetworkErrorType.CLIENT_ERROR) {
      // Try to extract message from API response
      const data = error.response?.data as ApiError | undefined;
      if (data?.message) {
        errorMessage = data.message;
      } else {
        errorMessage = `Request error: ${error.response?.statusText || 'Bad request'}`;
      }

      logger.warn('[Client Error]', {
        status: error.response?.status,
        url: error.config?.url,
        error: error.response?.data,
      });
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
    logger.error('[JS Error]', { error });
  }

  return errorMessage;
};

/**
 * Show error toast with enhanced error handling
 */
export const showEnhancedError = (error: unknown): void => {
  const message = handleApiError(error);
  const errorType = axios.isAxiosError(error) ? getErrorType(error) : NetworkErrorType.UNKNOWN_ERROR;

  // Different styling based on error type
  switch (errorType) {
    case NetworkErrorType.NETWORK_ERROR:
      toast.error(message, {
        id: 'network-error',
        // If same network error happens multiple times, don't spam toasts
        duration: 5000,
      });
      break;

    case NetworkErrorType.TIMEOUT_ERROR:
      toast.error(message, {
        id: 'timeout-error',
        duration: 5000,
      });
      break;

    case NetworkErrorType.AUTH_ERROR:
      toast.error(message, {
        id: 'auth-error',
        duration: 4000,
      });
      break;

    case NetworkErrorType.SERVER_ERROR:
      toast.error(message, {
        id: 'server-error',
        duration: 4000,
      });
      break;

    case NetworkErrorType.NOT_FOUND_ERROR:
      toast.error(message, {
        id: 'not-found-error',
        duration: 3000,
      });
      break;

    case NetworkErrorType.VALIDATION_ERROR:
      toast.error(message, {
        id: 'validation-error',
        duration: 6000, // Give a bit more time to read validation issues
      });
      break;

    default:
      toast.error(message, {
        duration: 3000,
      });
  }
};

/**
 * Safely execute an async function with enhanced error handling
 */
export async function safeAsync<T>(
  asyncFn: () => Promise<T>,
  options: {
    onError?: (error: unknown) => void;
    showToast?: boolean;
    defaultValue?: T;
  } = {},
): Promise<T | undefined> {
  const { onError, showToast = true, defaultValue } = options;

  try {
    return await asyncFn();
  } catch (error) {
    // Custom error handler has priority
    if (onError) {
      onError(error);
    }
    // Show toast if enabled
    else if (showToast) {
      showEnhancedError(error);
    }

    logger.error('Error in safeAsync', { error });
    return defaultValue;
  }
}

export default {
  handleApiError,
  showEnhancedError,
  safeAsync,
  getErrorType,
  NetworkErrorType,
};
