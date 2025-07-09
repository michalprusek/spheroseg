/**
 * Project Duplication Service
 *
 * This service provides centralized functionality for duplicating projects
 * and their associated assets (images, thumbnails, segmentations, etc.)
 */

import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import logger from '@/utils/logger';
import pathUtils from '@/utils/pathUtils';

/**
 * Interface for project data
 */
export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Interface for image data
 */
export interface Image {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  storage_path: string;
  thumbnail_path?: string;
  width?: number;
  height?: number;
  metadata?: any;
  status?: string;
  segmentation_status?: string;
  segmentation_result_path?: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Interface for duplication options
 */
export interface DuplicationOptions {
  /** Whether to copy image files */
  copyFiles?: boolean;
  /** Whether to copy segmentation results */
  copySegmentations?: boolean;
  /** Custom title for the new project */
  newTitle?: string;
  /** Whether to reset image statuses to pending */
  resetStatus?: boolean;
  /** Base directory for file operations */
  baseDir?: string;
}

/**
 * Default duplication options
 */
const DEFAULT_OPTIONS: DuplicationOptions = {
  copyFiles: true,
  copySegmentations: false,
  resetStatus: true,
  baseDir: path.join(process.cwd(), 'public'),
};

/**
 * Duplicate a project and its associated assets
 *
 * @param pool Database connection pool
 * @param originalProjectId ID of the project to duplicate
 * @param userId ID of the user performing the duplication
 * @param options Duplication options
 * @returns The newly created project
 */
export async function duplicateProject(
  pool: Pool,
  originalProjectId: string,
  userId: string,
  options: DuplicationOptions = {}
): Promise<Project> {
  // Merge options with defaults
  const mergedOptions: DuplicationOptions = { ...DEFAULT_OPTIONS, ...options };

  // Get a client from the pool for transaction
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // 1. Fetch original project data
    const projectRes = await client.query(
      'SELECT title, description FROM projects WHERE id = $1 AND user_id = $2',
      [originalProjectId, userId]
    );

    if (projectRes.rows.length === 0) {
      throw new Error('Original project not found or access denied');
    }

    const originalProject = projectRes.rows[0];

    // 2. Create new project entry
    const newProjectTitle = mergedOptions.newTitle || `${originalProject.title} (Copy)`;
    const newProjectRes = await client.query(
      'INSERT INTO projects (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
      [userId, newProjectTitle, originalProject.description]
    );

    const newProject = newProjectRes.rows[0];

    // 3. Duplicate images
    await duplicateProjectImages(client, originalProjectId, newProject.id, userId, mergedOptions);

    // Commit transaction
    await client.query('COMMIT');

    return newProject;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error('Error duplicating project:', {
      error,
      originalProjectId,
      userId,
    });
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
}

/**
 * Duplicate images associated with a project
 *
 * @param client Database client
 * @param originalProjectId ID of the original project
 * @param newProjectId ID of the new project
 * @param userId ID of the user performing the duplication
 * @param options Duplication options
 */
async function duplicateProjectImages(
  client: PoolClient,
  originalProjectId: string,
  newProjectId: string,
  userId: string,
  options: DuplicationOptions
): Promise<void> {
  // Fetch images from the original project
  const imagesRes = await client.query(`SELECT * FROM images WHERE project_id = $1`, [
    originalProjectId,
  ]);

  const originalImages = imagesRes.rows;

  // Create directory for new project if it doesn't exist
  if (options.copyFiles) {
    const projectDir = path.join(options.baseDir || '', 'uploads', newProjectId);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
      logger.debug(`Created directory for new project: ${projectDir}`);
    }
  }

  // Duplicate each image
  for (const image of originalImages) {
    await duplicateImage(client, image, newProjectId, userId, options);
  }
}

/**
 * Duplicate a single image
 *
 * @param client Database client
 * @param originalImage Original image data
 * @param newProjectId ID of the new project
 * @param userId ID of the user performing the duplication
 * @param options Duplication options
 * @returns The newly created image
 */
