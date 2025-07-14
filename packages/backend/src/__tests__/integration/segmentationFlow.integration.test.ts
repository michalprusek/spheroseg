import request from 'supertest';
import Bull from 'bull';
import Redis from 'ioredis';
import { Pool } from 'pg';
import app from '../../app';
import { BullQueueService } from '../../services/bullQueueService';
import { DatabasePool } from '../../db/pool';
import { MLServiceCircuitBreaker } from '../../services/circuitBreaker';
import { SegmentationWorker } from '../../workers/segmentationWorker';
import socketService from '../../services/socketService';
import { createHealthCheckRouter } from '../../routes/healthCheck';
import jwt from 'jsonwebtoken';

// Mock all external dependencies
jest.mock('bull');
jest.mock('ioredis');
jest.mock('pg');
jest.mock('axios');
jest.mock('fs/promises', () => ({
  access: jest.fn(),
}));

describe('Segmentation Flow Integration Test', () => {
  let dbPool: DatabasePool;
  let queueService: BullQueueService;
  let mlCircuitBreaker: MLServiceCircuitBreaker;
  let segmentationWorker: SegmentationWorker;
  let mockRedis: jest.Mocked<Redis>;
  let mockBullQueue: jest.Mocked<Bull.Queue>;
  let mockPgPool: jest.Mocked<Pool>;
  let authToken: string;
  let testUserId: number;
  let testProjectId: number;
  let testImageId: number;

  beforeAll(async () => {
    // Setup test user token
    testUserId = 123;
    authToken = jwt.sign(
      { userId: testUserId, email: 'test@example.com' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      info: jest.fn().mockResolvedValue('redis_version:7.0.0\r\nused_memory:1048576'),
      quit: jest.fn(),
    } as any;
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    // Mock Bull Queue
    mockBullQueue = {
      process: jest.fn(),
      add: jest.fn().mockImplementation(() => 
        Promise.resolve({ 
          id: 'job-' + Math.random().toString(36).substr(2, 9),
          data: {},
          progress: jest.fn(),
        } as any)
      ),
      on: jest.fn(),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 2,
        active: 1,
        completed: 10,
        failed: 0,
        delayed: 0,
        paused: 0,
      }),
      isPaused: jest.fn().mockResolvedValue(false),
      getJob: jest.fn(),
      close: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;
    (Bull as unknown as jest.Mock).mockReturnValue(mockBullQueue);

    // Mock PostgreSQL Pool
    mockPgPool = {
      query: jest.fn().mockImplementation((query: string) => {
        // Mock different query responses
        if (query.includes('SELECT NOW()')) {
          return Promise.resolve({ rows: [{ now: new Date() }] });
        }
        if (query.includes('FROM images i JOIN projects p')) {
          return Promise.resolve({
            rows: [{
              id: testImageId,
              storage_path: '/uploads/test-image.jpg',
              project_id: testProjectId,
              user_id: testUserId,
              subscription_tier: 'premium',
              width: 1920,
              height: 1080,
              segmentation_status: 'without_segmentation',
            }],
          });
        }
        if (query.includes('FROM segmentation_results')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('FROM queue_jobs')) {
          return Promise.resolve({
            rows: [{
              job_id: 'job-123',
              task_id: 'task-123',
              status: 'queued',
              created_at: new Date(),
              updated_at: new Date(),
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
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

    // Initialize services
    const redisUrl = 'redis://localhost:6379';
    const databaseUrl = 'postgresql://localhost/test';
    const mlServiceUrl = 'http://ml:5002';

    dbPool = new DatabasePool(databaseUrl);
    queueService = new BullQueueService(redisUrl);
    mlCircuitBreaker = new MLServiceCircuitBreaker(mlServiceUrl, socketService);
    segmentationWorker = new SegmentationWorker(
      queueService,
      dbPool,
      socketService,
      mlServiceUrl
    );

    // Make services available to the app
    (app as any).scalabilityServices = {
      dbPool,
      queueService,
      mlCircuitBreaker,
    };

    // Add health check routes
    const healthRouter = createHealthCheckRouter(dbPool, queueService, redisUrl);
    app.use('/api/health', healthRouter);

    // Set test IDs
    testProjectId = 456;
    testImageId = 789;
  });

  afterEach(async () => {
    await queueService.close();
    await dbPool.end();
    mlCircuitBreaker.shutdown();
  });

  describe('Complete Segmentation Flow', () => {
    it('should successfully process image segmentation from API to completion', async () => {
      // Step 1: Trigger segmentation via API
      const segmentationResponse = await request(app)
        .post(`/api/images/${testImageId}/segmentation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priority: 10,
          parameters: {
            threshold: 0.5,
          },
        });

      expect(segmentationResponse.status).toBe(202);
      expect(segmentationResponse.body).toMatchObject({
        message: 'Segmentation process queued',
        taskId: expect.any(String),
        jobId: expect.any(String),
        queueStatus: {
          position: expect.any(Number),
          waiting: expect.any(Number),
          active: expect.any(Number),
        },
      });

      // Verify job was added to queue
      expect(mockBullQueue.add).toHaveBeenCalledWith(
        'segmentation',
        {
          taskId: expect.any(String),
          imageId: testImageId,
          imagePath: '/uploads/test-image.jpg',
          userId: testUserId,
          priority: 10, // Premium user gets high priority
        },
        {
          priority: 10,
          delay: 0,
        }
      );

      // Verify database was updated
      expect(mockPgPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE images SET segmentation_status'),
        expect.arrayContaining(['queued'])
      );
    });

    it('should handle batch segmentation request', async () => {
      const imageIds = ['789', '790', '791'];
      
      // Mock batch query response
      mockPgPool.query.mockImplementationOnce((query: string) => {
        if (query.includes('WHERE i.id = ANY')) {
          return Promise.resolve({
            rows: imageIds.map((id, index) => ({
              id,
              storage_path: `/uploads/test-image-${id}.jpg`,
              project_id: testProjectId,
              user_id: testUserId,
              subscription_tier: 'free',
            })),
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const batchResponse = await request(app)
        .post('/api/images/batch/segmentation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageIds,
          priority: 3,
          model_type: 'resunet',
        });

      expect(batchResponse.status).toBe(202);
      expect(batchResponse.body).toMatchObject({
        message: 'Batch segmentation triggered for 3 images',
        successfullyTriggered: imageIds,
        failedToTrigger: [],
        queueStatus: {
          waiting: expect.any(Number),
          active: expect.any(Number),
        },
      });

      // Verify 3 jobs were added
      expect(mockBullQueue.add).toHaveBeenCalledTimes(3);
    });

    it('should get queue status', async () => {
      const queueStatusResponse = await request(app)
        .get('/api/segmentation/queue/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(queueStatusResponse.status).toBe(200);
      expect(queueStatusResponse.body).toMatchObject({
        queue: {
          waiting: 2,
          active: 1,
          completed: 10,
          failed: 0,
          delayed: 0,
          paused: false,
        },
        circuitBreaker: expect.any(Object),
      });
    });

    it('should get job status', async () => {
      const jobId = 'job-123';
      
      mockBullQueue.getJob.mockResolvedValue({
        id: jobId,
        progress: jest.fn().mockReturnValue(75),
        isCompleted: jest.fn().mockResolvedValue(false),
        isFailed: jest.fn().mockResolvedValue(false),
        failedReason: null,
        data: { taskId: 'task-123' },
      } as any);

      const jobStatusResponse = await request(app)
        .get(`/api/segmentation/job/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(jobStatusResponse.status).toBe(200);
      expect(jobStatusResponse.body).toMatchObject({
        jobId,
        status: 'queued',
        progress: 75,
        isCompleted: false,
        isFailed: false,
        failedReason: null,
      });
    });

    it('should handle segmentation result retrieval', async () => {
      // Mock successful segmentation result
      mockPgPool.query.mockImplementation((query: string) => {
        if (query.includes('FROM images i JOIN projects p')) {
          return Promise.resolve({
            rows: [{
              id: testImageId,
              width: 1920,
              height: 1080,
              segmentation_status: 'completed',
            }],
          });
        }
        if (query.includes('FROM segmentation_results')) {
          return Promise.resolve({
            rows: [{
              image_id: testImageId,
              status: 'completed',
              result_data: {
                polygons: [
                  { points: [[0, 0], [100, 0], [100, 100], [0, 100]] },
                ],
              },
              created_at: new Date(),
              updated_at: new Date(),
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const resultResponse = await request(app)
        .get(`/api/images/${testImageId}/segmentation`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(resultResponse.status).toBe(200);
      expect(resultResponse.body).toMatchObject({
        image_id: String(testImageId),
        status: 'completed',
        polygons: [
          { points: [[0, 0], [100, 0], [100, 100], [0, 100]] },
        ],
        imageWidth: 1920,
        imageHeight: 1080,
      });
    });
  });

  describe('Health Check Integration', () => {
    it('should report healthy status when all services are up', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({
        status: 200,
        data: { status: 'healthy', model_loaded: true },
      });

      const healthResponse = await request(app).get('/api/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        services: {
          database: 'healthy',
          redis: 'healthy',
          queue: 'healthy',
          ml: 'healthy',
        },
      });
    });

    it('should report detailed health information', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({
        status: 200,
        data: { status: 'healthy', model_loaded: true },
      });

      const detailedHealthResponse = await request(app).get('/api/health/detailed');

      expect(detailedHealthResponse.status).toBe(200);
      expect(detailedHealthResponse.body).toMatchObject({
        status: 'healthy',
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        },
        services: expect.any(Object),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failure gracefully', async () => {
      (mockPgPool.query as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post(`/api/images/${testImageId}/segmentation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ priority: 5 });

      expect(response.status).toBe(500);
    });

    it('should handle ML service failure with circuit breaker', async () => {
      const axios = require('axios');
      
      // Simulate ML service failures
      axios.post.mockRejectedValue(new Error('ML service unavailable'));
      
      // Start worker to process jobs
      segmentationWorker.start(1);

      // Add a job
      const job = await queueService.addSegmentationJob({
        taskId: 'task-fail',
        imageId: testImageId,
        imagePath: '/uploads/test.jpg',
        userId: testUserId,
      });

      // Get circuit breaker stats
      const stats = mlCircuitBreaker.getStats();
      expect(stats.state).toBeDefined();
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app)
        .post(`/api/images/${testImageId}/segmentation`)
        .send({ priority: 5 });

      expect(response.status).toBe(401);
    });

    it('should handle invalid image ID', async () => {
      mockPgPool.query.mockImplementation((query: string) => {
        if (query.includes('FROM images i JOIN projects p')) {
          return Promise.resolve({ rows: [] }); // No image found
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/images/999/segmentation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ priority: 5 });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        message: 'Image not found or access denied',
      });
    });
  });

  describe('Performance Testing', () => {
    it('should handle concurrent segmentation requests', async () => {
      const concurrentRequests = 10;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const imageId = 1000 + i;
        
        // Mock response for each image
        mockPgPool.query.mockImplementation((query: string) => {
          if (query.includes('FROM images i JOIN projects p')) {
            return Promise.resolve({
              rows: [{
                id: imageId,
                storage_path: `/uploads/test-image-${imageId}.jpg`,
                project_id: testProjectId,
                user_id: testUserId,
                subscription_tier: 'premium',
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        requests.push(
          request(app)
            .post(`/api/images/${imageId}/segmentation`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ priority: 5 })
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should be accepted
      responses.forEach(response => {
        expect(response.status).toBe(202);
      });

      // Verify all jobs were queued
      expect(mockBullQueue.add).toHaveBeenCalledTimes(concurrentRequests);
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      // Simulate 50 queue status checks
      const statusChecks = [];
      for (let i = 0; i < 50; i++) {
        statusChecks.push(
          request(app)
            .get('/api/segmentation/queue/status')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      await Promise.all(statusChecks);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (5 seconds for 50 requests)
      expect(duration).toBeLessThan(5000);
    });
  });
});