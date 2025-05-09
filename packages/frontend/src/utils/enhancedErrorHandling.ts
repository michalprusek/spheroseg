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
}

/**
 * Types of network errors that can occur
 */
export enum NetworkErrorType {
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Get error type based on error detail
 */
export const getErrorType = (error: unknown): NetworkErrorType => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      // No response - network error
      return NetworkErrorType.NETWORK_ERROR;
    }
    
    const status = error.response.status;
    if (status >= 500) {
      return NetworkErrorType.SERVER_ERROR;
    } else if (status === 401 || status === 403) {
      return NetworkErrorType.AUTH_ERROR;
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
        error: error.response?.data 
      });
    } else if (errorType === NetworkErrorType.SERVER_ERROR) {
      errorMessage = 'The server encountered an error. Our team has been notified.';
      // Log server error
      logger.error('[Server Error]', { 
        status: error.response?.status,
        url: error.config?.url,
        error: error.response?.data 
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
        error: error.response?.data 
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
  } = {}
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
  NetworkErrorType
};