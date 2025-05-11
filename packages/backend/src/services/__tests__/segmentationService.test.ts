import { triggerSegmentationTask, getSegmentationQueueStatus, cancelSegmentationTask } from '../segmentationService';
import segmentationQueueService from '../segmentationQueueService';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../segmentationQueueService', () => ({
  triggerSegmentationTask: jest.fn().mockResolvedValue('task-id-123'),
  getSegmentationQueueStatus: jest.fn().mockResolvedValue({
    pendingTasks: 2,
    runningTasks: 1,
    completedTasks: 5,
  }),
  cancelSegmentationTask: jest.fn().mockReturnValue(true),
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
      expect(segmentationQueueService.triggerSegmentationTask).toHaveBeenCalledWith(
        mockImageId,
        mockImagePath,
        mockParameters,
        1, // default priority
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle errors when queueing a task', async () => {
      // Arrange
      // Directly set the mock to reject with an error
      (segmentationQueueService.triggerSegmentationTask as jest.Mock)
        .mockReset()
        .mockRejectedValue(new Error('Queue error'));

      // Act & Assert
      await expect(triggerSegmentationTask(mockImageId, mockImagePath, mockParameters)).rejects.toThrow('Queue error');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should accept a custom priority', async () => {
      // Arrange - Reset the mock to prevent interference from previous test
      (segmentationQueueService.triggerSegmentationTask as jest.Mock).mockReset().mockResolvedValue('task-id-123');

      // Act
      const priority = 10;
      await triggerSegmentationTask(mockImageId, mockImagePath, mockParameters, priority);

      // Assert
      expect(segmentationQueueService.triggerSegmentationTask).toHaveBeenCalledWith(
        mockImageId,
        mockImagePath,
        mockParameters,
        priority,
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
      expect(segmentationQueueService.getSegmentationQueueStatus).toHaveBeenCalled();
    });
  });

  describe('cancelSegmentationTask', () => {
    it('should cancel a task successfully', () => {
      // Act
      const result = cancelSegmentationTask(mockImageId);

      // Assert
      expect(result).toBe(true);
      expect(segmentationQueueService.cancelSegmentationTask).toHaveBeenCalledWith(mockImageId);
    });

    it('should return false if task cancellation fails', () => {
      // Arrange
      (segmentationQueueService.cancelSegmentationTask as jest.Mock).mockReturnValue(false);

      // Act
      const result = cancelSegmentationTask('non-existent-task');

      // Assert
      expect(result).toBe(false);
    });
  });
});
