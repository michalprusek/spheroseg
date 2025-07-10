import { Request, Response } from 'express';
import * as metricsController from '../metricsRoutes';
import * as metricsService from '../../services/metricsService';
import { ApiError } from '../../utils/errors';

// Mock services
jest.mock('../../services/metricsService');

describe('Metrics API Controller', () => {
  // Common mocks
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.resetAllMocks();

    // Common mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectMetrics', () => {
    it('should return project metrics successfully', async () => {
      // Arrange
      const mockMetrics = {
        totalImages: 10,
        totalCells: 100,
        avgCellsPerImage: 10,
      };
      
      mockRequest = {
        params: { projectId: 'project-123' },
      };

      (metricsService.getProjectMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      // Act
      await metricsController.getProjectMetrics(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(metricsService.getProjectMetrics).toHaveBeenCalledWith('project-123');
      expect(mockResponse.json).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle errors', async () => {
      // Arrange
      mockRequest = {
        params: { projectId: 'project-123' },
      };
      
      const error = new Error('Service error');
      (metricsService.getProjectMetrics as jest.Mock).mockRejectedValue(error);

      // Act
      await metricsController.getProjectMetrics(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getImageMetrics', () => {
    it('should return image metrics successfully', async () => {
      // Arrange
      const mockMetrics = {
        cellCount: 50,
        avgCellArea: 100.5,
        minCellArea: 50,
        maxCellArea: 200,
      };
      
      mockRequest = {
        params: { imageId: 'image-123' },
      };

      (metricsService.getImageMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      // Act
      await metricsController.getImageMetrics(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(metricsService.getImageMetrics).toHaveBeenCalledWith('image-123');
      expect(mockResponse.json).toHaveBeenCalledWith(mockMetrics);
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics as CSV', async () => {
      // Arrange
      const mockCsvData = 'id,area,perimeter\n1,100,40\n2,150,50';
      
      mockRequest = {
        params: { projectId: 'project-123' },
        query: { format: 'csv' },
      };

      (metricsService.exportMetrics as jest.Mock).mockResolvedValue({
        data: mockCsvData,
        contentType: 'text/csv',
        filename: 'metrics.csv',
      });

      // Act
      await metricsController.exportMetrics(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(metricsService.exportMetrics).toHaveBeenCalledWith('project-123', 'csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="metrics.csv"'
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockCsvData);
    });

    it('should handle invalid format', async () => {
      // Arrange
      mockRequest = {
        params: { projectId: 'project-123' },
        query: { format: 'invalid' },
      };

      // Act
      await metricsController.exportMetrics(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringContaining('Invalid format'),
        })
      );
    });
  });
});