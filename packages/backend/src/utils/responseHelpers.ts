import { Response } from 'express';
import { UnifiedResponseHandler, ApiResponse, ApiErrorResponse } from '@spheroseg/shared';
import { ApiError } from './errors';
import logger from './logger';

/**
 * Response helper functions using the unified response handler
 */

/**
 * Send a successful response with data
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): Response {
  const response = UnifiedResponseHandler.success(data, message);
  return res.status(statusCode).json(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(
  res: Response,
  data: T,
  message = 'Resource created successfully'
): Response {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send a no content response (204)
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  error: unknown,
  statusCode?: number
): Response {
  let status = statusCode || 500;
  let errorResponse: ApiErrorResponse;

  if (error instanceof ApiError) {
    status = error.statusCode;
    errorResponse = UnifiedResponseHandler.error(
      error.message,
      error.code,
      error.validationErrors
    );
  } else {
    errorResponse = UnifiedResponseHandler.handleError(error, {
      path: res.req?.path,
      operation: `${res.req?.method} ${res.req?.path}`,
    });
  }

  // Log the error
  logger.error('API Error', {
    path: res.req?.path,
    method: res.req?.method,
    status,
    error: errorResponse,
  });

  return res.status(status).json(errorResponse);
}

/**
 * Send a bad request error (400)
 */
export function sendBadRequest(
  res: Response,
  message = 'Bad request',
  code = 'BAD_REQUEST'
): Response {
  const errorResponse = UnifiedResponseHandler.error(message, code);
  return res.status(400).json(errorResponse);
}

/**
 * Send an unauthorized error (401)
 */
export function sendUnauthorized(
  res: Response,
  message = 'Unauthorized',
  code = 'UNAUTHORIZED'
): Response {
  const errorResponse = UnifiedResponseHandler.error(message, code);
  return res.status(401).json(errorResponse);
}

/**
 * Send a forbidden error (403)
 */
export function sendForbidden(
  res: Response,
  message = 'Forbidden',
  code = 'FORBIDDEN'
): Response {
  const errorResponse = UnifiedResponseHandler.error(message, code);
  return res.status(403).json(errorResponse);
}

/**
 * Send a not found error (404)
 */
export function sendNotFound(
  res: Response,
  message = 'Resource not found',
  code = 'NOT_FOUND'
): Response {
  const errorResponse = UnifiedResponseHandler.error(message, code);
  return res.status(404).json(errorResponse);
}

/**
 * Send a conflict error (409)
 */
export function sendConflict(
  res: Response,
  message = 'Conflict',
  code = 'CONFLICT'
): Response {
  const errorResponse = UnifiedResponseHandler.error(message, code);
  return res.status(409).json(errorResponse);
}

/**
 * Send a server error (500)
 */
export function sendServerError(
  res: Response,
  message = 'Internal server error',
  code = 'INTERNAL_ERROR'
): Response {
  const errorResponse = UnifiedResponseHandler.error(message, code);
  return res.status(500).json(errorResponse);
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  },
  message?: string
): Response {
  const response = UnifiedResponseHandler.paginated(data, pagination, message);
  return res.status(200).json(response);
}

/**
 * Wrap an async route handler to automatically handle errors
 */
export function asyncHandler<T = any>(
  fn: (req: any, res: Response) => Promise<T>
) {
  return async (req: any, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      sendError(res, error);
    }
  };
}