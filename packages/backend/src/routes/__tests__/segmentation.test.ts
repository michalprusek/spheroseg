import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as segmentationController from '../../controllers/segmentationController';
import * as segmentationService from '../../services/segmentationService';
import * as segmentationQueueService from '../../services/segmentationQueueService';
import { ApiError } from '../../utils/errors';
import { SegmentationStatus } from '@spheroseg/types';

// Mock services
jest.mock('../../services/segmentationService');
jest.mock('../../services/segmentationQueueService');

describe('Segmentation API Controller', () => {
  // Common mocks
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.resetAllMocks();

    // Common mock response with jest spies for methods
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('getSegmentation', () => {
    it('successfully retrieves segmentation for an image', async () => {
      // Mock segmentation data
      const mockSegmentation = {
        imageId: 'image-123',
        polygons: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
            closed: true,
            color: '#FF0000',
          },
        ],
        status: SegmentationStatus.COMPLETED,
        version: 1,
      };

      // Set up mock to return the data
      (segmentationService.getSegmentation as jest.Mock).mockResolvedValue(mockSegmentation);

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123' },
      };

      // Call the controller
      await segmentationController.getSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(segmentationService.getSegmentation).toHaveBeenCalledWith('image-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSegmentation);
    });

    it('handles errors when segmentation is not found', async () => {
      // Set up mock to throw not found error
      (segmentationService.getSegmentation as jest.Mock).mockRejectedValue(new ApiError(404, 'Segmentation not found'));

      // Mock request
      mockRequest = {
        params: { imageId: 'non-existent' },
      };

      // Call the controller
      await segmentationController.getSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('handles errors when imageId parameter is missing', async () => {
      // Mock request with missing imageId
      mockRequest = {
        params: {},
      };

      // Call the controller
      await segmentationController.getSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe('saveSegmentation', () => {
    it('successfully saves segmentation data', async () => {
      // Mock segmentation data to save
      const mockSegmentationData = {
        polygons: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
            closed: true,
            color: '#FF0000',
          },
        ],
      };

      // Mock successful save response
      (segmentationService.saveSegmentation as jest.Mock).mockResolvedValue({
        success: true,
        version: 2,
      });

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123' },
        body: mockSegmentationData,
      };

      // Call the controller
      await segmentationController.saveSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(segmentationService.saveSegmentation).toHaveBeenCalledWith('image-123', mockSegmentationData.polygons);

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        version: 2,
      });
    });

    it('handles validation errors in segmentation data', async () => {
      // Mock invalid segmentation data (empty polygons)
      const mockInvalidData = {
        polygons: [],
      };

      // Set up mock to throw validation error
      (segmentationService.saveSegmentation as jest.Mock).mockRejectedValue(
        new ApiError(400, 'Invalid segmentation data'),
      );

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123' },
        body: mockInvalidData,
      };

      // Call the controller
      await segmentationController.saveSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
    });

    it('handles authorization errors when saving segmentation', async () => {
      // Mock segmentation data
      const mockSegmentationData = {
        polygons: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
            closed: true,
            color: '#FF0000',
          },
        ],
      };

      // Set up mock to throw authorization error
      (segmentationService.saveSegmentation as jest.Mock).mockRejectedValue(
        new ApiError(403, 'Unauthorized to modify this segmentation'),
      );

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123' },
        body: mockSegmentationData,
      };

      // Call the controller
      await segmentationController.saveSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('runAutoSegmentation', () => {
    it('successfully queues an auto-segmentation job', async () => {
      // Mock successful queue response
      (segmentationQueueService.queueSegmentationJob as jest.Mock).mockResolvedValue({
        jobId: 'job-123',
        status: 'queued',
      });

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123' },
        body: { options: { threshold: 0.5, simplify: true } },
      };

      // Call the controller
      await segmentationController.runAutoSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(segmentationQueueService.queueSegmentationJob).toHaveBeenCalledWith('image-123', {
        threshold: 0.5,
        simplify: true,
      });

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockResponse.json).toHaveBeenCalledWith({
        jobId: 'job-123',
        status: 'queued',
      });
    });

    it('handles image not found errors when queuing segmentation', async () => {
      // Set up mock to throw not found error
      (segmentationQueueService.queueSegmentationJob as jest.Mock).mockRejectedValue(
        new ApiError(404, 'Image not found'),
      );

      // Mock request
      mockRequest = {
        params: { imageId: 'non-existent' },
        body: { options: {} },
      };

      // Call the controller
      await segmentationController.runAutoSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('handles server errors when segmentation fails', async () => {
      // Set up mock to throw server error
      (segmentationQueueService.queueSegmentationJob as jest.Mock).mockRejectedValue(
        new Error('ML service unavailable'),
      );

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123' },
        body: { options: {} },
      };

      // Call the controller
      await segmentationController.runAutoSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getSegmentationStatus', () => {
    it('successfully retrieves segmentation job status', async () => {
      // Mock job status
      const mockJobStatus = {
        jobId: 'job-123',
        imageId: 'image-123',
        status: 'processing',
        progress: 65,
        createdAt: '2023-06-20T10:00:00Z',
        updatedAt: '2023-06-20T10:01:30Z',
      };

      // Set up mock to return the status
      (segmentationQueueService.getJobStatus as jest.Mock).mockResolvedValue(mockJobStatus);

      // Mock request
      mockRequest = {
        params: { jobId: 'job-123' },
      };

      // Call the controller
      await segmentationController.getSegmentationStatus(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(segmentationQueueService.getJobStatus).toHaveBeenCalledWith('job-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockJobStatus);
    });

    it('handles job not found errors', async () => {
      // Set up mock to throw not found error
      (segmentationQueueService.getJobStatus as jest.Mock).mockRejectedValue(new ApiError(404, 'Job not found'));

      // Mock request
      mockRequest = {
        params: { jobId: 'non-existent' },
      };

      // Call the controller
      await segmentationController.getSegmentationStatus(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  describe('cancelSegmentation', () => {
    it('successfully cancels a segmentation job', async () => {
      // Mock successful cancellation
      (segmentationQueueService.cancelJob as jest.Mock).mockResolvedValue({
        jobId: 'job-123',
        status: 'cancelled',
      });

      // Mock request
      mockRequest = {
        params: { jobId: 'job-123' },
      };

      // Call the controller
      await segmentationController.cancelSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(segmentationQueueService.cancelJob).toHaveBeenCalledWith('job-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        jobId: 'job-123',
        status: 'cancelled',
      });
    });

    it('handles cancellation of completed jobs', async () => {
      // Set up mock to throw error for already completed job
      (segmentationQueueService.cancelJob as jest.Mock).mockRejectedValue(
        new ApiError(400, 'Cannot cancel completed job'),
      );

      // Mock request
      mockRequest = {
        params: { jobId: 'completed-job' },
      };

      // Call the controller
      await segmentationController.cancelSegmentation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe('getSegmentationHistory', () => {
    it('successfully retrieves segmentation version history', async () => {
      // Mock version history
      const mockHistory = [
        {
          version: 3,
          createdAt: '2023-06-20T14:00:00Z',
          userId: 'user-123',
          userName: 'Test User',
          changeType: 'manual',
        },
        {
          version: 2,
          createdAt: '2023-06-19T10:00:00Z',
          userId: 'user-123',
          userName: 'Test User',
          changeType: 'auto',
        },
        {
          version: 1,
          createdAt: '2023-06-18T09:00:00Z',
          userId: 'user-123',
          userName: 'Test User',
          changeType: 'initial',
        },
      ];

      // Set up mock to return the history
      (segmentationService.getSegmentationHistory as jest.Mock).mockResolvedValue(mockHistory);

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123' },
      };

      // Call the controller
      await segmentationController.getSegmentationHistory(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(segmentationService.getSegmentationHistory).toHaveBeenCalledWith('image-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHistory);
    });

    it('handles not found errors for history', async () => {
      // Set up mock to throw not found error
      (segmentationService.getSegmentationHistory as jest.Mock).mockRejectedValue(
        new ApiError(404, 'Segmentation history not found'),
      );

      // Mock request
      mockRequest = {
        params: { imageId: 'non-existent' },
      };

      // Call the controller
      await segmentationController.getSegmentationHistory(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  describe('getSegmentationVersion', () => {
    it('successfully retrieves a specific segmentation version', async () => {
      // Mock specific version data
      const mockVersionData = {
        imageId: 'image-123',
        polygons: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
            closed: true,
            color: '#FF0000',
          },
        ],
        version: 2,
        createdAt: '2023-06-19T10:00:00Z',
      };

      // Set up mock to return the version
      (segmentationService.getSegmentationVersion as jest.Mock).mockResolvedValue(mockVersionData);

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123', version: '2' },
      };

      // Call the controller
      await segmentationController.getSegmentationVersion(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(segmentationService.getSegmentationVersion).toHaveBeenCalledWith('image-123', 2);

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockVersionData);
    });

    it('handles version not found errors', async () => {
      // Set up mock to throw not found error
      (segmentationService.getSegmentationVersion as jest.Mock).mockRejectedValue(
        new ApiError(404, 'Segmentation version not found'),
      );

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123', version: '999' },
      };

      // Call the controller
      await segmentationController.getSegmentationVersion(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('handles invalid version parameter', async () => {
      // Mock request with invalid version
      mockRequest = {
        params: { imageId: 'image-123', version: 'abc' },
      };

      // Call the controller
      await segmentationController.getSegmentationVersion(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe('restoreSegmentationVersion', () => {
    it('successfully restores a previous segmentation version', async () => {
      // Mock restore result
      const mockRestoreResult = {
        success: true,
        version: 4, // New version created from restore
        restoredFrom: 2, // Version that was restored
      };

      // Set up mock to return restore result
      (segmentationService.restoreSegmentationVersion as jest.Mock).mockResolvedValue(mockRestoreResult);

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123', version: '2' },
      };

      // Call the controller
      await segmentationController.restoreSegmentationVersion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Verify service was called with correct params
      expect(segmentationService.restoreSegmentationVersion).toHaveBeenCalledWith('image-123', 2);

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockRestoreResult);
    });

    it('handles version not found errors when restoring', async () => {
      // Set up mock to throw not found error
      (segmentationService.restoreSegmentationVersion as jest.Mock).mockRejectedValue(
        new ApiError(404, 'Version to restore not found'),
      );

      // Mock request
      mockRequest = {
        params: { imageId: 'image-123', version: '999' },
      };

      // Call the controller
      await segmentationController.restoreSegmentationVersion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });
  });
});
