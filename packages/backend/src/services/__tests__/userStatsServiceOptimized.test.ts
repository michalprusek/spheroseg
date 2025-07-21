/**
 * Tests for UserStatsServiceOptimized
 * 
 * Demonstrates:
 * - Testing with dependency injection
 * - Database transaction testing
 * - Redis cache mocking
 * - Complex query testing
 * - Performance measurement
 */

import { 
  withTransaction, 
  TestDataFactory,
  testDatabaseConnection
} from '../../__tests__/helpers/testDatabase';
import pool from '../../config/database';
import type { PoolClient } from 'pg';
import { UserStatsServiceOptimized, createUserStatsService } from '../userStatsServiceOptimized';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../cacheService', () => ({
  cacheService: {
    generateKey: jest.fn((prefix: string, id: string) => `${prefix}${id}`),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    cached: jest.fn((key: string, fn: () => Promise<any>) => fn()),
    invalidateRelated: jest.fn().mockResolvedValue(undefined)
  },
  CACHE_TTL: {
    SHORT: 300,
    MEDIUM: 900,
    LONG: 3600
  }
}));

describe('UserStatsServiceOptimized', () => {
  let service: UserStatsServiceOptimized;
  let mockCacheService: any;

  beforeAll(async () => {
    // Verify database connection
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      throw new Error('Database connection failed - ensure test database is running');
    }
    
    // Create service instance with real pool
    service = createUserStatsService(pool);
    
    // Get mock reference
    mockCacheService = require('../cacheService').cacheService;
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset cache behavior - return null (cache miss) by default
    mockCacheService.get.mockResolvedValue(null);
  });

  describe('getUserStats', () => {
    it('should return comprehensive user statistics with single query', async () => {
      await withTransaction(async (client: PoolClient) => {
        // Create test user
        const userData = TestDataFactory.createUser();
        const userResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        // Create projects with different dates
        const project1Result = await client.query(
          `INSERT INTO projects (title, description, user_id, created_at, updated_at) 
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
          ['Project 1', 'First project', userId]
        );
        const project1Id = project1Result.rows[0].id;

        const project2Result = await client.query(
          `INSERT INTO projects (title, description, user_id, created_at, updated_at) 
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '45 days') RETURNING id`,
          ['Project 2', 'Old project', userId]
        );
        const project2Id = project2Result.rows[0].id;

        // Create images with different statuses
        await client.query(
          `INSERT INTO images (project_id, name, storage_path, file_size, segmentation_status, created_at) 
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [project1Id, 'image1.jpg', '/test/image1.jpg', 1000000, 'completed']
        );

        await client.query(
          `INSERT INTO images (project_id, name, storage_path, file_size, segmentation_status, created_at) 
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [project1Id, 'image2.jpg', '/test/image2.jpg', 2000000, 'processing']
        );

        await client.query(
          `INSERT INTO images (project_id, name, storage_path, file_size, segmentation_status, created_at) 
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP - INTERVAL '45 days')`,
          [project2Id, 'image3.jpg', '/test/image3.jpg', 3000000, 'completed']
        );

        // Get stats
        const stats = await service.getUserStats(userId);

        // Verify results
        expect(stats).toMatchObject({
          totalProjects: 2,
          totalImages: 3,
          completedSegmentations: 2,
          storageUsedBytes: BigInt(6000000), // 1MB + 2MB + 3MB
          storageLimitBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB default
          projectsThisMonth: 1,
          projectsLastMonth: 0,
          imagesThisMonth: 2,
          imagesLastMonth: 0
        });

        // Verify arrays
        expect(stats.recentProjects).toHaveLength(2);
        expect(stats.recentProjects[0].title).toBe('Project 1');
        expect(stats.recentProjects[0].image_count).toBe('2');
        expect(stats.recentProjects[0].completed_count).toBe('1');

        expect(stats.recentImages).toHaveLength(3);
        expect(stats.recentActivity.length).toBeGreaterThan(0);

        // Verify caching was attempted
        expect(mockCacheService.get).toHaveBeenCalledWith(`user:stats:${userId}`);
        expect(mockCacheService.set).toHaveBeenCalled();
      });
    });

    it('should return cached stats when available', async () => {
      const cachedStats = {
        totalProjects: 5,
        totalImages: 10,
        completedSegmentations: 8,
        storageUsedBytes: BigInt(50000000),
        storageLimitBytes: BigInt(10 * 1024 * 1024 * 1024),
        recentActivity: [],
        recentProjects: [],
        recentImages: [],
        projectsThisMonth: 2,
        projectsLastMonth: 1,
        imagesThisMonth: 4,
        imagesLastMonth: 3
      };

      mockCacheService.get.mockResolvedValueOnce(cachedStats);

      const stats = await service.getUserStats('test-user-id');

      expect(stats).toEqual(cachedStats);
      expect(mockCacheService.get).toHaveBeenCalledWith('user:stats:test-user-id');
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const logger = require('../../utils/logger').default;
      
      // Create a service with a mock pool that throws errors
      const mockPool = {
        query: jest.fn().mockRejectedValue(new Error('Database connection lost'))
      };
      const errorService = new UserStatsServiceOptimized(mockPool);

      const stats = await errorService.getUserStats('error-user-id');

      // Should return default stats
      expect(stats).toMatchObject({
        totalProjects: 0,
        totalImages: 0,
        completedSegmentations: 0,
        storageUsedBytes: BigInt(0),
        storageLimitBytes: BigInt(10 * 1024 * 1024 * 1024)
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching optimized user stats',
        expect.objectContaining({ userId: 'error-user-id' })
      );
    });

    it('should handle missing storage_limit_bytes column', async () => {
      await withTransaction(async (client: PoolClient) => {
        // Create user without storage_limit_bytes
        const userData = TestDataFactory.createUser();
        const userResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        // Create minimal data
        const projectResult = await client.query(
          'INSERT INTO projects (title, user_id) VALUES ($1, $2) RETURNING id',
          ['Test Project', userId]
        );
        const projectId = projectResult.rows[0].id;

        await client.query(
          'INSERT INTO images (project_id, name, storage_path, file_size, segmentation_status) VALUES ($1, $2, $3, $4, $5)',
          [projectId, 'test.jpg', '/test.jpg', 1000000, 'completed']
        );

        const stats = await service.getUserStats(userId);

        // Should use default storage limit
        expect(stats.storageLimitBytes).toBe(BigInt(10 * 1024 * 1024 * 1024));
      });
    });
  });

  describe('getBasicStats', () => {
    it('should return basic stats with caching', async () => {
      await withTransaction(async (client: PoolClient) => {
        // Create test data
        const userData = TestDataFactory.createUser();
        const userResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        const projectResult = await client.query(
          'INSERT INTO projects (title, user_id) VALUES ($1, $2) RETURNING id',
          ['Test Project', userId]
        );
        const projectId = projectResult.rows[0].id;

        await client.query(
          'INSERT INTO images (project_id, name, storage_path, file_size, segmentation_status) VALUES ($1, $2, $3, $4, $5)',
          [projectId, 'test1.jpg', '/test1.jpg', 1000000, 'completed']
        );

        await client.query(
          'INSERT INTO images (project_id, name, storage_path, file_size, segmentation_status) VALUES ($1, $2, $3, $4, $5)',
          [projectId, 'test2.jpg', '/test2.jpg', 2000000, 'processing']
        );

        // Mock cache.cached to execute the function
        mockCacheService.cached.mockImplementationOnce(
          async (key: string, fn: () => Promise<any>) => fn()
        );

        const stats = await service.getBasicStats(userId);

        expect(stats).toMatchObject({
          totalProjects: 1,
          totalImages: 2,
          completedSegmentations: 1,
          storageUsedBytes: BigInt(3000000)
        });

        expect(mockCacheService.cached).toHaveBeenCalledWith(
          `user:stats:basic:${userId}`,
          expect.any(Function),
          300 // SHORT TTL
        );
      });
    });
  });

  describe('generateRecentActivity', () => {
    it('should generate activity timeline from multiple sources', async () => {
      await withTransaction(async (client: PoolClient) => {
        // Create test data
        const userData = TestDataFactory.createUser();
        const userResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        // Create project
        const projectResult = await client.query(
          `INSERT INTO projects (title, user_id, created_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '2 hours') RETURNING id, title`,
          ['Test Project', userId]
        );
        const projectId = projectResult.rows[0].id;
        const projectTitle = projectResult.rows[0].title;

        // Upload image
        const imageResult = await client.query(
          `INSERT INTO images (project_id, name, storage_path, segmentation_status, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '1 hour') 
           RETURNING id, name`,
          [projectId, 'test.jpg', '/test.jpg', 'processing']
        );
        const imageId = imageResult.rows[0].id;
        const imageName = imageResult.rows[0].name;

        // Complete segmentation
        await client.query(
          `UPDATE images SET segmentation_status = 'completed', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [imageId]
        );

        // Generate activity
        const activity = await service.generateRecentActivity(userId);

        // Should have 3 activities in chronological order
        expect(activity).toHaveLength(3);

        // Most recent: segmentation completed
        expect(activity[0]).toMatchObject({
          type: 'segmentation_completed',
          description: `Completed segmentation for "${imageName}"`,
          project_id: projectId,
          project_name: projectTitle,
          image_id: imageId,
          image_name: imageName
        });

        // Second: image uploaded
        expect(activity[1]).toMatchObject({
          type: 'image_uploaded',
          description: `Uploaded image "${imageName}"`,
          project_id: projectId,
          project_name: projectTitle,
          image_id: imageId,
          image_name: imageName
        });

        // Third: project created
        expect(activity[2]).toMatchObject({
          type: 'project_created',
          description: `Created project "${projectTitle}"`,
          project_id: projectId,
          project_name: projectTitle,
          image_id: null,
          image_name: null
        });

        // All should have timestamps
        activity.forEach(item => {
          expect(item.timestamp).toBeTruthy();
          expect(new Date(item.timestamp)).toBeInstanceOf(Date);
        });
      });
    });

    it('should handle activity generation errors gracefully', async () => {
      const logger = require('../../utils/logger').default;
      
      // Create service with mock pool that throws
      const mockPool = {
        query: jest.fn().mockRejectedValue(new Error('Query failed'))
      };
      const errorService = new UserStatsServiceOptimized(mockPool);

      const activity = await errorService.generateRecentActivity('error-user');

      expect(activity).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Error generating recent activity',
        expect.objectContaining({ userId: 'error-user' })
      );
    });
  });

  describe('invalidateUserStatsCache', () => {
    it('should invalidate user-related cache entries', async () => {
      await service.invalidateUserStatsCache('test-user-id');

      expect(mockCacheService.invalidateRelated).toHaveBeenCalledWith('user', 'test-user-id');
    });
  });

  describe('performance', () => {
    it('should execute complex stats query efficiently', async () => {
      await withTransaction(async (client: PoolClient) => {
        // Create substantial test data
        const userData = TestDataFactory.createUser();
        const userResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        // Create multiple projects
        const projectIds = [];
        for (let i = 0; i < 5; i++) {
          const result = await client.query(
            'INSERT INTO projects (title, user_id) VALUES ($1, $2) RETURNING id',
            [`Project ${i}`, userId]
          );
          projectIds.push(result.rows[0].id);
        }

        // Create multiple images per project
        for (const projectId of projectIds) {
          for (let i = 0; i < 10; i++) {
            await client.query(
              `INSERT INTO images (project_id, name, storage_path, file_size, segmentation_status) 
               VALUES ($1, $2, $3, $4, $5)`,
              [projectId, `image${i}.jpg`, `/images/${i}.jpg`, 1000000, 
               i % 2 === 0 ? 'completed' : 'processing']
            );
          }
        }

        // Measure query performance
        const startTime = Date.now();
        const stats = await service.getUserStats(userId);
        const queryTime = Date.now() - startTime;

        // Verify correctness
        expect(stats.totalProjects).toBe(5);
        expect(stats.totalImages).toBe(50);
        expect(stats.completedSegmentations).toBe(25);

        // Should complete in reasonable time (adjust based on test environment)
        expect(queryTime).toBeLessThan(1000); // 1 second max
        
        // Log for performance tracking
        console.log(`Stats query completed in ${queryTime}ms for 5 projects and 50 images`);
      });
    });
  });

  describe('legacy compatibility', () => {
    it('should support legacy function calls', async () => {
      // Import legacy exports
      const { userStatsServiceOptimized } = require('../userStatsServiceOptimized');
      
      await withTransaction(async (client: PoolClient) => {
        const userData = TestDataFactory.createUser();
        const userResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        // Test legacy getUserStats
        const stats = await userStatsServiceOptimized.getUserStats(pool, userId);
        expect(stats).toHaveProperty('totalProjects');
        expect(stats).toHaveProperty('totalImages');

        // Test legacy getBasicStats
        mockCacheService.cached.mockImplementationOnce(
          async (key: string, fn: () => Promise<any>) => fn()
        );
        const basicStats = await userStatsServiceOptimized.getBasicStats(pool, userId);
        expect(basicStats).toHaveProperty('totalProjects');

        // Test legacy generateRecentActivity
        const activity = await userStatsServiceOptimized.generateRecentActivity(pool, userId);
        expect(Array.isArray(activity)).toBe(true);
      });
    });
  });
});