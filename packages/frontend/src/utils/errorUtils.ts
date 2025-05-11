import axios, { AxiosError } from 'axios';
import { showError } from './toastUtils';

/**
 * Utility function to handle errors in a try-catch block
 * @param fn Function to execute
 * @param errorHandler Optional custom error handler
 * @returns Result of the function or undefined if an error occurred
 */
export const tryCatch = async <T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => void,
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error);
    } else {
      // Default error handling
      console.error('An error occurred:', error);

      let errorMessage = 'An unexpected error occurred';

      if (axios.isAxiosError(error)) {
        errorMessage = getAxiosErrorMessage(error);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      showError(errorMessage);
    }
    return undefined;
  }
};

/**
 * Extract a user-friendly error message from an Axios error
 * @param error Axios error
 * @returns User-friendly error message
 */
export const getAxiosErrorMessage = (error: AxiosError): string => {
  // Check for a response from the server
  if (error.response) {
    // The server responded with a status code outside the 2xx range
    const data = error.response.data as any;

    // Try to get the error message from the response data
    if (data?.message) {
      return data.message;
    } else if (data?.error) {
      return data.error;
    }

    // Fallback to status text
    return `Server error: ${error.response.status} ${error.response.statusText}`;
  } else if (error.request) {
    // The request was made but no response was received
    return 'No response received from server. Please check your network connection.';
  } else {
    // Something happened in setting up the request
    return `Request error: ${error.message}`;
  }
};

/**
 * Format an error object into a string message
 * @param error Error object
 * @returns Formatted error message
 */
export const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return getAxiosErrorMessage(error);
  } else if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else {
    return 'An unknown error occurred';
  }
};

export default {
  tryCatch,
  getAxiosErrorMessage,
  formatError,
};
