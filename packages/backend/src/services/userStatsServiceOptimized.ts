import { Pool } from 'pg';
import logger from '../utils/logger';

/**
 * Interface for database operations
 */
export interface IDatabase {
  query(text: string, params?: any[]): Promise<any>;
}

/**
 * Optimized Service for handling user statistics
 * Reduces database queries from 15+ to just 2-3
 */
export class UserStatsServiceOptimized {
  constructor(private readonly pool: Pool | IDatabase) {}

  /**
   * Get comprehensive user statistics with minimal database queries
   * @param userId User ID
   */
  async getUserStats(userId: string) {
    const startTime = Date.now();

    try {
      logger.debug('Fetching optimized user stats', { userId });

      // Single query to get all user stats at once
      const statsQuery = `
        WITH date_ranges AS (
          SELECT 
            date_trunc('month', CURRENT_DATE) AS current_month_start,
            date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AS last_month_start,
            date_trunc('month', CURRENT_DATE) - INTERVAL '1 second' AS last_month_end
        ),
        user_projects AS (
          SELECT 
            p.id,
            p.title,
            p.description,
            p.created_at,
            p.updated_at,
            COUNT(DISTINCT i.id) AS image_count,
            COUNT(DISTINCT CASE WHEN i.segmentation_status = 'completed' THEN i.id END) AS completed_count
          FROM projects p
          LEFT JOIN images i ON p.id = i.project_id
          WHERE p.user_id = $1
          GROUP BY p.id
        ),
        stats_summary AS (
          SELECT 
            COUNT(DISTINCT p.id) AS total_projects,
            COUNT(DISTINCT i.id) AS total_images,
            COUNT(DISTINCT CASE WHEN i.segmentation_status = 'completed' THEN i.id END) AS completed_segmentations,
            COALESCE(SUM(i.file_size), 0) AS storage_used_bytes,
            COUNT(DISTINCT CASE WHEN p.created_at >= dr.current_month_start THEN p.id END) AS projects_this_month,
            COUNT(DISTINCT CASE WHEN p.created_at >= dr.last_month_start AND p.created_at < dr.current_month_start THEN p.id END) AS projects_last_month,
            COUNT(DISTINCT CASE WHEN i.created_at >= dr.current_month_start THEN i.id END) AS images_this_month,
            COUNT(DISTINCT CASE WHEN i.created_at >= dr.last_month_start AND i.created_at < dr.current_month_start THEN i.id END) AS images_last_month
          FROM projects p
          LEFT JOIN images i ON p.id = i.project_id
          CROSS JOIN date_ranges dr
          WHERE p.user_id = $1
        ),
        recent_projects AS (
          SELECT * FROM user_projects
          ORDER BY updated_at DESC
          LIMIT 5
        ),
        recent_images AS (
          SELECT 
            i.id,
            i.name,
            i.storage_path,
            i.status,
            i.created_at,
            i.updated_at,
            i.project_id,
            p.title as project_name
          FROM images i
          JOIN projects p ON i.project_id = p.id
          WHERE p.user_id = $1
          ORDER BY i.updated_at DESC
          LIMIT 5
        )
        SELECT 
          (SELECT row_to_json(stats_summary.*) FROM stats_summary) AS stats,
          (SELECT json_agg(row_to_json(recent_projects.*)) FROM recent_projects) AS recent_projects,
          (SELECT json_agg(row_to_json(recent_images.*)) FROM recent_images) AS recent_images
      `;

      const result = await this.pool.query(statsQuery, [userId]);

      if (result.rows.length === 0 || !result.rows[0].stats) {
        throw new Error('Failed to fetch user statistics');
      }

      const { stats, recent_projects, recent_images } = result.rows[0];

      // Get user storage limits from users table (separate query for compatibility)
      let storageLimitBytes = BigInt(10 * 1024 * 1024 * 1024); // 10GB default
      try {
        const userRes = await this.pool.query(
          'SELECT storage_limit_bytes FROM users WHERE id = $1',
          [userId]
        );
        if (userRes.rows.length > 0 && userRes.rows[0].storage_limit_bytes) {
          storageLimitBytes = BigInt(userRes.rows[0].storage_limit_bytes);
        }
      } catch (error) {
        logger.debug('Storage limit columns not available, using default');
      }

      // Generate recent activity from projects and images
      const recentActivity = await this.generateRecentActivity(userId);

      // Prepare the final stats object
      const finalStats = {
        totalProjects: parseInt(stats.total_projects || 0, 10),
        totalImages: parseInt(stats.total_images || 0, 10),
        completedSegmentations: parseInt(stats.completed_segmentations || 0, 10),
        storageUsedBytes: BigInt(stats.storage_used_bytes || 0),
        storageLimitBytes,
        recentActivity,
        recentProjects: recent_projects || [],
        recentImages: recent_images || [],
        projectsThisMonth: parseInt(stats.projects_this_month || 0, 10),
        projectsLastMonth: parseInt(stats.projects_last_month || 0, 10),
        imagesThisMonth: parseInt(stats.images_this_month || 0, 10),
        imagesLastMonth: parseInt(stats.images_last_month || 0, 10),
      };

      const queryTime = Date.now() - startTime;
      logger.info('Optimized user stats fetched successfully', {
        userId,
        queryTime,
        projects: finalStats.totalProjects,
        images: finalStats.totalImages,
      });

      return finalStats;
    } catch (error) {
      logger.error('Error fetching optimized user stats', { userId, error });

      // Return default stats on error
      return {
        totalProjects: 0,
        totalImages: 0,
        completedSegmentations: 0,
        storageUsedBytes: BigInt(0),
        storageLimitBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB default
        recentActivity: [],
        recentProjects: [],
        recentImages: [],
        projectsThisMonth: 0,
        projectsLastMonth: 0,
        imagesThisMonth: 0,
        imagesLastMonth: 0,
      };
    }
  }

