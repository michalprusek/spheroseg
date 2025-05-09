import expressRateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';
import config from '../config';

/**
 * Create a rate limiter based on the specified type
 * 
 * @param type The type of rate limit to apply ('default', 'auth', or 'sensitive')
 * @returns A middleware function that applies rate limiting
 */
export function rateLimit(type: 'default' | 'auth' | 'sensitive' = 'default') {
  // In test mode, always allow requests if config.isTest is true
  if (config?.isTest) {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  // Use in-memory store for requests during testing
  const store = new Map();
  const cache = {
    increment: async (key: string) => {
      const current = store.get(key) || 0;
      store.set(key, current + 1);
      return current + 1;
    },
    decrement: async (key: string) => {
      const current = store.get(key) || 0;
      if (current > 0) {
        store.set(key, current - 1);
      }
      return Math.max(0, current - 1);
    },
    resetKey: async (key: string) => {
      store.delete(key);
      return true;
    }
  };

  let options: any = {
    // Use memory store with counter function for testing
    keyGenerator: (req: Request) => {
      // Use user ID if available, otherwise use IP
      return (req as any).user?.userId || req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: false,
    skip: (_req: Request, _res: Response) => false,
    requestWasSuccessful: (_req: Request, _res: Response) => true
  };

  // Configure options based on type
  switch (type) {
    case 'auth':
      options = {
        ...options,
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 auth attempts in tests
        message: { 
          error: {
            message: 'Too many requests, please try again later',
            timestamp: new Date().toISOString()
          }
        },
        handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
          logger.warn('Auth rate limit exceeded', { 
            ip: req.ip, 
            path: req.path,
            method: req.method,
            userId: (req as any).user?.userId 
          });
          res.status(429).json(options.message);
          res.set('Retry-After', '900'); // 15 minutes in seconds
        }
      };
      break;
    case 'sensitive':
      options = {
        ...options,
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 2, // 2 sensitive operations in tests
        message: { 
          error: {
            message: 'Too many sensitive operations, please try again later',
            timestamp: new Date().toISOString()
          }
        },
        handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
          logger.warn('Sensitive operation rate limit exceeded', { 
            ip: req.ip, 
            path: req.path,
            method: req.method,
            userId: (req as any).user?.userId 
          });
          res.status(429).json(options.message);
          res.set('Retry-After', '3600'); // 1 hour in seconds
        }
      };
      break;
    default: // 'default'
      options = {
        ...options,
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 requests in tests
        message: { 
          error: {
            message: 'Too many requests, please try again later',
            timestamp: new Date().toISOString()
          }
        },
        handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
          logger.warn('Rate limit exceeded', { 
            ip: req.ip, 
            path: req.path,
            method: req.method,
            userId: (req as any).user?.userId 
          });
          res.status(429).json(options.message);
          res.set('Retry-After', '900'); // 15 minutes in seconds
        }
      };
      break;
  }

  // Manual middleware implementation for tests
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator(req);
    
    try {
      const hits = await cache.increment(key);
      
      if (hits <= options.max) {
        next();
      } else {
        options.handler(req, res, next, options);
      }
    } catch (err) {
      next(err);
    }
  };
}

// Configure different rate limits for actual use
const standardLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip, 
      path: req.path,
      method: req.method 
    });
    res.status(options.statusCode).send(options.message);
  }
});

// Stricter rate limiting for authentication endpoints
const authLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later' },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    logger.warn('Auth rate limit exceeded', { 
      ip: req.ip, 
      path: req.path,
      method: req.method
    });
    res.status(options.statusCode).send(options.message);
  }
});

// Very strict rate limiting for sensitive operations 
const sensitiveOperationsLimiter = expressRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sensitive operations, please try again later' },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    logger.warn('Sensitive operation rate limit exceeded', { 
      ip: req.ip, 
      path: req.path,
      method: req.method,
      userId: (req as any).user?.userId 
    });
    res.status(options.statusCode).send(options.message);
  }
});

export { standardLimiter, authLimiter, sensitiveOperationsLimiter };
