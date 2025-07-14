import { Request, Response } from 'express';
import { createRateLimiter } from '../security/middleware/rateLimitMiddleware';
import { AuthenticatedRequest } from '../security/middleware/auth';

// Use jest.Mock type for nextFunction to access mock methods
type MockNextFunction = jest.Mock;

// Mock config to enable testing
jest.mock('../config', () => ({
  isTest: true, // Set to true to use test rate limits
  security: {
    rateLimitRequests: 10,
    rateLimitWindow: 60,
    enableRateLimit: true,
  },
}));

// Mock logger with all required methods
jest.mock('../utils/logger', () => {
  return {
    __esModule: true,
    default: {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      http: jest.fn(),
    },
  };
});

// Mock express-rate-limit
let rateLimitCallCount = 0;
const mockRateLimitHandler = jest.fn((req, res, next) => {
  rateLimitCallCount++;
  const config = (req as any)._rateLimitConfig || { max: 5 };
  
  // Simple rate limit simulation
  if (rateLimitCallCount > config.max) {
    const handler = config.handler || ((req: any, res: any) => {
      res.set('Retry-After', '60');
      res.status(429).json({
        error: {
          message: 'Too many requests, please try again later',
          retryAfter: 60,
          timestamp: new Date().toISOString(),
        },
      });
    });
    handler(req, res, next, { message: config.message });
  } else {
    next();
  }
});

jest.mock('express-rate-limit', () => {
  return {
    __esModule: true,
    default: (options: any) => {
      return (req: any, res: any, next: any) => {
        req._rateLimitConfig = options;
        mockRateLimitHandler(req, res, next);
      };
    },
  };
});

describe('Rate Limiting Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: MockNextFunction;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    rateLimitCallCount = 0;
    mockRateLimitHandler.mockClear();

    // Create mock request
    mockRequest = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
      user: {
        userId: 'test-user-id',
        email: 'test@example.com',
      },
      get: jest.fn((header: string) => {
        if (header === 'User-Agent') return 'Test Agent';
        if (header === 'set-cookie') return undefined;
        return undefined;
      }) as any,
    };

    // Create mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn(),
      setHeader: jest.fn(),
    };

    // Create next function with jest.fn() to get mock functionality
    nextFunction = jest.fn();
  });

  it('should allow requests within rate limit', async () => {
    // Create rate limit middleware
    const middleware = createRateLimiter('default');

    // Call middleware
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if next was called
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it('should block requests that exceed rate limit', async () => {
    // Create rate limit middleware
    const middleware = createRateLimiter('auth');

    // Call middleware multiple times to exceed rate limit (auth limit is 5 in test mode)
    for (let i = 0; i < 5; i++) {
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);
    }

    // Reset next function to check if it's called again
    nextFunction.mockReset();

    // Call middleware one more time to exceed limit
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if response was set correctly
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Too many authentication attempts, please try again later',
        }),
      })
    );
    expect(mockResponse.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('should use IP address if user is not authenticated', async () => {
    // Create request without user
    const requestWithoutUser = {
      ...mockRequest,
      user: undefined,
      ip: '192.168.1.1',
    };

    // Create rate limit middleware
    const middleware = createRateLimiter('default');

    // Call middleware
    await middleware(requestWithoutUser as Request, mockResponse as Response, nextFunction);

    // Check if next was called
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should use different rate limits for different endpoints', async () => {
    // Reset counter for this test
    rateLimitCallCount = 0;
    
    // Create rate limit middleware for auth (limit: 5 in test mode)
    const authMiddleware = createRateLimiter('auth');

    // Call auth middleware up to the limit
    for (let i = 0; i < 5; i++) {
      await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    }

    // Reset next function and response mocks
    nextFunction.mockReset();
    mockResponse.status = jest.fn().mockReturnThis();
    mockResponse.json = jest.fn();

    // Call auth middleware one more time to exceed limit
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if auth middleware blocked the request
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(429);

    // Reset mocks for next test
    jest.clearAllMocks();
    rateLimitCallCount = 0;

    // Create rate limit middleware for sensitive (limit: 2 in test mode)
    const sensitiveMiddleware = createRateLimiter('sensitive');

    // Call sensitive middleware up to the limit
    for (let i = 0; i < 2; i++) {
      await sensitiveMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    }
    
    // Should still allow requests as we haven't exceeded sensitive limit
    expect(nextFunction).toHaveBeenCalledTimes(2);
  });
});
