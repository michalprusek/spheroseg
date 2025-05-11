import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import * as metricsController from '../metricsRoutes';
import * as metricsService from '../../services/metricsService';
import { ApiError } from '../../utils/errors';

// Mock services
vi.mock('../../services/metricsService');

describe('Metrics API Controller', () => {
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
      set: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('getMetrics', () => {
    it('successfully retrieves Prometheus metrics', async () => {
      // Mock metrics data
      const mockMetricsData = `
# HELP api_requests_total Total number of API requests
# TYPE api_requests_total counter
api_requests_total{method="GET",status="200"} 1234
api_requests_total{method="POST",status="201"} 567
api_requests_total{method="GET",status="404"} 89
api_requests_total{method="GET",status="500"} 12

# HELP api_response_time_seconds API response time in seconds
# TYPE api_response_time_seconds histogram
api_response_time_seconds_bucket{le="0.1"} 800
api_response_time_seconds_bucket{le="0.3"} 1500
api_response_time_seconds_bucket{le="0.5"} 1900
api_response_time_seconds_bucket{le="1"} 1950
api_response_time_seconds_bucket{le="+Inf"} 1970
api_response_time_seconds_sum 400.2
api_response_time_seconds_count 1970
`;

      // Set up mock to return the metrics data
      vi.mocked(metricsService.getPrometheusMetrics).mockResolvedValue(mockMetricsData);

      // Mock request with admin user
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await metricsController.getMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called
      expect(metricsService.getPrometheusMetrics).toHaveBeenCalled();

      // Verify response
      expect(mockResponse.set).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(mockResponse.send).toHaveBeenCalledWith(mockMetricsData);
    });

    it('rejects non-admin users from accessing metrics', async () => {
      // Mock request with regular user
      mockRequest = {
        user: { id: 'user-123', role: 'user' },
      };

      // Call the controller
      await metricsController.getMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
      expect(mockNext.mock.calls[0][0].message).toContain('admin');
    });

    it('handles errors when retrieving metrics', async () => {
      // Set up mock to throw error
      vi.mocked(metricsService.getPrometheusMetrics).mockRejectedValue(new Error('Failed to collect metrics'));

      // Mock request
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await metricsController.getMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getApplicationMetrics', () => {
    it('successfully retrieves application-specific metrics', async () => {
      // Mock application metrics
      const mockAppMetrics = {
        userMetrics: {
          totalUsers: 1250,
          activeUsers: 450,
          newUsersLast30Days: 120,
        },
        projectMetrics: {
          totalProjects: 2500,
          activeProjects: 1200,
          averageImagesPerProject: 35,
        },
        segmentationMetrics: {
          totalPolygons: 150000,
          averagePolygonsPerImage: 42,
          autoSegmentationJobs: {
            total: 5000,
            successful: 4800,
            failed: 200,
          },
        },
        performanceMetrics: {
          averageRequestTime: 125,
          averageApiLatency: 85,
          averageSegmentationProcessingTime: 2500,
        },
      };

      // Set up mock to return the application metrics
      vi.mocked(metricsService.getApplicationMetrics).mockResolvedValue(mockAppMetrics);

      // Mock request with admin user
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await metricsController.getApplicationMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called
      expect(metricsService.getApplicationMetrics).toHaveBeenCalled();

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockAppMetrics);
    });

    it('rejects non-admin users from accessing application metrics', async () => {
      // Mock request with regular user
      mockRequest = {
        user: { id: 'user-123', role: 'user' },
      };

      // Call the controller
      await metricsController.getApplicationMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('getUserActivityMetrics', () => {
    it('successfully retrieves user activity metrics', async () => {
      // Mock user activity data
      const mockUserActivity = {
        userId: 'user-123',
        totalActivity: {
          projects: 15,
          images: 430,
          polygons: 2500,
          lastActivity: '2023-06-15T14:30:00Z',
        },
        dailyActivity: [
          { date: '2023-06-15', actions: 45 },
          { date: '2023-06-14', actions: 32 },
          { date: '2023-06-13', actions: 67 },
          { date: '2023-06-12', actions: 28 },
          { date: '2023-06-11', actions: 0 },
          { date: '2023-06-10', actions: 12 },
          { date: '2023-06-09', actions: 39 },
        ],
        mostActiveProjects: [
          { id: 'project-1', name: 'Main Project', activity: 156 },
          { id: 'project-2', name: 'Secondary Project', activity: 98 },
          { id: 'project-3', name: 'Small Test', activity: 45 },
        ],
      };

      // Set up mock to return the activity data
      vi.mocked(metricsService.getUserActivityMetrics).mockResolvedValue(mockUserActivity);

      // Mock request
      mockRequest = {
        params: { userId: 'user-123' },
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await metricsController.getUserActivityMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct userId
      expect(metricsService.getUserActivityMetrics).toHaveBeenCalledWith('user-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUserActivity);
    });

    it('allows users to access their own activity metrics', async () => {
      // Mock user activity data
      const mockUserActivity = {
        userId: 'user-123',
        totalActivity: {
          projects: 15,
          images: 430,
          polygons: 2500,
          lastActivity: '2023-06-15T14:30:00Z',
        },
        dailyActivity: [{ date: '2023-06-15', actions: 45 }],
        mostActiveProjects: [{ id: 'project-1', name: 'Main Project', activity: 156 }],
      };

      // Set up mock to return the activity data
      vi.mocked(metricsService.getUserActivityMetrics).mockResolvedValue(mockUserActivity);

      // Mock request with same user id as requested metrics
      mockRequest = {
        params: { userId: 'user-123' },
        user: { id: 'user-123', role: 'user' },
      };

      // Call the controller
      await metricsController.getUserActivityMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called
      expect(metricsService.getUserActivityMetrics).toHaveBeenCalledWith('user-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUserActivity);
    });

    it("prevents users from accessing other users' metrics", async () => {
      // Mock request with different user id
      mockRequest = {
        params: { userId: 'user-456' },
        user: { id: 'user-123', role: 'user' },
      };

      // Call the controller
      await metricsController.getUserActivityMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });

    it('handles user not found errors', async () => {
      // Set up mock to throw not found error
      vi.mocked(metricsService.getUserActivityMetrics).mockRejectedValue(new ApiError(404, 'User not found'));

      // Mock request
      mockRequest = {
        params: { userId: 'non-existent' },
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await metricsController.getUserActivityMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  describe('getSystemHealthMetrics', () => {
    it('successfully retrieves system health metrics', async () => {
      // Mock health metrics
      const mockHealthMetrics = {
        status: 'healthy',
        uptime: 1209600, // 14 days in seconds
        services: {
          api: { status: 'healthy', responseTime: 35 },
          database: {
            status: 'healthy',
            connectionPool: { active: 10, idle: 5, max: 20 },
          },
          ml: { status: 'healthy', queueLength: 0 },
          storage: { status: 'healthy', spaceAvailable: '1.2TB' },
        },
        resources: {
          cpu: { usage: 35, temperature: 45 },
          memory: { used: '4.5GB', free: '11.5GB', total: '16GB' },
          disk: { used: '350GB', free: '1.2TB', total: '1.5TB' },
        },
        errors: {
          last24Hours: 15,
          byService: {
            api: 5,
            database: 7,
            ml: 3,
            storage: 0,
          },
        },
      };

      // Set up mock to return the health metrics
      vi.mocked(metricsService.getSystemHealthMetrics).mockResolvedValue(mockHealthMetrics);

      // Mock request with admin user
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' },
      };

      // Call the controller
      await metricsController.getSystemHealthMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called
      expect(metricsService.getSystemHealthMetrics).toHaveBeenCalled();

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealthMetrics);
    });

    it('rejects non-admin users from accessing system health metrics', async () => {
      // Mock request with regular user
      mockRequest = {
        user: { id: 'user-123', role: 'user' },
      };

      // Call the controller
      await metricsController.getSystemHealthMetrics(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});
