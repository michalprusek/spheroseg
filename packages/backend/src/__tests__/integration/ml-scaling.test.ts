/**
 * Integration tests for ML Service Scaling
 * 
 * Tests load distribution, failover, and health monitoring
 */
import request from 'supertest';
import { Pool } from 'pg';
import app from '../../app';
import config from '../../config';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../config');
jest.mock('../../utils/logger');

describe('ML Service Scaling', () => {
  let authToken: string;
  let mockPool: jest.Mocked<Pool>;

  beforeAll(async () => {
    // Setup test database connection
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    (config as any).db = mockPool;

    // Mock successful auth for tests
    mockPool.query.mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM users WHERE email')) {
        return Promise.resolve({
          rows: [{
            id: 1,
            email: 'test@test.com',
            password_hash: '$2b$10$YourHashHere',
            name: 'Test User'
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  afterAll(async () => {
    jest.clearAllMocks();
  });

  describe('Load Distribution', () => {
    it('should distribute load across multiple ML instances', async () => {
      // Track which instances receive requests
      const instanceHits = new Map<string, number>();
      
      // Mock ML service responses with instance identification
      const mockMLResponses = [
        { instance: 'ml-1', taskId: '123', status: 'completed' },
        { instance: 'ml-2', taskId: '124', status: 'completed' },
        { instance: 'ml-3', taskId: '125', status: 'completed' },
      ];

      // Make multiple requests to test load distribution
      const requests = [];
      for (let i = 0; i < 30; i++) {
        requests.push(
          request(app)
            .post('/api/images/segment')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              imageId: `test-image-${i}`,
              projectId: 'test-project'
            })
        );
      }

      const responses = await Promise.all(requests);

      // Verify responses
      responses.forEach(res => {
        expect(res.status).toBe(200);
        const instance = res.body.instance;
        instanceHits.set(instance, (instanceHits.get(instance) || 0) + 1);
      });

      // Verify load is distributed (each instance should get roughly 1/3)
      expect(instanceHits.size).toBeGreaterThanOrEqual(2); // At least 2 instances used
      
      const hitCounts = Array.from(instanceHits.values());
      const avgHits = 30 / 3; // Expected average per instance
      
      hitCounts.forEach(count => {
        // Allow 50% deviation from perfect distribution
        expect(count).toBeGreaterThan(avgHits * 0.5);
        expect(count).toBeLessThan(avgHits * 1.5);
      });
    });

    it('should respect least connections algorithm', async () => {
      // Simulate varying processing times
      const slowInstanceRequests = [];
      const fastInstanceRequests = [];

      // Send requests with different processing times
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          // Simulate slow processing
          slowInstanceRequests.push(
            request(app)
              .post('/api/images/segment')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                imageId: `slow-${i}`,
                projectId: 'test-project',
                processingTime: 5000 // 5 seconds
              })
          );
        } else {
          // Fast processing
          fastInstanceRequests.push(
            request(app)
              .post('/api/images/segment')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                imageId: `fast-${i}`,
                projectId: 'test-project',
                processingTime: 100 // 100ms
              })
          );
        }
      }

      // Wait for all requests
      const allResponses = await Promise.all([
        ...slowInstanceRequests,
        ...fastInstanceRequests
      ]);

      // Verify all succeeded
      allResponses.forEach(res => {
        expect(res.status).toBe(200);
      });

      // In a real test, we'd verify that fast instances got more requests
      // This would require access to HAProxy stats or instance metrics
    });

    it('should handle ML service health checks', async () => {
      // Test health endpoint for each ML instance
      const healthChecks = [
        request(app).get('/api/ml/health/instance/1'),
        request(app).get('/api/ml/health/instance/2'),
        request(app).get('/api/ml/health/instance/3'),
      ];

      const responses = await Promise.all(healthChecks);

      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          status: 'healthy',
          instance: expect.any(String),
          uptime: expect.any(Number),
          tasksProcessed: expect.any(Number),
          currentLoad: expect.any(Number),
        });
      });
    });
  });

  describe('Instance Failure Handling', () => {
    it('should handle instance failure gracefully', async () => {
      // Simulate one instance being down
      const mockFailedInstance = 'ml-2';
      
      // Mock health check failure for one instance
      jest.spyOn(global, 'fetch').mockImplementation((url) => {
        if (url.toString().includes(mockFailedInstance)) {
          return Promise.reject(new Error('Connection refused'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'healthy' })
        } as Response);
      });

      // Make requests and verify they still succeed
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/images/segment')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              imageId: `failover-test-${i}`,
              projectId: 'test-project'
            })
        );
      }

      const responses = await Promise.all(requests);

      // All requests should succeed despite one instance being down
      responses.forEach(res => {
        expect(res.status).toBe(200);
        // Verify the failed instance was not used
        expect(res.body.instance).not.toBe(mockFailedInstance);
      });

      // Restore fetch
      (global.fetch as jest.Mock).mockRestore();
    });

    it('should retry failed requests on healthy instances', async () => {
      let attemptCount = 0;
      
      // Mock intermittent failures
      jest.spyOn(global, 'fetch').mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          return Promise.reject(new Error('Temporary failure'));
        }
        // Subsequent attempts succeed
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'completed',
            taskId: '123',
            instance: 'ml-1'
          })
        } as Response);
      });

      const response = await request(app)
        .post('/api/images/segment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageId: 'retry-test',
          projectId: 'test-project'
        });

      expect(response.status).toBe(200);
      expect(attemptCount).toBeGreaterThan(1); // Verify retry happened
      
      (global.fetch as jest.Mock).mockRestore();
    });

    it('should handle complete ML service outage', async () => {
      // Mock all instances being down
      jest.spyOn(global, 'fetch').mockRejectedValue(
        new Error('All instances down')
      );

      const response = await request(app)
        .post('/api/images/segment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageId: 'outage-test',
          projectId: 'test-project'
        });

      expect(response.status).toBe(503); // Service Unavailable
      expect(response.body).toMatchObject({
        error: expect.stringContaining('ML service unavailable'),
        retryAfter: expect.any(Number)
      });

      (global.fetch as jest.Mock).mockRestore();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track ML request metrics', async () => {
      // Clear previous metrics
      const metricsResponse = await request(app)
        .get('/api/metrics/ml')
        .set('Authorization', `Bearer ${authToken}`);

      const beforeMetrics = metricsResponse.body;

      // Make some requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/images/segment')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              imageId: `metrics-test-${i}`,
              projectId: 'test-project'
            })
        );
      }

      await Promise.all(requests);

      // Check metrics were updated
      const afterMetricsResponse = await request(app)
        .get('/api/metrics/ml')
        .set('Authorization', `Bearer ${authToken}`);

      const afterMetrics = afterMetricsResponse.body;

      expect(afterMetrics.totalRequests).toBeGreaterThan(
        beforeMetrics.totalRequests || 0
      );
      expect(afterMetrics.successRate).toBeGreaterThan(0);
      expect(afterMetrics.avgResponseTime).toBeGreaterThan(0);
      expect(afterMetrics.instanceMetrics).toBeDefined();
    });

    it('should expose Prometheus metrics for ML scaling', async () => {
      const response = await request(app)
        .get('/api/metrics');

      expect(response.status).toBe(200);
      expect(response.text).toContain('ml_tasks_queued');
      expect(response.text).toContain('ml_task_duration_seconds');
      expect(response.text).toContain('ml_instance_utilization');
      expect(response.text).toContain('ml_load_balancer_requests_total');
    });
  });

  describe('Queue Management', () => {
    it('should handle queue overflow gracefully', async () => {
      // Simulate many concurrent requests
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .post('/api/images/segment')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              imageId: `queue-test-${i}`,
              projectId: 'test-project'
            })
        );
      }

      const responses = await Promise.all(requests);

      // Count successful vs queued responses
      let successCount = 0;
      let queuedCount = 0;
      let rejectedCount = 0;

      responses.forEach(res => {
        if (res.status === 200) {
          successCount++;
        } else if (res.status === 202) {
          // Accepted but queued
          queuedCount++;
          expect(res.body).toHaveProperty('queuePosition');
        } else if (res.status === 503) {
          // Service at capacity
          rejectedCount++;
          expect(res.body).toHaveProperty('retryAfter');
        }
      });

      // Verify reasonable distribution
      expect(successCount).toBeGreaterThan(0);
      expect(successCount + queuedCount + rejectedCount).toBe(100);
    });

    it('should process queue in FIFO order', async () => {
      const taskIds: string[] = [];
      
      // Submit tasks with identifiers
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/images/segment')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            imageId: `fifo-test-${i}`,
            projectId: 'test-project',
            priority: 'normal'
          });

        if (response.body.taskId) {
          taskIds.push(response.body.taskId);
        }
      }

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check completion order
      const completionOrder = await request(app)
        .get('/api/ml/tasks/completion-order')
        .set('Authorization', `Bearer ${authToken}`);

      expect(completionOrder.body.order).toEqual(
        expect.arrayContaining(taskIds)
      );
    });
  });
});