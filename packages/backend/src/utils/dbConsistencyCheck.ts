/**
 * Database Consistency Check Utility
 * 
 * Provides utilities for checking and fixing database consistency issues
 * related to images and their statuses
 */

import { getPool } from '../db';
import logger from './logger';

// Validation utilities
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function validateMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 1440; // Max 24 hours
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface ConsistencyReport {
  totalImages: number;
  imagesWithoutStatus: number;
  imagesWithInvalidStatus: number;
  orphanedImages: number;
  missingFiles: number;
  fixedIssues: number;
  errors: string[];
}

const VALID_STATUSES = ['without_segmentation', 'queued', 'processing', 'completed', 'failed'];

/**
 * Check database consistency for a specific project
 */
export async function checkProjectConsistency(projectId: string): Promise<ConsistencyReport> {
  // Validate input
  if (!projectId || !isValidUUID(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }
  
  const pool = getPool();
  const report: ConsistencyReport = {
    totalImages: 0,
    imagesWithoutStatus: 0,
    imagesWithInvalidStatus: 0,
    orphanedImages: 0,
    missingFiles: 0,
    fixedIssues: 0,
    errors: []
  };

  try {
    // Get total image count
    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM images WHERE project_id = $1',
      [projectId]
    );
    report.totalImages = parseInt(totalResult.rows[0].count, 10);

    // Check for images without segmentation_status
    const noStatusResult = await pool.query(
      'SELECT COUNT(*) FROM images WHERE project_id = $1 AND segmentation_status IS NULL',
      [projectId]
    );
    report.imagesWithoutStatus = parseInt(noStatusResult.rows[0].count, 10);

    // Check for images with invalid status
    const invalidStatusResult = await pool.query(
      `SELECT COUNT(*) FROM images 
       WHERE project_id = $1 
       AND segmentation_status IS NOT NULL 
       AND segmentation_status NOT IN ($2, $3, $4, $5, $6)`,
      [projectId, ...VALID_STATUSES]
    );
    report.imagesWithInvalidStatus = parseInt(invalidStatusResult.rows[0].count, 10);

    // Check for orphaned images (no corresponding project)
    const orphanedResult = await pool.query(
      `SELECT COUNT(*) FROM images i 
       LEFT JOIN projects p ON i.project_id = p.id 
       WHERE i.project_id = $1 AND p.id IS NULL`,
      [projectId]
    );
    report.orphanedImages = parseInt(orphanedResult.rows[0].count, 10);

    logger.info('Database consistency check completed', {
      projectId,
      report
    });

  } catch (error) {
    logger.error('Error during consistency check', { projectId, error });
    report.errors.push(`Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return report;
}

/**
 * Fix common database consistency issues
 */
export async function fixProjectConsistency(projectId: string, dryRun: boolean = true): Promise<ConsistencyReport> {
  // Validate input
  if (!projectId || !isValidUUID(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }
  
  const pool = getPool();
  const report = await checkProjectConsistency(projectId);
  
  if (dryRun) {
    logger.info('Running in dry-run mode - no changes will be made');
    return report;
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Fix images without status
    if (report.imagesWithoutStatus > 0) {
      const updateResult = await client.query(
        `UPDATE images 
         SET segmentation_status = 'without_segmentation', 
             updated_at = NOW() 
         WHERE project_id = $1 AND segmentation_status IS NULL`,
        [projectId]
      );
      report.fixedIssues += updateResult.rowCount || 0;
      logger.info(`Fixed ${updateResult.rowCount} images without status`);
    }

    // Fix images with invalid status
    if (report.imagesWithInvalidStatus > 0) {
      const updateResult = await client.query(
        `UPDATE images 
         SET segmentation_status = 'without_segmentation', 
             updated_at = NOW() 
         WHERE project_id = $1 
         AND segmentation_status IS NOT NULL 
         AND segmentation_status NOT IN ($2, $3, $4, $5, $6)`,
        [projectId, ...VALID_STATUSES]
      );
      report.fixedIssues += updateResult.rowCount || 0;
      logger.info(`Fixed ${updateResult.rowCount} images with invalid status`);
    }

    await client.query('COMMIT');
    logger.info('Database consistency fixes applied', {
      projectId,
      fixedIssues: report.fixedIssues
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error fixing consistency issues', { projectId, error });
    report.errors.push(`Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    client.release();
  }

  return report;
}

/**
 * Get detailed status breakdown for a project
 */
export async function getProjectStatusBreakdown(projectId: string): Promise<Record<string, number>> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      `SELECT segmentation_status, COUNT(*) as count 
       FROM images 
       WHERE project_id = $1 
       GROUP BY segmentation_status 
       ORDER BY segmentation_status`,
      [projectId]
    );

    const breakdown: Record<string, number> = {};
    result.rows.forEach(row => {
      breakdown[row.segmentation_status || 'null'] = parseInt(row.count, 10);
    });

    logger.info('Status breakdown retrieved', { projectId, breakdown });
    return breakdown;

  } catch (error) {
    logger.error('Error getting status breakdown', { projectId, error });
    throw error;
  }
}

/**
 * Verify all images have proper status after upload
 */
export async function verifyRecentUploads(projectId: string, minutes: number = 5): Promise<{
  total: number;
  withoutStatus: number;
  imageIds: string[];
}> {
  // Validate inputs
  if (!projectId || !isValidUUID(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }
  
  if (!validateMinutes(minutes)) {
    throw new ValidationError('Minutes must be between 1 and 1440');
  }
  
  const pool = getPool();
  
  try {
    // Using parameterized query to prevent SQL injection
    const result = await pool.query(
      `SELECT id, name, segmentation_status, created_at 
       FROM images 
       WHERE project_id = $1 
       AND created_at > NOW() - INTERVAL $2
       AND (segmentation_status IS NULL OR segmentation_status = '')
       ORDER BY created_at DESC`,
      [projectId, `${minutes} minutes`]
    );

    const totalResult = await pool.query(
      `SELECT COUNT(*) FROM images 
       WHERE project_id = $1 
       AND created_at > NOW() - INTERVAL $2`,
      [projectId, `${minutes} minutes`]
    );

    return {
      total: parseInt(totalResult.rows[0].count, 10),
      withoutStatus: result.rows.length,
      imageIds: result.rows.map(row => row.id)
    };

  } catch (error) {
    logger.error('Error verifying recent uploads', { projectId, error });
    throw error;
  }
}

export default {
  checkProjectConsistency,
  fixProjectConsistency,
  getProjectStatusBreakdown,
  verifyRecentUploads
};