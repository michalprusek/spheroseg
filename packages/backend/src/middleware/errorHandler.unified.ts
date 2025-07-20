/**
 * Unified Error Handler Middleware
 * 
 * Consolidates all error handling functionality with consistent response format
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { getErrorTrackingService } from '../startup/errorTracking.startup';
import { PIISanitizer } from '../utils/piiSanitizer';
import ERROR_TRACKING_CONFIG from '../config/errorTracking.config';

// Standardized error response format
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: any;
    timestamp: string;
    requestId?: string;
    path?: string;
    method?: string;
  };
  // Optional fields for development
  stack?: string;
  originalError?: any;
}

// Error response options
export interface ErrorHandlerOptions {
  includeStack?: boolean;
  includeOriginalError?: boolean;
  logErrors?: boolean;
  trackErrors?: boolean;
  sanitizePII?: boolean;
  i18n?: {
    enabled: boolean;
    defaultLanguage: string;
    translations?: Record<string, Record<string, string>>;
  };
}

// Default options
const DEFAULT_OPTIONS: ErrorHandlerOptions = {
  includeStack: process.env.NODE_ENV === 'development',
  includeOriginalError: process.env.NODE_ENV === 'development',
  logErrors: true,
  trackErrors: true,
  sanitizePII: true,
  i18n: {
    enabled: true,
    defaultLanguage: 'en',
  },
};

// Common error translations
const ERROR_TRANSLATIONS = {
  en: {
    INTERNAL_ERROR: 'An internal server error occurred',
    VALIDATION_ERROR: 'Validation failed',
    AUTHENTICATION_ERROR: 'Authentication failed',
    AUTHORIZATION_ERROR: 'You do not have permission to perform this action',
    NOT_FOUND: 'The requested resource was not found',
    RATE_LIMIT: 'Too many requests, please try again later',
    BAD_REQUEST: 'Invalid request',
    CONFLICT: 'Resource conflict',
    UNPROCESSABLE_ENTITY: 'Unable to process the request',
  },
  es: {
    INTERNAL_ERROR: 'Se produjo un error interno del servidor',
    VALIDATION_ERROR: 'La validación falló',
    AUTHENTICATION_ERROR: 'Autenticación fallida',
    AUTHORIZATION_ERROR: 'No tienes permiso para realizar esta acción',
    NOT_FOUND: 'El recurso solicitado no fue encontrado',
    RATE_LIMIT: 'Demasiadas solicitudes, por favor intente de nuevo más tarde',
    BAD_REQUEST: 'Solicitud inválida',
    CONFLICT: 'Conflicto de recursos',
    UNPROCESSABLE_ENTITY: 'No se puede procesar la solicitud',
  },
  // Add more languages as needed
};

// Get user's preferred language from request
function getUserLanguage(req: Request, defaultLang: string): string {
  // Check custom header
  const customLang = req.headers['x-user-language'] as string;
  if (customLang) return customLang;
  
  // Check Accept-Language header
  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage) {
    const primaryLang = acceptLanguage.split(',')[0].split('-')[0];
    return primaryLang;
  }
  
  return defaultLang;
}

// Translate error message
function translateError(
  code: string,
  message: string,
  language: string,
  translations?: Record<string, Record<string, string>>
): string {
  const allTranslations = { ...ERROR_TRANSLATIONS, ...translations };
  const langTranslations = allTranslations[language] || allTranslations['en'];
  
  // Try to find translation by error code
  const translation = langTranslations?.[code];
  if (translation) return translation;
  
  // Return original message if no translation found
  return message;
}

// Create error response
function createErrorResponse(
  error: ApiError | Error,
  req: Request,
  options: ErrorHandlerOptions
): ErrorResponse {
  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 500;
  const errorCode = isApiError ? error.code : 'INTERNAL_ERROR';
  
  // Get user language for i18n
  const userLang = options.i18n?.enabled 
    ? getUserLanguage(req, options.i18n.defaultLanguage)
    : 'en';
  
  // Translate message if i18n is enabled
  let message = error.message;
  if (options.i18n?.enabled) {
    message = translateError(
      errorCode,
      message,
      userLang,
      options.i18n.translations
    );
  }
  
  // Sanitize message if configured
  if (options.sanitizePII && ERROR_TRACKING_CONFIG.privacy.sanitizePII) {
    message = PIISanitizer.sanitizeString(message);
  }
  
  // Build base response
  const response: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId || (req as any).id,
      path: req.path,
      method: req.method,
    },
  };
  
  // Add details if available (sanitized)
  if (isApiError && error.details) {
    response.error.details = options.sanitizePII 
      ? PIISanitizer.sanitizeObject(error.details)
      : error.details;
  }
  
  // Add stack trace in development
  if (options.includeStack && error.stack) {
    response.stack = options.sanitizePII
      ? PIISanitizer.sanitizeStackTrace(error.stack)
      : error.stack;
  }
  
  // Add original error in development
  if (options.includeOriginalError && isApiError && error.originalError) {
    response.originalError = options.sanitizePII
      ? PIISanitizer.sanitizeError(error.originalError)
      : error.originalError;
  }
  
  return response;
}

// Async error handler wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Main error handler factory
export function createErrorHandler(options: Partial<ErrorHandlerOptions> = {}): ErrorRequestHandler {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  return async (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Skip if headers already sent
    if (res.headersSent) {
      return next(err);
    }
    
    try {
      // Create error response
      const errorResponse = createErrorResponse(err, req, config);
      const { statusCode } = errorResponse.error;
      
      // Log error if enabled
      if (config.logErrors) {
        const logLevel = statusCode >= 500 ? 'error' : 'warn';
        logger[logLevel]('Request error', {
          error: {
            code: errorResponse.error.code,
            message: errorResponse.error.message,
            statusCode,
            stack: err.stack,
          },
          request: {
            method: req.method,
            path: req.path,
            query: req.query,
            params: req.params,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            userId: (req as any).user?.id,
          },
        });
      }
      
      // Track error if enabled
      if (config.trackErrors && statusCode >= 500) {
        try {
          const errorTracking = getErrorTrackingService();
          await errorTracking.trackError(err, {
            userId: (req as any).user?.id,
            requestId: (req as any).requestId,
            action: req.method,
            resource: req.path,
            metadata: {
              ip: req.ip,
              userAgent: req.get('user-agent'),
              query: req.query,
              params: req.params,
            },
          });
        } catch (trackingError) {
          logger.error('Failed to track error', trackingError);
        }
      }
      
      // Send response
      res.status(statusCode).json(errorResponse);
    } catch (handlerError) {
      // Fallback error response
      logger.error('Error handler failed', handlerError);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal server error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}

// Default error handler instance
export const errorHandler = createErrorHandler();

// 404 Not Found handler
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = ApiError.notFound(`Resource not found: ${req.method} ${req.path}`);
  next(error);
}

// Global error handlers setup
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    });
    
    // Track if error tracking is available
    try {
      const errorTracking = getErrorTrackingService();
      const error = reason instanceof Error ? reason : new Error(String(reason));
      errorTracking.trackError(error, {
        action: 'unhandledRejection',
        resource: 'process',
      });
    } catch (err) {
      logger.error('Failed to track unhandled rejection', err);
    }
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });
    
    // Track if error tracking is available
    try {
      const errorTracking = getErrorTrackingService();
      errorTracking.trackError(error, {
        action: 'uncaughtException',
        resource: 'process',
      });
    } catch (err) {
      logger.error('Failed to track uncaught exception', err);
    }
    
    // Exit process after logging
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}

// Export types and utilities
export {
  ApiError,
  ErrorHandlerOptions,
  ErrorResponse,
};