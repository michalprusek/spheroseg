/**
 * Advanced Rate Limiting Middleware
 *
 * Provides hierarchical rate limiting with support for:
 * - Multiple rate limit tiers
 * - Redis backend for distributed systems
 * - IP whitelisting
 * - Dynamic rate limits based on user roles
 * - Burst protection
 * - Sliding window algorithm
 */

import { Request, Response, NextFunction } from 'express';
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
  RateLimiterAbstract,
} from 'rate-limiter-flexible';
import Redis from 'ioredis';
import logger from '../../utils/logger';
import config from '../../config';
import { getClientIp } from '../utils/securityHelpers';

/**
 * Rate limit tier configuration
 */
export interface RateLimitTier {
  name: string;
  points: number; // Number of requests
  duration: number; // Time window in seconds
  blockDuration?: number; // Block duration in seconds after limit exceeded
  execEvenly?: boolean; // Spread requests evenly across duration
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  tiers: RateLimitTier[];
  useRedis: boolean;
  redisClient?: Redis;
  keyPrefix?: string;
  whitelistedIPs?: string[];
  whitelistedPaths?: string[];
  customKeyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, rateLimiterRes: RateLimiterRes) => void;
}

/**
 * Predefined rate limit tiers
 */
export const RATE_LIMIT_TIERS = {
  // Public API endpoints
  public: {
    default: { name: 'public-default', points: 100, duration: 900 }, // 100 req/15min
    burst: { name: 'public-burst', points: 20, duration: 60 }, // 20 req/min
  },

  // Authenticated user endpoints - Increased limits for segmentation editor
  authenticated: {
    default: { name: 'auth-default', points: 1000, duration: 900 }, // 1000 req/15min
    burst: { name: 'auth-burst', points: 200, duration: 60 }, // 200 req/min
  },

  // Premium user endpoints
  premium: {
    default: { name: 'premium-default', points: 1000, duration: 900 }, // 1000 req/15min
    burst: { name: 'premium-burst', points: 100, duration: 60 }, // 100 req/min
  },

  // Admin endpoints
  admin: {
    default: { name: 'admin-default', points: 10000, duration: 900 }, // 10000 req/15min
    burst: { name: 'admin-burst', points: 500, duration: 60 }, // 500 req/min
  },

  // Auth endpoints (login, register)
  auth: {
    default: { name: 'auth-endpoint', points: 10, duration: 900, blockDuration: 900 }, // 10 attempts/15min
    strict: { name: 'auth-strict', points: 3, duration: 300, blockDuration: 3600 }, // 3 attempts/5min
  },

  // Sensitive operations (password reset, account deletion)
  sensitive: {
    default: { name: 'sensitive-default', points: 5, duration: 3600, blockDuration: 3600 }, // 5 req/hour
    strict: { name: 'sensitive-strict', points: 1, duration: 300, blockDuration: 7200 }, // 1 req/5min
  },

  // File upload endpoints
  upload: {
    default: { name: 'upload-default', points: 20, duration: 3600 }, // 20 uploads/hour
    large: { name: 'upload-large', points: 5, duration: 3600, blockDuration: 1800 }, // 5 large uploads/hour
  },

  // API key based access
  api: {
    basic: { name: 'api-basic', points: 1000, duration: 3600 }, // 1000 req/hour
    pro: { name: 'api-pro', points: 10000, duration: 3600 }, // 10000 req/hour
    enterprise: { name: 'api-enterprise', points: 100000, duration: 3600 }, // 100000 req/hour
  },
};

/**
 * Create rate limiters for each tier
 */
export class HierarchicalRateLimiter {
  private limiters: Map<string, RateLimiterAbstract> = new Map();
  private config: RateLimitConfig;
  private whitelistedIPs: Set<string>;
  private whitelistedPaths: Set<string>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.whitelistedIPs = new Set(config.whitelistedIPs || []);
    this.whitelistedPaths = new Set(config.whitelistedPaths || []);

    // Add default whitelisted IPs
    this.whitelistedIPs.add('127.0.0.1');
    this.whitelistedIPs.add('::1');

