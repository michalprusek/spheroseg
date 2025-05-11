import { Request, Response } from 'express';
import fs from 'fs';

// Mock fs to avoid real directory creation
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn().mockImplementation((path) => {
      if (path === '/app/uploads' || path === '/app/uploads/avatars' || path.includes('logs')) {
        return true; // Pretend these directories exist
      }
      return actualFs.existsSync(path);
    }),
    mkdirSync: jest.fn().mockImplementation((path, options) => {
      // Just log the call but don't actually create directories
      console.log(`Mock: Creating directory ${path}`);
      return undefined;
    }),
  };
});

// Import after fs mock is set up
import { metricsMiddleware } from '../metricsMiddleware';

describe('Metrics Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockImplementation((header) => {
        if (header === 'user-agent') return 'test-agent';
        return null;
      }),
    };

    res = {
      statusCode: 200,
      locals: {} as any,
      on: jest.fn().mockImplementation((event, handler) => {
        if (event === 'finish') {
          // Simulate the finish event to test metrics collection
          handler();
        }
        return res;
      }),
      removeListener: jest.fn(),
    };

    next = jest.fn();
  });

  it('should call next and register a finish listener', () => {
    // Act
    metricsMiddleware(req as Request, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should register finish listener', () => {
    // Act
    metricsMiddleware(req as Request, res as Response, next);

    // Assert
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    // Note: The current implementation doesn't call removeListener, so we don't test for it
  });

  it('should handle different response status codes', () => {
    // Arrange
    res.statusCode = 404;

    // Act
    metricsMiddleware(req as Request, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should handle different request methods', () => {
    // Arrange
    req.method = 'POST';

    // Act
    metricsMiddleware(req as Request, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should handle different request paths', () => {
    // Arrange
    const reqWithPath = {
      ...req,
      path: '/api/users/me',
    };

    // Act
    metricsMiddleware(reqWithPath as Request, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });
});
