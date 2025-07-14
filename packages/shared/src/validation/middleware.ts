/**
 * Express Validation Middleware using Zod
 * 
 * This module provides Express middleware for validating requests
 * using Zod schemas, replacing express-validator.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, FormError } from './forms';

// ===========================
// Types
// ===========================

export interface ValidationSource {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
  headers?: z.ZodType;
  cookies?: z.ZodType;
  files?: z.ZodType;
}

export interface ValidationOptions {
  /**
   * Whether to strip unknown properties
   */
  stripUnknown?: boolean;
  
  /**
   * Whether to continue on validation error
   */
  passthrough?: boolean;
  
  /**
   * Custom error formatter
   */
  errorFormatter?: (errors: FormError[]) => any;
  
  /**
   * Status code for validation errors
   */
  statusCode?: number;
  
  /**
   * Whether to log validation errors
   */
  logErrors?: boolean;
}

export interface ValidationError {
  message: string;
  errors: FormError[];
  statusCode: number;
}

// ===========================
// Default Error Formatter
// ===========================

const defaultErrorFormatter = (errors: FormError[]) => ({
  message: 'Validation failed',
  errors: errors.map(err => ({
    field: err.field,
    message: err.message,
    code: err.code,
  })),
});

// ===========================
// Validation Middleware Factory
// ===========================

/**
 * Create validation middleware for Express
 */
export function validateRequest(
  schemas: ValidationSource,
  options: ValidationOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const {
    stripUnknown = true,
    passthrough = false,
    errorFormatter = defaultErrorFormatter,
    statusCode = 400,
    logErrors = process.env.NODE_ENV === 'development',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const errors: FormError[] = [];
    const validatedData: Record<string, any> = {};

    // Validate each source
    const sources: Array<[keyof ValidationSource, any]> = [
      ['body', req.body],
      ['params', req.params],
      ['query', req.query],
      ['headers', req.headers],
      ['cookies', req.cookies],
      ['files', req.files],
    ];

    for (const [source, data] of sources) {
      const schema = schemas[source];
      if (!schema || !data) continue;

      // Apply stripUnknown if enabled
      const schemaToUse = stripUnknown && schema instanceof z.ZodObject
        ? schema.strict()
        : schema;

      const result = validate(schemaToUse, data);

      if (!result.success) {
        // Prefix field names with source
        const sourceErrors = result.errors!.map(err => ({
          ...err,
          field: source === 'body' ? err.field : `${source}.${err.field}`,
        }));
        errors.push(...sourceErrors);
      } else if (result.data) {
        validatedData[source] = result.data;
        
        // Update request with validated data
        (req as any)[source] = result.data;
      }
    }

    // Handle validation errors
    if (errors.length > 0) {
      if (logErrors) {
        console.error('Validation errors:', errors);
      }

      if (!passthrough) {
        return res.status(statusCode).json(errorFormatter(errors));
      }
      
      // Attach errors to request for later handling
      (req as any).validationErrors = errors;
    }

    // Attach validated data to request
    (req as any).validated = validatedData;

    next();
  };
}

// ===========================
// Convenience Middleware Factories
// ===========================

/**
 * Validate request body
 */
export function validateBody(
  schema: z.ZodType,
  options?: ValidationOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return validateRequest({ body: schema }, options);
}

/**
 * Validate request params
 */
export function validateParams(
  schema: z.ZodType,
  options?: ValidationOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return validateRequest({ params: schema }, options);
}

/**
 * Validate request query
 */
export function validateQuery(
  schema: z.ZodType,
  options?: ValidationOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return validateRequest({ query: schema }, options);
}

/**
 * Validate request headers
 */
export function validateHeaders(
  schema: z.ZodType,
  options?: ValidationOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return validateRequest({ headers: schema }, options);
}

// ===========================
// Schema Builders
// ===========================

/**
 * Create a schema that coerces string values to proper types
 * Useful for query and params validation
 */
export function coerceSchema<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  const coercedShape: any = {};
  
  Object.entries(shape).forEach(([key, schema]) => {
    if (schema instanceof z.ZodNumber) {
      coercedShape[key] = z.coerce.number();
    } else if (schema instanceof z.ZodBoolean) {
      coercedShape[key] = z.coerce.boolean();
    } else if (schema instanceof z.ZodDate) {
      coercedShape[key] = z.coerce.date();
    } else {
      coercedShape[key] = schema;
    }
  });
  
  return z.object(coercedShape);
}

/**
 * Create a file validation schema
 */
export interface FileValidationOptions {
  maxSize?: number;
  mimeTypes?: string[];
  required?: boolean;
}

export function createFileSchema(options: FileValidationOptions = {}) {
  const { maxSize, mimeTypes, required = true } = options;
  
  let schema = z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.string(),
    size: z.number(),
    buffer: z.instanceof(Buffer).optional(),
    path: z.string().optional(),
  });
  
  if (maxSize) {
    schema = schema.refine(
      (file) => file.size <= maxSize,
      { message: `File size must not exceed ${maxSize} bytes` }
    );
  }
  
  if (mimeTypes && mimeTypes.length > 0) {
    schema = schema.refine(
      (file) => mimeTypes.includes(file.mimetype),
      { message: `File type must be one of: ${mimeTypes.join(', ')}` }
    );
  }
  
  return required ? schema : schema.optional();
}

// ===========================
// Error Handling Utilities
// ===========================

/**
 * Express error handler for validation errors
 */
export function validationErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof z.ZodError) {
    const errors: FormError[] = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));
    
    res.status(400).json({
      message: 'Validation failed',
      errors,
    });
    return;
  }
  
  next(err);
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: any): error is ValidationError {
  return error?.statusCode === 400 && Array.isArray(error?.errors);
}

// ===========================
// Request Type Extensions
// ===========================

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: any;
        params?: any;
        query?: any;
        headers?: any;
        cookies?: any;
        files?: any;
      };
      validationErrors?: FormError[];
    }
  }
}

// ===========================
// Async Validation Middleware
// ===========================

/**
 * Create async validation middleware
 */
export function validateAsync(
  validator: (req: Request) => Promise<ValidationSource>,
  options?: ValidationOptions
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schemas = await validator(req);
      const middleware = validateRequest(schemas, options);
      middleware(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

// ===========================
// Utility Exports
// ===========================

export default {
  // Main middleware
  validateRequest,
  validateBody,
  validateParams,
  validateQuery,
  validateHeaders,
  
  // Schema builders
  coerceSchema,
  createFileSchema,
  
  // Error handling
  validationErrorHandler,
  isValidationError,
  
  // Async validation
  validateAsync,
};