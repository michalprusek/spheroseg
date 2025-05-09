import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class with status code
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized error handling middleware
 * Catches all errors passed to next() and returns a consistent error response
 */
const errorHandler = (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
  console.error('Error caught by middleware:', err);

  // Default status code and error message
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: string | undefined = undefined;

  // If it's our ApiError, use its status code and message
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
    // Handle errors with statusCode property
    statusCode = (err as any).statusCode;
    message = err.message || message;
  }

  // In development, include the stack trace
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    details = err.stack;
  }

  // Send the error response
  res.status(statusCode).json({
    error: {
      message,
      details,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * 404 Not Found middleware
 * This should be added after all routes to catch any undefined routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString()
    }
  });
};

// Export the error handler as default
export default errorHandler;