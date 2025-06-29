import { PoolClient } from 'pg';
import { getPool } from '../db';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import imageUtils from '../utils/imageUtils.unified';
import config from '../config';
import { ApiError } from '../utils/ApiError';

// Type for delete image result
interface DeleteImageResult {
  imageId: string;
  success: boolean;
  error?: string;
}

// Type to track files for cleanup
interface ImageFilePaths {
  imageId: string;
  storageSize: bigint;
  storagePath: string | null;
  thumbnailPath: string | null;
}

/**
 * Delete a single image by ID, including all associated data and files
 *
 * Steps:
 * 1. Verify user permission and get file paths
 * 2. Begin transaction
 * 3. Delete segmentation results
 * 4. Delete the image record
 * 5. Update user storage quota
 * 6. Commit transaction
 * 7. Delete physical files
 *
 * @param imageId The ID of the image to delete
 * @param projectId The ID of the project containing the image
 * @param userId The ID of the user making the request
 * @returns Result of the deletion operation
 */
export async function deleteImage(imageId: string, projectId: string, userId: string): Promise<DeleteImageResult> {
  // Handle project ID with 'project-' prefix if not already handled by router
  if (projectId && projectId.startsWith('project-')) {
    projectId = projectId.substring(8);
    logger.debug('Removed project- prefix for deleteImage service', {
      originalId: `project-${projectId}`,
      cleanedId: projectId,
    });
  }
  const UPLOAD_DIR = config.storage.uploadDir;
  const pool = getPool();
  const client = await pool.connect();
  const result: DeleteImageResult = { imageId, success: false };
  let imageData: ImageFilePaths | null = null;

  try {
    // Step 1: Verify user owns the project and get image data
    const imageCheck = await client.query(
      `SELECT i.id, i.storage_path, i.thumbnail_path, i.file_size
       FROM images i JOIN projects p ON i.project_id = p.id
       WHERE i.id = $1 AND i.project_id = $2 AND p.user_id = $3`,
      [imageId, projectId, userId],
    );

    if (imageCheck.rows.length === 0) {
      throw new ApiError('Image not found or access denied', 404);
    }

    imageData = {
      imageId,
      storageSize: BigInt(imageCheck.rows[0].file_size || 0),
      storagePath: imageCheck.rows[0].storage_path,
      thumbnailPath: imageCheck.rows[0].thumbnail_path,
    };

    // Step 2: Begin transaction
    await client.query('BEGIN');

    // Step 3: Delete segmentation results
    await client.query('DELETE FROM segmentation_results WHERE image_id = $1', [imageId]);
    logger.debug('Deleted segmentation results', { imageId });

    // Step 4: Delete the image record from the database
    await client.query('DELETE FROM images WHERE id = $1', [imageId]);
    logger.debug('Deleted image from database', { imageId });

    // Step 5: Update user storage usage quota if column exists
    if (imageData.storageSize > 0n) {
      try {
        // Check if the storage_used_bytes column exists
        const checkColumnQuery = `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'storage_used_bytes'
        `;
        const columnCheck = await client.query(checkColumnQuery);

        if (columnCheck.rows.length > 0) {
          // Column exists, update it
          await client.query(
            'UPDATE users SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) - $1) WHERE id = $2',
            [imageData.storageSize.toString(), userId],
          );
          logger.debug('Updated user storage usage after deletion', {
            userId,
            subtractedBytes: imageData.storageSize.toString(),
          });
        }
      } catch (error) {
        // Log but continue - this shouldn't prevent the deletion
        logger.warn('Error updating storage usage after delete', { error });
      }
    }

    // Step 6: Commit transaction
    await client.query('COMMIT');
    logger.info('Image deletion transaction committed', { imageId });

    // Transaction successful, now set success to true
    result.success = true;

    // Step 7: Delete physical files (outside transaction)
    if (imageData.storagePath) {
      try {
        const storagePath = imageUtils.dbPathToFilesystemPath(imageData.storagePath, UPLOAD_DIR);
        await imageUtils.deleteFile(storagePath);
        logger.debug('Deleted image file', { path: storagePath });
      } catch (error) {
        logger.warn('Error deleting image file', {
          path: imageData.storagePath,
          error,
        });
        // Don't fail the operation if file deletion fails
      }
    }

    if (imageData.thumbnailPath) {
      try {
        const thumbnailPath = imageUtils.dbPathToFilesystemPath(imageData.thumbnailPath, UPLOAD_DIR);
        await imageUtils.deleteFile(thumbnailPath);
        logger.debug('Deleted thumbnail file', { path: thumbnailPath });
      } catch (error) {
        logger.warn('Error deleting thumbnail file', {
          path: imageData.thumbnailPath,
          error,
        });
        // Don't fail the operation if file deletion fails
      }
    }

    // Check if this was the last image in the project directory and clean up empty directory
    if (imageData.storagePath) {
      try {
        const storagePath = imageUtils.dbPathToFilesystemPath(imageData.storagePath, UPLOAD_DIR);
        const projectDir = path.dirname(storagePath);

        const remainingFiles = await imageUtils.getFilesInDirectory(projectDir);
        if (remainingFiles.length === 0) {
          // Directory is empty, try to remove it
          fs.rmdirSync(projectDir);
          logger.debug('Removed empty project directory after last image deletion', { projectDir });
        }
      } catch (error) {
        logger.warn('Error checking/removing empty project directory', {
          error,
        });
        // Don't fail the operation if directory cleanup fails
      }
    }
  } catch (error) {
    // Handle transaction rollback
    try {
      await client.query('ROLLBACK');
      logger.error('Image deletion transaction rolled back', {
        imageId,
        error,
      });
    } catch (rollbackError) {
      logger.error('Error rolling back transaction', { rollbackError });
    }

    if (error instanceof ApiError) {
      result.error = error.message;
    } else {
      result.error = 'Failed to delete image: Internal server error';
      logger.error('Unexpected error during image deletion', {
        imageId,
        projectId,
        error,
      });
    }
  } finally {
    client.release();
    logger.debug('Database client released', { imageId });
  }

  return result;
}