    this.initializeLimiters();
  }

  /**
   * Initialize rate limiters for each tier
   */
  private initializeLimiters(): void {
    for (const tier of this.config.tiers) {
      const limiterOptions = {
        keyPrefix: `${this.config.keyPrefix || 'rl'}:${tier.name}:`,
        points: tier.points,
        duration: tier.duration,
        blockDuration: tier.blockDuration || 0,
        execEvenly: tier.execEvenly || false,
      };

      let limiter: RateLimiterAbstract;

      if (this.config.useRedis && this.config.redisClient) {
        limiter = new RateLimiterRedis({
          ...limiterOptions,
          storeClient: this.config.redisClient,
        });
      } else {
        limiter = new RateLimiterMemory(limiterOptions);
      }

      this.limiters.set(tier.name, limiter);
    }

    logger.info('Hierarchical rate limiters initialized', {
      tiers: this.config.tiers.map((t) => t.name),
      backend: this.config.useRedis ? 'redis' : 'memory',
    });
  }

  /**
   * Get key for rate limiting
   */
  private getKey(req: Request): string {
    if (this.config.customKeyGenerator) {
      return this.config.customKeyGenerator(req);
    }

    // Use user ID if authenticated, otherwise use IP
    const user = (req as unknown).user;
    if (user?.id) {
      return `user:${user.id}`;
    }

    return `ip:${getClientIp(req)}`;
  }

  /**
   * Check if request should be rate limited
   */
  private shouldSkipRateLimit(req: Request): boolean {
    // Check whitelisted paths
    if (this.whitelistedPaths.has(req.path)) {
      return true;
    }

    // Check whitelisted IPs
    const clientIp = getClientIp(req);
    if (this.whitelistedIPs.has(clientIp)) {
      return true;
    }

    return false;
  }

  /**
   * Create middleware for specific tiers
   */
  public middleware(
    tierNames: string[]
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip rate limiting if disabled
      if (config.security?.enableRateLimit === false) {
        return next();
      }

      // Check if should skip
      if (this.shouldSkipRateLimit(req)) {
        return next();
      }

      const key = this.getKey(req);
      const errors: any[] = [];

      // Check each tier
      for (const tierName of tierNames) {
        const limiter = this.limiters.get(tierName);

        if (!limiter) {
          logger.warn(`Rate limiter tier not found: ${tierName}`);
          continue;
        }

        try {
          await limiter.consume(key, 1);
        } catch (rateLimiterRes: unknown) {
          errors.push({
            tier: tierName,
            retriesAfter: new Date(Date.now() + rateLimiterRes.msBeforeNext),
            remainingPoints: rateLimiterRes.remainingPoints || 0,
            consumedPoints: rateLimiterRes.consumedPoints || 0,
          });
        }
      }

      // If any tier failed, return rate limit error
      if (errors.length > 0) {
        const primaryError = errors[0];
        const retryAfter = Math.ceil(
          primaryError.retriesAfter.getTime() / 1000 - Date.now() / 1000
        );

        logger.warn('Rate limit exceeded', {
          key,
          tiers: errors.map((e) => e.tier),
          ip: getClientIp(req),
          path: req.path,
          method: req.method,
          userId: (req as unknown).user?.id,
        });

        // Call custom handler if provided
        if (this.config.onLimitReached) {
          this.config.onLimitReached(req, primaryError);
        }

        res.set('Retry-After', String(retryAfter));
        res.set('X-RateLimit-Limit', String(errors.map((e) => e.tier).join(', ')));

        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter,
            limits: errors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Add rate limit headers for successful requests
      try {
        const headers: any = {};

        for (const tierName of tierNames) {
          const limiter = this.limiters.get(tierName);
          if (limiter) {
            const limiterRes = await limiter.get(key);
            if (limiterRes) {
              headers[`X-RateLimit-${tierName}-Limit`] = limiter.points;
              headers[`X-RateLimit-${tierName}-Remaining`] = limiterRes.remainingPoints || 0;
              headers[`X-RateLimit-${tierName}-Reset`] = new Date(
                Date.now() + limiterRes.msBeforeNext
              ).toISOString();
            }
          }
        }

        Object.entries(headers).forEach(([key, value]) => {
          res.set(key, String(value));
        });
      } catch (error) {
        logger.error('Error setting rate limit headers', error);
      }

      next();
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  public async reset(key: string, tierName?: string): Promise<void> {
    if (tierName) {
      const limiter = this.limiters.get(tierName);
      if (limiter) {
        await limiter.delete(key);
      }
    } else {
      // Reset all tiers
      for (const limiter of this.limiters.values()) {
        await limiter.delete(key);
      }
    }
  }

  /**
   * Get current consumption for a key
   */
  public async getConsumption(key: string, tierName: string): Promise<RateLimiterRes | null> {
    const limiter = this.limiters.get(tierName);
    if (!limiter) {
      return null;
    }

    return await limiter.get(key);
  }

  /**
   * Add IP to whitelist
   */
  public addToWhitelist(ip: string): void {
    this.whitelistedIPs.add(ip);
  }

  /**
   * Remove IP from whitelist
   */
  public removeFromWhitelist(ip: string): void {
    this.whitelistedIPs.delete(ip);
  }

  /**
   * Add path to whitelist
   */
  public addPathToWhitelist(path: string): void {
    this.whitelistedPaths.add(path);
  }

  /**
   * Remove path from whitelist
   */
  public removePathFromWhitelist(path: string): void {
    this.whitelistedPaths.delete(path);
  }
}

/**
 * Create pre-configured rate limiters
 */
let redisClient: Redis | undefined;

if (config.security?.useRedis && config.redis?.url) {
  try {
    redisClient = new Redis(config.redis.url);
    logger.info('Redis client created for rate limiting');
  } catch (error) {
    logger.error('Failed to create Redis client for rate limiting', error);
  }
}

// Standard rate limiter for public endpoints
export const publicRateLimiter = new HierarchicalRateLimiter({
  tiers: [RATE_LIMIT_TIERS.public.default, RATE_LIMIT_TIERS.public.burst],
  useRedis: !!redisClient,
  redisClient,
  keyPrefix: 'rl:public',
  whitelistedPaths: ['/health', '/api/health', '/metrics'],
});

// Rate limiter for authenticated endpoints
export const authenticatedRateLimiter = new HierarchicalRateLimiter({
  tiers: [RATE_LIMIT_TIERS.authenticated.default, RATE_LIMIT_TIERS.authenticated.burst],
  useRedis: !!redisClient,
  redisClient,
  keyPrefix: 'rl:auth',
});

// Rate limiter for auth endpoints
export const authEndpointRateLimiter = new HierarchicalRateLimiter({
  tiers: [RATE_LIMIT_TIERS.auth.default, RATE_LIMIT_TIERS.auth.strict],
  useRedis: !!redisClient,
  redisClient,
  keyPrefix: 'rl:auth-endpoint',
  onLimitReached: (req) => {
    const ip = getClientIp(req);
    logger.warn('Auth rate limit reached - potential brute force', { ip, path: req.path });
  },
});

// Rate limiter for sensitive operations
export const sensitiveRateLimiter = new HierarchicalRateLimiter({
  tiers: [RATE_LIMIT_TIERS.sensitive.default, RATE_LIMIT_TIERS.sensitive.strict],
  useRedis: !!redisClient,
  redisClient,
  keyPrefix: 'rl:sensitive',
});

// Rate limiter for file uploads
export const uploadRateLimiter = new HierarchicalRateLimiter({
  tiers: [RATE_LIMIT_TIERS.upload.default],
  useRedis: !!redisClient,
  redisClient,
  keyPrefix: 'rl:upload',
});

// Export middleware shortcuts
export const publicRateLimit = publicRateLimiter.middleware(['public-default', 'public-burst']);
export const authenticatedRateLimit = authenticatedRateLimiter.middleware([
  'auth-default',
  'auth-burst',
]);
export const authRateLimit = authEndpointRateLimiter.middleware(['auth-endpoint', 'auth-strict']);
export const sensitiveRateLimit = sensitiveRateLimiter.middleware([
  'sensitive-default',
  'sensitive-strict',
]);
export const uploadRateLimit = uploadRateLimiter.middleware(['upload-default']);
