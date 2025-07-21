/**
 * Rate Limiting Middleware for Error Tracking Endpoints
 * 
 * Prevents abuse of error tracking endpoints while allowing legitimate error reporting
 */

import { Request, Response, NextFunction } from 'express';
import { DynamicRateLimiter } from './rateLimiter.enhanced';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// Create a dedicated rate limiter instance for error tracking
const errorTrackingLimiter = new DynamicRateLimiter();

// Specific rate limits for error tracking endpoints
const ERROR_TRACKING_LIMITS = {
  // Public error reporting endpoint (if exists)
  '/api/errors/report': {
    windowMs: 60000,      // 1 minute
    maxRequests: 5,       // 5 error reports per minute
    blockDuration: 300,   // 5 minutes block
    skipSuccessfulRequests: false,
  },
  
  // Admin error viewing endpoints
  '/api/error-tracking/errors': {
    windowMs: 60000,      // 1 minute
    maxRequests: 30,      // 30 requests per minute
    blockDuration: 180,   // 3 minutes block
    skipSuccessfulRequests: true,
  },
  
  // Pattern and insights endpoints
  '/api/error-tracking/patterns': {
    windowMs: 60000,      // 1 minute
    maxRequests: 20,      // 20 requests per minute
    blockDuration: 180,   // 3 minutes block
    skipSuccessfulRequests: true,
  },
  
  // Dashboard endpoint (heavier query)
  '/api/error-tracking/dashboard': {
    windowMs: 60000,      // 1 minute
    maxRequests: 10,      // 10 requests per minute
    blockDuration: 300,   // 5 minutes block
    skipSuccessfulRequests: true,
  },
  
  // Alert management endpoints
  '/api/error-tracking/alerts': {
    windowMs: 60000,      // 1 minute
    maxRequests: 20,      // 20 requests per minute
    blockDuration: 180,   // 3 minutes block
    skipSuccessfulRequests: true,
  },
};

/**
 * Rate limiting middleware factory for error tracking endpoints
 */
export function createErrorTrackingRateLimit(
  endpoint?: string,
  customLimits?: {
    windowMs?: number;
    maxRequests?: number;
    blockDuration?: number;
    skipSuccessfulRequests?: boolean;
  }
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = endpoint || req.path;
      const limits = customLimits || ERROR_TRACKING_LIMITS[path] || {
        windowMs: 60000,
        maxRequests: 20,
        blockDuration: 300,
        skipSuccessfulRequests: true,
      };
      
      // Get user identifier (prefer authenticated user ID, fallback to IP)
      const userId = (req as any).user?.id;
      const identifier = userId || req.ip || 'anonymous';
      const key = `error-tracking:${path}:${identifier}`;
      
      // Check rate limit
      const result = await errorTrackingLimiter.checkLimit(key, {
        windowMs: limits.windowMs,
        maxRequests: limits.maxRequests,
        identifier,
        path,
      });
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limits.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      
      if (!result.allowed) {
        // Log rate limit violation
        logger.warn('Error tracking rate limit exceeded', {
          path,
          identifier,
          requests: result.requests,
          limit: limits.maxRequests,
        });
        
        // Set retry header
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        
        throw ApiError.tooManyRequests(
          `Rate limit exceeded. Please retry after ${retryAfter} seconds.`
        );
      }
      
      // Continue to next middleware
      next();
      
      // After response, check if we should count this request
      if (limits.skipSuccessfulRequests) {
        res.on('finish', () => {
          if (res.statusCode >= 400) {
            // Only count failed requests
            errorTrackingLimiter.incrementCount(key);
          }
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        // If rate limiting fails, log but allow request to continue
        logger.error('Error tracking rate limit check failed', error);
        next();
      }
    }
  };
}

/**
 * Global error tracking rate limit middleware
 * Applied to all /api/error-tracking/* routes
 */
export const errorTrackingRateLimit = createErrorTrackingRateLimit();

/**
 * Strict rate limit for public error reporting
 * Prevents abuse of error submission endpoints
 */
export const strictErrorReportingLimit = createErrorTrackingRateLimit('/api/errors/report', {
  windowMs: 300000,    // 5 minutes
  maxRequests: 10,     // 10 reports per 5 minutes
  blockDuration: 900,  // 15 minutes block
  skipSuccessfulRequests: false,
});

/**
 * Helper to create custom rate limits for specific error tracking operations
 */
export function customErrorTrackingLimit(
  maxRequests: number,
  windowMinutes: number = 1,
  blockMinutes: number = 5
) {
  return createErrorTrackingRateLimit(undefined, {
    windowMs: windowMinutes * 60 * 1000,
    maxRequests,
    blockDuration: blockMinutes * 60,
    skipSuccessfulRequests: true,
  });
}

export default errorTrackingRateLimit;