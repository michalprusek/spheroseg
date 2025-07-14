import { SegmentationWorker } from '../segmentationWorker';
import { BullQueueService } from '../../services/bullQueueService';
import axios from 'axios';
import { Job } from 'bull';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('axios');
jest.mock('fs/promises', () => ({
  access: jest.fn(),
}));
jest.mock('../../utils/logger');
jest.mock('../../services/bullQueueService');

describe('SegmentationWorker', () => {
  let worker: SegmentationWorker;
  let mockQueueService: jest.Mocked<BullQueueService>;
  let mockDb: any;
  let mockSocketService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database
    mockDb = {
      query: jest.fn(),
    };

    // Mock socket service
    mockSocketService = {
      emitToUser: jest.fn(),
    };

    // Mock queue service
    mockQueueService = {
      processSegmentationJobs: jest.fn(),
      addSegmentationJob: jest.fn(),
      getJobStatus: jest.fn(),
      getQueueMetrics: jest.fn(),
      cleanOldJobs: jest.fn(),
      pauseQueue: jest.fn(),
      resumeQueue: jest.fn(),
      close: jest.fn(),
    } as any;

    worker = new SegmentationWorker(mockQueueService, mockDb, mockSocketService, 'http://ml:5002');
  });

  describe('start', () => {
    it('should register job processor and start cleanup cron', () => {
      worker.start(2);

      expect(mockQueueService.processSegmentationJobs).toHaveBeenCalledWith(
        expect.any(Function),
        2
      );
    });
  });

  describe('processSegmentationJob', () => {
    let mockJob: jest.Mocked<Job>;

    beforeEach(() => {
      mockJob = {
        id: 'job-123',
        data: {
          taskId: 'task-123',
          imageId: 456,
          imagePath: '/uploads/image.jpg',
          userId: 789,
        },
        progress: jest.fn(),
        log: jest.fn(),
        update: jest.fn(),
      } as any;
    });

    it('should process segmentation job successfully', async () => {
      // Mock file exists
      const fs = require('fs/promises');
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      // Mock ML service response
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          results: {
            polygons: [{ points: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
            features: { area: 100, perimeter: 40 },
          },
        },
      });

      // Mock database queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Update processing status
        .mockResolvedValueOnce({ rows: [] }) // Save results
        .mockResolvedValueOnce({ rows: [] }); // Update completed status

      const result = await (worker as any).processSegmentationJob(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);

      expect(mockSocketService.emitToUser).toHaveBeenCalledWith(789, 'segmentation-completed', {
        taskId: 'task-123',
        imageId: 456,
        success: true,
      });

      expect(result).toEqual({
        success: true,
        taskId: 'task-123',
        imageId: 456,
      });
    });

    it('should handle file not found error', async () => {
      const fs = require('fs/promises');
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect((worker as any).processSegmentationJob(mockJob)).rejects.toThrow(
        'Image file not found: /uploads/image.jpg'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE segmentation_tasks SET task_status = $1'),
        ['failed', expect.any(String), 'task-123']
      );

      expect(mockSocketService.emitToUser).toHaveBeenCalledWith(789, 'segmentation-failed', {
        taskId: 'task-123',
        imageId: 456,
        error: 'Image file not found: /uploads/image.jpg',
      });
    });

    it('should handle ML service error', async () => {
      const fs = require('fs/promises');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (axios.post as jest.Mock).mockRejectedValue(new Error('ML service unavailable'));

      await expect((worker as any).processSegmentationJob(mockJob)).rejects.toThrow(
        'ML service unavailable'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE segmentation_tasks SET task_status = $1'),
        ['failed', expect.any(String), 'task-123']
      );
    });

    it('should handle ML service failure response', async () => {
      const fs = require('fs/promises');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          success: false,
          error: 'Invalid image format',
        },
      });

      await expect((worker as any).processSegmentationJob(mockJob)).rejects.toThrow(
        'ML service processing failed: Invalid image format'
      );
    });

    it('should update job progress during processing', async () => {
      const fs = require('fs/promises');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (axios.post as jest.Mock).mockImplementation(() => {
        // Simulate delay
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: {
                success: true,
                results: { polygons: [], features: {} },
              },
            });
          }, 100);
        });
      });

      mockDb.query.mockResolvedValue({ rows: [] });

      await (worker as any).processSegmentationJob(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });
  });

  describe('cleanupOldJobs', () => {
    it('should call queue service cleanup', async () => {
      await (worker as any).cleanupOldJobs();
      expect(mockQueueService.cleanOldJobs).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should clear interval and close queue', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      worker.start();
      await worker.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(mockQueueService.close).toHaveBeenCalled();
    });
  });
});