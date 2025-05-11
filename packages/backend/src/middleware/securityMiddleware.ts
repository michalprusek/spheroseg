import { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from '../config';
import logger from '../utils/logger';
import createCSPMiddleware from './cspMiddleware';
import createSecurityHeadersMiddleware from './securityHeadersMiddleware';
import createCSRFMiddleware from './csrfMiddleware';
import securityReportRoutes from '../routes/securityReportRoutes';

// Define cors.allowedOrigins fallback if config.cors is undefined
const corsConfig = {
  allowedOrigins: ['http://localhost:3000', 'http://frontend:3000', '*'],
};

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Make sure to configure this properly for your environment
    const allowedOrigins = config.cors?.allowedOrigins || corsConfig.allowedOrigins;

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf('*') !== -1 || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN', 'X-Requested-With'],
};

/**
 * Apply security middleware to Express application
 * @param app Express application
 */
const applySecurityMiddleware = (app: Express) => {
  // Get environment
  const env = process.env.NODE_ENV || 'development';

  // Cookie parser is required for CSRF protection
  app.use(cookieParser());

  // Helmet helps secure Express apps by setting various HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // We use custom CSP middleware
      crossOriginEmbedderPolicy: false, // We handle this in security headers middleware
      crossOriginOpenerPolicy: false, // We handle this in security headers middleware
      crossOriginResourcePolicy: false, // We handle this in security headers middleware
      referrerPolicy: false, // We handle this in security headers middleware
      hsts: false, // We handle this in security headers middleware
      xFrameOptions: false, // We handle this in security headers middleware
      xContentTypeOptions: false, // We handle this in security headers middleware
      xXssProtection: false, // We handle this in security headers middleware
    }),
  );

  // Apply CORS
  app.use(cors(corsOptions));

  // Apply Content Security Policy
  app.use(createCSPMiddleware(env));

  // Apply Security Headers
  app.use(createSecurityHeadersMiddleware(env));

  // Apply CSRF protection (except in development)
  if (env !== 'development') {
    app.use(createCSRFMiddleware(env));
  }

  // Register security report routes
  app.use('/api/security/report', securityReportRoutes);

  // Log security middleware application
  logger.info('Security middleware applied', {
    environment: env,
    csrf: env !== 'development',
    csp: true,
    securityHeaders: true,
  });
};

export default applySecurityMiddleware;
