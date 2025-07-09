import { Pool } from 'pg';
import logger from '../utils/logger';

/**
 * Service for handling user statistics
 */
export class UserStatsService {
  /**
   * Get basic statistics for a user
   * @param pool Database connection pool
   * @param userId User ID
   */
  async getUserStats(pool: Pool, userId: string) {
    try {
      logger.debug('Fetching user stats', { userId });

      // Default stats
      const stats: {
        totalProjects: number;
        totalImages: number;
        completedSegmentations: number;
        storageUsedBytes: bigint;
        storageLimitBytes: bigint;
        recentActivity: any[];
        recentProjects: any[];
        recentImages: any[];
        projectsThisMonth: number;
        projectsLastMonth: number;
        imagesThisMonth: number;
        imagesLastMonth: number;
      } = {
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

      // Check if projects table exists
      const projectsTableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'projects'
        )
      `);

      if (!projectsTableCheck.rows[0].exists) {
        logger.warn('Projects table does not exist, returning default stats');
        throw new Error('Database schema not initialized - projects table missing');
      }

      // Fetch total projects
      const projectsCountRes = await pool.query(
        'SELECT COUNT(*) FROM projects WHERE user_id = $1',
        [userId]
      );
      stats.totalProjects = parseInt(projectsCountRes.rows[0].count, 10);

      // Check if images table exists
      const imagesTableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'images'
        )
      `);

      if (!imagesTableCheck.rows[0].exists) {
        logger.warn('Images table does not exist, returning partial stats');
        throw new Error('Database schema not initialized - images table missing');
      }

      // Fetch total images
      const imagesCountRes = await pool.query(
        'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
        [userId]
      );
      stats.totalImages = parseInt(imagesCountRes.rows[0].count, 10);

      // Fetch completed segmentations
      // Note: We use 'segmentation_status' field which tracks ML processing state ('without_segmentation', 'queued', 'processing', 'completed', 'failed')
      // This is different from 'status' field which tracks general image state ('pending', 'queued', 'completed')
      try {
        // First check if segmentation_status column exists
        const columnCheck = await pool.query(`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'images'
            AND column_name = 'segmentation_status'
          )
        `);

        if (columnCheck.rows[0].exists) {
          const completedSegmentationsRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.segmentation_status = $2',
            [userId, 'completed']
          );
          stats.completedSegmentations = parseInt(completedSegmentationsRes.rows[0].count, 10);
        } else {
          // Fallback to status column if segmentation_status doesn't exist
          logger.warn('segmentation_status column not found, falling back to status column');
          const completedSegmentationsRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2',
            [userId, 'completed']
          );
          stats.completedSegmentations = parseInt(completedSegmentationsRes.rows[0].count, 10);
        }
      } catch (error) {
        logger.error('Error fetching completed segmentations', { error, userId });
        stats.completedSegmentations = 0;
      }

      // Calculate storage usage - first try from users table, then from images
      try {
        // Try to get from users table first
        const storageRes = await pool.query(
          'SELECT storage_used_bytes, storage_limit_bytes FROM users WHERE id = $1',
          [userId]
        );

        if (storageRes.rows.length > 0) {
          if (storageRes.rows[0].storage_used_bytes) {
            stats.storageUsedBytes = BigInt(storageRes.rows[0].storage_used_bytes);
            logger.debug('Got storage info from users table', {
              storageBytes: stats.storageUsedBytes.toString(),
            });
          }

          if (storageRes.rows[0].storage_limit_bytes) {
            stats.storageLimitBytes = BigInt(storageRes.rows[0].storage_limit_bytes);
          }
        }
      } catch (error) {
        logger.warn('Error fetching storage info from users table', { error });
      }

      // If storage is still 0, try to calculate from images
      if (stats.storageUsedBytes === BigInt(0)) {
        try {
          // Check if file_size column exists in images table
          const fileSizeColumnCheck = await pool.query(`
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
              AND table_name = 'images'
              AND column_name = 'file_size'
            )
          `);

          if (fileSizeColumnCheck.rows[0].exists) {
            // Use file_size column to calculate total storage
            const storageSumRes = await pool.query(
              'SELECT COALESCE(SUM(file_size), 0) as sum FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
              [userId]
            );

            // Log raw sum
            logger.debug('Raw storage sum from images', {
              sum: storageSumRes.rows[0].sum,
              type: typeof storageSumRes.rows[0].sum,
            });

            // Convert to BigInt and handle null/undefined
            if (storageSumRes.rows[0].sum) {
              stats.storageUsedBytes = BigInt(storageSumRes.rows[0].sum);
            } else {
              // If still no storage info, estimate based on image count (1MB per image)
              stats.storageUsedBytes = BigInt(
                Math.max(stats.totalImages * 1024 * 1024, 1024 * 1024)
              );
            }

            // Log the calculated storage
            logger.debug('Calculated storage from images', {
              rawSum: storageSumRes.rows[0].sum,
              calculatedBytes: stats.storageUsedBytes.toString(),
              imageCount: stats.totalImages,
              perImageAvg:
                stats.totalImages > 0 ? Number(stats.storageUsedBytes) / stats.totalImages : 0,
            });
          } else {
            // If no file_size column, estimate based on image count
            stats.storageUsedBytes = BigInt(Math.max(stats.totalImages * 1024 * 1024, 1024 * 1024));
            logger.debug('Estimated storage based on image count (no file_size column)', {
              imageCount: stats.totalImages,
              estimatedBytes: stats.storageUsedBytes.toString(),
            });
          }
        } catch (sumError) {
          logger.error('Error calculating storage from images', { error: sumError });

          // Use fallback minimum value (~1MB) to ensure non-zero display
          stats.storageUsedBytes = BigInt(1024 * 1024);
          logger.debug('Using fallback minimum storage value', {
            fallbackBytes: stats.storageUsedBytes.toString(),
          });
        }
      }

      // Fetch recent images
      const recentImagesRes = await pool.query(
        `SELECT
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
        LIMIT 5`,
        [userId]
      );
      stats.recentImages = recentImagesRes.rows;

      // Fetch recent projects
      const recentProjectsRes = await pool.query(
        `SELECT
          p.id,
          p.title,
          p.description,
          p.created_at,
          p.updated_at,
          (SELECT COUNT(*) FROM images WHERE project_id = p.id) as image_count,
          (SELECT COUNT(*) FROM images WHERE project_id = p.id AND 
            CASE 
              WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'images' AND column_name = 'segmentation_status')
              THEN segmentation_status = 'completed'
              ELSE status = 'completed'
            END
          ) as completed_count
        FROM projects p
        WHERE p.user_id = $1
        ORDER BY p.updated_at DESC
        LIMIT 5`,
        [userId]
      );
      stats.recentProjects = recentProjectsRes.rows;

      // Get current month vs previous month stats
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const firstDayOfPrevMonth = new Date();
      firstDayOfPrevMonth.setMonth(firstDayOfPrevMonth.getMonth() - 1);
      firstDayOfPrevMonth.setDate(1);
      firstDayOfPrevMonth.setHours(0, 0, 0, 0);

      const lastDayOfPrevMonth = new Date(firstDayOfMonth);
      lastDayOfPrevMonth.setDate(0);
      lastDayOfPrevMonth.setHours(23, 59, 59, 999);

      // Projects created this month
      const projectsThisMonthRes = await pool.query(
        'SELECT COUNT(*) FROM projects WHERE user_id = $1 AND created_at >= $2',
        [userId, firstDayOfMonth]
      );
      stats.projectsThisMonth = parseInt(projectsThisMonthRes.rows[0].count, 10);

      // Projects created last month
      const projectsLastMonthRes = await pool.query(
        'SELECT COUNT(*) FROM projects WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3',
        [userId, firstDayOfPrevMonth, lastDayOfPrevMonth]
      );
      stats.projectsLastMonth = parseInt(projectsLastMonthRes.rows[0].count, 10);

      // Images uploaded this month
      const imagesThisMonthRes = await pool.query(
        'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.created_at >= $2',
        [userId, firstDayOfMonth]
      );
      stats.imagesThisMonth = parseInt(imagesThisMonthRes.rows[0].count, 10);

      // Images uploaded last month
      const imagesLastMonthRes = await pool.query(
        'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.created_at >= $2 AND i.created_at <= $3',
        [userId, firstDayOfPrevMonth, lastDayOfPrevMonth]
      );
      stats.imagesLastMonth = parseInt(imagesLastMonthRes.rows[0].count, 10);

      // Fetch recent activity
      try {
        const activityTableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'user_activity'
          )
        `);

        if (activityTableCheck.rows[0].exists) {
          const activityRes = await pool.query(
            `SELECT * FROM user_activity
             WHERE user_id = $1
             ORDER BY timestamp DESC
             LIMIT 10`,
            [userId]
          );
          stats.recentActivity = activityRes.rows;
        } else {
          // Generate activity from projects and images if activity table doesn't exist
          const projectActivity = await pool.query(
            `SELECT
              id as "projectId",
              title as "projectName",
              created_at as "timestamp",
              'project_created' as "type"
             FROM projects
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 5`,
            [userId]
          );

          const imageActivity = await pool.query(
            `SELECT
              i.id as "imageId",
              i.name as "imageName",
              i.project_id as "projectId",
              p.title as "projectName",
              i.created_at as "timestamp",
              'image_uploaded' as "type"
             FROM images i
             JOIN projects p ON i.project_id = p.id
             WHERE p.user_id = $1
             ORDER BY i.created_at DESC
             LIMIT 5`,
            [userId]
          );

          // Combine and sort activities
          const combinedActivity = [
            ...projectActivity.rows.map((p, i) => ({ id: `p${i}`, ...p })),
            ...imageActivity.rows.map((i, idx) => ({ id: `i${idx}`, ...i })),
          ]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);

          stats.recentActivity = combinedActivity;
        }
      } catch (activityError) {
        logger.error('Error fetching activity', { error: activityError });
      }

      return stats;
    } catch (error) {
      logger.error('Error fetching user stats', { error, userId });
      throw error;
    }
  }
}

export default new UserStatsService();
