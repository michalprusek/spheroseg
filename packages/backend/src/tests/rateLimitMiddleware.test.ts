import { Request, Response } from 'express';
import { rateLimit } from '../security/middleware/rateLimitMiddleware';
import { AuthenticatedRequest } from '../security/middleware/auth';

// Use jest.Mock type for nextFunction to access mock methods
type MockNextFunction = jest.Mock;

// Mock config to enable testing
jest.mock('../config', () => ({
  isTest: false, // Set to false to test rate limiting
  security: {
    rateLimitRequests: 10,
    rateLimitWindow: 60,
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

describe('Rate Limiting Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: MockNextFunction;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock request
    mockRequest = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
      user: {
        userId: 'test-user-id',
        email: 'test@example.com',
      },
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
    const middleware = rateLimit('default');

    // Call middleware
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if next was called
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it('should block requests that exceed rate limit', async () => {
    // Create rate limit middleware
    const middleware = rateLimit('auth');

    // Call middleware multiple times to exceed rate limit
    for (let i = 0; i < 5; i++) {
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);
    }

    // Reset next function to check if it's called again
    nextFunction.mockReset();

    // Call middleware one more time
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if response was set correctly
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Too many requests, please try again later',
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
    const middleware = rateLimit('default');

    // Call middleware
    await middleware(requestWithoutUser as Request, mockResponse as Response, nextFunction);

    // Check if next was called
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should use different rate limits for different endpoints', async () => {
    // Create rate limit middleware for auth
    const authMiddleware = rateLimit('auth');

    // Call auth middleware multiple times to exceed rate limit
    for (let i = 0; i < 5; i++) {
      await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    }

    // Reset next function to check if it's called again
    nextFunction.mockReset();

    // Call auth middleware one more time
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if auth middleware blocked the request
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(429);

    // Reset response
    jest.clearAllMocks();

    // Create rate limit middleware for default
    const defaultMiddleware = rateLimit('default');

    // Call default middleware
    await defaultMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if default middleware allowed the request
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });
});
