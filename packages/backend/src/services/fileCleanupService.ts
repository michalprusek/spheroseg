/**
 * File Cleanup Service
 *
 * This service handles the deletion of files associated with projects, images, and segmentations.
 * It ensures proper cleanup of file resources when database records are deleted.
 */

import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';
import imageUtils from '../utils/imageUtils.unified';
import config from '../config';

// Type definitions
export interface FileCleanupOptions {
  transactionClient?: PoolClient;
  dryRun?: boolean;
}

export interface FileCleanupResult {
  success: boolean;
  deletedFiles: string[];
  failedFiles: { path: string; error: string }[];
  dryRun: boolean;
}

/**
 * Deletes all files associated with a project
 * This includes original images, thumbnails, and segmentation results
 *
 * @param pool Database pool for querying image paths
 * @param projectId The ID of the project to delete files for
 * @param options Options for the deletion operation
 * @returns Result of the file cleanup operation
 */
export async function cleanupProjectFiles(
  pool: Pool,
  projectId: string,
  options: FileCleanupOptions = {}
): Promise<FileCleanupResult> {
  const { transactionClient, dryRun = false } = options;
  const client = transactionClient || pool;
  const result: FileCleanupResult = {
    success: true,
    deletedFiles: [],
    failedFiles: [],
    dryRun,
  };

  logger.info(`Starting file cleanup for project ${projectId}`, { projectId, dryRun });

  try {
    // 1. Get all images for the project
    const imagesQuery = `
      SELECT id, storage_path, thumbnail_path
      FROM images
      WHERE project_id = $1
    `;
    const imagesResult = await client.query(imagesQuery, [projectId]);
    const images = imagesResult.rows;
    logger.debug(`Found ${images.length} images to clean up`, { projectId });

    // 2. Get all segmentation files for the project's images
    const imageIds = images.map(img => img.id);
    let segmentationFiles: string[] = [];
    
    if (imageIds.length > 0) {
      const segmentationQuery = `
        SELECT sr.image_id, sr.result_data->>'mask_path' as mask_path, 
               sr.result_data->>'visualization_path' as visualization_path
        FROM segmentation_results sr
        WHERE sr.image_id = ANY($1::uuid[])
      `;
      const segmentationResults = await client.query(segmentationQuery, [imageIds]);
      
      segmentationFiles = segmentationResults.rows
        .flatMap(row => [row.mask_path, row.visualization_path])
        .filter(Boolean); // Remove nulls/undefined
    }

    // 3. Collect all file paths to delete
    const filesToDelete: string[] = [];
    const uploadDir = config.storage.uploadDir;

    // Add image files
    for (const image of images) {
      if (image.storage_path) {
        filesToDelete.push(imageUtils.dbPathToFilesystemPath(image.storage_path, uploadDir));
      }
      if (image.thumbnail_path) {
        filesToDelete.push(imageUtils.dbPathToFilesystemPath(image.thumbnail_path, uploadDir));
      }
    }

    // Add segmentation files
    for (const filePath of segmentationFiles) {
      if (filePath) {
        filesToDelete.push(imageUtils.dbPathToFilesystemPath(filePath, uploadDir));
      }
    }

    // 4. Project directory
    const projectDir = path.join(uploadDir, projectId);
    const projectDirExists = await imageUtils.fileExists(projectDir);

    // 5. Delete files and directory
    if (dryRun) {
      logger.info(`DRY RUN: Would delete ${filesToDelete.length} files and ${projectDirExists ? '1 directory' : '0 directories'}`, {
        projectId,
        fileCount: filesToDelete.length,
      });
      return {
        success: true,
        deletedFiles: filesToDelete,
        failedFiles: [],
        dryRun: true,
      };
    }

    // Delete individual files first
    for (const filePath of filesToDelete) {
      try {
        await imageUtils.deleteFile(filePath);
        result.deletedFiles.push(filePath);
      } catch (error) {
        logger.warn(`Failed to delete file ${filePath}`, { error });
        result.failedFiles.push({ path: filePath, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Finally, attempt to remove the project directory
    if (projectDirExists) {
      try {
        // Get remaining files in directory first
        const remainingFiles = await imageUtils.getFilesInDirectory(projectDir, { recursive: true });
        
        // Delete any remaining files
        for (const filePath of remainingFiles) {
          try {
            await imageUtils.deleteFile(filePath);
            result.deletedFiles.push(filePath);
          } catch (error) {
            logger.warn(`Failed to delete remaining file ${filePath}`, { error });
            result.failedFiles.push({ path: filePath, error: error instanceof Error ? error.message : String(error) });
          }
        }
        
        // Remove the directory recursively
        fs.rmdirSync(projectDir, { recursive: true });
        logger.info(`Deleted project directory: ${projectDir}`);
      } catch (error) {
        logger.error(`Failed to delete project directory ${projectDir}`, { error });
        result.failedFiles.push({ path: projectDir, error: error instanceof Error ? error.message : String(error) });
        result.success = false;
      }
    }

    // Update the final success status
    result.success = result.success && result.failedFiles.length === 0;
    
    return result;
  } catch (error) {
    logger.error(`Error during file cleanup for project ${projectId}`, { error });
    throw error;
  }
}

export default {
  cleanupProjectFiles
};