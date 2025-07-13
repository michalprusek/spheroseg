import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { requireAuth, optionalAuth, requireRole } from '../auth';
import logger from '@/utils/logger';

// Mock dependencies
vi.mock('jsonwebtoken');
vi.mock('@/utils/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      headers: {},
      cookies: {},
    };
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    
    mockNext = vi.fn();
  });

  describe('requireAuth', () => {
    it('should call next() with valid token in Authorization header', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      
      vi.mocked(jwt.verify).mockReturnValue(mockUser as any);
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() with valid token in cookie', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockReq.cookies = { authToken: 'valid-cookie-token' };
      
      vi.mocked(jwt.verify).mockReturnValue(mockUser as any);
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-cookie-token', process.env.JWT_SECRET);
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when no token is provided', () => {
      requireAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid authentication token',
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle malformed authorization header', () => {
      mockReq.headers = { authorization: 'InvalidFormat' };
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should prefer authorization header over cookie when both are present', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockReq.headers = { authorization: 'Bearer header-token' };
      mockReq.cookies = { authToken: 'cookie-token' };
      
      vi.mocked(jwt.verify).mockReturnValue(mockUser as any);
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jwt.verify).toHaveBeenCalledWith('header-token', process.env.JWT_SECRET);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should call next() with valid token and set user', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      
      vi.mocked(jwt.verify).mockReturnValue(mockUser as any);
      
      optionalAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() without setting user when no token is provided', () => {
      optionalAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() without setting user when token is invalid', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      optionalAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should call next() when user has required role', () => {
      mockReq.user = { id: '123', email: 'test@example.com', role: 'admin' };
      
      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() when user has one of multiple required roles', () => {
      mockReq.user = { id: '123', email: 'test@example.com', role: 'moderator' };
      
      const middleware = requireRole(['admin', 'moderator']);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      mockReq.user = { id: '123', email: 'test@example.com', role: 'user' };
      
      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Insufficient permissions',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when no user is present', () => {
      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive role matching', () => {
      mockReq.user = { id: '123', email: 'test@example.com', role: 'ADMIN' };
      
      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle JWT expiration error', () => {
      mockReq.headers = { authorization: 'Bearer expired-token' };
      
      const error = new Error('Token expired') as any;
      error.name = 'TokenExpiredError';
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw error;
      });
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid authentication token',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'JWT verification failed',
        expect.objectContaining({
          error: 'Token expired',
          errorName: 'TokenExpiredError',
        })
      );
    });

    it('should handle missing JWT_SECRET', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      mockReq.headers = { authorization: 'Bearer some-token' };
      
      requireAuth(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      
      // Restore original secret
      process.env.JWT_SECRET = originalSecret;
    });
  });
});