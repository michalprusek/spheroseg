/**
 * Consolidated Security Middleware
 *
 * This module consolidates all security-related middleware:
 * - Security headers (HSTS, X-Frame-Options, etc.)
 * - Content Security Policy (CSP)
 * - CSRF protection
 * - CORS configuration
 * - General security hardening
 */

import { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import config from '../../config';
import logger from '../../utils/logger';
import { standardLimiter } from './rateLimitMiddleware';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

export interface SecurityOptions {
  /** Whether to enable HSTS */
  hsts?: boolean;
  /** HSTS max age in seconds */
  hstsMaxAge?: number;
  /** Whether to include subdomains in HSTS */
  hstsIncludeSubdomains?: boolean;
  /** Whether to enable CSP in report-only mode */
  cspReportOnly?: boolean;
  /** URL to send CSP violation reports to */
  cspReportUri?: string;
  /** Whether to enable CSRF protection */
  csrfProtection?: boolean;
  /** Custom CORS origins */
  corsOrigins?: string[];
  /** Whether to enable rate limiting */
  enableRateLimit?: boolean;
}

export interface CSRFTokenRequest extends Request {
  csrfToken?: string;
}

// =============================================================================
// SECURITY HEADERS MIDDLEWARE
// =============================================================================

/**
 * Apply security headers to responses
 */
export const createSecurityHeadersMiddleware = (options: SecurityOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const {
      hsts = true,
      hstsMaxAge = 31536000, // 1 year
      hstsIncludeSubdomains = true,
    } = options;

    // HSTS (HTTP Strict Transport Security)
    if (hsts && req.secure) {
      let hstsValue = `max-age=${hstsMaxAge}`;
      if (hstsIncludeSubdomains) {
        hstsValue += '; includeSubDomains';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // X-Frame-Options
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-XSS-Protection (deprecated but still widely supported)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy (Feature-Policy successor)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Cross-Origin policies
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    next();
  };
};

// =============================================================================
// CONTENT SECURITY POLICY MIDDLEWARE
// =============================================================================

/**
 * Generate a nonce for inline scripts
 */
const generateNonce = (): string => {
  return crypto.randomBytes(16).toString('base64');
};

/**
 * Create CSP middleware
 */
export const createCSPMiddleware = (options: SecurityOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { cspReportOnly = false, cspReportUri } = options;

    const nonce = generateNonce();

    // Store nonce in request for use in templates
    (req as any).nonce = nonce;

    const isDevelopment = process.env.NODE_ENV === 'development';

    // Build CSP directives
    const directives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", `'nonce-${nonce}'`, ...(isDevelopment ? ["'unsafe-eval'"] : [])],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for many CSS frameworks
      ],
      'img-src': [
        "'self'",
        'data:', // Allow data URLs for images
        'https:', // Allow HTTPS images
        'blob:', // Allow blob URLs for images
      ],
      'font-src': [
        "'self'",
        'data:', // Allow data URLs for fonts
        'https:', // Allow HTTPS fonts
      ],
      'connect-src': [
        "'self'",
        'ws:', // WebSocket connections
        'wss:', // Secure WebSocket connections
        ...(isDevelopment ? ['http://localhost:*'] : []),
      ],
      'media-src': [
        "'self'",
        'blob:', // Allow blob URLs for media
      ],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
    };

    // Add report URI if provided
    if (cspReportUri) {
      (directives as any)['report-uri'] = [cspReportUri];
    }

    // Convert directives to CSP string
    const cspString = Object.entries(directives)
      .map(([directive, sources]) => {
        if (sources.length === 0) {
          return directive;
        }
        return `${directive} ${sources.join(' ')}`;
      })
      .join('; ');

    // Set CSP header
    const headerName = cspReportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    res.setHeader(headerName, cspString);

    next();
  };
};

// =============================================================================
// CSRF PROTECTION MIDDLEWARE
// =============================================================================

