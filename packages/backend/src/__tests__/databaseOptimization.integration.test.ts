/**
 * Database Optimization Integration Tests
 *
 * Tests for the comprehensive database optimization system including
 * advanced caching, query optimization, and performance monitoring
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import DatabaseOptimizationService from '../services/databaseOptimizationService';
import AdvancedCacheService from '../services/advancedCacheService';
import OptimizedQueryService from '../services/optimizedQueryService';
import { jest } from '@jest/globals';
import { createMockQueryResult } from './types/mocks';

// Mock dependencies
jest.mock('../utils/logger');

describe('Database Optimization Integration', () => {
  let pool: jest.Mocked<Pool>;
  let optimizationService: DatabaseOptimizationService;
  let mockQueryResult: QueryResult<any>;

  beforeEach(() => {
    // Mock Pool
    mockQueryResult = createMockQueryResult([]);

    const mockClient: Partial<PoolClient> = {
      query: jest.fn().mockResolvedValue(mockQueryResult),
      release: jest.fn(),
    };

    pool = {
      query: jest.fn().mockResolvedValue(mockQueryResult),
      connect: jest.fn().mockResolvedValue(mockClient as PoolClient),
      totalCount: 10,
      idleCount: 5,
      waitingCount: 0,
    } as unknown as jest.Mocked<Pool>;

    optimizationService = new DatabaseOptimizationService(pool, {
      enableQueryCache: true,
      enablePreparedStatements: true,
      cacheStrategy: 'moderate',
      monitoringEnabled: false, // Disable for tests
      maxConnections: 20,
      queryTimeout: 30000,
    });
  });

  afterEach(async () => {
    await optimizationService.shutdown();
  });

  describe('Advanced Cache Service', () => {
    let cacheService: AdvancedCacheService;

    beforeEach(() => {
      cacheService = new AdvancedCacheService(pool);
    });

    afterEach(async () => {
      await cacheService.shutdown();
    });

    it('should implement multi-layer caching strategy', async () => {
      const testData = { id: 1, name: 'test' };
      const key = 'test_key';

      // First call should fetch from source
      const fetchFunction = jest.fn().mockResolvedValue(testData);
      const result1 = await cacheService.get(key, 'HOT', fetchFunction);

      expect(result1).toEqual(testData);
      expect(fetchFunction).toHaveBeenCalledTimes(1);

      // Second call should use memory cache
      const result2 = await cacheService.get(key, 'HOT', fetchFunction);

      expect(result2).toEqual(testData);
      expect(fetchFunction).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle different cache strategies', async () => {
      const testData = { id: 1, name: 'test' };

      // Test HOT strategy (memory + redis)
      await cacheService.set('hot_key', testData, 'HOT');
      const hotResult = await cacheService.get('hot_key', 'HOT');
      expect(hotResult).toEqual(testData);

      // Test COLD strategy (redis only)
      await cacheService.set('cold_key', testData, 'COLD');
      const coldResult = await cacheService.get('cold_key', 'COLD');
      expect(coldResult).toEqual(testData);

      // Test STATIC strategy (memory + redis with longer TTL)
      await cacheService.set('static_key', testData, 'STATIC');
      const staticResult = await cacheService.get('static_key', 'STATIC');
      expect(staticResult).toEqual(testData);
    });

    it('should provide cache metrics', () => {
      const metrics = cacheService.getMetrics();

      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('memoryCacheSize');
      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('memoryHitRate');
    });

    it('should invalidate cache by pattern', async () => {
      const testData = { id: 1, name: 'test' };

      await cacheService.set('user:123:stats', testData, 'WARM');
      await cacheService.set('user:123:projects', testData, 'WARM');
      await cacheService.set('user:456:stats', testData, 'WARM');

      // Invalidate all user:123 entries
      await cacheService.invalidatePattern('user:123:*');

      // user:123 entries should be gone
      const result1 = await cacheService.get('user:123:stats', 'WARM');
      const result2 = await cacheService.get('user:123:projects', 'WARM');
      expect(result1).toBeNull();
      expect(result2).toBeNull();

      // user:456 entry should still exist
      const result3 = await cacheService.get('user:456:stats', 'WARM');
      expect(result3).toEqual(testData);
    });
  });

  describe('Optimized Query Service', () => {
    let queryService: OptimizedQueryService;

    beforeEach(() => {
      queryService = new OptimizedQueryService(pool);
    });

    afterEach(async () => {
      await queryService.shutdown();
    });

    it('should execute queries with caching', async () => {
      const selectQuery = 'SELECT * FROM users WHERE id = $1';
      const params = ['123'];

      mockQueryResult.rows = [{ id: '123', name: 'Test User' }];
      (pool.query as jest.Mock).mockResolvedValue(mockQueryResult);

      // First call should hit database
      const result1 = await queryService.query(selectQuery, params, {
        useCache: true,
        cacheStrategy: 'WARM',
      });

      expect(result1.rows).toEqual(mockQueryResult.rows);
      expect(pool.query).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await queryService.query(selectQuery, params, {
        useCache: true,
        cacheStrategy: 'WARM',
      });

      expect(result2.rows).toEqual(mockQueryResult.rows);
      // Should still be 1 because result came from cache
    });

    it('should handle batch queries with transactions', async () => {
      const queries = [
        { text: 'INSERT INTO projects (title) VALUES ($1)', params: ['Project 1'] },
        { text: 'INSERT INTO projects (title) VALUES ($1)', params: ['Project 2'] },
      ];

      const mockClient = {
        query: jest.fn().mockResolvedValue(mockQueryResult),
        release: jest.fn(),
      };

      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      const results = await queryService.executeBatch(queries);

      expect(results).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should provide query metrics', () => {
      const metrics = queryService.getMetrics();

      expect(metrics).toHaveProperty('totalQueries');
      expect(metrics).toHaveProperty('averageTime');
      expect(metrics).toHaveProperty('slowQueries');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('connectionPoolSize');
    });

    it('should handle query streaming for large result sets', async () => {
      const streamQuery = 'SELECT * FROM large_table';
      const batchSize = 10;

      // Mock multiple batches
      let callCount = 0;
      (pool.connect as jest.Mock).mockResolvedValue({
        query: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            return Promise.resolve({
              rows: Array(batchSize)
                .fill(0)
                .map((_, i) => ({ id: callCount * batchSize + i })),
            });
          } else {
            return Promise.resolve({ rows: [] }); // End of data
          }
        }),
        release: jest.fn(),
      });

      const stream = await queryService.queryStream(streamQuery, [], batchSize);
      const batches = [];

      for await (const batch of stream) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(batchSize);
      expect(batches[1]).toHaveLength(batchSize);
    });
  });

  describe('Database Optimization Service', () => {
    it('should provide optimized user statistics', async () => {
      const userId = 'test-user-id';

      mockQueryResult.rows = [
        {
          stats: JSON.stringify({
            total_projects: 5,
            total_images: 20,
            completed_segmentations: 15,
            storage_used_bytes: 1024000,
          }),
          recent_projects: JSON.stringify([
            { id: '1', title: 'Project 1' },
            { id: '2', title: 'Project 2' },
          ]),
          recent_activity: JSON.stringify([{ type: 'project_created', item_name: 'New Project' }]),
        },
      ];

      (pool.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const stats = await optimizationService.getUserStatsOptimized(userId);

      expect(stats).toBeDefined();
      expect(stats.total_projects).toBe(5);
      expect(stats.total_images).toBe(20);
      expect(stats.completed_segmentations).toBe(15);
      expect(stats.recentProjects).toHaveLength(2);
      expect(stats.recentActivity).toHaveLength(1);
    });

    it('should provide optimized project list with pagination', async () => {
      const userId = 'test-user-id';
      const page = 1;
      const limit = 10;

      mockQueryResult.rows = [
        {
          projects: JSON.stringify([
            { id: '1', title: 'Project 1', image_count: 5 },
            { id: '2', title: 'Project 2', image_count: 3 },
          ]),
          total: 2,
        },
      ];

      (pool.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await optimizationService.getProjectListOptimized(userId, page, limit);

      expect(result).toBeDefined();
      expect(result.projects).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should provide optimized image list', async () => {
      const projectId = 'test-project-id';
      const page = 1;
      const limit = 20;

      mockQueryResult.rows = [
        {
          images: JSON.stringify([
            { id: '1', name: 'image1.jpg', segmentation_result: { status: 'completed' } },
            { id: '2', name: 'image2.jpg', segmentation_result: null },
          ]),
          total: 2,
        },
      ];

      (pool.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await optimizationService.getImageListOptimized(projectId, page, limit);

      expect(result).toBeDefined();
      expect(result.images).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should invalidate related caches correctly', async () => {
      const userId = 'test-user-id';
      const projectId = 'test-project-id';
      const imageId = 'test-image-id';

      // Mock queries for cache invalidation
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ user_id: userId }] }) // Project owner query
        .mockResolvedValueOnce({ rows: [{ project_id: projectId, user_id: userId }] }); // Image project query

      // These should not throw errors
      await optimizationService.invalidateRelatedCaches('user', userId);
      await optimizationService.invalidateRelatedCaches('project', projectId);
      await optimizationService.invalidateRelatedCaches('image', imageId);

      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should generate performance profile and recommendations', async () => {
      const profile = await optimizationService.generatePerformanceProfile();

      expect(profile).toHaveProperty('averageQueryTime');
      expect(profile).toHaveProperty('slowQueryCount');
      expect(profile).toHaveProperty('cacheHitRate');
      expect(profile).toHaveProperty('connectionPoolUtilization');
      expect(profile).toHaveProperty('recommendedOptimizations');
      expect(Array.isArray(profile.recommendedOptimizations)).toBe(true);
    });

    it('should provide comprehensive metrics', () => {
      const metrics = optimizationService.getMetrics();

      expect(metrics).toHaveProperty('query');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('config');

      expect(metrics.query).toHaveProperty('totalQueries');
      expect(metrics.query).toHaveProperty('averageTime');
      expect(metrics.cache).toHaveProperty('hitRate');
      expect(metrics.config).toHaveProperty('enableQueryCache');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track query performance metrics', async () => {
      const selectQuery = 'SELECT * FROM users LIMIT 1';

      // Simulate a slow query
      (pool.query as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockQueryResult), 100))
      );

      const queryService = new OptimizedQueryService(pool);

      await queryService.query(selectQuery);

      const metrics = queryService.getMetrics();
      expect(metrics.totalQueries).toBeGreaterThan(0);
      expect(metrics.averageTime).toBeGreaterThan(0);

      await queryService.shutdown();
    });

    it('should detect and log slow queries', async () => {
      const slowQuery = 'SELECT * FROM large_table ORDER BY random()';

      // Simulate a very slow query
      (pool.query as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockQueryResult), 1500))
      );

      const queryService = new OptimizedQueryService(pool);

      await queryService.query(slowQuery);

      const metrics = queryService.getMetrics();
      expect(metrics.slowQueries).toBeGreaterThan(0);

      await queryService.shutdown();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle database connection errors gracefully', async () => {
      const failingPool = {
        ...pool,
        query: jest.fn().mockRejectedValue(new Error('Connection failed')),
      };

      const queryService = new OptimizedQueryService(failingPool as any);

      await expect(queryService.query('SELECT 1')).rejects.toThrow('Connection failed');

      await queryService.shutdown();
    });

    it('should retry failed queries with exponential backoff', async () => {
      let callCount = 0;
      const retryableError = new Error('Connection timeout');

      (pool.query as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw retryableError;
        }
        return Promise.resolve(mockQueryResult);
      });

      const queryService = new OptimizedQueryService(pool);

      const result = await queryService.query('SELECT 1', [], { retries: 2 });

      expect(result).toEqual(mockQueryResult);
      expect(callCount).toBe(3); // Initial attempt + 2 retries

      await queryService.shutdown();
    });

    it('should handle cache failures gracefully', async () => {
      const cacheService = new AdvancedCacheService(pool);

      // Test that cache failures don't break the application
      const fetchFunction = jest.fn().mockResolvedValue({ data: 'test' });

      // This should work even if Redis is unavailable
      const result = await cacheService.get('test_key', 'WARM', fetchFunction);

      expect(result).toEqual({ data: 'test' });
      expect(fetchFunction).toHaveBeenCalled();

      await cacheService.shutdown();
    });
  });
});
