/**
 * Enhanced Rate Limiter with Dynamic User Behavior Analysis
 * 
 * Features:
 * - Dynamic rate limits based on user behavior
 * - Sliding window algorithm for accurate tracking
 * - User reputation scoring
 * - Endpoint-specific limits
 * - Distributed rate limiting with Redis
 * - Graceful degradation
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { ApiError } from '../utils/ApiError.enhanced';
import logger from '../utils/logger';
import config from '../config';

// User behavior categories
export enum UserCategory {
  NEW = 'new',           // New users (< 24 hours)
  NORMAL = 'normal',     // Normal behavior
  POWER = 'power',       // Power users with good history
  SUSPICIOUS = 'suspicious', // Suspicious patterns detected
  BLOCKED = 'blocked'    // Temporarily blocked
}

// Rate limit configurations per category
export const RATE_LIMITS = {
  [UserCategory.NEW]: {
    windowMs: 60000,      // 1 minute
    maxRequests: 30,      // 30 requests per minute
    blockDuration: 300,   // 5 minutes block
  },
  [UserCategory.NORMAL]: {
    windowMs: 60000,      // 1 minute
    maxRequests: 60,      // 60 requests per minute
    blockDuration: 300,   // 5 minutes block
  },
  [UserCategory.POWER]: {
    windowMs: 60000,      // 1 minute
    maxRequests: 120,     // 120 requests per minute
    blockDuration: 180,   // 3 minutes block
  },
  [UserCategory.SUSPICIOUS]: {
    windowMs: 60000,      // 1 minute
    maxRequests: 15,      // 15 requests per minute
    blockDuration: 600,   // 10 minutes block
  },
  [UserCategory.BLOCKED]: {
    windowMs: 60000,      // 1 minute
    maxRequests: 0,       // No requests allowed
    blockDuration: 3600,  // 1 hour block
  },
};

// Endpoint-specific multipliers
export const ENDPOINT_MULTIPLIERS: Record<string, number> = {
  '/api/auth/login': 0.5,              // More restrictive
  '/api/auth/register': 0.3,           // Very restrictive
  '/api/auth/forgot-password': 0.2,    // Extremely restrictive
  '/api/ml/segment': 0.5,              // Resource intensive
  '/api/images/upload': 0.7,           // File upload
  '/api/export': 0.5,                  // Data export
  '/api/health': 2.0,                  // Less restrictive
};

// User behavior patterns to detect
interface BehaviorPattern {
  rapidRequests: number;      // Requests in last 10 seconds
  failedAuthAttempts: number; // Failed auth in last hour
  errorRate: number;          // 4xx/5xx responses ratio
  uniqueEndpoints: number;    // Unique endpoints accessed
  dataVolume: number;         // MB of data requested
  accountAge: number;         // Days since registration
  successfulRequests: number; // Successful requests in last day
}

export class DynamicRateLimiter {
  private redis: Redis;
  private fallbackStore: Map<string, any>;
  private readonly prefix = 'ratelimit:';

  constructor(redisClient?: Redis) {
    this.redis = redisClient || new Redis({
      host: config.redis?.host || 'localhost',
      port: config.redis?.port || 6379,
      password: config.redis?.password,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    // Fallback for when Redis is unavailable
    this.fallbackStore = new Map();

    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Main middleware function
   */
  middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const ipAddress = req.ip;
      const endpoint = req.path;
      const identifier = userId || ipAddress;

      // Get user category and behavior
      const category = await this.getUserCategory(identifier, userId);
      const behavior = await this.getUserBehavior(identifier);

      // Calculate dynamic limit
      const limit = this.calculateDynamicLimit(category, endpoint, behavior);

      // Check rate limit
      const result = await this.checkRateLimit(identifier, endpoint, limit);

      // Set response headers
      res.setHeader('X-RateLimit-Limit', limit.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.maxRequests - result.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

      if (result.blocked) {
        // User is blocked
        res.setHeader('X-RateLimit-Retry-After', result.retryAfter.toString());
        
        // Log the block
        logger.warn('Rate limit exceeded - user blocked', {
          identifier,
          category,
          endpoint,
          behavior,
          limit,
        });

        // Update user behavior (failed request)
        await this.updateBehavior(identifier, false, 429);

        throw ApiError.rateLimitExceeded({
          userId,
          metadata: {
            retryAfter: result.retryAfter,
            category,
          },
        });
      }

      if (result.count > limit.maxRequests) {
        // Rate limit exceeded
        res.setHeader('X-RateLimit-Retry-After', result.retryAfter.toString());
        
        // Log the violation
        logger.warn('Rate limit exceeded', {
          identifier,
          category,
          endpoint,
          count: result.count,
          limit: limit.maxRequests,
        });

        // Update user behavior
        await this.updateBehavior(identifier, false, 429);

        // Check if we should block the user
        if (await this.shouldBlockUser(identifier, behavior)) {
          await this.blockUser(identifier, category);
        }

        throw ApiError.rateLimitExceeded({
          userId,
          metadata: {
            retryAfter: result.retryAfter,
          },
        });
      }

      // Track successful request
      res.on('finish', async () => {
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 400;
        await this.updateBehavior(identifier, success, statusCode);
      });

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        logger.error('Rate limiter error', { error });
        // Fail open - allow request if rate limiter fails
        next();
      }
    }
  };

  /**
   * Get user category based on behavior and history
   */
  private async getUserCategory(identifier: string, userId?: string): Promise<UserCategory> {
    try {
      // Check if blocked
      const blockKey = `${this.prefix}blocked:${identifier}`;
      const isBlocked = await this.redis.get(blockKey);
      if (isBlocked) {
        return UserCategory.BLOCKED;
      }

      // Check if suspicious
      const suspiciousKey = `${this.prefix}suspicious:${identifier}`;
      const isSuspicious = await this.redis.get(suspiciousKey);
      if (isSuspicious) {
        return UserCategory.SUSPICIOUS;
      }

      if (!userId) {
        // Non-authenticated users are limited
        return UserCategory.NEW;
      }

      // Get user registration date
      const userKey = `${this.prefix}user:${userId}`;
      const userData = await this.redis.hgetall(userKey);
      
      if (!userData.registeredAt) {
        // New user
        return UserCategory.NEW;
      }

      const accountAge = (Date.now() - parseInt(userData.registeredAt)) / (1000 * 60 * 60 * 24);
      
      // Power user criteria
      if (
        accountAge > 30 &&
        parseInt(userData.successfulRequests || '0') > 1000 &&
        parseFloat(userData.errorRate || '1') < 0.05
      ) {
        return UserCategory.POWER;
      }

      // New user (< 24 hours)
      if (accountAge < 1) {
        return UserCategory.NEW;
      }

      return UserCategory.NORMAL;
    } catch (error) {
      logger.error('Error getting user category', { error, identifier });
      return UserCategory.NORMAL;
    }
  }

  /**
   * Get user behavior metrics
   */
  private async getUserBehavior(identifier: string): Promise<BehaviorPattern> {
    try {
      const behaviorKey = `${this.prefix}behavior:${identifier}`;
      const data = await this.redis.hgetall(behaviorKey);

      return {
        rapidRequests: parseInt(data.rapidRequests || '0'),
        failedAuthAttempts: parseInt(data.failedAuthAttempts || '0'),
        errorRate: parseFloat(data.errorRate || '0'),
        uniqueEndpoints: parseInt(data.uniqueEndpoints || '0'),
        dataVolume: parseFloat(data.dataVolume || '0'),
        accountAge: parseInt(data.accountAge || '0'),
        successfulRequests: parseInt(data.successfulRequests || '0'),
      };
    } catch (error) {
      logger.error('Error getting user behavior', { error, identifier });
      return {
        rapidRequests: 0,
        failedAuthAttempts: 0,
        errorRate: 0,
        uniqueEndpoints: 0,
        dataVolume: 0,
        accountAge: 0,
        successfulRequests: 0,
      };
    }
  }

  /**
   * Calculate dynamic rate limit based on category and behavior
   */
  private calculateDynamicLimit(
    category: UserCategory,
    endpoint: string,
    behavior: BehaviorPattern
  ): typeof RATE_LIMITS[UserCategory] {
    const baseLimit = { ...RATE_LIMITS[category] };
    
    // Apply endpoint multiplier
    const endpointMultiplier = ENDPOINT_MULTIPLIERS[endpoint] || 1.0;
    baseLimit.maxRequests = Math.floor(baseLimit.maxRequests * endpointMultiplier);

    // Adjust based on behavior
    if (behavior.errorRate > 0.3) {
      // High error rate - reduce limit
      baseLimit.maxRequests = Math.floor(baseLimit.maxRequests * 0.5);
    }

    if (behavior.failedAuthAttempts > 5) {
      // Multiple failed auth attempts - reduce limit significantly
      baseLimit.maxRequests = Math.floor(baseLimit.maxRequests * 0.3);
      baseLimit.blockDuration *= 2;
    }

    if (behavior.rapidRequests > 10) {
      // Rapid requests detected - reduce limit
      baseLimit.maxRequests = Math.floor(baseLimit.maxRequests * 0.7);
    }

    // Ensure minimum of 1 request (except for blocked)
    if (category !== UserCategory.BLOCKED) {
      baseLimit.maxRequests = Math.max(1, baseLimit.maxRequests);
    }

    return baseLimit;
  }

  /**
   * Check rate limit using sliding window
   */
  private async checkRateLimit(
    identifier: string,
    endpoint: string,
    limit: typeof RATE_LIMITS[UserCategory]
  ): Promise<{
    count: number;
    resetTime: number;
    blocked: boolean;
    retryAfter: number;
  }> {
    const now = Date.now();
    const windowStart = now - limit.windowMs;
    const key = `${this.prefix}requests:${identifier}:${endpoint}`;

    try {
      // Use Redis sorted set for sliding window
      const pipe = this.redis.pipeline();
      
      // Remove old entries
      pipe.zremrangebyscore(key, '-inf', windowStart);
      
      // Add current request
      pipe.zadd(key, now, `${now}-${Math.random()}`);
      
      // Count requests in window
      pipe.zcount(key, windowStart, '+inf');
      
      // Set expiry
      pipe.expire(key, Math.ceil(limit.windowMs / 1000) + 1);
      
      const results = await pipe.exec();
      const count = results?.[2]?.[1] as number || 0;

      // Check if blocked
      const blockKey = `${this.prefix}blocked:${identifier}`;
      const blockExpiry = await this.redis.ttl(blockKey);
      
      if (blockExpiry > 0) {
        return {
          count,
          resetTime: now + limit.windowMs,
          blocked: true,
          retryAfter: blockExpiry,
        };
      }

      return {
        count,
        resetTime: now + limit.windowMs,
        blocked: false,
        retryAfter: Math.ceil((limit.windowMs - (now - windowStart)) / 1000),
      };
    } catch (error) {
      logger.error('Redis error in rate limiter', { error });
      
      // Fallback to in-memory store
      return this.checkRateLimitFallback(identifier, endpoint, limit);
    }
  }

  /**
   * Fallback rate limiting when Redis is unavailable
   */
  private checkRateLimitFallback(
    identifier: string,
    endpoint: string,
    limit: typeof RATE_LIMITS[UserCategory]
  ): {
    count: number;
    resetTime: number;
    blocked: boolean;
    retryAfter: number;
  } {
    const now = Date.now();
    const key = `${identifier}:${endpoint}`;
    const data = this.fallbackStore.get(key) || { count: 0, resetTime: now + limit.windowMs };

    if (now > data.resetTime) {
      // Reset window
      data.count = 1;
      data.resetTime = now + limit.windowMs;
    } else {
      data.count++;
    }

    this.fallbackStore.set(key, data);

    return {
      count: data.count,
      resetTime: data.resetTime,
      blocked: false,
      retryAfter: Math.ceil((data.resetTime - now) / 1000),
    };
  }

  /**
   * Update user behavior metrics
   */
  private async updateBehavior(
    identifier: string,
    success: boolean,
    statusCode: number
  ): Promise<void> {
    try {
      const behaviorKey = `${this.prefix}behavior:${identifier}`;
      const now = Date.now();

      // Update rapid requests counter
      const rapidKey = `${this.prefix}rapid:${identifier}`;
      await this.redis.incr(rapidKey);
      await this.redis.expire(rapidKey, 10); // 10 seconds window

      // Update behavior metrics
      const pipe = this.redis.pipeline();

      // Track endpoints
      const endpointKey = `${this.prefix}endpoints:${identifier}`;
      pipe.pfadd(endpointKey, new Date().toISOString().split('T')[0]);
      
      // Update counters
      if (success) {
        pipe.hincrby(behaviorKey, 'successfulRequests', 1);
      } else {
        if (statusCode === 401 || statusCode === 403) {
          pipe.hincrby(behaviorKey, 'failedAuthAttempts', 1);
        }
      }

      // Update error rate
      pipe.hincrby(behaviorKey, 'totalRequests', 1);
      if (statusCode >= 400) {
        pipe.hincrby(behaviorKey, 'errorRequests', 1);
      }

      await pipe.exec();

      // Calculate and update error rate
      const data = await this.redis.hgetall(behaviorKey);
      const errorRate = parseInt(data.errorRequests || '0') / parseInt(data.totalRequests || '1');
      await this.redis.hset(behaviorKey, 'errorRate', errorRate.toString());

    } catch (error) {
      logger.error('Error updating behavior', { error, identifier });
    }
  }

  /**
   * Determine if user should be blocked
   */
  private async shouldBlockUser(identifier: string, behavior: BehaviorPattern): Promise<boolean> {
    // Block if multiple failed auth attempts
    if (behavior.failedAuthAttempts > 10) {
      return true;
    }

    // Block if very high error rate
    if (behavior.errorRate > 0.8 && behavior.rapidRequests > 20) {
      return true;
    }

    // Block if suspicious pattern
    if (behavior.rapidRequests > 50) {
      return true;
    }

    return false;
  }

  /**
   * Block a user temporarily
   */
  private async blockUser(identifier: string, category: UserCategory): Promise<void> {
    const blockDuration = RATE_LIMITS[category].blockDuration;
    const blockKey = `${this.prefix}blocked:${identifier}`;
    
    await this.redis.setex(blockKey, blockDuration, '1');
    
    logger.warn('User blocked due to suspicious behavior', {
      identifier,
      category,
      duration: blockDuration,
    });
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    // Cleanup in-memory fallback store
    const now = Date.now();
    for (const [key, data] of this.fallbackStore.entries()) {
      if (now > data.resetTime + 60000) { // 1 minute grace period
        this.fallbackStore.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a user (admin function)
   */
  async resetUserLimit(identifier: string): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*:${identifier}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    logger.info('Rate limit reset for user', { identifier });
  }

  /**
   * Get user rate limit status (for debugging)
   */
  async getUserStatus(identifier: string): Promise<any> {
    const category = await this.getUserCategory(identifier);
    const behavior = await this.getUserBehavior(identifier);
    const blockKey = `${this.prefix}blocked:${identifier}`;
    const blockTTL = await this.redis.ttl(blockKey);

    return {
      identifier,
      category,
      behavior,
      blocked: blockTTL > 0,
      blockRemainingSeconds: blockTTL > 0 ? blockTTL : 0,
      limits: RATE_LIMITS[category],
    };
  }
}

// Export singleton instance
export const rateLimiter = new DynamicRateLimiter();

// Export middleware
export const dynamicRateLimit = rateLimiter.middleware;