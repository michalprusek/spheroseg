/**
 * Enhanced Error Handler Middleware
 * 
 * Provides comprehensive error handling with:
 * - Structured error codes
 * - Request correlation
 * - Error tracking and metrics
 * - Sanitization for production
 * - Detailed logging
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError, ErrorContext } from '../utils/ApiError.enhanced';
import logger from '../utils/logger';
import config from '../config';
import { v4 as uuidv4 } from 'uuid';

// Extend Request to include custom properties
interface ExtendedRequest extends Request {
  id?: string;
  user?: { id: string; email?: string };
  startTime?: number;
}

/**
 * Generate or get request ID
 */
function getRequestId(req: ExtendedRequest): string {
  if (!req.id) {
    req.id = uuidv4();
  }
  return req.id;
}

/**
 * Build error context from request
 */
function buildErrorContext(req: ExtendedRequest): ErrorContext {
  const context: ErrorContext = {
    requestId: getRequestId(req),
    action: req.method,
    resource: req.route?.path || req.path,
    metadata: {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      host: req.get('Host'),
    },
  };
  
  if (req.user?.id) {
    context.userId = req.user.id;
  }
  
  return context;
}


/**
 * Track error metrics
 */
function trackErrorMetrics(error: ApiError, req: ExtendedRequest): void {
  const duration = req.startTime ? Date.now() - req.startTime : 0;
  
  // You can integrate with monitoring services here
  // For now, we'll just log the metrics
  logger.info('Error metric', {
    errorCode: error.code,
    statusCode: error.statusCode,
    duration,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });
}

/**
 * Enhanced error handling middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: ExtendedRequest,
  res: Response,
  _next: NextFunction
) => {
  // Don't respond if headers already sent
  if (res.headersSent) {
    return _next(err);
  }

  const context = buildErrorContext(req);
  let apiError: ApiError;

  // Convert to ApiError if needed
  if (err instanceof ApiError) {
    // If error already has context, use it; otherwise create new error with context
    if (err.context) {
      apiError = err;
    } else {
      apiError = new ApiError(
        err.code,
        err.message,
        err.details,
        context,
        err.originalError
      );
    }
  } else {
    apiError = ApiError.from(err, context);
  }

  // Track error metrics
  trackErrorMetrics(apiError, req);

  // Log error with full context
  const logContext = {
    requestId: context.requestId,
    errorCode: apiError.code,
    statusCode: apiError.statusCode,
    message: apiError.message,
    details: apiError.details,
    context: apiError.context,
    stack: config.isDevelopment ? apiError.stack : undefined,
    originalError: apiError.originalError?.message,
    request: {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: config.isDevelopment ? req.body : undefined,
    },
    user: req.user,
    duration: req.startTime ? Date.now() - req.startTime : undefined,
  };

  // Log based on severity
  if (apiError.statusCode >= 500) {
    logger.error('Server error', logContext);
  } else if (apiError.statusCode >= 400) {
    logger.warn('Client error', logContext);
  }

  // Send response
  const response = apiError.toResponse(context.requestId);
  
  // Apply sanitization for production
  if (!config.isDevelopment && apiError.statusCode >= 500) {
    response.error.message = 'An error occurred processing your request';
    delete response.error.context;
    delete response.error.details;
  }

  res.status(apiError.statusCode).json(response);
};

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T = any>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request ID middleware - should be used before error handler
 */
export function requestIdMiddleware(req: ExtendedRequest, res: Response, next: NextFunction): void {
  req.id = getRequestId(req);
  req.startTime = Date.now();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);
  
  // Log request start
  logger.debug('Request started', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
    });
  });
  
  next();
}

/**
 * Not found handler with proper error response
 */
export function notFoundHandler(req: ExtendedRequest, res: Response): void {
  const context = buildErrorContext(req);
  const error = ApiError.resourceNotFound('Route', req.originalUrl, context);
  
  res.status(404).json(error.toResponse(context.requestId));
}

/**
 * Global error event handlers
 */
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    });
    
    // In production, track but don't exit
    if (config.env === 'production') {
      // Send alert to monitoring service
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });
    
    // Always exit on uncaught exceptions
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}