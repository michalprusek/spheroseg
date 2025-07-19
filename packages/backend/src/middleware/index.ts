/**
 * Centralized Middleware Configuration
 *
 * This module organizes and configures all middleware for the Express application
 * in a centralized location for better maintainability and consistency.
 */

import express, { Application } from 'express';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import fs from 'fs';

import config from '../config';
import performanceConfig from '../config/performance';
import logger from '../utils/logger';
import { errorHandler } from './errorHandler';
import { configureSecurity } from '../security';
import { requestLoggerMiddleware } from '../monitoring/unified';
import { trackAPIPerformance, addResponseTimeHeader } from './performanceTracking';
import createSessionMiddleware, { sessionSecurityMiddleware } from '../config/session';
// TODO: Fix i18n imports - temporarily disabled
// import { createI18nMiddleware } from '../config/i18n';
// import { setUserLanguage } from './i18n';

/**
 * Security middleware configuration
 */
export const configureSecurityMiddleware = (app: Application): void => {
  configureSecurity(app);
};

/**
 * Performance middleware configuration
 */
export const configurePerformanceMiddleware = (app: Application): void => {
  // Compression for response payloads
  app.use(
    compression({
      level: performanceConfig.compression.level,
      threshold: performanceConfig.compression.threshold,
      memLevel: performanceConfig.compression.memLevel,
      filter: (req: express.Request, res: express.Response) => {
        // Don't compress if the request includes a Cache-Control no-transform directive
        if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
          return false;
        }

        // Always compress JSON responses
        const contentType = res.getHeader('Content-Type')?.toString() || '';
        if (contentType.includes('application/json')) {
          return true;
        }

        // Use default compression filter for other content types
        return compression.filter(req, res);
      },
    })
  );

  logger.info('Compression middleware configured', {
    level: performanceConfig.compression.level,
    threshold: performanceConfig.compression.threshold,
    memLevel: performanceConfig.compression.memLevel,
  });
};

/**
 * Logging middleware configuration
 */
export const configureLoggingMiddleware = (app: Application): void => {
  // HTTP request logging
  const logFormat = config.isDevelopment ? 'dev' : 'combined';

  app.use(
    morgan(logFormat, {
      stream: {
        write: (message: string) => {
          // Remove trailing newline and log through Winston
          logger.info(message.trim(), {
            service: 'http-access',
            module: 'morgan',
          });
        },
      },
      // Skip logging for health checks in production
      skip: (req: express.Request) => {
        return !config.isDevelopment && req.path === '/health';
      },
    })
  );
};

/**
 * Body parsing middleware configuration
 */
export const configureBodyParsingMiddleware = (_app: Application): void => {
  // Body parsing is now handled in app.ts BEFORE any other middleware
  // This ensures security checks have access to parsed body
  logger.info('Body parsing configured in app.ts');
};

/**
 * i18n middleware configuration
 */
export const configureI18nMiddleware = (_app: Application): void => {
  // TODO: Fix i18n imports - temporarily disabled
  // const i18nMiddleware = createI18nMiddleware();
  // app.use(i18nMiddleware);

  // Add user language detection middleware (must be after auth)
  // app.use(setUserLanguage);

  logger.info('i18n middleware temporarily disabled - requires import fixes', {
    languages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
  });
};

/**
 * Session middleware configuration
 */
export const configureSessionMiddleware = (app: Application): void => {
  try {
    // Initialize session middleware
    const sessionMiddleware = createSessionMiddleware();
    app.use(sessionMiddleware);
    
    // Add session security checks
    app.use(sessionSecurityMiddleware);
    
    logger.info('Session middleware configured with Redis store');
  } catch (error) {
    logger.error('Failed to configure session middleware', { error });
    // Sessions will fall back to memory store
  }
};

/**
 * Static files middleware configuration
 */
export const configureStaticFilesMiddleware = (app: Application): void => {
  const uploadsPath = config.storage.uploadDir;

  // Ensure upload directory exists
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    logger.info(`Created upload directory: ${uploadsPath}`);
  }

  // Serve static files with proper caching headers
  app.use(
    '/uploads',
    express.static(uploadsPath, {
      maxAge: config.isDevelopment ? 0 : '1d', // Cache for 1 day in production
      etag: true,
      lastModified: true,
      setHeaders: (res: express.Response, filePath: string) => {
        // Set proper content type for images
        const ext = path.extname(filePath).toLowerCase();
        if (['.jpg', '.jpeg'].includes(ext)) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (ext === '.png') {
          res.setHeader('Content-Type', 'image/png');
        } else if (ext === '.tiff' || ext === '.tif') {
          res.setHeader('Content-Type', 'image/tiff');
        }

        // Add security headers for file uploads
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );
};

/**
 * Error handling middleware configuration
 */
export const configureErrorHandlingMiddleware = (app: Application): void => {
  // 404 handler for unknown routes
  app.use('*', (req: express.Request, res: express.Response) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);
};

/**
 * Configure all middleware in the correct order
 */
export const configureMiddleware = (app: Application): void => {
  // 1. Performance middleware (compression should be early)
  configurePerformanceMiddleware(app);

  // 2. Logging middleware (log raw requests)
  configureLoggingMiddleware(app);

  // 3. Body parsing middleware (MUST be before security checks that need body)
  configureBodyParsingMiddleware(app);

  // 4. Session middleware (needs to be before auth checks)
  configureSessionMiddleware(app);

  // 5. Security middleware (needs parsed body for suspicious pattern detection)
  configureSecurityMiddleware(app);

  // 6. i18n middleware (needs to be early in the chain)
  // TODO: Fix i18n middleware - temporarily disabled due to module resolution issues
  // configureI18nMiddleware(app);

  // 7. Request monitoring middleware (unified monitoring system)
  app.use(requestLoggerMiddleware);

  // 8. Performance tracking middleware
  app.use(addResponseTimeHeader());
  app.use(trackAPIPerformance());

  // 9. Static files middleware
  configureStaticFilesMiddleware(app);

  logger.info('All middleware configured successfully');
};

/**
 * Configure error handling middleware (should be called after routes)
 */
export const configureErrorMiddleware = (app: Application): void => {
  configureErrorHandlingMiddleware(app);
  logger.info('Error handling middleware configured');
};
