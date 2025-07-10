/**
 * Performance tests for projectService
 * Validates the optimized getUserProjects function
 */

import { getUserProjects } from '../projectService';
import { Pool } from 'pg';

// Mock the database pool
jest.mock('../../db', () => ({
  getPool: jest.fn(() => mockPool),
}));

jest.mock('../../utils/logger');

const mockPool = {
  query: jest.fn(),
} as unknown as Pool;

describe('ProjectService Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProjects Performance', () => {
    it('should execute only one query for project list (no N+1)', async () => {
      // Mock the optimized CTE query response
      const mockProjects = [
        {
          id: '1',
          title: 'Project 1',
          description: 'Description 1',
          user_id: 'user123',
          created_at: new Date(),
          updated_at: new Date(),
          is_owner: true,
          permission: null,
          image_count: 10,
          thumbnail_url: '/thumbnails/1.jpg'
        },
        {
          id: '2',
          title: 'Project 2',
          description: 'Description 2',
          user_id: 'user123',
          created_at: new Date(),
          updated_at: new Date(),
          is_owner: true,
          permission: null,
          image_count: 5,
          thumbnail_url: '/thumbnails/2.jpg'
        }
      ];

      // Mock table existence check
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ images_exists: true, shares_exists: true }]
        })
        // Mock the main CTE query
        .mockResolvedValueOnce({
          rows: mockProjects
        })
        // Mock the count query
        .mockResolvedValueOnce({
          rows: [{ total: 2 }]
        });

      const result = await getUserProjects(mockPool, 'user123', 10, 0, true);

      // Verify results
      expect(result.projects).toHaveLength(2);
      expect(result.total).toBe(2);

      // CRITICAL: Verify only 3 queries were executed (not 1 + 2n)
      // 1. Table existence check
      // 2. Main CTE query with all data
      // 3. Count query
      expect(mockPool.query).toHaveBeenCalledTimes(3);

      // Verify the main query uses CTEs (contains WITH clause)
      const mainQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(mainQueryCall[0]).toContain('WITH user_projects AS');
      expect(mainQueryCall[0]).toContain('image_stats AS');
      expect(mainQueryCall[0]).toContain('latest_thumbnails AS');
    });

    it('should handle large result sets efficiently', async () => {
      // Create mock data for 100 projects
      const mockProjects = Array.from({ length: 100 }, (_, i) => ({
        id: `project-${i}`,
        title: `Project ${i}`,
        description: `Description ${i}`,
        user_id: 'user123',
        created_at: new Date(),
        updated_at: new Date(),
        is_owner: true,
        permission: null,
        image_count: Math.floor(Math.random() * 100),
        thumbnail_url: `/thumbnails/${i}.jpg`
      }));

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ images_exists: true, shares_exists: true }]
        })
        .mockResolvedValueOnce({
          rows: mockProjects.slice(0, 10) // Paginated results
        })
        .mockResolvedValueOnce({
          rows: [{ total: 100 }]
        });

      const startTime = Date.now();
      const result = await getUserProjects(mockPool, 'user123', 10, 0, true);
      const endTime = Date.now();

      // Verify pagination works
      expect(result.projects).toHaveLength(10);
      expect(result.total).toBe(100);

      // Verify still only 3 queries regardless of result size
      expect(mockPool.query).toHaveBeenCalledTimes(3);

      // Performance should be fast (under 50ms for mocked queries)
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should efficiently handle projects without images', async () => {
      const mockProjects = [
        {
          id: '1',
          title: 'Empty Project',
          description: 'No images yet',
          user_id: 'user123',
          created_at: new Date(),
          updated_at: new Date(),
          is_owner: true,
          permission: null,
          image_count: 0,
          thumbnail_url: null
        }
      ];

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ images_exists: true, shares_exists: false }]
        })
        .mockResolvedValueOnce({
          rows: mockProjects
        })
        .mockResolvedValueOnce({
          rows: [{ total: 1 }]
        });

      const result = await getUserProjects(mockPool, 'user123', 10, 0, false);

      // Verify null handling
      expect(result.projects[0].image_count).toBe(0);
      expect(result.projects[0].thumbnail_url).toBeNull();

      // Still only 3 queries
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });
  });
});