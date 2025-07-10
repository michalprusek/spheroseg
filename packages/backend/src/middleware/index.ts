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
export const configureBodyParsingMiddleware = (app: Application): void => {
  // Body parsing is now handled in app.ts BEFORE any other middleware
  // This ensures security checks have access to parsed body
  logger.info('Body parsing configured in app.ts');
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

  // 4. Security middleware (needs parsed body for suspicious pattern detection)
  configureSecurityMiddleware(app);

  // 5. Request monitoring middleware (unified monitoring system)
  app.use(requestLoggerMiddleware);

  // 6. Performance tracking middleware
  app.use(addResponseTimeHeader());
  app.use(trackAPIPerformance());

  // 7. Static files middleware
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
