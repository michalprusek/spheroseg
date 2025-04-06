import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError } from 'jsonwebtoken';
import { config } from '../config/app';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err instanceof JsonWebTokenError) {
    statusCode = 401;
    message = 'Invalid Token';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    message = 'Duplicate Entry';
  }

  // Log detailed error in development
  if (config.server.env === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode,
      message,
      details: config.server.env === 'development' ? err.stack : undefined
    }
  });
};