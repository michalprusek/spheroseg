/**
 * Custom API Error Class
 *
 * Standardized error handling for the API with proper HTTP status codes
 * and consistent error response format.
 */

export enum ErrorCode {
  // Client Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
}

export interface ErrorDetails {
  field?: string;
  value?: unknown;
  constraint?: string;
  message?: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetails[];
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: ErrorDetails[],
    isOperational: boolean = true
  ) {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Create a validation error
   */
  static validation(message: string, details?: ErrorDetails[]): ApiError {
    return new ApiError(message, 400, ErrorCode.VALIDATION_ERROR, details);
  }

  /**
   * Create an authentication error
   */
  static unauthorized(message: string = 'Authentication required'): ApiError {
    return new ApiError(message, 401, ErrorCode.AUTHENTICATION_REQUIRED);
  }

  /**
   * Create a forbidden error
   */
  static forbidden(message: string = 'Insufficient permissions'): ApiError {
    return new ApiError(message, 403, ErrorCode.INSUFFICIENT_PERMISSIONS);
  }

  /**
   * Create a not found error
   */
  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(message, 404, ErrorCode.RESOURCE_NOT_FOUND);
  }

  /**
   * Create a conflict error
   */
  static conflict(message: string, details?: ErrorDetails[]): ApiError {
    return new ApiError(message, 409, ErrorCode.RESOURCE_CONFLICT, details);
  }

  /**
   * Create a rate limit error
   */
  static rateLimit(message: string = 'Rate limit exceeded'): ApiError {
    return new ApiError(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED);
  }

  /**
   * Create a database error
   */
  static database(message: string, originalError?: Error): ApiError {
    return new ApiError(
      message,
      500,
      ErrorCode.DATABASE_ERROR,
      originalError ? [{ message: originalError.message }] : undefined
    );
  }

  /**
   * Create a storage error
   */
  static storage(message: string): ApiError {
    return new ApiError(message, 500, ErrorCode.STORAGE_ERROR);
  }

  /**
   * Create an external service error
   */
  static externalService(message: string, service?: string): ApiError {
    return new ApiError(
      message,
      502,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      service ? [{ field: 'service', value: service }] : undefined
    );
  }

  /**
   * Convert to JSON representation
   */
  toJSON() {
    return {
      success: false,
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  /**
   * Check if error is operational (expected) vs programming error
   */
  static isOperational(error: Error): boolean {
    if (error instanceof ApiError) {
      return error.isOperational;
    }
    return false;
  }
}
