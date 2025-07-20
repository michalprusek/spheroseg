import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/errors';
import { ErrorCode } from '../utils/ApiError';
import logger from '../utils/logger';
import { sendError, sendServerError } from '../utils/apiResponsei18n';

/**
 * i18n-enabled error handling middleware
 */
export const errorHandleri18n: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Don't respond if response was already sent
  if (res.headersSent) {
    return next(err);
  }

  // Log the error
  const errorObj = err as any;
  logger.error('Request error', {
    error: errorObj.message,
    stack: errorObj.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    user: (req as any).user?.id,
  });

  // Handle specific error types with i18n
  if (err instanceof ApiError) {
    const translationKey = getTranslationKeyForError(err);
    return sendError(req, res, translationKey, err.details, err.statusCode, err.details);
  }

  // Handle other known error types
  if (errorObj.name === 'ValidationError') {
    return sendError(req, res, 'error.validationFailed', undefined, 400, errorObj.details);
  }

  if (errorObj.name === 'CastError') {
    return sendError(req, res, 'validation.invalidFormat', { field: errorObj.path }, 400);
  }

  if (errorObj.code === 11000) {
    // MongoDB duplicate key error
    const field = errorObj.keyValue ? Object.keys(errorObj.keyValue)[0] : 'field';
    return sendError(req, res, 'validation.alreadyExists', { field }, 409);
  }

  if (errorObj.name === 'JsonWebTokenError') {
    return sendError(req, res, 'auth.invalidToken', undefined, 401);
  }

  if (errorObj.name === 'TokenExpiredError') {
    return sendError(req, res, 'auth.tokenExpired', undefined, 401);
  }

  if (errorObj.code === 'LIMIT_FILE_SIZE') {
    return sendError(req, res, 'error.fileTooLarge', undefined, 413);
  }

  if (errorObj.code === 'LIMIT_UNEXPECTED_FILE') {
    return sendError(req, res, 'error.unexpectedField', undefined, 400);
  }

  // Generic server error
  return sendServerError(req, res, err);
};

/**
 * Map ApiError codes to translation keys
 */
function getTranslationKeyForError(error: ApiError): string {
  // Map common error messages to translation keys
  const messageKeyMap: Record<string, string> = {
    'Invalid credentials': 'auth.invalidCredentials',
    'User not found': 'auth.userNotFound',
    'Email already exists': 'auth.emailAlreadyExists',
    'Invalid token': 'auth.invalidToken',
    'Token expired': 'auth.tokenExpired',
    'Authentication required': 'auth.authRequired',
    'Insufficient permissions': 'auth.insufficientPermissions',
    'Project not found': 'project.notFound',
    'Image not found': 'image.notFound',
    'Resource not found': 'error.resourceNotFound',
    'Validation failed': 'error.validationFailed',
  };

  // Check if we have a translation key for this specific message
  const translationKey = messageKeyMap[error.message];
  if (translationKey) {
    return translationKey;
  }

  // Map error codes to generic translation keys
  switch (error.code) {
    case ErrorCode.AUTHENTICATION_REQUIRED:
      return 'auth.authRequired';
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
      return 'auth.insufficientPermissions';
    case ErrorCode.RESOURCE_NOT_FOUND:
      return 'error.resourceNotFound';
    case ErrorCode.VALIDATION_ERROR:
      return 'error.validationFailed';
    case ErrorCode.RESOURCE_CONFLICT:
      return 'error.resourceConflict';
    case ErrorCode.INTERNAL_SERVER_ERROR:
    default:
      return 'error.internalServer';
  }
}
