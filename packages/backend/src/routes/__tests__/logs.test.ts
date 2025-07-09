import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import * as logsController from '../logs';
import * as loggingService from '../../services/loggingService';
import { ApiError } from '../../utils/errors';

// Mock services
vi.mock('../../services/loggingService');

describe('Logs API Controller', () => {
  // Common mocks
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();

    // Common mock response with jest-like spies for methods
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('getLogs', () => {
    it('successfully retrieves logs with default pagination', async () => {
      // Mock log data
      const mockLogs = {
        logs: [
          {
            id: 'log-1',
            level: 'info',
            message: 'User login successful',
            timestamp: '2023-06-10T10:00:00Z',
            userId: 'user-123',
            metadata: { ip: '192.168.1.1' },
          },
          {
            id: 'log-2',
            level: 'error',
            message: 'Database query failed',
            timestamp: '2023-06-10T10:05:00Z',
            metadata: {
              query: 'SELECT * FROM users',
              error: 'Connection timeout',
            },
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };

      // Set up mock to return the data
      vi.mocked(loggingService.getLogs).mockResolvedValue(mockLogs);

      // Mock request with admin role
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
        query: {},
      };

      // Call the controller
      await logsController.getLogs(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with default params
      expect(loggingService.getLogs).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        level: undefined,
        startDate: undefined,
        endDate: undefined,
        userId: undefined,
        search: undefined,
      });

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockLogs);
    });

    it('handles filtering and pagination parameters', async () => {
      // Mock log data with filters
      const mockFilteredLogs = {
        logs: [
          {
            id: 'log-1',
            level: 'error',
            message: 'Authentication failed',
            timestamp: '2023-06-10T10:00:00Z',
            userId: 'user-123',
            metadata: { ip: '192.168.1.1', reason: 'Invalid password' },
          },
        ],
        total: 1,
        page: 2,
        limit: 10,
      };

      // Set up mock to return the filtered data
      vi.mocked(loggingService.getLogs).mockResolvedValue(mockFilteredLogs);

      // Mock request with filters
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
        query: {
          page: '2',
          limit: '10',
          level: 'error',
          startDate: '2023-06-10',
          endDate: '2023-06-11',
          userId: 'user-123',
          search: 'Authentication',
        },
      };

      // Call the controller
      await logsController.getLogs(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with filter params
      expect(loggingService.getLogs).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        level: 'error',
        startDate: '2023-06-10',
        endDate: '2023-06-11',
        userId: 'user-123',
        search: 'Authentication',
      });

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockFilteredLogs);
    });

    it('handles invalid pagination parameters', async () => {
      // Set up mock with default return
      vi.mocked(loggingService.getLogs).mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      // Mock request with invalid pagination
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
        query: {
          page: 'abc',
          limit: 'def',
        },
      };

      // Call the controller
      await logsController.getLogs(mockRequest as Request, mockResponse as Response, mockNext);

      // Should use default values
      expect(loggingService.getLogs).toHaveBeenCalledWith({
        page: 1, // Default
        limit: 20, // Default
        level: undefined,
        startDate: undefined,
        endDate: undefined,
        userId: undefined,
        search: undefined,
      });
    });

    it('rejects non-admin users from accessing logs', async () => {
      // Mock request with non-admin role
      mockRequest = {
        user: { id: 'user-123', role: 'user' },
        query: {},
      };

      // Call the controller
      await logsController.getLogs(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
      expect(mockNext.mock.calls[0][0].message).toContain('admin');
    });

    it('handles server errors when fetching logs', async () => {
      // Set up mock to throw error
      vi.mocked(loggingService.getLogs).mockRejectedValue(new Error('Database connection error'));

      // Mock request
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
        query: {},
      };

      // Call the controller
      await logsController.getLogs(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getSystemStats', () => {
    it('successfully retrieves system statistics', async () => {
      // Mock stats data
      const mockStats = {
        apiRequests: {
          total: 15000,
          lastHour: 250,
          byEndpoint: {
            '/api/projects': 5000,
            '/api/segmentation': 8000,
            '/api/users': 2000,
          },
        },
        errors: {
          total: 150,
          lastHour: 5,
          byType: {
            ValidationError: 50,
            AuthenticationError: 40,
            ServerError: 60,
          },
        },
        performance: {
          averageResponseTime: 120,
          p95ResponseTime: 350,
          slowestEndpoints: [
            { path: '/api/segmentation/auto', time: 500 },
            { path: '/api/export', time: 450 },
          ],
        },
        system: {
          cpuLoad: 45,
          memoryUsage: 70,
          diskSpace: 65,
        },
      };

      // Set up mock to return the stats
      vi.mocked(loggingService.getSystemStats).mockResolvedValue(mockStats);

      // Mock request with admin role
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await logsController.getSystemStats(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service was called
      expect(loggingService.getSystemStats).toHaveBeenCalled();

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockStats);
    });

    it('rejects non-admin users from accessing system stats', async () => {
      // Mock request with non-admin role
      mockRequest = {
        user: { id: 'user-123', role: 'user' },
      };

      // Call the controller
      await logsController.getSystemStats(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('getLogDetails', () => {
    it('successfully retrieves detailed log information', async () => {
      // Mock detailed log
      const mockLogDetail = {
        id: 'log-123',
        level: 'error',
        message: 'Database query failed',
        timestamp: '2023-06-10T10:05:00Z',
        logger: 'database.service',
        userId: 'user-123',
        metadata: {
          query: 'SELECT * FROM users WHERE id = ?',
          params: ['user-123'],
          error: {
            name: 'QueryTimeoutError',
            message: 'Query execution timed out',
            stack: 'Error: Query execution timed out\n    at Database.query (/app/src/db.ts:45:11)',
          },
          request: {
            method: 'GET',
            path: '/api/users/user-123',
            headers: {
              'user-agent': 'Mozilla/5.0',
            },
          },
        },
      };

      // Set up mock to return the log detail
      vi.mocked(loggingService.getLogById).mockResolvedValue(mockLogDetail);

      // Mock request
      mockRequest = {
        params: { id: 'log-123' },
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await logsController.getLogDetails(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service was called with correct id
      expect(loggingService.getLogById).toHaveBeenCalledWith('log-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockLogDetail);
    });

    it('handles log not found errors', async () => {
      // Set up mock to throw not found error
      vi.mocked(loggingService.getLogById).mockRejectedValue(new ApiError(404, 'Log not found'));

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await logsController.getLogDetails(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('rejects non-admin users from accessing log details', async () => {
      // Mock request with non-admin role
      mockRequest = {
        params: { id: 'log-123' },
        user: { id: 'user-123', role: 'user' },
      };

      // Call the controller
      await logsController.getLogDetails(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});
