/**
 * Project Duplication Service
 * Handles duplicating projects with all their associated data
 */

import { Pool, PoolClient } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';
import config from '../config';

interface DuplicationOptions {
  includeImages?: boolean;
  includeSegmentations?: boolean;
  includeSharedUsers?: boolean;
  newName?: string;
}

interface FilePath {
  originalPath: string;
  newPath: string;
}

/**
 * Duplicate a project with all its associated data
 */
export async function duplicateProject(
  pool: Pool,
  projectId: string,
  userId: string,
  options: DuplicationOptions = {}
): Promise<string> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get original project
    const projectResult = await client.query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error('Project not found');
    }
    
    const originalProject = projectResult.rows[0];
    
    // Create new project
    const newProjectName = options.newName || `${originalProject.name} (Copy)`;
    const newProjectResult = await client.query(
      `INSERT INTO projects (name, description, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [newProjectName, originalProject.description, userId]
    );
    
    const newProjectId = newProjectResult.rows[0].id;
    
    // Duplicate images if requested
    if (options.includeImages) {
      await duplicateImages(client, projectId, newProjectId);
    }
    
    // Duplicate segmentations if requested
    if (options.includeSegmentations && options.includeImages) {
      await duplicateSegmentations(client, projectId, newProjectId);
    }
    
    // Copy shared users if requested
    if (options.includeSharedUsers) {
      await duplicateSharedUsers(client, projectId, newProjectId);
    }
    
    await client.query('COMMIT');
    
    logger.info('Project duplicated successfully', {
      originalProjectId: projectId,
      newProjectId,
      options
    });
    
    return newProjectId;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error duplicating project', { error, projectId, options });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Duplicate project via API (for client-side usage)
 */
export async function duplicateProjectViaApi(
  projectId: string,
  options: DuplicationOptions = {}
): Promise<{ projectId: string; message: string }> {
  // This would typically make an API call to the backend
  // For now, returning a stub response
  return {
    projectId: 'new-project-id',
    message: 'Project duplicated successfully'
  };
}

/**
 * Generate new file paths for duplicated files
 */
export function generateNewFilePaths(originalPaths: string[]): FilePath[] {
  return originalPaths.map(originalPath => {
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const basename = path.basename(originalPath, ext);
    const timestamp = Date.now();
    const newPath = path.join(dir, `${basename}_copy_${timestamp}${ext}`);
    
    return {
      originalPath,
      newPath
    };
  });
}

/**
 * Copy image files to new locations
 */
export async function copyImageFiles(filePaths: FilePath[]): Promise<void> {
  for (const { originalPath, newPath } of filePaths) {
    try {
      await fs.copyFile(originalPath, newPath);
      logger.debug('Copied file', { originalPath, newPath });
    } catch (error) {
      logger.error('Error copying file', { error, originalPath, newPath });
      throw error;
    }
  }
}

/**
 * Duplicate images from one project to another
 */
async function duplicateImages(
  client: PoolClient,
  originalProjectId: string,
  newProjectId: string
): Promise<void> {
  const imagesResult = await client.query(
    'SELECT * FROM images WHERE project_id = $1',
    [originalProjectId]
  );
  
  for (const image of imagesResult.rows) {
    // Generate new file paths
    const filePaths = generateNewFilePaths([
      image.image_path,
      image.thumbnail_path
    ]);
    
    // Copy files
    await copyImageFiles(filePaths);
    
    // Insert new image record
    await client.query(
      `INSERT INTO images (
        project_id, filename, image_path, thumbnail_path,
        width, height, size, format, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        newProjectId,
        image.filename,
        filePaths[0].newPath,
        filePaths[1].newPath,
        image.width,
        image.height,
        image.size,
        image.format
      ]
    );
  }
}

/**
 * Duplicate segmentations from one project to another
 */
async function duplicateSegmentations(
  client: PoolClient,
  originalProjectId: string,
  newProjectId: string
): Promise<void> {
  // Get mapping of old to new image IDs
  const imageMappingResult = await client.query(
    `SELECT 
       o.id as original_id,
       n.id as new_id
     FROM images o
     JOIN images n ON o.filename = n.filename
     WHERE o.project_id = $1 AND n.project_id = $2`,
    [originalProjectId, newProjectId]
  );
  
  const imageIdMap = new Map(
    imageMappingResult.rows.map(row => [row.original_id, row.new_id])
  );
  
  // Duplicate segmentation results
  for (const [originalImageId, newImageId] of imageIdMap) {
    const segmentationResult = await client.query(
      'SELECT * FROM segmentation_results WHERE image_id = $1',
      [originalImageId]
    );
    
    if (segmentationResult.rows.length > 0) {
      const seg = segmentationResult.rows[0];
      
      const newSegResult = await client.query(
        `INSERT INTO segmentation_results (
          image_id, polygons, created_at, processing_time,
          ml_model_version, parameters
        ) VALUES ($1, $2, NOW(), $3, $4, $5)
        RETURNING id`,
        [
          newImageId,
          seg.polygons,
          seg.processing_time,
          seg.ml_model_version,
          seg.parameters
        ]
      );
      
      // Duplicate cells
      const cellsResult = await client.query(
        'SELECT * FROM cells WHERE segmentation_id = $1',
        [seg.id]
      );
      
      for (const cell of cellsResult.rows) {
        await client.query(
          `INSERT INTO cells (
            segmentation_id, cell_index, polygon, area,
            perimeter, centroid, convexity, solidity,
            eccentricity, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            newSegResult.rows[0].id,
            cell.cell_index,
            cell.polygon,
            cell.area,
            cell.perimeter,
            cell.centroid,
            cell.convexity,
            cell.solidity,
            cell.eccentricity
          ]
        );
      }
    }
  }
}

/**
 * Duplicate shared users from one project to another
 */
async function duplicateSharedUsers(
  client: PoolClient,
  originalProjectId: string,
  newProjectId: string
): Promise<void> {
  await client.query(
    `INSERT INTO project_shares (project_id, user_id, permission, shared_at)
     SELECT $2, user_id, permission, NOW()
     FROM project_shares
     WHERE project_id = $1`,
    [originalProjectId, newProjectId]
  );
}

// Export all functions as default object for compatibility with test
export default {
  duplicateProject,
  duplicateProjectViaApi,
  generateNewFilePaths,
  copyImageFiles
};