/**
 * Delete multiple images at once
 *
 * @param imageIds Array of image IDs to delete
 * @param projectId The ID of the project containing the images
 * @param userId The ID of the user making the request
 * @returns Results of the deletion operations
 */
export async function deleteMultipleImages(
  imageIds: string[],
  projectId: string,
  userId: string,
): Promise<DeleteImageResult[]> {
  logger.info('Batch image deletion started', {
    imageCount: imageIds.length,
    projectId,
  });

  // Process each image deletion individually
  const results: DeleteImageResult[] = [];

  for (const imageId of imageIds) {
    try {
      const result = await deleteImage(imageId, projectId, userId);
      results.push(result);
    } catch (error) {
      // If one image fails, continue with the others
      results.push({
        imageId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Batch image deletion completed', {
    totalImages: imageIds.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
  });

  return results;
}

/**
 * Check if an image can be deleted
 * This performs validation only and doesn't actually delete anything
 *
 * @param imageId The ID of the image to check
 * @param projectId The ID of the project containing the image
 * @param userId The ID of the user making the request
 * @returns True if the image can be deleted
 */
export async function canDeleteImage(imageId: string, projectId: string, userId: string): Promise<boolean> {
  try {
    const pool = getPool();
    // Check if user owns the project and the image exists in it
    const imageCheck = await pool.query(
      `SELECT i.id
       FROM images i JOIN projects p ON i.project_id = p.id
       WHERE i.id = $1 AND i.project_id = $2 AND p.user_id = $3`,
      [imageId, projectId, userId],
    );

    return imageCheck.rows.length > 0;
  } catch (error) {
    logger.error('Error checking if image can be deleted', {
      imageId,
      projectId,
      error,
    });
    return false;
  }
}

export default {
  deleteImage,
  deleteMultipleImages,
  canDeleteImage,
};
