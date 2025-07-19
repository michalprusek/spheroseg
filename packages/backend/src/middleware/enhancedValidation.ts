/**
 * Enhanced Express Validation Middleware
 *
 * Express middleware that uses the comprehensive validation and sanitization
 * system from the shared package.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '@spheroseg/shared/src/validation/enhancedValidation';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ===========================
// Request Enhancement Types
// ===========================

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

// ===========================
// Validation Middleware Factory
// ===========================

export interface ValidationOptions {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  onError?: (error: z.ZodError, req: Request) => void;
  logValidation?: boolean;
}

/**
 * Create enhanced validation middleware
 */
export function createValidationMiddleware(options: ValidationOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const { body, query, params, onError, logValidation = true } = options;

    try {
      // Validate body if schema provided
      if (body) {
        const bodyResult = await validateBody(body, req.body, 'request-body');

        if (!bodyResult.success) {
          if (onError) {
            onError(new z.ZodError([]) as any, req);
          }

          if (logValidation) {
            logger.warn('Body validation failed', {
              path: req.path,
              method: req.method,
              errors: bodyResult.issues,
            });
          }

          throw new ApiError(
            'VALIDATION_ERROR',
            bodyResult.error || 'Validation failed',
            bodyResult.issues?.map(issue => ({
              field: 'body',
              value: undefined,
              constraint: 'validation',
              message: issue
            }))
          );
        }

        req.validatedBody = bodyResult.data;
      }

      // Validate query if schema provided
      if (query) {
        const queryResult = await validateQuery(query, req.query, 'request-query');

        if (!queryResult.success) {
          if (onError) {
            onError(new z.ZodError([]) as any, req);
          }

          if (logValidation) {
            logger.warn('Query validation failed', {
              path: req.path,
              method: req.method,
              errors: queryResult.issues,
            });
          }

          throw new ApiError(
            'VALIDATION_ERROR',
            queryResult.error || 'Query validation failed',
            queryResult.issues?.map(issue => ({
              field: 'query',
              value: undefined,
              constraint: 'validation',
              message: issue
            }))
          );
        }

        req.validatedQuery = queryResult.data;
      }

      // Validate params if schema provided
      if (params) {
        const paramsResult = await validateBody(params, req.params, 'request-params');

        if (!paramsResult.success) {
          if (onError) {
            onError(new z.ZodError([]) as any, req);
          }

          if (logValidation) {
            logger.warn('Params validation failed', {
              path: req.path,
              method: req.method,
              errors: paramsResult.issues,
            });
          }

          throw new ApiError(
            'VALIDATION_ERROR',
            paramsResult.error || 'Params validation failed',
            paramsResult.issues?.map(issue => ({
              field: 'params',
              value: undefined,
              constraint: 'validation',
              message: issue
            }))
          );
        }

        req.validatedParams = paramsResult.data;
      }

      if (logValidation) {
        logger.debug('Request validation successful', {
          path: req.path,
          method: req.method,
          hasBody: !!body,
          hasQuery: !!query,
          hasParams: !!params,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ===========================
// Convenience Middleware Functions
// ===========================

/**
 * Validate request body only
 */
export function validateRequestBody<T>(schema: z.ZodSchema<T>) {
  return createValidationMiddleware({ body: schema });
}

/**
 * Validate query parameters only
 */
export function validateRequestQuery<T>(schema: z.ZodSchema<T>) {
  return createValidationMiddleware({ query: schema });
}

/**
 * Validate route parameters only
 */
export function validateRequestParams<T>(schema: z.ZodSchema<T>) {
  return createValidationMiddleware({ params: schema });
}

// ===========================
// Common Parameter Schemas
// ===========================

export const commonSchemas = {
  // UUID parameter
  uuid: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),

  // Pagination query
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),

  // Search query
  search: z.object({
    q: z.string().min(1).max(200).optional(),
    filter: z.record(z.string().max(100)).optional(),
  }),

  // File upload
  fileUpload: z.object({
    file: z.object({
      originalname: z.string().min(1).max(255),
      mimetype: z.string(),
      size: z.number().max(50 * 1024 * 1024), // 50MB
      buffer: z.instanceof(Buffer).optional(),
      path: z.string().optional(),
    }),
  }),
};

// ===========================
// Security Middleware
// ===========================

/**
 * CSRF protection middleware
 */
export function csrfProtection() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Skip CSRF for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;

    if (!token) {
      throw new ApiError('CSRF token missing', 403);
    }

    // TODO: Implement actual CSRF token validation
    // For now, just check that token exists
    if (typeof token !== 'string' || token.length < 10) {
      throw new ApiError('Invalid CSRF token', 403);
    }

    next();
  };
}

/**
 * Rate limiting by IP
 */
export function rateLimitByIP(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (now > value.resetTime) {
        requests.delete(key);
      }
    }

    const current = requests.get(ip);

    if (!current) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > current.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      logger.warn('Rate limit exceeded', { ip, count: current.count, maxRequests });
      throw new ApiError('Rate limit exceeded', 429);
    }

    current.count++;
    next();
  };
}

/**
 * Content type validation
 */
export function validateContentType(allowedTypes: string[] = ['application/json']) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
      return next();
    }

    const contentType = req.headers['content-type'];

    if (!contentType) {
      throw new ApiError('Content-Type header required', 400);
    }

    const isAllowed = allowedTypes.some((type) =>
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isAllowed) {
      throw new ApiError(`Invalid Content-Type. Allowed: ${allowedTypes.join(', ')}`, 400);
    }

    next();
  };
}

// ===========================
// Request Sanitization
// ===========================

/**
 * Sanitize request data to prevent XSS and injection attacks
 */
export function sanitizeRequest() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    next();
  };
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: unknown): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Basic XSS prevention
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ===========================
// Exports
// ===========================

export default {
  createValidationMiddleware,
  validateRequestBody,
  validateRequestQuery,
  validateRequestParams,
  commonSchemas,
  csrfProtection,
  rateLimitByIP,
  validateContentType,
  sanitizeRequest,
};
