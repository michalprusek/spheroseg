/**
 * Script to check detailed segmentation status across all tables
 * This helps diagnose where the "17 processing" count is coming from
 */

import { getPool } from '../db';
import logger from '../utils/logger';

async function checkDetailedStatus() {
  const pool = getPool();

  try {
    // 1. Check overall image status counts
    logger.info('=== Image Status Summary ===');
    const imageStatusQuery = `
      SELECT 
        segmentation_status,
        COUNT(*) as count
      FROM images
      GROUP BY segmentation_status
      ORDER BY count DESC;
    `;
    const imageStatusResult = await pool.query(imageStatusQuery);
    logger.info('Image status counts:', imageStatusResult.rows);

    // 2. Check segmentation_results status counts
    logger.info('\n=== Segmentation Results Status Summary ===');
    const segResultsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM segmentation_results
      GROUP BY status
      ORDER BY count DESC;
    `;
    const segResultsResult = await pool.query(segResultsQuery);
    logger.info('Segmentation results status counts:', segResultsResult.rows);

    // 3. Check segmentation_tasks status counts
    logger.info('\n=== Segmentation Tasks Status Summary ===');
    const segTasksQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM segmentation_tasks
      GROUP BY status
      ORDER BY count DESC;
    `;
    const segTasksResult = await pool.query(segTasksQuery);
    logger.info('Segmentation tasks status counts:', segTasksResult.rows);

    // 4. Check for mismatches between tables
    logger.info('\n=== Status Mismatches ===');
    const mismatchQuery = `
      SELECT 
        i.id,
        i.name,
        i.project_id,
        i.segmentation_status AS image_status,
        sr.status AS result_status,
        st.status AS task_status,
        CASE 
          WHEN i.segmentation_status != COALESCE(sr.status, i.segmentation_status) THEN 'Image vs Result mismatch'
          WHEN i.segmentation_status != COALESCE(st.status::text, i.segmentation_status) THEN 'Image vs Task mismatch'
          WHEN sr.status IS NOT NULL AND st.status IS NOT NULL AND sr.status != st.status::text THEN 'Result vs Task mismatch'
          ELSE 'No mismatch'
        END AS mismatch_type
      FROM images i
      LEFT JOIN segmentation_results sr ON i.id = sr.image_id
      LEFT JOIN segmentation_tasks st ON i.id = st.image_id
      WHERE 
        i.segmentation_status != COALESCE(sr.status, i.segmentation_status)
        OR i.segmentation_status != COALESCE(st.status::text, i.segmentation_status)
        OR (sr.status IS NOT NULL AND st.status IS NOT NULL AND sr.status != st.status::text);
    `;
    const mismatchResult = await pool.query(mismatchQuery);
    logger.info(`Found ${mismatchResult.rows.length} images with status mismatches`);
    if (mismatchResult.rows.length > 0) {
      mismatchResult.rows.forEach((row) => {
        logger.info(`Image ${row.id} (${row.name}):`, {
          imageStatus: row.image_status,
          resultStatus: row.result_status,
          taskStatus: row.task_status,
          mismatchType: row.mismatch_type,
        });
      });
    }

    // 5. Check processing count calculation as done in SegmentationProgress component
    logger.info('\n=== Processing Count Calculation (Frontend Logic) ===');
    const processingCountQuery = `
      WITH project_stats AS (
        SELECT 
          p.id AS project_id,
          p.title AS project_name,
          COUNT(DISTINCT i.id) AS total_images,
          COUNT(DISTINCT i.id) FILTER (WHERE i.segmentation_status = 'processing') AS processing_count_images,
          COUNT(DISTINCT sr.image_id) FILTER (WHERE sr.status = 'processing') AS processing_count_results,
          COUNT(DISTINCT st.image_id) FILTER (WHERE st.status = 'processing') AS processing_count_tasks
        FROM projects p
        LEFT JOIN images i ON p.id = i.project_id
        LEFT JOIN segmentation_results sr ON i.id = sr.image_id
        LEFT JOIN segmentation_tasks st ON i.id = st.image_id
        GROUP BY p.id, p.title
      )
      SELECT 
        project_id,
        project_name,
        total_images,
        processing_count_images,
        processing_count_results,
        processing_count_tasks,
        GREATEST(processing_count_images, processing_count_results, processing_count_tasks) AS max_processing_count
      FROM project_stats
      WHERE processing_count_images > 0 OR processing_count_results > 0 OR processing_count_tasks > 0
      ORDER BY project_name;
    `;
    const processingCountResult = await pool.query(processingCountQuery);
    logger.info('Processing counts by project:');
    processingCountResult.rows.forEach((row) => {
      logger.info(`Project "${row.project_name}":`, {
        totalImages: row.total_images,
        processingInImages: row.processing_count_images,
        processingInResults: row.processing_count_results,
        processingInTasks: row.processing_count_tasks,
        maxProcessingCount: row.max_processing_count,
      });
    });

    // 6. Check for orphaned records
    logger.info('\n=== Orphaned Records Check ===');
    const orphanedResultsQuery = `
      SELECT COUNT(*) as orphaned_results
      FROM segmentation_results sr
      WHERE NOT EXISTS (SELECT 1 FROM images i WHERE i.id = sr.image_id);
    `;
    const orphanedResultsResult = await pool.query(orphanedResultsQuery);

    const orphanedTasksQuery = `
      SELECT COUNT(*) as orphaned_tasks
      FROM segmentation_tasks st
      WHERE NOT EXISTS (SELECT 1 FROM images i WHERE i.id = st.image_id);
    `;
    const orphanedTasksResult = await pool.query(orphanedTasksQuery);

    logger.info('Orphaned segmentation_results:', orphanedResultsResult.rows[0].orphaned_results);
    logger.info('Orphaned segmentation_tasks:', orphanedTasksResult.rows[0].orphaned_tasks);

    // 7. Check images by project with their status
    logger.info('\n=== Images by Project ===');
    const imagesByProjectQuery = `
      SELECT 
        p.title AS project_name,
        i.segmentation_status,
        COUNT(*) as count
      FROM projects p
      JOIN images i ON p.id = i.project_id
      GROUP BY p.title, i.segmentation_status
      ORDER BY p.title, i.segmentation_status;
    `;
    const imagesByProjectResult = await pool.query(imagesByProjectQuery);
    let currentProject = '';
    imagesByProjectResult.rows.forEach((row) => {
      if (row.project_name !== currentProject) {
        currentProject = row.project_name;
        logger.info(`\nProject: ${currentProject}`);
      }
      logger.info(`  ${row.segmentation_status}: ${row.count}`);
    });

    // 8. Check if there's a specific query that might return 17 processing
    logger.info('\n=== Checking for "17 processing" source ===');
    const checkSeventeenQuery = `
      SELECT 
        'Images table' as source,
        COUNT(*) as processing_count
      FROM images
      WHERE segmentation_status = 'processing'
      UNION ALL
      SELECT 
        'Segmentation results table' as source,
        COUNT(*) as processing_count
      FROM segmentation_results
      WHERE status = 'processing'
      UNION ALL
      SELECT 
        'Segmentation tasks table' as source,
        COUNT(*) as processing_count
      FROM segmentation_tasks
      WHERE status = 'processing'
      UNION ALL
      SELECT 
        'Images with no results' as source,
        COUNT(*) as processing_count
      FROM images i
      WHERE i.segmentation_status = 'queued'
        AND NOT EXISTS (SELECT 1 FROM segmentation_results sr WHERE sr.image_id = i.id)
      UNION ALL
      SELECT 
        'Tasks in queue' as source,
        COUNT(*) as processing_count
      FROM segmentation_tasks
      WHERE status IN ('queued', 'processing');
    `;
    const checkSeventeenResult = await pool.query(checkSeventeenQuery);
    logger.info('Possible sources for "17 processing":');
    checkSeventeenResult.rows.forEach((row) => {
      if (row.processing_count === '17' || row.processing_count === 17) {
        logger.warn(`FOUND: ${row.source} has exactly 17 items!`);
      } else {
        logger.info(`${row.source}: ${row.processing_count}`);
      }
    });
  } catch (error) {
    logger.error('Error checking detailed status:', error);
    throw error;
  }
}

// Command line execution
if (require.main === module) {
  logger.info('Starting detailed segmentation status check');

  checkDetailedStatus()
    .then(() => {
      logger.info('Check completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Check failed:', error);
      process.exit(1);
    });
}

export { checkDetailedStatus };
