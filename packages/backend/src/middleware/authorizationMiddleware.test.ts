import { Request, Response, NextFunction } from 'express';
import { isAdmin, isUserApproved } from './authorizationMiddleware';
import { AuthenticatedRequest } from './authMiddleware';
import pool from '../db';

// Mock the database pool
jest.mock('../db', () => ({
  query: jest.fn(),
}));

// Mock Express response and next functions
const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockNext: NextFunction = jest.fn();

describe('Authorization Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let response: Response;
  const mockDbQuery = pool.query as jest.Mock; // Type cast for mock control

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockRequest = {}; // Reset request object
    response = mockResponse();
  });

  // --- isAdmin Tests ---
  describe('isAdmin', () => {
    it('should call next() if user is admin', async () => {
      mockRequest.user = { userId: 'admin-user-id', email: 'admin@test.com' }; // Mock authenticated user
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ role: 'admin' }],
        rowCount: 1,
      }); // Mock DB response

      await isAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', ['admin-user-id']);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(response.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not admin', async () => {
      mockRequest.user = { userId: 'regular-user-id', email: 'user@test.com' };
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ role: 'user' }],
        rowCount: 1,
      });

      await isAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', ['regular-user-id']);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        message: 'Forbidden: Admin access required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user not found in DB', async () => {
      mockRequest.user = { userId: 'ghost-user-id', email: 'ghost@test.com' };
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Simulate user not found

      await isAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', ['ghost-user-id']);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        message: 'Forbidden: Admin access required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated (no req.user)', async () => {
      // No req.user set
      await isAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        message: 'Not authenticated',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next(error) if database query fails', async () => {
      mockRequest.user = { userId: 'admin-user-id', email: 'admin@test.com' };
      const dbError = new Error('Database error');
      mockDbQuery.mockRejectedValueOnce(dbError); // Simulate DB error

      await isAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', ['admin-user-id']);
      expect(response.status).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  // --- isUserApproved Tests ---
  describe('isUserApproved', () => {
    it('should call next() if user is approved', async () => {
      mockRequest.user = {
        userId: 'approved-user-id',
        email: 'approved@test.com',
      };
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ is_approved: true }],
        rowCount: 1,
      });

      await isUserApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT is_approved FROM users WHERE id = $1', ['approved-user-id']);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(response.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not approved', async () => {
      mockRequest.user = {
        userId: 'not-approved-user-id',
        email: 'notapproved@test.com',
      };
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ is_approved: false }],
        rowCount: 1,
      });

      await isUserApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT is_approved FROM users WHERE id = $1', ['not-approved-user-id']);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        message: 'Forbidden: Account not approved',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user not found in DB', async () => {
      mockRequest.user = { userId: 'ghost-user-id', email: 'ghost@test.com' };
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await isUserApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT is_approved FROM users WHERE id = $1', ['ghost-user-id']);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        message: 'Forbidden: Account not approved',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated (no req.user)', async () => {
      await isUserApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        message: 'Not authenticated',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next(error) if database query fails', async () => {
      mockRequest.user = {
        userId: 'approved-user-id',
        email: 'approved@test.com',
      };
      const dbError = new Error('DB connection failed');
      mockDbQuery.mockRejectedValueOnce(dbError);

      await isUserApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT is_approved FROM users WHERE id = $1', ['approved-user-id']);
      expect(response.status).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
