import pool from '../db';
import logger from '../utils/logger';
import { getIO } from '../socket';

interface StuckImage {
  id: string;
  name: string;
  project_id: string;
  segmentation_status: string;
  updated_at: Date;
  task_id?: string;
  task_status?: string;
  task_created?: Date;
}

/**
 * Service for automatically detecting and fixing stuck images
 */
class StuckImageCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly STUCK_THRESHOLD_MINUTES = 30; // Images stuck for more than 30 minutes
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

  /**
   * Start the automatic cleanup service
   */
  public start(): void {
    if (this.cleanupInterval) {
      logger.warn('Stuck image cleanup service is already running');
      return;
    }

    logger.info('Starting stuck image cleanup service');
    
    // Run immediately on start
    this.checkAndFixStuckImages();
    
    // Then run periodically
    this.cleanupInterval = setInterval(() => {
      this.checkAndFixStuckImages();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the cleanup service
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Stopped stuck image cleanup service');
    }
  }

  /**
   * Check for stuck images and fix them
   */
  private async checkAndFixStuckImages(): Promise<void> {
    const dbPool = pool.getPool();
    const client = await dbPool.connect();
    
    try {
      // Find images that are stuck in 'queued' or 'processing' status
      const stuckImagesQuery = `
        SELECT DISTINCT 
          i.id, 
          i.name, 
          i.project_id,
          i.segmentation_status, 
          i.updated_at,
          st.id as task_id,
          st.status as task_status,
          st.created_at as task_created
        FROM images i
        LEFT JOIN LATERAL (
          SELECT id, status, created_at 
          FROM segmentation_tasks 
          WHERE image_id = i.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) st ON true
        WHERE 
          -- Images stuck in queued or processing
          i.segmentation_status IN ('queued', 'processing')
          AND (
            -- No task exists
            st.id IS NULL
            -- Or task is old and stuck in processing
            OR (st.status = 'processing' AND st.created_at < NOW() - INTERVAL '${this.STUCK_THRESHOLD_MINUTES} minutes')
            -- Or task is old and stuck in queued (not picked up by ML service)
            OR (st.status = 'queued' AND st.created_at < NOW() - INTERVAL '${this.STUCK_THRESHOLD_MINUTES} minutes')
          )
      `;

      const result = await client.query<StuckImage>(stuckImagesQuery);
      
      if (result.rows.length === 0) {
        logger.debug('No stuck images found');
        return;
      }

      logger.info(`Found ${result.rows.length} stuck images to fix`);

      for (const image of result.rows) {
        await this.fixStuckImage(client, image);
      }

    } catch (error) {
      logger.error('Error checking for stuck images:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Fix a single stuck image
   */
  private async fixStuckImage(client: any, image: StuckImage): Promise<void> {
    try {
      logger.info(`Fixing stuck image: ${image.name} (${image.id})`);

      // Start transaction
      await client.query('BEGIN');

      // 1. Update image status to 'without_segmentation'
      await client.query(
        "UPDATE images SET segmentation_status = 'without_segmentation', updated_at = NOW() WHERE id = $1",
        [image.id]
      );

      // 2. Delete any queued segmentation results
      await client.query(
        "DELETE FROM segmentation_results WHERE image_id = $1 AND status IN ('queued', 'processing')",
        [image.id]
      );

      // 3. Mark any stuck tasks as failed
      if (image.task_id) {
        await client.query(
          `UPDATE segmentation_tasks 
           SET status = 'failed'::task_status, 
               error = 'Task automatically cancelled - stuck for too long',
               updated_at = NOW()
           WHERE id = $1`,
          [image.task_id]
        );
      }

      // Commit transaction
      await client.query('COMMIT');

      // 4. Emit WebSocket event to update UI
      const io = getIO();
      if (io && image.project_id) {
        io.to(`project-${image.project_id}`).emit('segmentation_update', {
          imageId: image.id,
          status: 'without_segmentation',
          error: 'Segmentation automatically reset due to timeout',
          timestamp: new Date().toISOString(),
        });

        // Also emit image status update event
        io.to(`project-${image.project_id}`).emit('image_update', {
          imageId: image.id,
          type: 'status',
          data: {
            segmentationStatus: 'without_segmentation',
            error: 'Segmentation automatically reset due to timeout',
          },
        });
      }

      logger.info(`Successfully reset stuck image ${image.id} to 'without_segmentation'`);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to fix stuck image ${image.id}:`, error);
    }
  }

  /**
   * Manually trigger cleanup (for testing or admin purposes)
   */
  public async forceCleanup(): Promise<number> {
    logger.info('Manually triggering stuck image cleanup');
    const dbPool = pool.getPool();
    const client = await dbPool.connect();
    
    try {
      const stuckImagesQuery = `
        SELECT COUNT(*) as count
        FROM images i
        LEFT JOIN LATERAL (
          SELECT id, status, created_at 
          FROM segmentation_tasks 
          WHERE image_id = i.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) st ON true
        WHERE 
          i.segmentation_status IN ('queued', 'processing')
          AND (
            st.id IS NULL
            OR (st.status = 'processing' AND st.created_at < NOW() - INTERVAL '${this.STUCK_THRESHOLD_MINUTES} minutes')
            OR (st.status = 'queued' AND st.created_at < NOW() - INTERVAL '${this.STUCK_THRESHOLD_MINUTES} minutes')
          )
      `;

      const result = await client.query(stuckImagesQuery);
      const count = parseInt(result.rows[0].count);
      
      if (count > 0) {
        await this.checkAndFixStuckImages();
      }
      
      return count;
    } finally {
      client.release();
    }
  }
}

// Create singleton instance
const stuckImageCleanupService = new StuckImageCleanupService();

export default stuckImageCleanupService;