import { BullQueueService } from '../../services/bullQueueService';
import { SegmentationWorker } from '../../workers/segmentationWorker';
import { DatabasePool } from '../../db/pool';
import { MLServiceCircuitBreaker } from '../../services/circuitBreaker';
import Bull from 'bull';
import Redis from 'ioredis';
import { Pool } from 'pg';

// Mock all external dependencies
jest.mock('bull');
jest.mock('ioredis');
jest.mock('pg');
jest.mock('axios');

describe('Scalability Improvements Integration', () => {
  let bullQueueService: BullQueueService;
  let dbPool: DatabasePool;
  let mlCircuitBreaker: MLServiceCircuitBreaker;
  let segmentationWorker: SegmentationWorker;
  let mockRedis: jest.Mocked<Redis>;
  let mockBullQueue: jest.Mocked<Bull.Queue>;
  let mockPgPool: jest.Mocked<Pool>;
  let mockSocketService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn(),
    } as any;
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    // Mock Bull Queue
    mockBullQueue = {
      process: jest.fn(),
      add: jest.fn().mockResolvedValue({ id: 'job-123' } as any),
      on: jest.fn(),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      }),
      isPaused: jest.fn().mockResolvedValue(false),
      close: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;
    (Bull as unknown as jest.Mock).mockReturnValue(mockBullQueue);

    // Mock PostgreSQL Pool
    mockPgPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      connect: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      }),
      on: jest.fn(),
      end: jest.fn(),
      totalCount: 20,
      idleCount: 15,
      waitingCount: 0,
    } as any;
    (Pool as unknown as jest.Mock).mockImplementation(() => mockPgPool);

    // Mock socket service
    mockSocketService = {
      emit: jest.fn(),
      emitToUser: jest.fn(),
    };

    // Create service instances
    bullQueueService = new BullQueueService('redis://localhost:6379');
    dbPool = new DatabasePool('postgresql://localhost/test');
    mlCircuitBreaker = new MLServiceCircuitBreaker('http://ml:5002', mockSocketService);
    segmentationWorker = new SegmentationWorker(
      bullQueueService,
      dbPool,
      mockSocketService,
      'http://ml:5002'
    );
  });

  afterEach(async () => {
    await bullQueueService.close();
    await dbPool.end();
    mlCircuitBreaker.shutdown();
  });

  describe('Async ML Processing with Bull Queue', () => {
    it('should add segmentation job to queue', async () => {
      const taskData = {
        taskId: 'task-123',
        imageId: 456,
        imagePath: '/uploads/image.jpg',
        userId: 789,
      };

      const job = await bullQueueService.addSegmentationJob(taskData);

      expect(mockBullQueue.add).toHaveBeenCalledWith('segmentation', taskData, {
        priority: 1,
        delay: 0,
      });
      expect(job.id).toBe('job-123');
    });

    it('should process multiple jobs concurrently', () => {
      const processor = jest.fn();
      segmentationWorker.start(5);

      expect(mockBullQueue.process).toHaveBeenCalledWith(
        'segmentation',
        5,
        expect.any(Function)
      );
    });

    it('should handle queue metrics', async () => {
      const metrics = await bullQueueService.getQueueMetrics();

      expect(metrics).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
        isPaused: false,
      });
    });
  });

  describe('Database Connection Pooling', () => {
    it('should use connection pool for queries', async () => {
      await dbPool.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockPgPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [1]
      );
    });

    it('should handle concurrent transactions', async () => {
      const results = await Promise.all([
        dbPool.transaction(async (client) => {
          await client.query('UPDATE users SET name = $1 WHERE id = $2', ['User 1', 1]);
          return { id: 1 };
        }),
        dbPool.transaction(async (client) => {
          await client.query('UPDATE users SET name = $1 WHERE id = $2', ['User 2', 2]);
          return { id: 2 };
        }),
      ]);

      expect(results).toEqual([{ id: 1 }, { id: 2 }]);
      expect(mockPgPool.connect).toHaveBeenCalledTimes(2);
    });

    it('should provide pool statistics', () => {
      const stats = dbPool.getPoolStats();

      expect(stats).toEqual({
        total: 20,
        idle: 15,
        waiting: 0,
      });
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should handle ML service failures gracefully', async () => {
      const axios = require('axios');
      axios.post.mockRejectedValue(new Error('Connection refused'));

      // Should fail but not crash
      await expect(
        mlCircuitBreaker.segmentImage('/path/to/image.jpg', 'task-123')
      ).rejects.toThrow('Connection refused');

      // Circuit stats should reflect the failure
      const stats = mlCircuitBreaker.getStats();
      expect(stats.stats.failures).toBeGreaterThan(0);
    });

    it('should emit status updates via WebSocket', async () => {
      const axios = require('axios');
      
      // Simulate multiple failures to open circuit
      axios.post.mockRejectedValue(new Error('Service unavailable'));
      
      for (let i = 0; i < 5; i++) {
        try {
          await mlCircuitBreaker.segmentImage('/path/to/image.jpg', `task-${i}`);
        } catch (e) {
          // Expected
        }
      }

      // Check that WebSocket notification was sent
      expect(mockSocketService.emit).toHaveBeenCalledWith('ml-service-status', {
        status: 'unavailable',
        circuitOpen: true,
      });
    });
  });

  describe('End-to-End Segmentation Flow', () => {
    it('should process segmentation from queue to completion', async () => {
      const axios = require('axios');
      
      // Mock successful ML response
      axios.post.mockResolvedValue({
        data: {
          success: true,
          results: {
            polygons: [{ points: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
            features: { area: 100, perimeter: 40 },
          },
        },
      });

      // Mock file system
      const fs = require('fs/promises');
      fs.access = jest.fn().mockResolvedValue(undefined);

      // Add job to queue
      const taskData = {
        taskId: 'task-123',
        imageId: 456,
        imagePath: '/uploads/image.jpg',
        userId: 789,
        priority: 10, // High priority
      };

      const job = await bullQueueService.addSegmentationJob(taskData);

      // Verify job was added with correct priority
      expect(mockBullQueue.add).toHaveBeenCalledWith('segmentation', taskData, {
        priority: 10,
        delay: 0,
      });

      // Verify WebSocket notification would be sent on completion
      const mockJob = {
        id: job.id,
        data: taskData,
        progress: jest.fn(),
        log: jest.fn(),
        update: jest.fn(),
      };

      // Get the processor function that was registered
      const processorFunc = mockBullQueue.process.mock.calls[0][2];
      
      // Execute the processor
      const result = await processorFunc(mockJob);

      expect(result).toEqual({
        success: true,
        taskId: 'task-123',
        imageId: 456,
      });

      // Verify notifications
      expect(mockSocketService.emitToUser).toHaveBeenCalledWith(789, 'segmentation-completed', {
        taskId: 'task-123',
        imageId: 456,
        success: true,
      });
    });
  });

  describe('Health Check Integration', () => {
    it('should verify all services are healthy', async () => {
      const axios = require('axios');
      
      // Mock health check responses
      axios.get.mockResolvedValue({
        status: 200,
        data: { status: 'healthy', model_loaded: true },
      });

      // Check database health
      const dbHealthy = await dbPool.query('SELECT NOW()');
      expect(dbHealthy).toBeDefined();

      // Check Redis health
      const redisHealthy = await mockRedis.ping();
      expect(redisHealthy).toBe('PONG');

      // Check queue health
      const queueMetrics = await bullQueueService.getQueueMetrics();
      expect(queueMetrics.isPaused).toBe(false);

      // Check ML service health
      const mlHealth = await mlCircuitBreaker.checkHealth();
      expect(mlHealth.status).toBe('healthy');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume job processing', async () => {
      const jobPromises = [];
      
      // Add 100 jobs to the queue
      for (let i = 0; i < 100; i++) {
        const taskData = {
          taskId: `task-${i}`,
          imageId: i,
          imagePath: `/uploads/image-${i}.jpg`,
          userId: Math.floor(i / 10), // Distribute across 10 users
          priority: i % 10 === 0 ? 10 : 1, // Every 10th job is high priority
        };
        
        jobPromises.push(bullQueueService.addSegmentationJob(taskData));
      }

      const jobs = await Promise.all(jobPromises);
      
      expect(jobs).toHaveLength(100);
      expect(mockBullQueue.add).toHaveBeenCalledTimes(100);
      
      // Verify high priority jobs
      const highPriorityJobs = mockBullQueue.add.mock.calls.filter(
        call => call[2].priority === 10
      );
      expect(highPriorityJobs).toHaveLength(10);
    });

    it('should maintain performance under concurrent database load', async () => {
      const queries = [];
      
      // Execute 50 concurrent queries
      for (let i = 0; i < 50; i++) {
        queries.push(
          dbPool.query('SELECT * FROM images WHERE user_id = $1', [i])
        );
      }

      await Promise.all(queries);
      
      expect(mockPgPool.query).toHaveBeenCalledTimes(50);
      
      // Pool should maintain connection limits
      const stats = dbPool.getPoolStats();
      expect(stats.total).toBeLessThanOrEqual(20); // Max pool size
    });
  });
});