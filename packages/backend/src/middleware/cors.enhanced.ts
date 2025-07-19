/**
 * Enhanced CORS Middleware with Strict Whitelist Validation
 * 
 * Features:
 * - Domain whitelist with pattern matching
 * - Environment-specific configurations
 * - Request origin validation
 * - Preflight caching optimization
 * - Security logging and monitoring
 * - Dynamic origin validation
 */

import cors, { CorsOptions, CorsOptionsDelegate } from 'cors';
import { Request, Response } from 'express';
import { URL } from 'url';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError.enhanced';
import config from '../config';

// CORS origin patterns for different environments
interface OriginPattern {
  pattern: string | RegExp;
  description: string;
  allowCredentials: boolean;
}

// Strict whitelist of allowed origins
const ORIGIN_WHITELIST: OriginPattern[] = [
  // Development origins
  {
    pattern: /^http:\/\/localhost(:\d+)?$/,
    description: 'Local development',
    allowCredentials: true,
  },
  {
    pattern: /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    description: 'Local development (IP)',
    allowCredentials: true,
  },
  // Production domains (add your domains here)
  {
    pattern: process.env['PRODUCTION_DOMAIN'] ? 
      new RegExp(`^https://${process.env['PRODUCTION_DOMAIN'].replace('.', '\\.')}$`) : 
      /^$/,
    description: 'Production domain',
    allowCredentials: true,
  },
  {
    pattern: process.env['PRODUCTION_DOMAIN'] ? 
      new RegExp(`^https://www\\.${process.env['PRODUCTION_DOMAIN'].replace('.', '\\.')}$`) : 
      /^$/,
    description: 'Production domain (www)',
    allowCredentials: true,
  },
  // Staging domain
  {
    pattern: process.env['STAGING_DOMAIN'] ? 
      new RegExp(`^https://${process.env['STAGING_DOMAIN'].replace('.', '\\.')}$`) : 
      /^$/,
    description: 'Staging domain',
    allowCredentials: true,
  },
];

// Additional allowed origins from environment
const ADDITIONAL_ORIGINS = process.env['CORS_ALLOWED_ORIGINS']
  ?.split(',')
  .map(origin => origin.trim())
  .filter(Boolean) || [];

/**
 * Validate origin against whitelist
 */
function isOriginAllowed(origin: string | undefined): OriginPattern | null {
  if (!origin) {
    return null;
  }

  // Check against pattern whitelist
  for (const entry of ORIGIN_WHITELIST) {
    if (typeof entry.pattern === 'string') {
      if (origin === entry.pattern) {
        return entry;
      }
    } else if (entry.pattern.test(origin)) {
      return entry;
    }
  }

  // Check against additional origins
  if (ADDITIONAL_ORIGINS.includes(origin)) {
    return {
      pattern: origin,
      description: 'Additional allowed origin',
      allowCredentials: true,
    };
  }

  return null;
}

/**
 * Validate origin URL structure
 */
function validateOriginStructure(origin: string): boolean {
  try {
    const url = new URL(origin);
    
    // Ensure protocol is http or https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    
    // Ensure no username/password in URL
    if (url.username || url.password) {
      return false;
    }
    
    // Ensure no path (origin should not include path)
    if (url.pathname !== '/') {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Log CORS requests for monitoring
 */
function logCorsRequest(req: Request, origin: string | undefined, allowed: boolean, reason?: string): void {
  const logData = {
    origin,
    allowed,
    reason,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  };

  if (allowed) {
    logger.debug('CORS request allowed', logData);
  } else {
    logger.warn('CORS request blocked', logData);
  }
}

/**
 * Dynamic CORS options based on request
 */
const corsOptionsDelegate: CorsOptionsDelegate = (req: Request, callback) => {
  const origin = req.header('Origin');
  
  // Validate origin structure
  if (origin && !validateOriginStructure(origin)) {
    logCorsRequest(req, origin, false, 'Invalid origin structure');
    return callback(new ApiError('CORS_INVALID_ORIGIN', 'Invalid origin format'));
  }
  
  const matchedPattern = isOriginAllowed(origin);
  
  if (!origin) {
    // No origin header (same-origin request)
    const options: CorsOptions = {
      origin: false,
      credentials: false,
    };
    logCorsRequest(req, origin, true, 'Same-origin request');
    callback(null, options);
  } else if (matchedPattern) {
    // Origin is whitelisted
    const options: CorsOptions = {
      origin: true,
      credentials: matchedPattern.allowCredentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-Page',
        'X-Per-Page',
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-RateLimit-Retry-After',
      ],
      maxAge: config.env === 'production' ? 86400 : 3600, // 24h in prod, 1h in dev
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };
    
    logCorsRequest(req, origin, true, matchedPattern.description);
    callback(null, options);
  } else {
    // Origin not allowed
    logCorsRequest(req, origin, false, 'Origin not in whitelist');
    callback(new ApiError('CORS_ORIGIN_NOT_ALLOWED', 'Origin not allowed by CORS policy'));
  }
};

/**
 * Create enhanced CORS middleware
 */
export function createEnhancedCorsMiddleware() {
  return cors(corsOptionsDelegate);
}

/**
 * Middleware to add additional CORS security headers
 */
export function additionalCorsHeaders(req: Request, res: Response, next: Function): void {
  // Add Vary header to ensure proper caching
  res.vary('Origin');
  
  // Add additional security headers for CORS requests
  const origin = req.header('Origin');
  if (origin && isOriginAllowed(origin)) {
    // Timing-Allow-Origin for performance monitoring
    res.setHeader('Timing-Allow-Origin', origin);
  }
  
  next();
}

/**
 * Get current CORS configuration (for admin endpoints)
 */
export function getCorsConfiguration() {
  return {
    whitelist: ORIGIN_WHITELIST.map(entry => ({
      pattern: entry.pattern.toString(),
      description: entry.description,
      allowCredentials: entry.allowCredentials,
    })),
    additionalOrigins: ADDITIONAL_ORIGINS,
    environment: config.env,
    settings: {
      maxAge: config.env === 'production' ? 86400 : 3600,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    },
  };
}

/**
 * Validate CORS configuration on startup
 */
export function validateCorsConfiguration(): void {
  const errors: string[] = [];
  
  // Check production domain is set in production
  if (config.env === 'production' && !process.env['PRODUCTION_DOMAIN']) {
    errors.push('PRODUCTION_DOMAIN environment variable is required in production');
  }
  
  // Validate additional origins format
  for (const origin of ADDITIONAL_ORIGINS) {
    if (!validateOriginStructure(origin)) {
      errors.push(`Invalid origin format in CORS_ALLOWED_ORIGINS: ${origin}`);
    }
  }
  
  // Check for localhost in production
  if (config.env === 'production') {
    const hasLocalhost = ADDITIONAL_ORIGINS.some(origin => 
      origin.includes('localhost') || origin.includes('127.0.0.1')
    );
    if (hasLocalhost) {
      errors.push('Localhost origins should not be allowed in production');
    }
  }
  
  if (errors.length > 0) {
    errors.forEach(error => logger.error('CORS configuration error:', error));
    if (config.env === 'production') {
      throw new Error('Invalid CORS configuration for production');
    }
  }
  
  logger.info('CORS configuration validated', {
    environment: config.env,
    whitelistCount: ORIGIN_WHITELIST.length,
    additionalOriginsCount: ADDITIONAL_ORIGINS.length,
  });
}

// Export middleware and utilities
export const enhancedCors = createEnhancedCorsMiddleware();
export default enhancedCors;