import { Request, Response, NextFunction } from 'express';
import { performanceMonitoring } from '../middleware/performanceMiddleware';

// Mock config to enable testing
jest.mock('../config', () => ({
  isTest: false, // Set to false to test performance monitoring
  isDevelopment: true,
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
  },
}));

// Import logger after mocking
import logger from '../utils/logger';

describe('Performance Monitoring Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let finishCallback: Function;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock request
    mockRequest = {
      method: 'GET',
      path: '/api/test',
    };

    // Create mock response
    mockResponse = {
      statusCode: 200,
      set: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
        return mockResponse;
      }) as any,
    };

    // Create next function
    nextFunction = jest.fn();
  });

  it('should call next function', () => {
    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if next was called
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should skip monitoring for excluded paths', () => {
    // Set request path to health check
    (mockRequest as any).path = '/health';

    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Check if on was not called (monitoring was skipped)
    expect(mockResponse.on).not.toHaveBeenCalled();
  });

  it('should log performance metrics on request finish', () => {
    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Simulate request finish
    finishCallback();

    // Check if performance metrics were logged
    expect(logger.info).toHaveBeenCalledWith(
      'Request performance',
      expect.objectContaining({
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        duration: expect.objectContaining({
          ms: expect.any(Number),
          formatted: expect.any(String),
        }),
        memory: expect.objectContaining({
          current: expect.any(Object),
          diff: expect.any(Object),
        }),
      })
    );
  });

  it('should add performance headers in development mode', () => {
    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Simulate request finish
    finishCallback();

    // Check if headers were set
    expect(mockResponse.set).toHaveBeenCalledWith('X-Response-Time', expect.any(String));
    expect(mockResponse.set).toHaveBeenCalledWith('X-Memory-Usage', expect.any(String));
  });

  it('should log warning for slow requests', () => {
    // Mock process.hrtime to simulate a slow request
    const originalHrtime = process.hrtime;
    process.hrtime = jest.fn().mockImplementation((time) => {
      if (time) {
        return [2, 0]; // 2 seconds
      }
      return [0, 0];
    }) as any;

    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Simulate request finish
    finishCallback();

    // Check if warning was logged
    expect(logger.warn).toHaveBeenCalledWith('Performance warning', expect.any(Object));

    // Restore original hrtime
    process.hrtime = originalHrtime;
  });

  it('should log error for very slow requests', () => {
    // Mock process.hrtime to simulate a very slow request
    const originalHrtime = process.hrtime;
    process.hrtime = jest.fn().mockImplementation((time) => {
      if (time) {
        return [4, 0]; // 4 seconds
      }
      return [0, 0];
    }) as any;

    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Simulate request finish
    finishCallback();

    // Check if error was logged
    expect(logger.error).toHaveBeenCalledWith('Performance issue detected', expect.any(Object));

    // Restore original hrtime
    process.hrtime = originalHrtime;
  });

  it('should handle missing memory usage gracefully', () => {
    // Mock process.memoryUsage to throw error
    const originalMemoryUsage = process.memoryUsage;
    (process.memoryUsage as any) = jest.fn(() => {
      throw new Error('Memory usage not available');
    });

    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    expect(() => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      finishCallback();
    }).not.toThrow();

    // Restore original memoryUsage
    process.memoryUsage = originalMemoryUsage;
  });

  it('should handle missing hrtime gracefully', () => {
    // Mock process.hrtime to throw error
    const originalHrtime = process.hrtime;
    (process.hrtime as any) = jest.fn(() => {
      throw new Error('High-resolution time not available');
    });

    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    expect(() => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
    }).not.toThrow();

    // Restore original hrtime
    process.hrtime = originalHrtime;
  });

  it('should log error for high memory usage', () => {
    // Mock process.memoryUsage to simulate high memory usage
    const originalMemoryUsage = process.memoryUsage;
    (process.memoryUsage as any) = jest.fn(() => ({
      rss: 600 * 1024 * 1024, // 600 MB
      heapTotal: 400 * 1024 * 1024,
      heapUsed: 350 * 1024 * 1024,
      external: 50 * 1024 * 1024,
      arrayBuffers: 0,
    }));

    // Create performance monitoring middleware
    const middleware = performanceMonitoring();

    // Call middleware
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Simulate request finish
    finishCallback();

    // Check if error was logged due to high memory
    expect(logger.error).toHaveBeenCalledWith(
      'Performance issue detected',
      expect.objectContaining({
        memory: expect.objectContaining({
          current: expect.objectContaining({
            rss: 600 * 1024 * 1024,
          }),
        }),
      })
    );

    // Restore original memoryUsage
    process.memoryUsage = originalMemoryUsage;
  });
});