/**
 * Script to fix segmentation status inconsistency
 *
 * This script identifies and fixes images where the segmentation has been completed
 * but the status is still showing as 'processing' in one or more tables.
 */

import { getPool } from '../db';
import logger from '../utils/logger';

const SEGMENTATION_STATUS = {
  WITHOUT_SEGMENTATION: 'without_segmentation',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

async function findInconsistentStatuses() {
  const pool = getPool();

  try {
    // Find images with inconsistent statuses
    const query = `
      WITH image_status_comparison AS (
        SELECT 
          i.id AS image_id,
          i.name AS image_name,
          i.project_id,
          i.segmentation_status AS image_status,
          sr.status AS segmentation_result_status,
          st.status AS task_status,
          sr.result_data IS NOT NULL AS has_result_data,
          sr.created_at AS result_created_at,
          sr.updated_at AS result_updated_at,
          st.completed_at AS task_completed_at
        FROM images i
        LEFT JOIN segmentation_results sr ON i.id = sr.image_id
        LEFT JOIN segmentation_tasks st ON i.id = st.image_id
        WHERE i.segmentation_status IN ('processing', 'queued')
          OR sr.status IN ('processing', 'queued')
          OR st.status IN ('processing', 'queued')
      )
      SELECT * FROM image_status_comparison
      WHERE 
        -- Case 1: Result data exists but status is not completed
        (has_result_data = true AND (image_status != 'completed' OR segmentation_result_status != 'completed'))
        -- Case 2: Task shows completed but image status doesn't
        OR (task_status = 'completed' AND image_status != 'completed')
        -- Case 3: Segmentation result shows completed but image status doesn't
        OR (segmentation_result_status = 'completed' AND image_status != 'completed')
        -- Case 4: Image has been in processing for too long (> 1 hour)
        OR (image_status = 'processing' AND result_updated_at < NOW() - INTERVAL '1 hour')
      ORDER BY project_id, image_id;
    `;

    const result = await pool.query(query);

    logger.info(`Found ${result.rows.length} images with inconsistent statuses`);

    return result.rows;
  } catch (error) {
    logger.error('Error finding inconsistent statuses:', error);
    throw error;
  }
}

async function fixInconsistentStatuses(dryRun = true) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const inconsistentImages = await findInconsistentStatuses();

    if (inconsistentImages.length === 0) {
      logger.info('No inconsistent statuses found');
      return;
    }

    logger.info(`Processing ${inconsistentImages.length} images with inconsistent statuses`);

    if (!dryRun) {
      await client.query('BEGIN');
    }

    let fixedCount = 0;
    let errorCount = 0;

    for (const image of inconsistentImages) {
      try {
        let targetStatus = SEGMENTATION_STATUS.WITHOUT_SEGMENTATION;
        let reason = 'No clear completion status';

        // Determine the correct status based on available data
        if (
          image.has_result_data ||
          image.segmentation_result_status === 'completed' ||
          image.task_status === 'completed'
        ) {
          targetStatus = SEGMENTATION_STATUS.COMPLETED;
          reason = 'Has result data or completion status in other tables';
        } else if (
          image.task_status === 'failed' ||
          image.segmentation_result_status === 'failed'
        ) {
          targetStatus = SEGMENTATION_STATUS.FAILED;
          reason = 'Failed status in other tables';
        } else if (
          image.result_updated_at &&
          new Date(image.result_updated_at) < new Date(Date.now() - 3600000)
        ) {
          // If stuck in processing for more than 1 hour, mark as without segmentation
          targetStatus = SEGMENTATION_STATUS.WITHOUT_SEGMENTATION;
          reason = 'Stuck in processing for too long';
        }

        logger.info(`Image ${image.image_id} (${image.image_name}):`, {
          currentStatus: image.image_status,
          targetStatus,
          reason,
          dryRun,
        });

        if (!dryRun) {
          // Update images table
          await client.query(
            'UPDATE images SET segmentation_status = $1, updated_at = NOW() WHERE id = $2',
            [targetStatus, image.image_id]
          );

          // Update segmentation_results table if exists
          if (image.segmentation_result_status) {
            await client.query(
              'UPDATE segmentation_results SET status = $1, updated_at = NOW() WHERE image_id = $2',
              [targetStatus, image.image_id]
            );
          }

          // Update segmentation_tasks table if exists and not already completed
          if (
            image.task_status &&
            image.task_status !== 'completed' &&
            image.task_status !== 'failed'
          ) {
            await client.query(
              `UPDATE segmentation_tasks 
               SET status = $1::task_status, 
                   completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
                   updated_at = NOW() 
               WHERE image_id = $2 AND status NOT IN ('completed', 'failed')`,
              [targetStatus, image.image_id]
            );
          }

          fixedCount++;
        }
      } catch (error) {
        logger.error(`Error processing image ${image.image_id}:`, error);
        errorCount++;
      }
    }

    if (!dryRun) {
      await client.query('COMMIT');
      logger.info(`Successfully fixed ${fixedCount} images, ${errorCount} errors`);
    } else {
      logger.info(`Dry run complete. Would fix ${inconsistentImages.length} images`);
    }

    // Generate summary report
    const summaryQuery = `
      SELECT 
        p.id AS project_id,
        p.title AS project_name,
        COUNT(DISTINCT i.id) AS total_images,
        COUNT(DISTINCT i.id) FILTER (WHERE i.segmentation_status = 'completed') AS completed_count,
        COUNT(DISTINCT i.id) FILTER (WHERE i.segmentation_status = 'processing') AS processing_count,
        COUNT(DISTINCT i.id) FILTER (WHERE i.segmentation_status = 'queued') AS queued_count,
        COUNT(DISTINCT i.id) FILTER (WHERE i.segmentation_status = 'failed') AS failed_count,
        COUNT(DISTINCT i.id) FILTER (WHERE i.segmentation_status = 'without_segmentation') AS without_segmentation_count
      FROM projects p
      JOIN images i ON p.id = i.project_id
      WHERE p.id IN (SELECT DISTINCT project_id FROM images WHERE id = ANY($1))
      GROUP BY p.id, p.title
      ORDER BY p.title;
    `;

    const summaryResult = await pool.query(summaryQuery, [
      inconsistentImages.map((img) => img.image_id),
    ]);

    logger.info('Project summary after fixes:');
    summaryResult.rows.forEach((project) => {
      logger.info(`Project "${project.project_name}":`, {
        totalImages: project.total_images,
        completed: project.completed_count,
        processing: project.processing_count,
        queued: project.queued_count,
        failed: project.failed_count,
        withoutSegmentation: project.without_segmentation_count,
      });
    });
  } catch (error) {
    if (!dryRun) {
      await client.query('ROLLBACK');
    }
    logger.error('Error fixing inconsistent statuses:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  logger.info('Starting segmentation status inconsistency fix');
  logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);

  fixInconsistentStatuses(dryRun)
    .then(() => {
      logger.info('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}

export { findInconsistentStatuses, fixInconsistentStatuses };
