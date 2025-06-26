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
  options: FileCleanupOptions = {},
): Promise<FileCleanupResult> {
  const { transactionClient, dryRun = false } = options;
  const client = transactionClient || pool;
  const result: FileCleanupResult = {
    success: true,
    deletedFiles: [],
    failedFiles: [],
    dryRun,
  };

  logger.info(`Starting file cleanup for project ${projectId}`, {
    projectId,
    dryRun,
  });

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
    const imageIds = images.map((img) => img.id);
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
        .flatMap((row) => [row.mask_path, row.visualization_path])
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
      logger.info(
        `DRY RUN: Would delete ${filesToDelete.length} files and ${projectDirExists ? '1 directory' : '0 directories'}`,
        {
          projectId,
          fileCount: filesToDelete.length,
        },
      );
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
        result.failedFiles.push({
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
        });
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
            logger.warn(`Failed to delete remaining file ${filePath}`, {
              error,
            });
            result.failedFiles.push({
              path: filePath,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Remove the directory recursively
        fs.rmdirSync(projectDir, { recursive: true });
        logger.info(`Deleted project directory: ${projectDir}`);
      } catch (error) {
        logger.error(`Failed to delete project directory ${projectDir}`, {
          error,
        });
        result.failedFiles.push({
          path: projectDir,
          error: error instanceof Error ? error.message : String(error),
        });
        result.success = false;
      }
    }

    // Update the final success status
    result.success = result.success && result.failedFiles.length === 0;

    return result;
  } catch (error) {
    logger.error(`Error during file cleanup for project ${projectId}`, {
      error,
    });
    throw error;
  }
}

/**
 * Cleans up temporary files older than the specified age
 * @param maxAgeHours Maximum age in hours for temporary files
 * @param options Cleanup options
 */
export async function cleanupTemporaryFiles(
  maxAgeHours: number = 24,
  options: FileCleanupOptions = {},
): Promise<FileCleanupResult> {
  const { dryRun = false } = options;
  const result: FileCleanupResult = {
    success: true,
    deletedFiles: [],
    failedFiles: [],
    dryRun,
  };

  logger.info(`Starting temporary file cleanup (files older than ${maxAgeHours} hours)`, { maxAgeHours, dryRun });

  const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
  const tempDirs = [
    path.join(config.storage.uploadDir, 'temp'),
    path.join(config.storage.uploadDir, 'processing'),
    path.join(config.storage.uploadDir, 'segmentation_temp'),
    path.join(config.storage.uploadDir, 'ml_temp'),
    '/tmp',
  ];

  for (const tempDir of tempDirs) {
    if (!fs.existsSync(tempDir)) continue;

    try {
      const files = fs.readdirSync(tempDir, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(tempDir, file.name);
        
        try {
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            if (dryRun) {
              result.deletedFiles.push(filePath);
            } else {
              if (file.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
              result.deletedFiles.push(filePath);
            }
          }
        } catch (error) {
          result.failedFiles.push({
            path: filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to process temp directory ${tempDir}`, { error });
    }
  }

  logger.info(`Temporary file cleanup completed`, {
    deletedCount: result.deletedFiles.length,
    failedCount: result.failedFiles.length,
    dryRun,
  });

  return result;
}

/**
 * Cleans up orphaned files (files not referenced in database)
 * @param pool Database pool
 * @param options Cleanup options
 */
export async function cleanupOrphanedFiles(
  pool: Pool,
  options: FileCleanupOptions = {},
): Promise<FileCleanupResult> {
  const { transactionClient, dryRun = false } = options;
  const client = transactionClient || pool;
  const result: FileCleanupResult = {
    success: true,
    deletedFiles: [],
    failedFiles: [],
    dryRun,
  };

  logger.info('Starting orphaned file cleanup', { dryRun });

  try {
    // Get all files referenced in database
    const referencedFiles = new Set<string>();
    
    // Images
    const imagesResult = await client.query('SELECT storage_path, thumbnail_path FROM images WHERE storage_path IS NOT NULL');
    imagesResult.rows.forEach(row => {
      if (row.storage_path) referencedFiles.add(row.storage_path);
      if (row.thumbnail_path) referencedFiles.add(row.thumbnail_path);
    });

    // Segmentation results
    const segmentationResult = await client.query(`
      SELECT result_data->>'mask_path' as mask_path, 
             result_data->>'visualization_path' as visualization_path
      FROM segmentation_results 
      WHERE result_data IS NOT NULL
    `);
    segmentationResult.rows.forEach(row => {
      if (row.mask_path) referencedFiles.add(row.mask_path);
      if (row.visualization_path) referencedFiles.add(row.visualization_path);
    });

    // Scan upload directory for actual files
    const uploadDir = config.storage.uploadDir;
    const actualFiles = await getAllFilesRecursively(uploadDir);

    // Find orphaned files
    for (const filePath of actualFiles) {
      const relativePath = path.relative(uploadDir, filePath);
      const dbPath = imageUtils.normalizePathForDb(relativePath);
      
      if (!referencedFiles.has(dbPath)) {
        // Skip certain directories/files that should not be cleaned
        const skipPatterns = ['/temp/', '/processing/', '/logs/', '/backups/'];
        const shouldSkip = skipPatterns.some(pattern => filePath.includes(pattern));
        
        if (!shouldSkip) {
          if (dryRun) {
            result.deletedFiles.push(filePath);
          } else {
            try {
              fs.unlinkSync(filePath);
              result.deletedFiles.push(filePath);
            } catch (error) {
              result.failedFiles.push({
                path: filePath,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      }
    }

    logger.info('Orphaned file cleanup completed', {
      referencedCount: referencedFiles.size,
      actualCount: actualFiles.length,
      deletedCount: result.deletedFiles.length,
      failedCount: result.failedFiles.length,
      dryRun,
    });

  } catch (error) {
    logger.error('Error during orphaned file cleanup', { error });
    result.success = false;
  }

  return result;
}

/**
 * Recursively get all files in a directory
 */
async function getAllFilesRecursively(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...await getAllFilesRecursively(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Runs a scheduled cleanup of temporary and orphaned files
 * @param pool Database pool
 * @param options Cleanup configuration
 */
export async function runScheduledCleanup(
  pool: Pool,
  options: {
    tempFileMaxAgeHours?: number;
    cleanupOrphaned?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<void> {
  const {
    tempFileMaxAgeHours = 24,
    cleanupOrphaned = true,
    dryRun = false,
  } = options;

  logger.info('Starting scheduled file cleanup', { options });

  try {
    // Clean temporary files
    const tempResult = await cleanupTemporaryFiles(tempFileMaxAgeHours, { dryRun });
    logger.info('Temporary file cleanup completed', {
      deleted: tempResult.deletedFiles.length,
      failed: tempResult.failedFiles.length,
    });

    // Clean orphaned files if enabled
    if (cleanupOrphaned) {
      const orphanedResult = await cleanupOrphanedFiles(pool, { dryRun });
      logger.info('Orphaned file cleanup completed', {
        deleted: orphanedResult.deletedFiles.length,
        failed: orphanedResult.failedFiles.length,
      });
    }

    logger.info('Scheduled file cleanup completed successfully');
  } catch (error) {
    logger.error('Error during scheduled file cleanup', { error });
    throw error;
  }
}

export default {
  cleanupProjectFiles,
  cleanupTemporaryFiles,
  cleanupOrphanedFiles,
  runScheduledCleanup,
};
