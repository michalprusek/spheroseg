/**
 * Legacy error classes for backward compatibility
 *
 * @deprecated Use ApiError from './ApiError' instead
 * This file is kept for backward compatibility with existing code.
 * New code should use the unified ApiError class.
 */

import { ApiError as UnifiedApiError, ErrorCode } from './ApiError';

// Re-export the unified ApiError for consistency
export { ApiError } from './ApiError';

// Common HTTP status codes for errors
export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Legacy error classes that extend the unified ApiError
export class BadRequestError extends UnifiedApiError {
  constructor(message = 'Bad Request') {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }
}

export class NotFoundError extends UnifiedApiError {
  constructor(message = 'Resource Not Found') {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND);
  }
}

export class UnauthorizedError extends UnifiedApiError {
  constructor(message = 'Unauthorized') {
    super(message, HTTP_STATUS_CODES.UNAUTHORIZED, ErrorCode.AUTHENTICATION_REQUIRED);
  }
}

export class ForbiddenError extends UnifiedApiError {
  constructor(message = 'Forbidden') {
    super(message, HTTP_STATUS_CODES.FORBIDDEN, ErrorCode.INSUFFICIENT_PERMISSIONS);
  }
}

export class UnprocessableEntityError extends UnifiedApiError {
  constructor(message = 'Unprocessable Entity') {
    super(message, HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_ERROR);
  }
}

export class InternalServerError extends UnifiedApiError {
  constructor(message = 'Internal Server Error') {
    super(message, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_SERVER_ERROR);
  }
}
