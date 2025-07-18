import { Request, Response } from 'express';
import * as logsController from '../logs';
import logger from '../../utils/logger';

// Mock the unified logger
jest.mock('../../utils/logger', () => ({
  getLogs: jest.fn(),
  getLog: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// logger is already imported above

describe('Logs API Controller', () => {
  // Common mocks
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.resetAllMocks();

    // Common mock response with jest-like spies for methods
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogs', () => {
    it('should return logs successfully', async () => {
      // Arrange
      const mockLogs = [
        { timestamp: '2023-01-01', level: 'info', message: 'Test log 1' },
        { timestamp: '2023-01-02', level: 'error', message: 'Test log 2' },
      ];

      mockRequest = {
        query: {
          startDate: '2023-01-01',
          endDate: '2023-01-02',
          level: 'all',
          page: '1',
          limit: '10',
        },
      };

      logger.getLogs.mockResolvedValue({
        logs: mockLogs,
        totalCount: 2,
        page: 1,
        limit: 10,
      });

      // Act
      await logsController.getLogs(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(logger.getLogs).toHaveBeenCalledWith({
        startDate: '2023-01-01',
        endDate: '2023-01-02',
        level: 'all',
        page: 1,
        limit: 10,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        logs: mockLogs,
        totalCount: 2,
        page: 1,
        limit: 10,
      });
    });

    it('should handle invalid query parameters', async () => {
      // Arrange
      mockRequest = {
        query: {
          page: 'invalid',
          limit: 'invalid',
        },
      };

      // Act
      await logsController.getLogs(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.any(String),
        })
      );
    });

    it('should handle service errors', async () => {
      // Arrange
      mockRequest = { query: {} };
      const error = new Error('Service error');
      logger.getLogs.mockRejectedValue(error);

      // Act
      await logsController.getLogs(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getLogFile', () => {
    it('should return a specific log file', async () => {
      // Arrange
      const mockLogContent = 'Log file content';
      mockRequest = {
        params: { filename: 'app-2023-01-01.log' },
      };

      logger.getLog.mockResolvedValue(mockLogContent);

      // Act
      await logsController.getLogFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(logger.getLog).toHaveBeenCalledWith('app-2023-01-01.log');
      expect(mockResponse.send).toHaveBeenCalledWith(mockLogContent);
    });

    it('should handle log file not found', async () => {
      // Arrange
      mockRequest = {
        params: { filename: 'nonexistent.log' },
      };

      logger.getLog.mockResolvedValue(null);

      // Act
      await logsController.getLogFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
          message: 'Log file not found',
        })
      );
    });

    it('should handle invalid filename', async () => {
      // Arrange
      mockRequest = {
        params: { filename: '../../../etc/passwd' },
      };

      // Act
      await logsController.getLogFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringContaining('Invalid filename'),
        })
      );
    });
  });
});
