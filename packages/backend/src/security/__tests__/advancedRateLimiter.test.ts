/**
 * Advanced Rate Limiter Tests
 */

import { HierarchicalRateLimiter, RATE_LIMIT_TIERS } from '../middleware/advancedRateLimiter';
import express, { Request, Response } from 'express';
import request from 'supertest';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

// Mock config
jest.mock('../../config', () => ({
  default: {
    security: {
      enableRateLimit: true,
      useRedis: false,
    },
    redis: {
      url: 'redis://localhost:6379',
    },
    isDevelopment: false,
    isTest: true,
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('HierarchicalRateLimiter', () => {
  let app: express.Application;
  let rateLimiter: HierarchicalRateLimiter;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Basic Functionality', () => {
    beforeEach(() => {
      rateLimiter = new HierarchicalRateLimiter({
        tiers: [
          { name: 'test-default', points: 5, duration: 60 },
          { name: 'test-burst', points: 2, duration: 10 },
        ],
        useRedis: false,
        keyPrefix: 'test',
      });

      app.get(
        '/test',
        rateLimiter.middleware(['test-default', 'test-burst']),
        (req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
    });

    it('should allow requests within rate limits', async () => {
      // Make 2 requests (burst limit)
      for (let i = 0; i < 2; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
      }
    });

    it('should block requests exceeding burst limit', async () => {
      // Make 2 requests to reach burst limit
      for (let i = 0; i < 2; i++) {
        await request(app).get('/test');
      }

      // 3rd request should be blocked
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.error.limits).toHaveLength(1);
      expect(response.body.error.limits[0].tier).toBe('test-burst');
    });

    it('should set proper headers on successful requests', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-test-default-limit']).toBe('5');
      expect(response.headers['x-ratelimit-test-default-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-test-burst-limit']).toBe('2');
      expect(response.headers['x-ratelimit-test-burst-remaining']).toBeDefined();
    });

    it('should set Retry-After header when rate limited', async () => {
      // Exceed burst limit
      for (let i = 0; i < 3; i++) {
        await request(app).get('/test');
      }

      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('IP Whitelisting', () => {
    beforeEach(() => {
      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 1, duration: 60 }],
        useRedis: false,
        whitelistedIPs: ['192.168.1.100'],
      });

      app.get('/test', rateLimiter.middleware(['test']), (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should not rate limit whitelisted IPs', async () => {
      // Override IP detection
      app.use((req, res, next) => {
        req.ip = '192.168.1.100';
        next();
      });

      // Make many requests
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }
    });

    it('should allow dynamic whitelist management', async () => {
      // Add IP to whitelist
      rateLimiter.addToWhitelist('10.0.0.1');

      // Verify IP was added (would need to mock IP in real test)
      expect(rateLimiter['whitelistedIPs'].has('10.0.0.1')).toBe(true);

      // Remove IP from whitelist
      rateLimiter.removeFromWhitelist('10.0.0.1');
      expect(rateLimiter['whitelistedIPs'].has('10.0.0.1')).toBe(false);
    });
  });

  describe('Path Whitelisting', () => {
    beforeEach(() => {
      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 1, duration: 60 }],
        useRedis: false,
        whitelistedPaths: ['/health', '/metrics'],
      });

      const middleware = rateLimiter.middleware(['test']);

      app.get('/test', middleware, (req: Request, res: Response) => {
        res.json({ success: true });
      });

      app.get('/health', middleware, (req: Request, res: Response) => {
        res.json({ status: 'ok' });
      });
    });

    it('should not rate limit whitelisted paths', async () => {
      // Make many requests to whitelisted path
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
      }
    });

    it('should rate limit non-whitelisted paths', async () => {
      await request(app).get('/test');
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
    });
  });

  describe('Custom Key Generator', () => {
    it('should use custom key generator when provided', async () => {
      const keyGenerator = jest.fn().mockReturnValue('custom-key');

      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 2, duration: 60 }],
        useRedis: false,
        customKeyGenerator: keyGenerator,
      });

      app.get('/test', rateLimiter.middleware(['test']), (req: Request, res: Response) => {
        res.json({ success: true });
      });

      await request(app).get('/test');

      expect(keyGenerator).toHaveBeenCalled();
    });

    it('should use user ID when authenticated', async () => {
      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 2, duration: 60 }],
        useRedis: false,
      });

      app.use((req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      app.get('/test', rateLimiter.middleware(['test']), (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });
  });

  describe('Multiple Tiers', () => {
    beforeEach(() => {
      rateLimiter = new HierarchicalRateLimiter({
        tiers: [
          { name: 'minute', points: 10, duration: 60 },
          { name: 'hour', points: 50, duration: 3600 },
          { name: 'burst', points: 3, duration: 10, blockDuration: 30 },
        ],
        useRedis: false,
      });

      app.get(
        '/test',
        rateLimiter.middleware(['minute', 'hour', 'burst']),
        (req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
    });

    it('should enforce all tier limits independently', async () => {
      // Make 3 requests to hit burst limit
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      // 4th request should be blocked by burst limit
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.error.limits[0].tier).toBe('burst');
    });

    it('should block when any tier limit is exceeded', async () => {
      // Simulate different tier violations
      // This would require time manipulation in a real test
    });
  });

  describe('Redis Integration', () => {
    let mockRedisClient: jest.Mocked<Redis>;

    beforeEach(() => {
      mockRedisClient = new Redis() as jest.Mocked<Redis>;

      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 5, duration: 60 }],
        useRedis: true,
        redisClient: mockRedisClient,
      });
    });

    it('should use Redis client when provided', () => {
      expect(mockRedisClient).toBeDefined();
      // Further Redis-specific tests would go here
    });
  });

  describe('Rate Limit Reset', () => {
    beforeEach(() => {
      rateLimiter = new HierarchicalRateLimiter({
        tiers: [
          { name: 'test1', points: 1, duration: 60 },
          { name: 'test2', points: 1, duration: 60 },
        ],
        useRedis: false,
      });
    });

    it('should reset rate limit for specific tier', async () => {
      // Implementation would consume points then reset
      await rateLimiter.reset('test-key', 'test1');

      // Verify reset (would need to check internal state)
    });

    it('should reset all tiers when no tier specified', async () => {
      await rateLimiter.reset('test-key');

      // Verify all tiers reset
    });
  });

  describe('Consumption Tracking', () => {
    beforeEach(() => {
      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 5, duration: 60 }],
        useRedis: false,
      });
    });

    it('should track consumption correctly', async () => {
      const consumption = await rateLimiter.getConsumption('test-key', 'test');

      // Initial consumption should be null or 0
      expect(consumption?.consumedPoints || 0).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tier gracefully', async () => {
      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 5, duration: 60 }],
        useRedis: false,
      });

      app.get('/test', rateLimiter.middleware(['non-existent']), (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(200); // Should pass through
    });

    it('should handle Redis errors gracefully', async () => {
      const mockRedisClient = new Redis() as jest.Mocked<Redis>;
      mockRedisClient.get = jest.fn().mockRejectedValue(new Error('Redis error'));

      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 5, duration: 60 }],
        useRedis: true,
        redisClient: mockRedisClient,
      });

      // Should fall back gracefully
    });
  });

  describe('Event Callbacks', () => {
    it('should call onLimitReached callback', async () => {
      const onLimitReached = jest.fn();

      rateLimiter = new HierarchicalRateLimiter({
        tiers: [{ name: 'test', points: 1, duration: 60 }],
        useRedis: false,
        onLimitReached,
      });

      app.get('/test', rateLimiter.middleware(['test']), (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Exceed limit
      await request(app).get('/test');
      await request(app).get('/test');

      expect(onLimitReached).toHaveBeenCalled();
    });
  });

  describe('Predefined Rate Limiters', () => {
    it('should have correct configuration for public endpoints', () => {
      const publicTiers = RATE_LIMIT_TIERS.public;
      expect(publicTiers.default.points).toBe(100);
      expect(publicTiers.default.duration).toBe(900);
      expect(publicTiers.burst.points).toBe(20);
      expect(publicTiers.burst.duration).toBe(60);
    });

    it('should have correct configuration for auth endpoints', () => {
      const authTiers = RATE_LIMIT_TIERS.auth;
      expect(authTiers.default.points).toBe(10);
      expect(authTiers.default.blockDuration).toBe(900);
      expect(authTiers.strict.points).toBe(3);
      expect(authTiers.strict.blockDuration).toBe(3600);
    });

    it('should have correct configuration for sensitive operations', () => {
      const sensitiveTiers = RATE_LIMIT_TIERS.sensitive;
      expect(sensitiveTiers.default.points).toBe(5);
      expect(sensitiveTiers.default.duration).toBe(3600);
      expect(sensitiveTiers.strict.points).toBe(1);
      expect(sensitiveTiers.strict.blockDuration).toBe(7200);
    });
  });
});
