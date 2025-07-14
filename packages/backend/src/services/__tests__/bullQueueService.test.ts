import Bull from 'bull';
import { BullQueueService } from '../bullQueueService';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('bull');
jest.mock('../../utils/logger');

describe('BullQueueService', () => {
  let bullQueueService: BullQueueService;
  let mockQueue: jest.Mocked<Bull.Queue>;
  let mockRedisUrl: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Bull queue
    mockQueue = {
      process: jest.fn(),
      add: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      getJob: jest.fn(),
      getJobCounts: jest.fn(),
      clean: jest.fn(),
      empty: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isPaused: jest.fn(),
    } as any;

    (Bull as unknown as jest.Mock).mockReturnValue(mockQueue);
    
    mockRedisUrl = 'redis://localhost:6379';
    bullQueueService = new BullQueueService(mockRedisUrl);
  });

  afterEach(async () => {
    await bullQueueService.close();
  });

  describe('constructor', () => {
    it('should create a Bull queue with correct configuration', () => {
      expect(Bull).toHaveBeenCalledWith('segmentation', mockRedisUrl, {
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });
    });

    it('should register event listeners', () => {
      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('waiting', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('active', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('stalled', expect.any(Function));
    });
  });

  describe('addSegmentationJob', () => {
    it('should add a job to the queue with correct data', async () => {
      const taskData = {
        taskId: 'task-123',
        imageId: 123,
        imagePath: '/path/to/image.jpg',
        userId: 456,
      };

      mockQueue.add.mockResolvedValue({ id: 'job-123' } as any);

      const result = await bullQueueService.addSegmentationJob(taskData);

      expect(mockQueue.add).toHaveBeenCalledWith('segmentation', taskData, {
        priority: 1,
        delay: 0,
      });
      expect(result).toEqual({ id: 'job-123' });
    });

    it('should add a high priority job for premium users', async () => {
      const taskData = {
        taskId: 'task-123',
        imageId: 123,
        imagePath: '/path/to/image.jpg',
        userId: 456,
        priority: 10,
      };

      mockQueue.add.mockResolvedValue({ id: 'job-123' } as any);

      await bullQueueService.addSegmentationJob(taskData);

      expect(mockQueue.add).toHaveBeenCalledWith('segmentation', taskData, {
        priority: 10,
        delay: 0,
      });
    });

    it('should handle errors when adding job', async () => {
      const taskData = {
        taskId: 'task-123',
        imageId: 123,
        imagePath: '/path/to/image.jpg',
        userId: 456,
      };

      const error = new Error('Redis connection failed');
      mockQueue.add.mockRejectedValue(error);

      await expect(bullQueueService.addSegmentationJob(taskData)).rejects.toThrow('Redis connection failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to add segmentation job:', error);
    });
  });

  describe('processSegmentationJobs', () => {
    it('should register a job processor with concurrency', () => {
      const processor = jest.fn();
      bullQueueService.processSegmentationJobs(processor, 5);

      expect(mockQueue.process).toHaveBeenCalledWith('segmentation', 5, processor);
    });

    it('should use default concurrency of 1', () => {
      const processor = jest.fn();
      bullQueueService.processSegmentationJobs(processor);

      expect(mockQueue.process).toHaveBeenCalledWith('segmentation', 1, processor);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const mockJob = {
        id: 'job-123',
        progress: jest.fn().mockReturnValue(50),
        isCompleted: jest.fn().mockResolvedValue(false),
        isFailed: jest.fn().mockResolvedValue(false),
        failedReason: null,
        data: { taskId: 'task-123' },
      };

      mockQueue.getJob.mockResolvedValue(mockJob as any);

      const status = await bullQueueService.getJobStatus('job-123');

      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(status).toEqual({
        id: 'job-123',
        progress: 50,
        isCompleted: false,
        isFailed: false,
        failedReason: null,
        data: { taskId: 'task-123' },
      });
    });

    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const status = await bullQueueService.getJobStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const mockCounts = {
        waiting: 10,
        active: 2,
        completed: 100,
        failed: 5,
        delayed: 3,
        paused: 0,
      };

      mockQueue.getJobCounts.mockResolvedValue(mockCounts);
      mockQueue.isPaused.mockResolvedValue(false);

      const metrics = await bullQueueService.getQueueMetrics();

      expect(mockQueue.getJobCounts).toHaveBeenCalled();
      expect(metrics).toEqual({
        waiting: 10,
        active: 2,
        completed: 100,
        failed: 5,
        delayed: 3,
        paused: 0,
        isPaused: false,
      });
    });
  });

  describe('cleanOldJobs', () => {
    it('should clean completed and failed jobs', async () => {
      await bullQueueService.cleanOldJobs();

      expect(mockQueue.clean).toHaveBeenCalledWith(24 * 3600 * 1000, 'completed');
      expect(mockQueue.clean).toHaveBeenCalledWith(7 * 24 * 3600 * 1000, 'failed');
    });

    it('should handle clean errors gracefully', async () => {
      mockQueue.clean.mockRejectedValue(new Error('Clean failed'));

      await expect(bullQueueService.cleanOldJobs()).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Failed to clean old jobs:', expect.any(Error));
    });
  });

  describe('pauseQueue', () => {
    it('should pause the queue', async () => {
      await bullQueueService.pauseQueue();
      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should resume the queue', async () => {
      await bullQueueService.resumeQueue();
      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the queue connection', async () => {
      await bullQueueService.close();
      
      expect(mockQueue.removeAllListeners).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    it('should log completed jobs', () => {
      const completedHandler = (mockQueue.on as jest.Mock).mock.calls.find(
        call => call[0] === 'completed'
      )[1];

      const job = { id: 'job-123', data: { taskId: 'task-123' } };
      completedHandler(job, { success: true });

      expect(logger.info).toHaveBeenCalledWith(`Job job-123 completed:`, { success: true });
    });

    it('should log failed jobs', () => {
      const failedHandler = (mockQueue.on as jest.Mock).mock.calls.find(
        call => call[0] === 'failed'
      )[1];

      const job = { id: 'job-123', data: { taskId: 'task-123' } };
      const error = new Error('Processing failed');
      failedHandler(job, error);

      expect(logger.error).toHaveBeenCalledWith(`Job job-123 failed:`, error);
    });
  });
});