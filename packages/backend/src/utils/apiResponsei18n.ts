/**
 * i18n-enabled API Response Utilities
 *
 * Extends the standard API response utilities to support internationalization.
 * Uses translation keys instead of hardcoded messages.
 */

import { Request, Response } from 'express';
import {
  ApiResponseMeta,
  ApiSuccessResponse,
  ApiErrorResponse,
  sendSuccess as baseSendSuccess,
  sendNoContent,
} from './apiResponse';

/**
 * Send successful response with translated message
 */
export const sendSuccess = <T>(
  req: Request,
  res: Response,
  data: T,
  messageKey?: string,
  messageParams?: any,
  statusCode: number = 200,
  meta?: ApiResponseMeta
): Response => {
  const message = messageKey ? req.t(messageKey, messageParams) : undefined;
  return baseSendSuccess(res, data, message, statusCode, meta);
};

/**
 * Send created response (201) with translation
 */
export const sendCreated = <T>(
  req: Request,
  res: Response,
  data: T,
  resource: string = 'Resource'
): Response => {
  const message = req.t('success.created', { resource });
  return sendSuccess(req, res, data, undefined, undefined, 201);
};

/**
 * Send updated response with translation
 */
export const sendUpdated = <T>(
  req: Request,
  res: Response,
  data: T,
  resource: string = 'Resource'
): Response => {
  const message = req.t('success.updated', { resource });
  return sendSuccess(req, res, data, undefined, undefined, 200);
};

/**
 * Send deleted response with translation
 */
export const sendDeleted = (
  req: Request,
  res: Response,
  resource: string = 'Resource'
): Response => {
  const message = req.t('success.deleted', { resource });
  return sendSuccess(req, res, {}, message, undefined, 200);
};

/**
 * Send paginated response with optional translated message
 */
export const sendPaginated = <T>(
  req: Request,
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  messageKey?: string,
  messageParams?: any
): Response => {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  const meta: ApiResponseMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };

  return sendSuccess(req, res, data, messageKey, messageParams, 200, meta);
};

/**
 * Send error response with translation
 */
export const sendError = (
  req: Request,
  res: Response,
  errorKey: string,
  errorParams?: any,
  statusCode: number = 500,
  details?: any[]
): Response => {
  const errorMessage = req.t(errorKey, errorParams);
  
  const response: ApiErrorResponse = {
    success: false,
    error: errorKey,
    message: errorMessage,
    statusCode,
    details,
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};

/**
 * Send validation error response
 */
export const sendValidationError = (
  req: Request,
  res: Response,
  errors: any[]
): Response => {
  return sendError(req, res, 'error.validationFailed', undefined, 400, errors);
};

/**
 * Send not found error
 */
export const sendNotFound = (
  req: Request,
  res: Response,
  resource: string = 'Resource'
): Response => {
  return sendError(req, res, 'error.resourceNotFound', { resource }, 404);
};

/**
 * Send unauthorized error
 */
export const sendUnauthorized = (
  req: Request,
  res: Response,
  messageKey: string = 'auth.authRequired'
): Response => {
  return sendError(req, res, messageKey, undefined, 401);
};

/**
 * Send forbidden error
 */
export const sendForbidden = (
  req: Request,
  res: Response,
  messageKey: string = 'auth.insufficientPermissions'
): Response => {
  return sendError(req, res, messageKey, undefined, 403);
};

/**
 * Send conflict error
 */
export const sendConflict = (
  req: Request,
  res: Response,
  resource: string,
  field?: string
): Response => {
  const params = field ? { field } : { resource };
  const key = field ? 'validation.alreadyExists' : 'error.resourceConflict';
  return sendError(req, res, key, params, 409);
};

/**
 * Send internal server error
 */
export const sendServerError = (
  req: Request,
  res: Response,
  error?: any
): Response => {
  const details = error && process.env.NODE_ENV !== 'production' ? [error.message] : undefined;
  return sendError(req, res, 'error.internalServer', undefined, 500, details);
};

// Re-export utilities that don't need i18n
export { sendNoContent };