import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

// Custom error class for API errors
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Main error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: any = undefined;

  // Handle specific error types
  if (err instanceof AppError) {
    // Our custom application error
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    // Validation error from Zod
    statusCode = 400;
    message = 'Validation failed';
    errors = err.errors;
  } else if (err instanceof PrismaClientKnownRequestError) {
    // Prisma database errors
    statusCode = 400;
    
    switch (err.code) {
      case 'P2002':
        message = `A record with the same ${err.meta?.target || 'value'} already exists`;
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
      default:
        message = 'Database operation failed';
    }
  } else if (err instanceof JsonWebTokenError) {
    // JWT validation error
    statusCode = 401;
    message = 'Invalid token';
  } else if (err instanceof TokenExpiredError) {
    // JWT expiration error
    statusCode = 401;
    message = 'Token expired';
  }

  // Send response
  return res.status(statusCode).json({
    status: 'error',
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response) => {
  return res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
}; 