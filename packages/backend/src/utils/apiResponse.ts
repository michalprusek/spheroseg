/**
 * API Response Utilities
 * 
 * Standardized response formats for consistent API responses across the application.
 * Provides utility functions for common response patterns.
 */

import { Response } from 'express';

export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: ApiResponseMeta;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  details?: any[];
  timestamp: string;
}

/**
 * Send successful response with data
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: ApiResponseMeta
): Response => {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    message,
    meta,
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};

/**
 * Send created response (201)
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): Response => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send no content response (204)
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};

/**
 * Send paginated response
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message?: string
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

  return sendSuccess(res, data, message, 200, meta);
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  error: string,
  message: string,
  statusCode: number = 500,
  details?: any[]
): Response => {
  const response: ApiErrorResponse = {
    success: false,
    error,
    message,
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
  res: Response,
  message: string = 'Validation failed',
  details?: any[]
): Response => {
  return sendError(res, 'VALIDATION_ERROR', message, 400, details);
};

/**
 * Send unauthorized error response
 */
export const sendUnauthorized = (
  res: Response,
  message: string = 'Authentication required'
): Response => {
  return sendError(res, 'AUTHENTICATION_REQUIRED', message, 401);
};

/**
 * Send forbidden error response
 */
export const sendForbidden = (
  res: Response,
  message: string = 'Insufficient permissions'
): Response => {
  return sendError(res, 'INSUFFICIENT_PERMISSIONS', message, 403);
};

/**
 * Send not found error response
 */
export const sendNotFound = (
  res: Response,
  message: string = 'Resource not found'
): Response => {
  return sendError(res, 'RESOURCE_NOT_FOUND', message, 404);
};

/**
 * Send conflict error response
 */
export const sendConflict = (
  res: Response,
  message: string = 'Resource conflict',
  details?: any[]
): Response => {
  return sendError(res, 'RESOURCE_CONFLICT', message, 409, details);
};

/**
 * Send internal server error response
 */
export const sendInternalError = (
  res: Response,
  message: string = 'Internal server error'
): Response => {
  return sendError(res, 'INTERNAL_SERVER_ERROR', message, 500);
};

/**
 * Helper to extract pagination parameters from query
 */
export const extractPagination = (query: any) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

/**
 * Helper to format database results for API response
 */
export const formatListResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) => {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};