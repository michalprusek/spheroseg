import { Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/errors';
import { ErrorCode } from '../utils/ApiError';
import logger from '../utils/logger';
import config from '../config';

/**
 * Enhanced error handling middleware with proper logging and standardized responses
 */
export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Don't respond if response was already sent
  if (res.headersSent) {
    return _next(err);
  }

  let error = err;

  // Convert non-ApiError instances to ApiError
  if (!(err instanceof ApiError)) {
    // Handle specific error types
    if (err.name === 'ValidationError') {
      error = ApiError.validation(err.message, err.details);
    } else if (err.name === 'CastError') {
      error = ApiError.validation(`Invalid ${err.path}: ${err.value}`);
    } else if (err.code === 11000) {
      // MongoDB duplicate key error
      const field = Object.keys(err.keyValue)[0];
      error = ApiError.conflict(`${field} already exists`);
    } else if (err.name === 'JsonWebTokenError') {
      error = ApiError.unauthorized('Invalid token');
    } else if (err.name === 'TokenExpiredError') {
      error = ApiError.unauthorized('Token expired');
    } else if (err.code === 'LIMIT_FILE_SIZE') {
      error = ApiError.validation('File too large');
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      error = ApiError.validation('Unexpected file field');
    } else {
      // Generic server error
      error = new ApiError(
        config.isDevelopment ? err.message : 'Internal server error',
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        undefined,
        false // Mark as non-operational (programming error)
      );
    }
  }

  // Log error details
  const logContext = {
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: config.isDevelopment ? error.stack : undefined,
      isOperational: error.isOperational,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body || {},
      params: req.params || {},
      query: req.query || {},
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
    user: (req as unknown).user?.id || 'anonymous',
  };

  // Log level based on error type
  if (error.statusCode >= 500) {
    logger.error('Server error occurred', logContext);
  } else if (error.statusCode >= 400) {
    logger.warn('Client error occurred', logContext);
  } else {
    logger.info('Request error occurred', logContext);
  }

  // Send standardized error response
  const response = {
    success: false,
    error: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    timestamp: error.timestamp,
    // Include additional debug info in development
    ...(config.isDevelopment && {
      stack: error.stack,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
      },
    }),
  };

  res.status(error.statusCode).json(response);
};

/**
 * Middleware to handle async route handlers
 * Wraps async functions to catch promise rejections
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const error = ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`);

  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json(error.toJSON());
};
