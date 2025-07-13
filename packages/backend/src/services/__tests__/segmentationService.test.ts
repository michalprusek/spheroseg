import {
  triggerSegmentationTask,
  getSegmentationQueueStatus,
  cancelSegmentationTask,
  getSegmentation,
  saveSegmentation,
  getSegmentationHistory,
  getSegmentationVersion,
  restoreSegmentationVersion,
} from '../segmentationService';
import segmentationQueueService from '../segmentationQueueService';
import pool from '../../db';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../segmentationQueueService', () => ({
  addTask: jest.fn().mockResolvedValue('task-id-123'),
  getQueueStatus: jest.fn().mockResolvedValue({
    pendingTasks: 2,
    runningTasks: 1,
    completedTasks: 5,
  }),
  cancelTask: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../db', () => ({
  query: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

describe('Segmentation Service', () => {
  // Mock data for tests
  const mockImageId = 'test-image-id';
  const mockImagePath = '/path/to/image.jpg';
  const mockParameters = { threshold: 0.5 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerSegmentationTask', () => {
    it('should queue a segmentation task successfully', async () => {
      // Act
      const taskId = await triggerSegmentationTask(mockImageId, mockImagePath, mockParameters);

      // Assert
      expect(taskId).toBe('task-id-123');
      expect(segmentationQueueService.addTask).toHaveBeenCalledWith(
        mockImageId,
        mockImagePath,
        mockParameters,
        1 // default priority
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle errors when queueing a task', async () => {
      // Arrange
      // Directly set the mock to reject with an error
      (segmentationQueueService.addTask as jest.Mock)
        .mockReset()
        .mockRejectedValue(new Error('Queue error'));

      // Act & Assert
      await expect(
        triggerSegmentationTask(mockImageId, mockImagePath, mockParameters)
      ).rejects.toThrow('Queue error');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should accept a custom priority', async () => {
      // Arrange - Reset the mock to prevent interference from previous test
      (segmentationQueueService.addTask as jest.Mock)
        .mockReset()
        .mockResolvedValue('task-id-123');

      // Act
      const priority = 10;
      await triggerSegmentationTask(mockImageId, mockImagePath, mockParameters, priority);

      // Assert
      expect(segmentationQueueService.addTask).toHaveBeenCalledWith(
        mockImageId,
        mockImagePath,
        mockParameters,
        priority
      );
    });
  });

  describe('getSegmentationQueueStatus', () => {
    it('should return the queue status', async () => {
      // Act
      const status = await getSegmentationQueueStatus();

      // Assert
      expect(status).toEqual({
        pendingTasks: 2,
        runningTasks: 1,
        completedTasks: 5,
      });
      expect(segmentationQueueService.getQueueStatus).toHaveBeenCalled();
    });
  });

  describe('cancelSegmentationTask', () => {
    it('should cancel a task successfully', async () => {
      // Act
      const result = await cancelSegmentationTask(mockImageId);

      // Assert
      expect(result).toBe(true);
      expect(segmentationQueueService.cancelTask).toHaveBeenCalledWith(mockImageId);
    });

    it('should return false if task cancellation fails', async () => {
      // Arrange
      (segmentationQueueService.cancelTask as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await cancelSegmentationTask('non-existent-task');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getSegmentation', () => {
    it('should return segmentation data for an image', async () => {
      // Arrange
      const mockSegmentationData = {
        id: 'seg-123',
        image_id: mockImageId,
        result_data: { polygons: [] },
        created_at: new Date(),
      };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockSegmentationData] });

      // Act
      const result = await getSegmentation(mockImageId);

      // Assert
      expect(result).toEqual(mockSegmentationData);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM segmentation_results WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1',
        [mockImageId]
      );
    });

    it('should return null if no segmentation exists', async () => {
      // Arrange
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const result = await getSegmentation(mockImageId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('saveSegmentation', () => {
    it('should save segmentation data successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const segmentationData = { polygons: [], features: {} };
      const mockSavedData = {
        id: 'seg-456',
        image_id: mockImageId,
        user_id: userId,
        result_data: segmentationData,
        status: 'completed',
      };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockSavedData] });

      // Act
      const result = await saveSegmentation(mockImageId, userId, segmentationData);

      // Assert
      expect(result).toEqual(mockSavedData);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO segmentation_results'),
        [mockImageId, userId, JSON.stringify(segmentationData)]
      );
    });
  });

  describe('getSegmentationHistory', () => {
    it('should return all segmentation versions for an image', async () => {
      // Arrange
      const mockHistory = [
        { id: 'seg-1', created_at: new Date('2024-01-01') },
        { id: 'seg-2', created_at: new Date('2024-01-02') },
      ];
      (pool.query as jest.Mock).mockResolvedValue({ rows: mockHistory });

      // Act
      const result = await getSegmentationHistory(mockImageId);

      // Assert
      expect(result).toEqual(mockHistory);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM segmentation_results WHERE image_id = $1 ORDER BY created_at DESC',
        [mockImageId]
      );
    });
  });

  describe('getSegmentationVersion', () => {
    it('should return a specific version of segmentation', async () => {
      // Arrange
      const version = 2;
      const mockVersionData = { id: 'seg-2', version: 2 };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockVersionData] });

      // Act
      const result = await getSegmentationVersion(mockImageId, version);

      // Assert
      expect(result).toEqual(mockVersionData);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM segmentation_results WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1 OFFSET $2',
        [mockImageId, version - 1]
      );
    });

    it('should return null if version does not exist', async () => {
      // Arrange
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const result = await getSegmentationVersion(mockImageId, 999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('restoreSegmentationVersion', () => {
    it('should restore a specific version successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const version = 2;
      const mockVersionData = { result_data: { polygons: ['old'] } };
      const mockRestoredData = {
        id: 'seg-new',
        image_id: mockImageId,
        user_id: userId,
        result_data: mockVersionData.result_data,
      };
      
      // Mock getSegmentationVersion
      jest.spyOn(require('../segmentationService'), 'getSegmentationVersion')
        .mockResolvedValue(mockVersionData);
      
      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockRestoredData] });

      // Act
      const result = await restoreSegmentationVersion(mockImageId, userId, version);

      // Assert
      expect(result).toEqual(mockRestoredData);
    });

    it('should throw error if version not found', async () => {
      // Arrange
      jest.spyOn(require('../segmentationService'), 'getSegmentationVersion')
        .mockResolvedValue(null);

      // Act & Assert
      await expect(
        restoreSegmentationVersion(mockImageId, 'user-123', 999)
      ).rejects.toThrow();
    });
  });
});