  /**
   * Get basic user stats with a single query (for frequent polling)
   */
  async getBasicStats(userId: string) {
    const query = `
      SELECT 
        COUNT(DISTINCT p.id) AS total_projects,
        COUNT(DISTINCT i.id) AS total_images,
        COUNT(DISTINCT CASE WHEN i.segmentation_status = 'completed' THEN i.id END) AS completed_segmentations,
        COALESCE(SUM(i.file_size), 0) AS storage_used_bytes
      FROM projects p
      LEFT JOIN images i ON p.id = i.project_id
      WHERE p.user_id = $1
    `;

    const result = await this.pool.query(query, [userId]);

    return {
      totalProjects: parseInt(result.rows[0].total_projects || 0, 10),
      totalImages: parseInt(result.rows[0].total_images || 0, 10),
      completedSegmentations: parseInt(result.rows[0].completed_segmentations || 0, 10),
      storageUsedBytes: BigInt(result.rows[0].storage_used_bytes || 0),
    };
  }

  /**
   * Generate recent activity from projects and images
   */
  async generateRecentActivity(userId: string) {
    try {
      const activityQuery = `
        WITH combined_activities AS (
          -- Project creation activities
          SELECT 
            'project_created' as type,
            p.title as item_name,
            p.id as item_id,
            p.created_at as timestamp,
            p.title as project_name,
            p.id as project_id,
            NULL as image_id,
            NULL as image_name
          FROM projects p
          WHERE p.user_id = $1
          
          UNION ALL
          
          -- Image upload activities
          SELECT 
            'image_uploaded' as type,
            i.name as item_name,
            i.id as item_id,
            i.created_at as timestamp,
            p.title as project_name,
            p.id as project_id,
            i.id as image_id,
            i.name as image_name
          FROM images i
          JOIN projects p ON i.project_id = p.id
          WHERE p.user_id = $1
          
          UNION ALL
          
          -- Segmentation completed activities
          SELECT 
            'segmentation_completed' as type,
            i.name as item_name,
            i.id as item_id,
            i.updated_at as timestamp,
            p.title as project_name,
            p.id as project_id,
            i.id as image_id,
            i.name as image_name
          FROM images i
          JOIN projects p ON i.project_id = p.id
          WHERE p.user_id = $1
            AND i.segmentation_status = 'completed'
            AND i.updated_at > i.created_at
        )
        SELECT * FROM combined_activities
        ORDER BY timestamp DESC
        LIMIT 20
      `;

      const result = await this.pool.query(activityQuery, [userId]);

      return result.rows.map((row) => ({
        type: row.type,
        description: this.getActivityDescription(row.type, row.item_name),
        timestamp: row.timestamp.toISOString(),
        project_id: row.project_id,
        project_name: row.project_name,
        image_id: row.image_id,
        image_name: row.image_name,
        item_id: row.item_id,
        item_name: row.item_name,
      }));
    } catch (error) {
      logger.error('Error generating recent activity', { userId, error });
      return [];
    }
  }

  /**
   * Get human-readable description for activity type
   */
  private getActivityDescription(type: string, itemName: string): string {
    switch (type) {
      case 'project_created':
        return `Created project "${itemName}"`;
      case 'image_uploaded':
        return `Uploaded image "${itemName}"`;
      case 'segmentation_completed':
        return `Completed segmentation for "${itemName}"`;
      default:
        return `Activity on "${itemName}"`;
    }
  }
}

// Factory function for creating service instances
export function createUserStatsService(pool: Pool | IDatabase): UserStatsServiceOptimized {
  return new UserStatsServiceOptimized(pool);
}

// Legacy compatibility export - requires pool injection
export const userStatsServiceOptimized = {
  /**
   * Get user stats with pool injection
   * @deprecated Use createUserStatsService instead
   */
  getUserStats: async (pool: Pool | IDatabase, userId: string) => {
    const service = createUserStatsService(pool);
    return service.getUserStats(userId);
  },

  /**
   * Get basic stats with pool injection
   * @deprecated Use createUserStatsService instead
   */
  getBasicStats: async (pool: Pool | IDatabase, userId: string) => {
    const service = createUserStatsService(pool);
    return service.getBasicStats(userId);
  },

  /**
   * Generate recent activity with pool injection
   * @deprecated Use createUserStatsService instead
   */
  generateRecentActivity: async (pool: Pool | IDatabase, userId: string) => {
    const service = createUserStatsService(pool);
    return service.generateRecentActivity(userId);
  },
};
