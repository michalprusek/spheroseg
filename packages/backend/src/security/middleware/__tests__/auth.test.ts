import { Response, NextFunction } from 'express';
import { requireAdmin, requireApproved, AuthenticatedRequest } from '../auth';
import pool from '../../../db';

// Mock the database pool
jest.mock('../../../db', () => ({
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

  // --- requireAdmin Tests ---
  describe('requireAdmin', () => {
    it('should call next() if user is admin', async () => {
      mockRequest.user = { userId: 'admin-user-id', email: 'admin@test.com' }; // Mock authenticated user
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ role: 'admin' }],
        rowCount: 1,
      }); // Mock DB response

      await requireAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', [
        'admin-user-id',
      ]);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(response.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not admin', async () => {
      mockRequest.user = { userId: 'regular-user-id', email: 'user@test.com' };
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ role: 'user' }],
        rowCount: 1,
      });

      await requireAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', [
        'regular-user-id',
      ]);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin access required',
        error: 'INSUFFICIENT_PERMISSIONS',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user not found in DB', async () => {
      mockRequest.user = { userId: 'ghost-user-id', email: 'ghost@test.com' };
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Simulate user not found

      await requireAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', [
        'ghost-user-id',
      ]);
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated (no req.user)', async () => {
      // No req.user set
      await requireAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 if database query fails', async () => {
      mockRequest.user = { userId: 'admin-user-id', email: 'admin@test.com' };
      const dbError = new Error('Database error');
      mockDbQuery.mockRejectedValueOnce(dbError); // Simulate DB error

      await requireAdmin(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', [
        'admin-user-id',
      ]);
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authorization check failed',
        error: 'AUTHORIZATION_ERROR',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // --- requireApproved Tests ---
  describe('requireApproved', () => {
    it('should call next() if user is approved', async () => {
      mockRequest.user = {
        userId: 'approved-user-id',
        email: 'approved@test.com',
      };
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ is_approved: true }],
        rowCount: 1,
      });

      await requireApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT is_approved FROM users WHERE id = $1', [
        'approved-user-id',
      ]);
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

      await requireApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT is_approved FROM users WHERE id = $1', [
        'not-approved-user-id',
      ]);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account not approved',
        error: 'ACCOUNT_NOT_APPROVED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user not found in DB', async () => {
      mockRequest.user = {
        userId: 'non-existent-user-id',
        email: 'ghost@test.com',
      };
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await requireApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT is_approved FROM users WHERE id = $1', [
        'non-existent-user-id',
      ]);
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated (no req.user)', async () => {
      // No req.user set
      await requireApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 if database query fails', async () => {
      mockRequest.user = {
        userId: 'approved-user-id',
        email: 'approved@test.com',
      };
      const dbError = new Error('DB connection failed');
      mockDbQuery.mockRejectedValueOnce(dbError);

      await requireApproved(mockRequest as AuthenticatedRequest, response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith('SELECT is_approved FROM users WHERE id = $1', [
        'approved-user-id',
      ]);
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'Approval check failed',
        error: 'AUTHORIZATION_ERROR',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
