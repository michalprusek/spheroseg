/**
 * Rate Limiting Middleware
 *
 * Provides configurable rate limiting for different endpoint types
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../utils/logger';

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

// Rate limiter for image upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // limit each IP to 50 uploads per windowMs
  message: 'Too many uploads, please try again later',
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    const userId = (req as unknown).user?.userId;
    return userId || req.ip;
  },
});

// Rate limiter for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  skip: (req: Request) => {
    // Skip rate limiting for certain paths
    const skipPaths = ['/health', '/metrics'];
    return skipPaths.includes(req.path);
  },
});

// Rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: 'Too many authentication attempts, please try again later',
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
