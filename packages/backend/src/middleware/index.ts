/**
 * Centralized Middleware Configuration
 * 
 * This module organizes and configures all middleware for the Express application
 * in a centralized location for better maintainability and consistency.
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
// import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import config from '../config';
import logger from '../utils/logger';
import { errorHandler } from './errorHandler';

/**
 * Security middleware configuration
 */
export const configureSecurityMiddleware = (app: Application): void => {
  // Helmet for security headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // Disable for Socket.IO compatibility
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: config.server.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // Rate limiting - more lenient in development
  const limiter = rateLimit({
    windowMs: config.security.rateLimitWindow * 1000, // Convert to milliseconds
    max: config.isDevelopment ? 1000 : config.security.rateLimitRequests, // Much higher limit in development
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: config.security.rateLimitWindow,
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for health checks and static files
    skip: (req: express.Request) => {
      return req.path === '/health' || req.path.startsWith('/uploads/');
    },
  });
  
  app.use('/api', limiter);
};

/**
 * Performance middleware configuration
 */
export const configurePerformanceMiddleware = (app: Application): void => {
  // Compression for response payloads - temporarily disabled
  // app.use(compression({
  //   level: 6, // Balance between compression ratio and CPU usage
  //   threshold: 1024, // Only compress responses larger than 1KB
  //   filter: (req: express.Request, res: express.Response) => {
  //     // Don't compress if the request includes a Cache-Control no-transform directive
  //     if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
  //       return false;
  //     }
  //     // Use compression filter function
  //     return compression.filter(req, res);
  //   },
  // }));
};

/**
 * Logging middleware configuration
 */
export const configureLoggingMiddleware = (app: Application): void => {
  // HTTP request logging
  const logFormat = config.isDevelopment 
    ? 'dev' 
    : 'combined';

  app.use(morgan(logFormat, {
    stream: {
      write: (message: string) => {
        // Remove trailing newline and log through Winston
        logger.info(message.trim(), { 
          service: 'http-access',
          module: 'morgan' 
        });
      },
    },
    // Skip logging for health checks in production
    skip: (req: express.Request) => {
      return !config.isDevelopment && req.path === '/health';
    },
  }));
};

/**
 * Body parsing middleware configuration
 */
export const configureBodyParsingMiddleware = (app: Application): void => {
  // JSON body parser with configurable size limit
  app.use(express.json({ 
    limit: config.storage.maxFileSize || '10mb',
    verify: (req: express.Request, res: express.Response, buf: Buffer) => {
      // Store raw body for webhook verification if needed
      (req as any).rawBody = buf;
    },
  }));

  // URL-encoded body parser
  app.use(express.urlencoded({ 
    extended: true, 
    limit: config.storage.maxFileSize || '10mb',
  }));
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
  app.use('/uploads', express.static(uploadsPath, {
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
  }));
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
  // 1. Security middleware (should be first)
  configureSecurityMiddleware(app);
  
  // 2. Performance middleware
  configurePerformanceMiddleware(app);
  
  // 3. Logging middleware
  configureLoggingMiddleware(app);
  
  // 4. Body parsing middleware
  configureBodyParsingMiddleware(app);
  
  // 5. Static files middleware
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