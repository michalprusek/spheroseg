/**
 * Tests for Enhanced Rate Limiter
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { DynamicRateLimiter, UserCategory, RATE_LIMITS } from '../rateLimiter.enhanced';
import { ApiError } from '../../utils/ApiError.enhanced';

// Mock Redis
jest.mock('ioredis');

describe('DynamicRateLimiter', () => {
  let rateLimiter: DynamicRateLimiter;
  let mockRedis: jest.Mocked<Redis>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Create mock Redis instance
    mockRedis = new Redis() as jest.Mocked<Redis>;
    
    // Setup Redis mock methods
    mockRedis.pipeline = jest.fn().mockReturnValue({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      zcount: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1], [null, 1], [null, 5], [null, 1]]),
    });
    mockRedis.get = jest.fn().mockResolvedValue(null);
    mockRedis.ttl = jest.fn().mockResolvedValue(-1);
    mockRedis.hgetall = jest.fn().mockResolvedValue({});
    mockRedis.setex = jest.fn().mockResolvedValue('OK');
    mockRedis.keys = jest.fn().mockResolvedValue([]);
    mockRedis.del = jest.fn().mockResolvedValue(1);

    // Create rate limiter instance
    rateLimiter = new DynamicRateLimiter(mockRedis);

    // Setup request mock
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
      user: { id: 'user123' },
    };

    // Setup response mock
    mockRes = {
      setHeader: jest.fn(),
      on: jest.fn(),
      statusCode: 200,
    };

    // Setup next mock
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('middleware', () => {
    it('should allow requests within rate limit', async () => {
      // Mock Redis responses for normal user
      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({ registeredAt: (Date.now() - 86400000 * 30).toString() }) // User data
        .mockResolvedValueOnce({ successfulRequests: '100', errorRate: '0.02' }); // Behavior data

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '60');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '55');
    });

    it('should block requests exceeding rate limit', async () => {
      // Mock Redis to return high request count
      mockRedis.pipeline = jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcount: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 1], [null, 1], [null, 100], [null, 1]]),
      });

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.code).toBe('SYS_9003');
    });

    it('should apply endpoint-specific multipliers', async () => {
      mockReq.path = '/api/auth/login';

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // Login endpoint has 0.5 multiplier, so limit should be 30 instead of 60
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '30');
    });

    it('should categorize new users correctly', async () => {
      // Mock new user (registered < 24 hours ago)
      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({ registeredAt: (Date.now() - 3600000).toString() }) // 1 hour ago
        .mockResolvedValueOnce({});

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // New users have lower limit (30)
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '30');
    });

    it('should identify power users', async () => {
      // Mock power user
      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({ 
          registeredAt: (Date.now() - 86400000 * 60).toString(), // 60 days
          successfulRequests: '2000',
          errorRate: '0.01'
        })
        .mockResolvedValueOnce({});

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // Power users have higher limit (120)
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '120');
    });

    it('should handle blocked users', async () => {
      // Mock blocked user
      mockRedis.get = jest.fn().mockResolvedValue('1');
      mockRedis.ttl = jest.fn().mockResolvedValue(300);

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Retry-After', '300');
    });

    it('should track user behavior', async () => {
      // Setup response finishing
      let finishCallback: Function;
      mockRes.on = jest.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // Simulate response finishing
      mockRes.statusCode = 200;
      finishCallback!();

      // Verify behavior tracking
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should reduce limits for high error rates', async () => {
      // Mock user with high error rate
      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({ registeredAt: (Date.now() - 86400000 * 30).toString() })
        .mockResolvedValueOnce({ errorRate: '0.5' }); // 50% error rate

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // High error rate reduces limit by 50%
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '30');
    });

    it('should handle Redis failures gracefully', async () => {
      // Mock Redis failure
      mockRedis.pipeline = jest.fn().mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should fall back to in-memory limiting and allow request
      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle unauthenticated users', async () => {
      mockReq.user = undefined;

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // Unauthenticated users get NEW category limit (30)
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '30');
    });
  });

  describe('getUserStatus', () => {
    it('should return complete user status', async () => {
      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({ registeredAt: Date.now().toString() })
        .mockResolvedValueOnce({
          rapidRequests: '5',
          failedAuthAttempts: '2',
          errorRate: '0.1',
        });

      const status = await rateLimiter.getUserStatus('user123');

      expect(status).toMatchObject({
        identifier: 'user123',
        category: UserCategory.NEW,
        blocked: false,
        behavior: {
          rapidRequests: 5,
          failedAuthAttempts: 2,
          errorRate: 0.1,
        },
      });
    });
  });

  describe('resetUserLimit', () => {
    it('should reset all rate limit data for user', async () => {
      mockRedis.keys = jest.fn().mockResolvedValue([
        'ratelimit:requests:user123:*',
        'ratelimit:behavior:user123',
        'ratelimit:blocked:user123',
      ]);

      await rateLimiter.resetUserLimit('user123');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'ratelimit:requests:user123:*',
        'ratelimit:behavior:user123',
        'ratelimit:blocked:user123'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle very high request rates', async () => {
      // Mock pipeline with very high request count
      mockRedis.pipeline = jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcount: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 1], [null, 1], [null, 1000], [null, 1]]),
      });

      // Mock behavior indicating rapid requests
      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rapidRequests: '100' });

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should block user
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should handle multiple failed auth attempts', async () => {
      mockReq.path = '/api/auth/login';
      
      // Mock high failed auth attempts
      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ failedAuthAttempts: '15' });

      await rateLimiter.middleware(mockReq as Request, mockRes as Response, mockNext);

      // Very restrictive limit due to failed auth attempts
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
      const limit = parseInt(mockRes.setHeader.mock.calls.find(
        call => call[0] === 'X-RateLimit-Limit'
      )?.[1] as string);
      expect(limit).toBeLessThan(10);
    });
  });
});