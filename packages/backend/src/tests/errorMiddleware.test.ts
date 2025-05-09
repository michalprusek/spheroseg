import { Request, Response, NextFunction } from 'express';
import errorHandler, { ApiError, notFoundHandler } from '../middleware/errorMiddleware';

describe('errorMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  describe('ApiError', () => {
    it('should create an error with the specified status code and message', () => {
      const error = new ApiError('Test error', 400);
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ApiError');
      expect(error.stack).toBeDefined();
    });

    it('should default to status code 500 if not specified', () => {
      const error = new ApiError('Test error');
      
      expect(error.statusCode).toBe(500);
    });
  });

  describe('errorHandler', () => {
    it('should handle ApiError with correct status code and message', () => {
      const error = new ApiError('Bad Request', 400);
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Bad Request',
          details: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle regular Error with default 500 status code', () => {
      const error = new Error('Something went wrong');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal Server Error',
          details: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle errors with statusCode property', () => {
      const error = new Error('Not Found') as any;
      error.statusCode = 404;
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Not Found',
          details: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    it('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new ApiError('Production Error', 400);
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Production Error',
          details: undefined,
          timestamp: expect.any(String)
        }
      });
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with route information', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/nonexistent'
      };
      
      notFoundHandler(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Route not found: GET /api/nonexistent',
          timestamp: expect.any(String)
        }
      });
    });
  });
});