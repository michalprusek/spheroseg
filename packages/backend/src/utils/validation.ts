import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError, ZodType } from 'zod';
import { sendBadRequest } from './responseHelpers';

/**
 * Enhanced validation utilities using Zod schemas
 */

/**
 * Validate request data against a Zod schema
 * Returns validated data or throws validation error
 */
export function validateData<T>(schema: ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns result object instead of throwing
 */
export function safeValidateData<T>(
  schema: ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Express middleware for validating request body with Zod schema
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = validateData(schema, req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const _validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        return sendBadRequest(res, 'Validation failed', 'VALIDATION_ERROR');
      }
      next(error);
    }
  };
}

/**
 * Express middleware for validating query parameters
 */
export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = validateData(schema, req.query);
      // Type assertion is needed here as Express types are not fully compatible
      (req as Request & { query: T }).query = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const _validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        return sendBadRequest(res, 'Invalid query parameters', 'VALIDATION_ERROR');
      }
      next(error);
    }
  };
}

/**
 * Express middleware for validating route parameters
 */
export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = validateData(schema, req.params);
      // Type assertion is needed here as Express types are not fully compatible
      (req as Request & { params: T }).params = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const _validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        return sendBadRequest(res, 'Invalid route parameters', 'VALIDATION_ERROR');
      }
      next(error);
    }
  };
}

/**
 * Combine multiple validation middlewares
 */
export function validateRequest<TBody = unknown, TQuery = unknown, TParams = unknown>(options: {
  body?: ZodType<TBody>;
  query?: ZodType<TQuery>;
  params?: ZodType<TParams>;
}) {
  const middlewares: RequestHandler[] = [];

  if (options.body) {
    middlewares.push(validateBody(options.body));
  }
  if (options.query) {
    middlewares.push(validateQuery(options.query));
  }
  if (options.params) {
    middlewares.push(validateParams(options.params));
  }

  return middlewares;
}