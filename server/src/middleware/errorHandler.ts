import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

/**
 * Generic error handling middleware.
 * Catches errors passed via next(error) and sends a standardized JSON response.
 */
export const errorHandler: ErrorRequestHandler = (
    err: any, 
    req: Request, 
    res: Response, 
    next: NextFunction // next is required for Express to recognize it as an error handler
) => {
    console.error("Unhandled Error:", err); // Log the full error for debugging

    // Determine status code - default to 500 if not specified
    const statusCode = err.statusCode || 500;

    // Determine message - use error message or a generic one
    const message = err.message || 'Internal Server Error';

    // Send JSON response
    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message,
        // Optionally include stack trace in development mode
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}; 