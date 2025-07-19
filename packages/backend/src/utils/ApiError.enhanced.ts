/**
 * Enhanced API Error Class with Structured Error Codes
 *
 * Provides a comprehensive error handling system with:
 * - Structured error codes
 * - Consistent error responses
 * - Error tracking and correlation
 * - Localization support
 * - Detailed error context
 */

import { ERROR_CODES, ErrorCodeKey, getErrorDefinition } from './errorCodes';
import logger from '../utils/logger';

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export interface ValidationError {
  field: string;
  value?: any;
  constraint: string;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId?: string;
    details?: ValidationError[];
    context?: Partial<ErrorContext>;
    help?: string;
  };
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly details?: ValidationError[];
  public readonly context?: ErrorContext;
  public readonly help?: string;
  public readonly originalError?: Error;

  constructor(
    codeKey: ErrorCodeKey | string,
    message?: string,
    details?: ValidationError[],
    context?: ErrorContext,
    originalError?: Error
  ) {
    // If codeKey is a valid error code key, use the predefined error
    const errorDef = ERROR_CODES[codeKey as ErrorCodeKey];
    const isStructuredError = !!errorDef;

    super(message || errorDef?.message || 'An error occurred');

    this.name = 'ApiError';
    this.code = isStructuredError ? errorDef.code : codeKey;
    this.statusCode = isStructuredError ? errorDef.statusCode : 500;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    this.details = details;
    this.context = context;
    this.originalError = originalError;

    // Add help link based on error code
    if (isStructuredError) {
      this.help = `/docs/errors/${errorDef.code}`;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }

    // Log error creation
    this.logError();
  }

  /**
   * Factory methods for common errors
   */
  static invalidCredentials(context?: ErrorContext): ApiError {
    return new ApiError('AUTH_INVALID_CREDENTIALS', undefined, undefined, context);
  }

  static tokenExpired(context?: ErrorContext): ApiError {
    return new ApiError('AUTH_TOKEN_EXPIRED', undefined, undefined, context);
  }

  static tokenInvalid(context?: ErrorContext): ApiError {
    return new ApiError('AUTH_TOKEN_INVALID', undefined, undefined, context);
  }

  static sessionExpired(context?: ErrorContext): ApiError {
    return new ApiError('AUTH_SESSION_EXPIRED', undefined, undefined, context);
  }

  static accountDisabled(context?: ErrorContext): ApiError {
    return new ApiError('AUTH_ACCOUNT_DISABLED', undefined, undefined, context);
  }

  static emailNotVerified(context?: ErrorContext): ApiError {
    return new ApiError('AUTH_EMAIL_NOT_VERIFIED', undefined, undefined, context);
  }

  static tooManyAttempts(context?: ErrorContext): ApiError {
    return new ApiError('AUTH_TOO_MANY_ATTEMPTS', undefined, undefined, context);
  }

  static validationError(
    message: string,
    details?: ValidationError[],
    context?: ErrorContext
  ): ApiError {
    return new ApiError('VALIDATION_INVALID_FORMAT', message, details, context);
  }

  static requiredField(field: string, context?: ErrorContext): ApiError {
    return new ApiError(
      'VALIDATION_REQUIRED_FIELD',
      `${field} is required`,
      [{ field, constraint: 'required', message: `${field} is required` }],
      context
    );
  }

  static invalidFormat(field: string, format: string, context?: ErrorContext): ApiError {
    return new ApiError(
      'VALIDATION_INVALID_FORMAT',
      `Invalid ${field} format`,
      [{ field, constraint: format, message: `${field} must be a valid ${format}` }],
      context
    );
  }

  static duplicateValue(field: string, value: any, context?: ErrorContext): ApiError {
    return new ApiError(
      'VALIDATION_DUPLICATE_VALUE',
      `${field} already exists`,
      [{ field, value, constraint: 'unique', message: `${field} must be unique` }],
      context
    );
  }

  static resourceNotFound(resource: string, id?: string, context?: ErrorContext): ApiError {
    return new ApiError(
      'RESOURCE_NOT_FOUND',
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      undefined,
      { ...context, resource, resourceId: id }
    );
  }

  static resourceAlreadyExists(resource: string, context?: ErrorContext): ApiError {
    return new ApiError(
      'RESOURCE_ALREADY_EXISTS',
      `${resource} already exists`,
      undefined,
      { ...context, resource }
    );
  }

  static permissionDenied(action?: string, resource?: string, context?: ErrorContext): ApiError {
    return new ApiError(
      'PERMISSION_DENIED',
      action && resource ? `Permission denied to ${action} ${resource}` : undefined,
      undefined,
      { ...context, action, resource }
    );
  }

  static insufficientRole(requiredRole: string, context?: ErrorContext): ApiError {
    return new ApiError(
      'PERMISSION_INSUFFICIENT_ROLE',
      `This action requires ${requiredRole} role`,
      undefined,
      { ...context, metadata: { requiredRole } }
    );
  }

  static invalidState(message: string, context?: ErrorContext): ApiError {
    return new ApiError('BUSINESS_INVALID_STATE', message, undefined, context);
  }

  static prerequisiteFailed(message: string, context?: ErrorContext): ApiError {
    return new ApiError('BUSINESS_PREREQUISITE_FAILED', message, undefined, context);
  }

  static externalServiceError(
    service: string,
    originalError?: Error,
    context?: ErrorContext
  ): ApiError {
    return new ApiError(
      'EXTERNAL_SERVICE_UNAVAILABLE',
      `${service} service is unavailable`,
      undefined,
      { ...context, metadata: { service } },
      originalError
    );
  }

  static mlServiceError(message?: string, context?: ErrorContext): ApiError {
    return new ApiError('EXTERNAL_ML_SERVICE_ERROR', message, undefined, context);
  }

  static databaseError(message: string, originalError?: Error, context?: ErrorContext): ApiError {
    return new ApiError('EXTERNAL_DATABASE_ERROR', message, undefined, context, originalError);
  }

  static rateLimitExceeded(context?: ErrorContext): ApiError {
    return new ApiError('SYSTEM_RATE_LIMIT_EXCEEDED', undefined, undefined, context);
  }

  static internalError(message?: string, originalError?: Error, context?: ErrorContext): ApiError {
    return new ApiError('SYSTEM_INTERNAL_ERROR', message, undefined, context, originalError);
  }

  /**
   * Log the error with appropriate severity
   */
  private logError(): void {
    const logContext = {
      code: this.code,
      statusCode: this.statusCode,
      message: this.message,
      context: this.context,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError?.message,
    };

    if (this.statusCode >= 500) {
      logger.error('API Error occurred', logContext);
    } else if (this.statusCode >= 400) {
      logger.warn('Client error occurred', logContext);
    }
  }

  /**
   * Convert to API response format
   */
  toResponse(requestId?: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        requestId,
        details: this.details,
        context: this.context,
        help: this.help,
      },
    };
  }

  /**
   * Check if error is a specific type
   */
  is(codeKey: ErrorCodeKey): boolean {
    const errorDef = getErrorDefinition(codeKey);
    return this.code === errorDef.code;
  }

  /**
   * Create from unknown error
   */
  static from(error: unknown, context?: ErrorContext): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      // Handle specific error types
      if (error.name === 'ValidationError') {
        return ApiError.validationError(error.message, undefined, context);
      }
      
      if (error.name === 'JsonWebTokenError') {
        return ApiError.tokenInvalid(context);
      }

      if (error.name === 'TokenExpiredError') {
        return ApiError.tokenExpired(context);
      }

      // Database errors
      if ('code' in error) {
        if (error.code === '23505') { // PostgreSQL unique violation
          return ApiError.duplicateValue('resource', undefined, context);
        }
        if (error.code === '23503') { // PostgreSQL foreign key violation
          return ApiError.validationError('Invalid reference', undefined, context);
        }
      }

      return ApiError.internalError(error.message, error, context);
    }

    return ApiError.internalError('An unknown error occurred', undefined, context);
  }
}