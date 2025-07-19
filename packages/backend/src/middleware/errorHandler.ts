import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/errors';
import { ErrorCode } from '../utils/ApiError';
import logger from '../utils/logger';
import config from '../config';
import jwt from 'jsonwebtoken';
import multer from 'multer';

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize error message for production
 */
function sanitizeErrorMessage(message: string): string {
  if (config.isDevelopment) {
    return message;
  }
  
  // Remove sensitive information from error messages
  const sensitivePatterns = [
    /password[\s\S]*?['"]\w+['"]/gi,
    /token[\s\S]*?['"]\w+['"]/gi,
    /api[_-]?key[\s\S]*?['"]\w+['"]/gi,
    /secret[\s\S]*?['"]\w+['"]/gi,
    /\/home\/[\w\/]+/g, // File paths
    /postgresql:\/\/[^@]+@[^/]+/g, // Database URLs
  ];
  
  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
}

/**
 * Enhanced error handling middleware with proper logging and standardized responses
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Don't respond if response was already sent
  if (res.headersSent) {
    return _next(err);
  }

  const errorId = generateErrorId();
  let error = err;

  // Convert non-ApiError instances to ApiError
  if (!(err instanceof ApiError)) {
    // Type guard for error-like objects
    const errorObj = err as any;
    
    // Handle specific error types
    if (errorObj.name === 'ValidationError') {
      error = ApiError.validation(errorObj.message || 'Validation error', errorObj.details);
    } else if (errorObj.name === 'CastError') {
      error = ApiError.validation(`Invalid ${errorObj.path}: ${errorObj.value}`);
    } else if (errorObj.code === 11000) {
      // MongoDB duplicate key error
      const field = errorObj.keyValue ? Object.keys(errorObj.keyValue)[0] : 'field';
      error = ApiError.conflict(`${field} already exists`);
    } else if (errorObj.code === '23505') {
      // PostgreSQL unique violation
      error = ApiError.conflict('Resource already exists');
    } else if (errorObj.code === '23503') {
      // PostgreSQL foreign key violation
      error = ApiError.validation('Invalid reference');
    } else if (err instanceof jwt.JsonWebTokenError) {
      if (err.name === 'TokenExpiredError') {
        error = ApiError.unauthorized('Token expired');
      } else {
        error = ApiError.unauthorized('Invalid token');
      }
    } else if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        error = ApiError.validation('File too large');
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        error = ApiError.validation('Unexpected file field');
      } else {
        error = ApiError.validation(`File upload error: ${err.message}`);
      }
    } else {
      // Generic server error
      error = new ApiError(
        sanitizeErrorMessage(errorObj.message || 'Internal server error'),
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        undefined,
        false // Mark as non-operational (programming error)
      );
    }
  }

  // Log error details
  const logContext = {
    errorId,
    error: {
      message: (error as ApiError).message,
      code: (error as ApiError).code,
      statusCode: (error as ApiError).statusCode,
      stack: config.isDevelopment ? (error as ApiError).stack : undefined,
      isOperational: (error as ApiError).isOperational,
      originalError: config.isDevelopment ? err : undefined,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: config.isDevelopment ? req.headers : undefined,
      body: config.isDevelopment ? req.body : undefined,
      params: req.params || {},
      query: req.query || {},
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
    user: (req as any).user?.id || (req as any).user?.userId || 'anonymous',
    timestamp: new Date().toISOString(),
  };

  // Log level based on error type
  if ((error as ApiError).statusCode >= 500) {
    logger.error('Server error occurred', logContext);
  } else if ((error as ApiError).statusCode >= 400) {
    logger.warn('Client error occurred', logContext);
  } else {
    logger.info('Request error occurred', logContext);
  }

  // Send standardized error response
  const response = {
    success: false,
    error: (error as ApiError).code,
    message: sanitizeErrorMessage((error as ApiError).message),
    statusCode: (error as ApiError).statusCode,
    details: (error as ApiError).details,
    timestamp: (error as ApiError).timestamp || new Date().toISOString(),
    errorId,
    // Include additional debug info in development
    ...(config.isDevelopment && {
      stack: (error as ApiError).stack,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
      },
    }),
  };

  res.status((error as ApiError).statusCode).json(response);
};

/**
 * Middleware to handle async route handlers
 * Wraps async functions to catch promise rejections
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const errorId = generateErrorId();
  const error = ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`);

  logger.warn('Route not found', {
    errorId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    ...error.toJSON(),
    errorId,
  });
};

/**
 * Global handler for unhandled promise rejections
 */
export const unhandledRejectionHandler = (reason: any, promise: Promise<any>): void => {
  const errorId = generateErrorId();
  
  logger.error('Unhandled Promise Rejection', {
    errorId,
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
  });
  
  // In production, you might want to gracefully shut down
  if (config.env === 'production' && !config.isDevelopment) {
    logger.error('Shutting down due to unhandled promise rejection');
    // Give time to log and clean up
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
};

/**
 * Global handler for uncaught exceptions
 */
export const uncaughtExceptionHandler = (error: Error): void => {
  const errorId = generateErrorId();
  
  logger.error('Uncaught Exception', {
    errorId,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  
  // Always exit on uncaught exceptions as the process is in an undefined state
  logger.error('Shutting down due to uncaught exception');
  // Give time to log and clean up
  setTimeout(() => {
    process.exit(1);
  }, 1000);
};

// Register global error handlers
if (process.env["NODE_ENV"] !== 'test') {
  process.on('unhandledRejection', unhandledRejectionHandler);
  process.on('uncaughtException', uncaughtExceptionHandler);
}
