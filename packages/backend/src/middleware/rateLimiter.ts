/**
 * Rate Limiting Middleware
 *
 * Provides configurable rate limiting for different endpoint types
 * Enhanced with security configuration integration
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { securityConfig } from '../config/security';
import logger from '../utils/logger';

// Helper to create consistent rate limiter configuration
function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests, please try again later',
    standardHeaders: securityConfig.rateLimit.standardHeaders,
    legacyHeaders: securityConfig.rateLimit.legacyHeaders,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    keyGenerator:
      options.keyGenerator ||
      ((req: Request) => {
        // Use user ID if authenticated, otherwise use IP
        const userId = (req as any).user?.id || (req as any).user?.userId;
        return userId || req.ip;
      }),
    skip: options.skip,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userId: (req as any).user?.id || (req as any).user?.userId,
        method: req.method,
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        message: options.message || 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
}

// Rate limiter for diagnostic endpoints
export const diagnosticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many diagnostic requests, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for diagnostics', {
      ip: req.ip,
      path: req.path,
      userId: (req as unknown).user?.userId,
    });
    res.status(429).json({
      error: 'Too many diagnostic requests',
      message: 'Please wait before making additional diagnostic requests',
      retryAfter: Math.ceil(req.rateLimit?.resetTime || Date.now() / 1000),
    });
  },
});

// Rate limiter for image upload endpoints (using security config)
export const uploadLimiter = createRateLimiter({
  windowMs: securityConfig.rateLimit.endpoints.upload.windowMs,
  max: securityConfig.rateLimit.endpoints.upload.max,
  message: 'Too many uploads, please try again later',
});

// Rate limiter for general API endpoints (using security config)
export const apiLimiter = createRateLimiter({
  windowMs: securityConfig.rateLimit.endpoints.api.windowMs,
  max: securityConfig.rateLimit.endpoints.api.max,
  message: 'Too many API requests, please try again later',
  skip: (req: Request) => {
    // Skip rate limiting for health check paths
    const skipPaths = ['/health', '/health/live', '/health/ready', '/metrics'];
    return skipPaths.some((path) => req.path.includes(path));
  },
});

// Rate limiter for authentication endpoints (using security config)
export const authLimiter = createRateLimiter({
  windowMs: securityConfig.rateLimit.endpoints.login.windowMs,
  max: securityConfig.rateLimit.endpoints.login.max,
  skipSuccessfulRequests: securityConfig.rateLimit.endpoints.login.skipSuccessfulRequests,
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req: Request) => {
    // Rate limit by email/username + IP combination for better security
    const identifier = req.body?.email || req.body?.username || '';
    return `${identifier}:${req.ip}`;
  },
});

// Rate limiter for signup endpoints
export const signupLimiter = createRateLimiter({
  windowMs: securityConfig.rateLimit.endpoints.signup.windowMs,
  max: securityConfig.rateLimit.endpoints.signup.max,
  message: 'Too many signup attempts, please try again later',
  keyGenerator: (req: Request) => {
    // Rate limit by email + IP
    const email = req.body?.email || '';
    return `signup:${email}:${req.ip}`;
  },
});

// Rate limiter for password reset
export const passwordResetLimiter = createRateLimiter({
  windowMs: 3600000, // 1 hour
  max: 3,
  message: 'Too many password reset attempts, please try again later',
  keyGenerator: (req: Request) => {
    const email = req.body?.email || req.params?.email || '';
    return `reset:${email}:${req.ip}`;
  },
});

// Rate limiter for segmentation requests
export const segmentationLimiter = createRateLimiter({
  windowMs: 300000, // 5 minutes
  max: 10,
  message: 'Too many segmentation requests, please wait for current tasks to complete',
});

// Dynamic rate limiter based on user tier (example)
export function createDynamicLimiter(options: {
  windowMs: number;
  standardMax: number;
  premiumMax: number;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: (req: Request) => {
      const user = (req as unknown).user;
      const isPremium = user?.tier === 'premium';
      return isPremium ? options.premiumMax : options.standardMax;
    },
    keyGenerator: (req: Request) => {
      const userId = (req as unknown).user?.userId;
      return userId || req.ip;
    },
  });
}

// Apply different rate limiters based on path
export function dynamicRateLimiter(req: Request, res: Response, next: Function): void {
  const path = req.path.toLowerCase();

  // Apply specific limiters based on path patterns
  if (path.includes('/login') || path.includes('/signin') || path.includes('/auth')) {
    return authLimiter(req, res, next);
  }

  if (path.includes('/signup') || path.includes('/register')) {
    return signupLimiter(req, res, next);
  }

  if (path.includes('/upload') || path.includes('/images')) {
    return uploadLimiter(req, res, next);
  }

  if (path.includes('/segment') || path.includes('/process')) {
    return segmentationLimiter(req, res, next);
  }

  if (path.includes('/password') || path.includes('/reset')) {
    return passwordResetLimiter(req, res, next);
  }

  if (path.includes('/diagnostic')) {
    return diagnosticsLimiter(req, res, next);
  }

  // Default to general API limiter
  return apiLimiter(req, res, next);
}