async function duplicateImage(
  client: PoolClient,
  originalImage: Image,
  newProjectId: string,
  userId: string,
  options: DuplicationOptions
): Promise<Image> {
  try {
    // Generate new file paths
    const { newStoragePath, newThumbnailPath } = generateNewFilePaths(
      originalImage.storage_path,
      originalImage.thumbnail_path,
      newProjectId
    );

    // Copy files if needed
    if (options.copyFiles) {
      await copyImageFiles(originalImage.storage_path, newStoragePath, options.baseDir || '');

      if (originalImage.thumbnail_path && newThumbnailPath) {
        await copyImageFiles(originalImage.thumbnail_path, newThumbnailPath, options.baseDir || '');
      }
    }

    // Determine segmentation status and path
    let segmentationStatus = 'pending';
    let segmentationResultPath: string | null = null;

    if (
      options.copySegmentations &&
      !options.resetStatus &&
      originalImage.segmentation_status === 'completed' &&
      originalImage.segmentation_result_path
    ) {
      // Generate new segmentation result path
      const segmentationFileName = originalImage.segmentation_result_path.split('/').pop() || '';
      const newSegmentationPath = `/uploads/${newProjectId}/segmentation-${Date.now()}-${segmentationFileName}`;

      // Copy segmentation file
      if (options.copyFiles) {
        await copyImageFiles(
          originalImage.segmentation_result_path,
          newSegmentationPath,
          options.baseDir || ''
        );
      }

      segmentationStatus = 'completed';
      segmentationResultPath = newSegmentationPath;
    }

    // Create new image record
    const newImageRes = await client.query(
      `INSERT INTO images (
        project_id, user_id, name, storage_path, thumbnail_path,
        width, height, metadata, status, segmentation_status, segmentation_result_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        newProjectId,
        userId,
        `${originalImage.name} (Copy)`,
        newStoragePath,
        newThumbnailPath,
        originalImage.width,
        originalImage.height,
        originalImage.metadata,
        options.resetStatus ? 'pending' : originalImage.status,
        segmentationStatus,
        segmentationResultPath,
      ]
    );

    return newImageRes.rows[0];
  } catch (error) {
    logger.error('Error duplicating image:', {
      error,
      imageId: originalImage.id,
    });
    throw error;
  }
}

/**
 * Generate new file paths for duplicated image
 *
 * @param originalStoragePath Original storage path
 * @param originalThumbnailPath Original thumbnail path
 * @param newProjectId ID of the new project
 * @returns Object with new storage and thumbnail paths
 */
function generateNewFilePaths(
  originalStoragePath: string,
  originalThumbnailPath?: string,
  newProjectId?: string
): { newStoragePath: string; newThumbnailPath?: string } {
  // Generate timestamp and random suffix for uniqueness
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000000);

  // Extract filename from original path
  const originalFileName = originalStoragePath.split('/').pop() || '';
  const fileNameParts = originalFileName.split('.');
  const fileExtension = fileNameParts.pop() || 'png';
  const fileBaseName = fileNameParts.join('.');

  // Generate new storage path
  const newStoragePath = `/uploads/${newProjectId}/${fileBaseName}-copy-${timestamp}-${randomSuffix}.${fileExtension}`;

  // Generate new thumbnail path if original exists
  let newThumbnailPath;
  if (originalThumbnailPath) {
    const originalThumbName = originalThumbnailPath.split('/').pop() || '';
    const thumbNameParts = originalThumbName.split('.');
    const thumbExtension = thumbNameParts.pop() || 'png';
    const thumbBaseName = thumbNameParts.join('.');

    newThumbnailPath = `/uploads/${newProjectId}/thumb-${thumbBaseName}-copy-${timestamp}-${randomSuffix}.${thumbExtension}`;
  }

  return { newStoragePath, newThumbnailPath };
}

/**
 * Copy image files from source to target
 *
 * @param sourcePath Source path (relative to baseDir)
 * @param targetPath Target path (relative to baseDir)
 * @param baseDir Base directory
 */
async function copyImageFiles(
  sourcePath: string,
  targetPath: string,
  baseDir: string
): Promise<void> {
  try {
    // Normalize paths
    const normalizedSourcePath = sourcePath.startsWith('/') ? sourcePath.substring(1) : sourcePath;
    const normalizedTargetPath = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;

    // Create full paths
    const fullSourcePath = path.join(baseDir, normalizedSourcePath);
    const fullTargetPath = path.join(baseDir, normalizedTargetPath);

    // Create target directory if it doesn't exist
    const targetDir = path.dirname(fullTargetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Check if source file exists
    if (fs.existsSync(fullSourcePath)) {
      // Copy file
      fs.copyFileSync(fullSourcePath, fullTargetPath);
      logger.debug(`Copied file from ${fullSourcePath} to ${fullTargetPath}`);
    } else {
      logger.warn(`Source file not found: ${fullSourcePath}`);
    }
  } catch (error) {
    logger.error('Error copying file:', { error, sourcePath, targetPath });
    throw error;
  }
}

/**
 * Duplicate a project using HTTP API
 *
 * @param baseUrl Base URL of the API
 * @param projectId ID of the project to duplicate
 * @param token Authentication token
 * @param options Duplication options
 * @returns The newly created project
 */
export async function duplicateProjectViaApi(
  baseUrl: string,
  projectId: string,
  token: string,
  options: DuplicationOptions = {}
): Promise<any> {
  try {
    // Import axios dynamically to avoid server-side dependency
    const axios = await import('axios');

    // 1. Get project information
    const projectResponse = await axios.default.get(`${baseUrl}/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const project = projectResponse.data;
    logger.info(`Retrieved project information: ${project.title}`);

    // 2. Create new project
    const newTitle = options.newTitle || `${project.title} (Copy)`;
    const newProjectResponse = await axios.default.post(
      `${baseUrl}/projects`,
      {
        title: newTitle,
        description: project.description,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const newProject = newProjectResponse.data;
    logger.info(`Created new project: ${newProject.title} (ID: ${newProject.id})`);

    // 3. Get list of images from original project
    const imagesResponse = await axios.default.get(`${baseUrl}/projects/${projectId}/images`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const images = imagesResponse.data;
    logger.info(`Found ${images.length} images in original project`);

    // 4. Create directory for new project if needed
    if (options.copyFiles) {
      const uploadsDir = path.join(
        options.baseDir || process.cwd(),
        'public',
        'uploads',
        newProject.id
      );
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        logger.info(`Created directory for new project: ${uploadsDir}`);
      }
    }

    // 5. Copy images and create new records
    for (const image of images) {
      try {
        // Generate new file paths
        const { newStoragePath, newThumbnailPath } = generateNewFilePaths(
          image.storage_path,
          image.thumbnail_path,
          newProject.id
        );

        // Copy files if needed
        if (options.copyFiles) {
          await copyImageFiles(
            image.storage_path,
            newStoragePath,
            path.join(options.baseDir || process.cwd(), 'public')
          );

          if (image.thumbnail_path && newThumbnailPath) {
            await copyImageFiles(
              image.thumbnail_path,
              newThumbnailPath,
              path.join(options.baseDir || process.cwd(), 'public')
            );
          }
        }

        // Create new image record
        const newImageResponse = await axios.default.post(
          `${baseUrl}/projects/${newProject.id}/images`,
          {
            name: `${image.name} (Copy)`,
            storage_path: newStoragePath,
            thumbnail_path: newThumbnailPath,
            width: image.width,
            height: image.height,
            metadata: image.metadata,
            status: options.resetStatus ? 'pending' : image.status,
            segmentation_status: options.resetStatus ? 'pending' : image.segmentation_status,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        logger.info(`Created new image record: ${newImageResponse.data.name}`);
      } catch (imageError) {
        logger.error(`Error copying image ${image.id}:`, imageError);
      }
    }

    logger.info(`Project duplication completed. New project ID: ${newProject.id}`);
    return newProject;
  } catch (error) {
    logger.error('Error duplicating project via API:', error);
    throw error;
  }
}

export default {
  duplicateProject,
  duplicateProjectViaApi,
  generateNewFilePaths,
  copyImageFiles,
};
