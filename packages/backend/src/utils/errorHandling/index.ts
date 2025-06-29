/**
 * Centralized Error Handling Module
 * 
 * This module provides a unified approach to error handling across the application.
 * It exports all error-related utilities, classes, and middleware for consistent
 * error management.
 */

// Import for internal use
import { ApiError as ApiErrorClass, ErrorCode } from '../ApiError';

// Export the main ApiError class and related types
export { ApiError, ErrorCode, ErrorDetails } from '../ApiError';

// Export legacy error classes for backward compatibility
export {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  UnprocessableEntityError,
  InternalServerError,
  HTTP_STATUS_CODES,
} from '../errors';

// Export error handler middleware
export { errorHandler, asyncHandler, notFoundHandler } from '../../middleware/errorHandler';

// Export API response utilities
export { sendError, sendSuccess } from '../apiResponse';

/**
 * Utility function to determine if an error should be logged
 */
export const shouldLogError = (error: Error): boolean => {
  if (error instanceof ApiErrorClass) {
    // Only log non-operational errors and server errors
    return !error.isOperational || error.statusCode >= 500;
  }
  return true; // Log all non-ApiError instances
};

/**
 * Utility function to sanitize error messages for production
 */
export const sanitizeErrorMessage = (error: Error, isDevelopment: boolean): string => {
  if (isDevelopment) {
    return error.message;
  }
  
  if (error instanceof ApiErrorClass && error.isOperational) {
    return error.message; // Operational errors are safe to expose
  }
  
  return 'An unexpected error occurred'; // Generic message for production
};

/**
 * Create a standard error response object
 */
export const createErrorResponse = (error: ApiErrorClass, includeStack = false) => {
  const response: any = {
    success: false,
    error: error.code,
    message: error.message,
    statusCode: error.statusCode,
    timestamp: error.timestamp,
  };

  if (error.details && error.details.length > 0) {
    response.details = error.details;
  }

  if (includeStack && error.stack) {
    response.stack = error.stack;
  }

  return response;
};

/**
 * Error type guards
 */
export const isApiError = (error: any): error is ApiErrorClass => {
  return error instanceof ApiErrorClass;
};

export const isOperationalError = (error: any): boolean => {
  return isApiError(error) && error.isOperational;
};

export const isValidationError = (error: any): boolean => {
  return isApiError(error) && error.code === ErrorCode.VALIDATION_ERROR;
};

export const isAuthenticationError = (error: any): boolean => {
  return isApiError(error) && error.code === ErrorCode.AUTHENTICATION_REQUIRED;
};

export const isAuthorizationError = (error: any): boolean => {
  return isApiError(error) && error.code === ErrorCode.INSUFFICIENT_PERMISSIONS;
};

/**
 * Middleware to add error throwing helper methods to request object
 */
export const errorHelpers = (req: any, res: any, next: any) => {
  req.throwValidationError = (message: string, details?: any) => {
    throw ApiErrorClass.validation(message, details);
  };
  
  req.throwNotFound = (message: string) => {
    throw ApiErrorClass.notFound(message);
  };
  
  req.throwUnauthorized = (message: string) => {
    throw ApiErrorClass.unauthorized(message);
  };
  
  req.throwForbidden = (message: string) => {
    throw ApiErrorClass.forbidden(message);
  };
  
  next();
};