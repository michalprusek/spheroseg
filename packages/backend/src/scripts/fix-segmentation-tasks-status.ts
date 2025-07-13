/**
 * Script to fix segmentation tasks that are stuck in processing status
 * when the associated images and results are already completed
 */

import { getPool } from '../db';
import logger from '../utils/logger';

async function fixStuckSegmentationTasks(dryRun = true) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    // Find all tasks that are stuck in processing but have completed images
    const stuckTasksQuery = `
      SELECT 
        st.id AS task_id,
        st.image_id,
        st.status AS task_status,
        st.created_at,
        st.started_at,
        i.name AS image_name,
        i.segmentation_status AS image_status,
        sr.status AS result_status,
        sr.result_data IS NOT NULL AS has_result_data,
        p.title AS project_name
      FROM segmentation_tasks st
      JOIN images i ON st.image_id = i.id
      LEFT JOIN segmentation_results sr ON i.id = sr.image_id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE st.status = 'processing'
        AND (
          i.segmentation_status = 'completed'
          OR sr.status = 'completed'
          OR sr.result_data IS NOT NULL
        )
      ORDER BY p.title, i.name;
    `;
    
    const stuckTasks = await pool.query(stuckTasksQuery);
    
    logger.info(`Found ${stuckTasks.rows.length} stuck segmentation tasks`);
    
    if (stuckTasks.rows.length === 0) {
      logger.info('No stuck tasks found');
      return;
    }
    
    // Group by project for reporting
    const tasksByProject: Record<string, any[]> = {};
    stuckTasks.rows.forEach(task => {
      const projectName = task.project_name || 'Unknown';
      if (!tasksByProject[projectName]) {
        tasksByProject[projectName] = [];
      }
      tasksByProject[projectName].push(task);
    });
    
    logger.info('\n=== Stuck Tasks by Project ===');
    Object.entries(tasksByProject).forEach(([project, tasks]) => {
      logger.info(`Project "${project}": ${tasks.length} stuck tasks`);
    });
    
    if (!dryRun) {
      await client.query('BEGIN');
    }
    
    let fixedCount = 0;
    let errorCount = 0;
    
    // Fix each stuck task
    for (const task of stuckTasks.rows) {
      try {
        logger.info(`Processing task ${task.task_id} for image ${task.image_name}`, {
          currentTaskStatus: task.task_status,
          imageStatus: task.image_status,
          resultStatus: task.result_status,
          hasResultData: task.has_result_data
        });
        
        if (!dryRun) {
          // Update task status to completed since the image is completed
          await client.query(
            `UPDATE segmentation_tasks 
             SET status = 'completed'::task_status, 
                 completed_at = COALESCE(completed_at, NOW()),
                 updated_at = NOW()
             WHERE id = $1`,
            [task.task_id]
          );
          
          fixedCount++;
        }
      } catch (error) {
        logger.error(`Error fixing task ${task.task_id}:`, error);
        errorCount++;
      }
    }
    
    // Also handle orphaned tasks (tasks without corresponding images)
    logger.info('\n=== Checking Orphaned Tasks ===');
    const orphanedTasksQuery = `
      SELECT st.id, st.image_id, st.status
      FROM segmentation_tasks st
      WHERE NOT EXISTS (SELECT 1 FROM images i WHERE i.id = st.image_id)
        AND st.status IN ('processing', 'queued');
    `;
    
    const orphanedTasks = await pool.query(orphanedTasksQuery);
    logger.info(`Found ${orphanedTasks.rows.length} orphaned tasks`);
    
    if (!dryRun && orphanedTasks.rows.length > 0) {
      // Mark orphaned tasks as failed
      for (const orphan of orphanedTasks.rows) {
        try {
          await client.query(
            `UPDATE segmentation_tasks 
             SET status = 'failed'::task_status, 
                 error = 'Image no longer exists',
                 completed_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [orphan.id]
          );
          fixedCount++;
        } catch (error) {
          logger.error(`Error fixing orphaned task ${orphan.id}:`, error);
          errorCount++;
        }
      }
    }
    
    if (!dryRun) {
      await client.query('COMMIT');
      logger.info(`\nSuccessfully fixed ${fixedCount} tasks, ${errorCount} errors`);
    } else {
      logger.info(`\nDry run complete. Would fix ${stuckTasks.rows.length + orphanedTasks.rows.length} tasks`);
    }
    
    // Generate final summary
    logger.info('\n=== Final Task Status Summary ===');
    const finalSummaryQuery = `
      SELECT 
        p.title AS project_name,
        COUNT(DISTINCT st.id) AS total_tasks,
        COUNT(DISTINCT st.id) FILTER (WHERE st.status = 'completed') AS completed,
        COUNT(DISTINCT st.id) FILTER (WHERE st.status = 'processing') AS processing,
        COUNT(DISTINCT st.id) FILTER (WHERE st.status = 'queued') AS queued,
        COUNT(DISTINCT st.id) FILTER (WHERE st.status = 'failed') AS failed
      FROM segmentation_tasks st
      JOIN images i ON st.image_id = i.id
      JOIN projects p ON i.project_id = p.id
      GROUP BY p.title
      ORDER BY p.title;
    `;
    
    const finalSummary = await pool.query(finalSummaryQuery);
    finalSummary.rows.forEach(row => {
      logger.info(`Project "${row.project_name}":`, {
        totalTasks: row.total_tasks,
        completed: row.completed,
        processing: row.processing,
        queued: row.queued,
        failed: row.failed
      });
    });
    
  } catch (error) {
    if (!dryRun) {
      await client.query('ROLLBACK');
    }
    logger.error('Error fixing stuck tasks:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  logger.info('Starting segmentation tasks status fix');
  logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);
  
  fixStuckSegmentationTasks(dryRun)
    .then(() => {
      logger.info('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}

export { fixStuckSegmentationTasks };