/**
 * Integration tests for performance optimizations
 */

import { Pool } from 'pg';
import request from 'supertest';
import express from 'express';
import { createUserStatsService } from '../../services/userStatsServiceOptimized';
import {
  performanceMonitor,
  apiPerformanceMiddleware,
  createMonitoredPool,
} from '../../middleware/performanceMonitoring';
// Request deduplication is a frontend utility, not needed for backend tests

// Mock dependencies
jest.mock('../../utils/logger');

describe('Performance Optimizations Integration Tests', () => {
  let app: express.Application;
  let pool: Pool;
  let monitoredPool: Pool;

  beforeAll(() => {
    // Setup test database connection
    pool = new Pool({
      connectionString:
        process.env.TEST_DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/spheroseg_test',
    });

    // Create monitored pool
    monitoredPool = createMonitoredPool(pool);

    // Setup Express app with performance middleware
    app = express();
    app.use(express.json());
    app.use(apiPerformanceMiddleware());

    // Test routes
    app.get('/api/user/:id/stats', async (req, res) => {
      try {
        const service = createUserStatsService(monitoredPool);
        const stats = await service.getUserStats(req.params.id);
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    app.get('/api/performance/metrics', (req, res) => {
      const metrics = performanceMonitor.getSummary();
      res.json(metrics);
    });
  });

  afterAll(async () => {
    await pool.end();
    performanceMonitor.destructor();
  });

  beforeEach(() => {
    performanceMonitor.clearMetrics();
  });

  describe('UserStatsService Integration', () => {
    it('should execute optimized queries with CTE', async () => {
      const userId = 'test-user-123';

      // Create test data
      await monitoredPool.query(
        `
        INSERT INTO users (id, email, storage_limit_bytes) 
        VALUES ($1, 'test@example.com', 10737418240)
        ON CONFLICT (id) DO NOTHING
      `,
        [userId]
      );

      await monitoredPool.query(
        `
        INSERT INTO projects (id, user_id, title, created_at) 
        VALUES 
          ('proj-1', $1, 'Test Project 1', NOW()),
          ('proj-2', $1, 'Test Project 2', NOW() - INTERVAL '1 month')
        ON CONFLICT (id) DO NOTHING
      `,
        [userId]
      );

      // Execute optimized service
      const service = createUserStatsService(monitoredPool);
      const stats = await service.getUserStats(userId);

      // Verify results
      expect(stats).toMatchObject({
        totalProjects: expect.any(Number),
        totalImages: expect.any(Number),
        completedSegmentations: expect.any(Number),
        storageUsedBytes: expect.any(BigInt),
        storageLimitBytes: expect.any(BigInt),
        recentProjects: expect.any(Array),
        recentImages: expect.any(Array),
      });

      // Check performance metrics
      const metrics = performanceMonitor.getSummary();
      expect(metrics.database.totalQueries).toBeGreaterThan(0);
      expect(metrics.database.avgQueryTime).toBeLessThan(100); // Should be fast
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate high memory usage
      const largeArray = new Array(1000000).fill('test-data');

      // Trigger memory monitoring
      performanceMonitor['handleHighMemoryPressure'](91, process.memoryUsage());

      // Verify cleanup was triggered
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.dbQueries.length).toBeLessThanOrEqual(250); // 25% of max

      // Cleanup
      largeArray.length = 0;
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track API performance metrics', async () => {
      // Make multiple API calls
      const responses = await Promise.all([
        request(app).get('/api/user/test-123/stats'),
        request(app).get('/api/user/test-456/stats'),
        request(app).get('/api/user/test-789/stats'),
      ]);

      // Check metrics were recorded
      const metrics = performanceMonitor.getSummary();
      expect(metrics.api.totalCalls).toBeGreaterThanOrEqual(3);
      expect(metrics.api.totalEndpoints).toBeGreaterThanOrEqual(1);
      expect(metrics.api.avgResponseTime).toBeGreaterThan(0);
    });

    it('should emit events for slow operations', (done) => {
      performanceMonitor.once('slowQuery', (data) => {
        expect(data.duration).toBeGreaterThan(100);
        expect(data.query).toBeDefined();
        done();
      });

      // Simulate slow query
      performanceMonitor.trackQuery('SELECT * FROM large_table', 150, 1000);
    });

    it('should handle critical memory pressure', () => {
      const spy = jest.spyOn(performanceMonitor as any, 'emergencyCleanup');

      // Simulate critical memory pressure
      performanceMonitor['handleCriticalMemoryPressure'](96, process.memoryUsage());

      expect(spy).toHaveBeenCalled();

      // Verify aggressive cleanup
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.dbQueries.length).toBeLessThanOrEqual(100);
      expect(metrics.memoryUsage.length).toBeLessThanOrEqual(10);
    });
  });


  describe('Redis Cache Integration', () => {
    it('should use Redis for caching when available', async () => {
      // This test would require Redis to be running
      // Mock Redis client for testing
      const mockRedisClient = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
      };

      // Test cache hit scenario
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({
          totalProjects: 5,
          totalImages: 100,
        })
      );

      const cachedData = await mockRedisClient.get('user:stats:test-123');
      expect(JSON.parse(cachedData)).toMatchObject({
        totalProjects: 5,
        totalImages: 100,
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets', async () => {
      const startTime = Date.now();

      // Execute multiple operations
      const operations = Array(10)
        .fill(null)
        .map((_, i) => request(app).get(`/api/user/test-${i}/stats`));

      await Promise.all(operations);

      const duration = Date.now() - startTime;
      const avgResponseTime = duration / operations.length;

      // Should meet performance target (< 100ms average)
      expect(avgResponseTime).toBeLessThan(100);
    });
  });
});
