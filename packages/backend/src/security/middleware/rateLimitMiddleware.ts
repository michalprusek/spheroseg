import expressRateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { NextFunction, Request, Response } from 'express';
import logger from '../../utils/logger';
import config from '../../config';

/**
 * Rate limit configurations for different endpoint types
 */
const rateLimitConfigs = {
  default: {
    windowMs: (config.security?.rateLimitWindow || 60) * 1000, // Convert seconds to ms
    max: config.security?.rateLimitRequests || 100,
    message: 'Too many requests, please try again later',
    retryAfter: config.security?.rateLimitWindow || 60,
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.isTest ? 5 : 10, // Stricter limit for auth
    message: 'Too many authentication attempts, please try again later',
    retryAfter: 900, // 15 minutes in seconds
  },
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: config.isTest ? 2 : 5, // Very strict for sensitive operations
    message: 'Too many sensitive operations, please try again later',
    retryAfter: 3600, // 1 hour in seconds
  },
};

/**
 * Common rate limit options
 */
const commonOptions: Partial<Options> = {
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipFailedRequests: false, // Count failed requests
  keyGenerator: (req: Request) => {
    // Use user ID if available, otherwise use IP
    return (req as any).user?.userId || req.ip || 'unknown';
  },
};

/**
 * Error handler for rate limit exceeded
 */
const createErrorHandler = (type: string, retryAfter: number) => {
  return (req: Request, res: Response, _next: NextFunction, options: any) => {
    logger.warn(`${type} rate limit exceeded`, {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.userId,
      userAgent: req.get('User-Agent'),
    });
    
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: {
        message: options.message,
        retryAfter,
        timestamp: new Date().toISOString(),
      },
    });
  };
};

/**
 * Create a rate limiter based on the specified type
 *
 * @param type The type of rate limit to apply ('default', 'auth', or 'sensitive')
 * @returns A middleware function that applies rate limiting
 */
export function createRateLimiter(
  type: 'default' | 'auth' | 'sensitive' = 'default'
): RateLimitRequestHandler {
  // Skip rate limiting if explicitly disabled
  if (config.security?.enableRateLimit === false) {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  const typeConfig = rateLimitConfigs[type];
  
  const options: Partial<Options> = {
    ...commonOptions,
    windowMs: typeConfig.windowMs,
    max: typeConfig.max,
    message: typeConfig.message,
    handler: createErrorHandler(type, typeConfig.retryAfter),
  };

  return expressRateLimit(options);
}

// Pre-configured rate limiters for common use cases
export const standardLimiter = createRateLimiter('default');
export const authLimiter = createRateLimiter('auth');
export const sensitiveOperationsLimiter = createRateLimiter('sensitive');

// Backward compatibility export
export const rateLimit = createRateLimiter;

// Export configurations for testing
export const getRateLimitConfig = (type: keyof typeof rateLimitConfigs) => {
  return rateLimitConfigs[type];
};