/**
 * Generate CSRF token
 */
const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create CSRF protection middleware
 */
export const createCSRFMiddleware = (options: SecurityOptions = {}) => {
  const { csrfProtection = true } = options;

  if (!csrfProtection) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const ignoreMethods = ['GET', 'HEAD', 'OPTIONS'];

    // Skip CSRF for safe methods
    if (ignoreMethods.includes(req.method)) {
      return next();
    }

    // Skip CSRF for API endpoints using Authorization header
    if (req.headers.authorization) {
      return next();
    }

    // Skip CSRF for public endpoints
    const publicEndpoints = ['/api/access-requests'];
    if (publicEndpoints.some((endpoint) => req.path.startsWith(endpoint))) {
      return next();
    }

    const token = (req.headers['x-xsrf-token'] as string) || req.body?._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!sessionToken) {
      // Generate new CSRF token for session
      const newToken = generateCSRFToken();
      if (req.session) {
        req.session.csrfToken = newToken;
      }

      // Set CSRF token cookie
      res.cookie('XSRF-TOKEN', newToken, {
        httpOnly: false, // Must be accessible to JavaScript
        secure: req.secure,
        sameSite: 'strict',
      });

      return next();
    }

    if (!token || token !== sessionToken) {
      logger.warn('CSRF token mismatch', {
        method: req.method,
        url: req.url,
        hasToken: !!token,
        hasSessionToken: !!sessionToken,
      });

      return res.status(403).json({
        error: 'CSRF token mismatch',
        message: 'Invalid or missing CSRF token',
      });
    }

    next();
  };
};

// =============================================================================
// CORS MIDDLEWARE
// =============================================================================

/**
 * Create CORS middleware
 */
export const createCORSMiddleware = (options: SecurityOptions = {}) => {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://frontend:3000',
    'https://spherosegapp.utia.cas.cz',
  ];

  const allowedOrigins = options.corsOrigins || config.cors?.allowedOrigins || defaultOrigins;

  const corsOptions = {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list or if wildcard is set
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request', { origin, allowedOrigins });
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-XSRF-TOKEN',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-XSRF-TOKEN'],
  };

  return cors(corsOptions);
};

// =============================================================================
// MAIN SECURITY MIDDLEWARE SETUP
// =============================================================================

/**
 * Apply all security middleware to Express application
 */
export const applySecurityMiddleware = (app: Express, options: SecurityOptions = {}): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  logger.info('Applying security middleware', {
    environment: process.env.NODE_ENV,
    options,
  });

  // Cookie parser (required for CSRF)
  app.use(cookieParser());

  // Helmet for basic security headers
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // Disabled for Socket.IO compatibility
      contentSecurityPolicy: false, // We handle CSP ourselves
      hsts: {
        maxAge: options.hstsMaxAge || 31536000,
        includeSubDomains: options.hstsIncludeSubdomains !== false,
        preload: true,
      },
    })
  );

  // Custom security headers
  app.use(createSecurityHeadersMiddleware(options));

  // Content Security Policy
  app.use(createCSPMiddleware(options));

  // CORS
  app.use(createCORSMiddleware(options));

  // Rate limiting (should be early in the middleware chain)
  if (options.enableRateLimit !== false && config.security?.enableRateLimit !== false) {
    app.use(standardLimiter);
    logger.info('Rate limiting enabled');
  } else {
    logger.info('Rate limiting disabled');
  }

  // CSRF protection (should be after CORS)
  if (!isDevelopment) {
    app.use(createCSRFMiddleware(options));
  } else {
    logger.info('CSRF protection disabled in development');
  }

  logger.info('Security middleware applied successfully');
};

// =============================================================================
// INDIVIDUAL MIDDLEWARE EXPORTS
// =============================================================================

export default {
  applySecurityMiddleware,
  createSecurityHeadersMiddleware,
  createCSPMiddleware,
  createCSRFMiddleware,
  createCORSMiddleware,
};
