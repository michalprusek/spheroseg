import express, { Request, Response, Router, NextFunction } from 'express';
import { getPool } from '../db';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';;
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PoolClient } from 'pg';
import { validate } from '../middleware/validationMiddleware';
import {
  uploadImagesSchema,
  listImagesSchema,
  imageDetailSchema,
  imageIdSchema,
  deleteImageSchema,
  batchDeleteImagesSchema,
} from '../validators/imageValidators';
import imageDeleteService from '../services/imageDeleteService';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import imageUtils from '../utils/imageUtils.unified';
import { ImageData } from '../utils/imageUtils';
import config from '../config';

// Type definition for multer request with params
interface MulterRequest extends Express.Request {
  params: {
    projectId?: string;
    [key: string]: string | undefined;
  };
}

// Using ImageData interface imported from imageUtils.ts

const router: Router = express.Router();

/**
 * Helper function to format image data and send the response
 *
 * This function:
 * 1. Formats image paths with the origin for client-side use
 * 2. Verifies that the image file exists on the filesystem
 * 3. Sends the formatted image data as a JSON response
 *
 * If the image file doesn't exist, it throws an ApiError with a 404 status code.
 *
 * @param image The image data from the database
 * @param req The request object
 * @param res The response object
 * @throws {ApiError} If the image file doesn't exist on the filesystem
 */
async function formatAndSendImage(image: ImageData, req: Request, res: Response) {
  // Format image paths with origin
  const origin = req.get('origin') || config.baseUrl;
  const imageData = imageUtils.formatImageForApi(image, origin);
  // Verification is handled by verifyImageFiles now, or skipped based on query param
  res.json(imageData);
}

/**
 * Multer Configuration for Local Storage
 *
 * This configuration:
 * - Sets up a local directory for storing uploaded files
 * - Creates project-specific subdirectories for organization
 * - Generates unique filenames to prevent conflicts
 * - Limits file size to 50MB
 *
 * The upload directory is relative to the server root, not the source directory.
 * This is important for Docker deployments where the compiled code is in a different location.
 */
const UPLOAD_DIR = config.storage.uploadDir;

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info('Created upload directory', { path: UPLOAD_DIR });
  } else {
    logger.debug('Upload directory already exists', { path: UPLOAD_DIR });
  }
} catch (error) {
  logger.error('Error creating upload directory', { path: UPLOAD_DIR, error });
}

/**
 * Multer disk storage configuration
 *
 * Handles two key aspects of file uploads:
 * 1. Destination: Where to store the uploaded files
 *    - Creates project-specific subdirectories
 *    - Creates directories if they don't exist
 *
 * 2. Filename: How to name the uploaded files
 *    - Preserves the original file extension
 *    - Adds a timestamp and random number to ensure uniqueness
 *    - Uses the field name as a prefix for organization
 */
const storage = multer.diskStorage({
  destination: function (
    req: MulterRequest,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) {
    // Store files in a subdirectory based on project ID
    const projectId = req.params.projectId;
    if (!projectId) {
      return cb(new Error('Project ID missing for upload destination'), '');
    }

    // No need to handle project- prefix anymore as it's been removed from the frontend

    const projectUploadDir = path.join(UPLOAD_DIR, projectId);
    if (!fs.existsSync(projectUploadDir)) {
      fs.mkdirSync(projectUploadDir, { recursive: true });
      logger.debug('Created project upload directory', {
        path: projectUploadDir,
      });
    }
    cb(null, projectUploadDir);
  },
  filename: function (
    _req: MulterRequest,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) {
    // Keep original filename + add timestamp to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // Increased limit to 200MB
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/tif',
      'image/bmp',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, TIFF, and BMP are allowed.'));
    }
  },
});
// --- End Multer Configuration ---

// Helper function for processing a single image
async function processAndStoreImage(
  file: Express.Multer.File,
  projectId: string,
  userId: string,
  client: PoolClient,
): Promise<ImageData> {
  let thumbnailPath = null;
  let width = null;
  let height = null;
  let finalStoragePath = file.path; // Path to be stored in DB, potentially converted
  const cleanupPaths = [file.path]; // All files to clean up in case of error

  try {
    logger.debug('Processing uploaded file', {
      filename: file.originalname,
      path: file.path,
      mimetype: file.mimetype,
    });

    // Check if file exists
    const fileExists = await imageUtils.fileExists(file.path);
    if (!fileExists) {
      logger.error('Uploaded file missing from filesystem', {
        path: file.path,
      });
      throw new ApiError(`Uploaded file missing from filesystem: ${file.originalname}`, 500);
    }

    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isTiff = fileExtension === '.tiff' || fileExtension === '.tif';
    const isBmp = fileExtension === '.bmp';
    const needsConversion = isTiff || isBmp;

    let sourcePathForThumbnail = file.path; // Path to use for metadata and thumbnail generation

    if (needsConversion) {
      // Generate a new filename for the converted PNG
      const baseFilename = path.basename(file.filename, path.extname(file.filename));
      const convertedPngFilename = `${baseFilename}.png`;
      const convertedPngPath = path.join(path.dirname(file.path), convertedPngFilename);
      cleanupPaths.push(convertedPngPath); // Add converted file to cleanup list

      const formatName = isTiff ? 'TIFF' : 'BMP';
      logger.debug(`Converting ${formatName} to web-friendly PNG`, {
        source: file.path,
        target: convertedPngPath,
      });

      await imageUtils.convertTiffToWebFriendly(file.path, convertedPngPath);
      finalStoragePath = convertedPngPath; // Update the path to be stored in DB
      sourcePathForThumbnail = convertedPngPath; // Use converted PNG for thumbnail
      logger.debug(`${formatName} converted to PNG successfully`, { path: finalStoragePath });
    }

    // Generate thumbnail filename - always use .png extension since thumbnails are saved as PNG
    const baseFilename = path.basename(file.filename, path.extname(file.filename));
    const thumbnailFilename = `thumb-${baseFilename}.png`;
    thumbnailPath = path.join(path.dirname(file.path), thumbnailFilename);
    cleanupPaths.push(thumbnailPath);
    logger.debug('Generating thumbnail', { path: thumbnailPath });

    // Get image metadata from the original file (or the converted JPEG if it's the source for metadata)
    const metadata = await imageUtils.getImageMetadata(sourcePathForThumbnail);
    width = metadata.width;
    height = metadata.height;
    logger.debug('Image metadata extracted', {
      width,
      height,
      format: metadata.format,
    });

    // Generate thumbnail from the original file (or the converted JPEG)
    await imageUtils.createThumbnail(sourcePathForThumbnail, thumbnailPath, {
      width: 200,
      height: 200,
    });
    logger.debug('Thumbnail generated successfully', { path: thumbnailPath });
  } catch (error) {
    const processError = error as Error;
    logger.error('Failed to process image or generate thumbnail', {
      filename: file.originalname,
      error: {
        message: processError.message,
        name: processError.name,
        stack: processError.stack,
      },
      mimetype: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      ext: path.extname(file.originalname).toLowerCase(),
    });

    // Clean up any created files
    for (const filePath of cleanupPaths) {
      try {
        await imageUtils.deleteFile(filePath);
        logger.debug('Cleaned up file after processing error', {
          path: filePath,
        });
      } catch (deleteError) {
        logger.error('Failed to cleanup file after processing error', {
          path: filePath,
          error: deleteError,
        });
      }
    }

    throw new ApiError(
      `Failed to process image: ${file.originalname} - ${processError.message || 'Unknown error'}`,
      500,
    );
  }

  // Normalize paths for database storage
  // Use finalStoragePath for the main image path
  const relativePath = imageUtils.normalizePathForDb(finalStoragePath, UPLOAD_DIR);
  const relativeThumbnailPath = thumbnailPath ? imageUtils.normalizePathForDb(thumbnailPath, UPLOAD_DIR) : null;

  logger.debug('Storing paths in database', {
    originalFilePath: file.path, // Original uploaded file path
    finalStoragePath, // Path actually stored on disk for display (might be converted)
    relativePath, // Relative path for DB
    originalThumbnailPath: thumbnailPath,
    relativeThumbnailPath,
  });

  // Insert image record into database
  // Make sure userId is a valid UUID
  if (!userId || typeof userId !== 'string' || userId === 'NaN') {
    logger.error('Invalid user ID for image upload', { userId });
    throw new ApiError(`Invalid user ID: ${userId}`, 400);
  }

  const userIdStr = String(userId);
  if (!userIdStr.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    logger.error('Invalid user ID format for image upload', { userId });
    throw new ApiError(`Invalid user ID format: ${userId}`, 400);
  }

  // Make sure projectId is a valid UUID
  if (!projectId || typeof projectId !== 'string') {
    logger.error('Invalid project ID for image upload', { projectId });
    throw new ApiError(`Invalid project ID: ${projectId}`, 400);
  }

  const projectIdStr = String(projectId);
  if (!projectIdStr.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    logger.error('Invalid project ID format for image upload', { projectId });
    throw new ApiError(`Invalid project ID format: ${projectId}`, 400);
  }

  const imageResult = await client.query(
    'INSERT INTO images (project_id, user_id, name, storage_filename, storage_path, thumbnail_path, width, height, metadata, file_size) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
    [
      projectIdStr, // Use validated UUID string
      userIdStr, // Use validated UUID string
      file.originalname,
      path.basename(finalStoragePath), // Use the filename of the *final* stored image
      relativePath,
      relativeThumbnailPath,
      width || 0,
      height || 0,
      { originalSize: file.size, originalFormat: file.mimetype }, // Store original size and format
      // If TIFF was converted, we store the size of the converted JPEG, not the original TIFF
      (await fs.promises.stat(finalStoragePath)).size,
    ],
  );

  return imageResult.rows[0];
}

/**
 * POST /api/projects/:projectId/images - Upload one or more images to a project
 *
 * This route:
 * 1. Authenticates the user
 * 2. Validates the request parameters
 * 3. Uploads the image files to the project directory
 * 4. Processes the images (generates thumbnails, extracts metadata)
 * 5. Stores the image information in the database
 * 6. Returns the created image records
 *
 * Error handling:
 * - Cleans up any uploaded files if an error occurs
 * - Validates project ownership
 * - Handles missing files
 * - Handles image processing errors
 */
router.post(
  '/:projectId/images',
  authMiddleware,
  validate(uploadImagesSchema),
  (req: any, res: any, next: any) => {
    logger.info('Upload endpoint hit - before multer', {
      projectId: req.params.projectId,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
    });
    next();
  },
  upload.array('images', 20), // Zvýšíme limit na 20 obrázků najednou
  (req: any, res: any, next: any) => {
    logger.info('Upload endpoint - after multer', {
      filesReceived: req.files?.length || 0,
      files: req.files?.map((f: any) => ({ name: f.originalname, size: f.size })),
    });
    next();
  },
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Validate user ID
    const requestingUserId = req.user?.userId;
    if (!requestingUserId || typeof requestingUserId !== 'string') {
      logger.error('User ID not found in authenticated request', {
        userId: requestingUserId,
      });
      throw new ApiError('User ID not found in authenticated request', 500);
    }

    // Log user ID for debugging
    logger.debug('Processing image upload request', {
      userId: requestingUserId,
    });

    const { projectId } = req.params;

    // No need to handle project- prefix anymore as it's been removed from the frontend
    const originalProjectId = projectId;

    const files = req.files as Express.Multer.File[];
    logger.debug('Files received in upload request', {
      count: files?.length || 0,
      projectId,
      originalProjectId,
      files: files?.map((f) => ({
        name: f.originalname,
        size: f.size,
        path: f.path,
      })),
    });

    const allUploadedFilePaths = files ? files.map((f) => f.path) : [];

    try {
      // --- Storage Limit Check --- START
      // Get default limit from config - 10GB if not specified
      const defaultLimitBytes = config.storage.defaultUserLimitBytes || 10737418240;

      // First check if storage columns exist in the users table
      let storageLimitBytes = BigInt(defaultLimitBytes);
      let storageUsedBytes = BigInt(0);

      try {
        const storageInfoRes = await pool.query(
          'SELECT storage_limit_bytes, storage_used_bytes FROM users WHERE id = $1',
          [requestingUserId],
        );

        if (storageInfoRes.rows.length === 0) {
          logger.warn('User not found for storage check, using defaults', {
            userId: requestingUserId,
          });
        } else {
          // Use values from database if columns exist
          storageLimitBytes = BigInt(storageInfoRes.rows[0].storage_limit_bytes || defaultLimitBytes);
          storageUsedBytes = BigInt(storageInfoRes.rows[0].storage_used_bytes || 0);
        }
      } catch (error) {
        // If columns don't exist yet, use defaults
        logger.warn('Error getting storage info, using defaults', { error });
      }

      let incomingTotalSizeBytes = 0n;
      if (files && files.length > 0) {
        incomingTotalSizeBytes = files.reduce((sum, file) => sum + BigInt(file.size), 0n);
      }

      if (storageUsedBytes + incomingTotalSizeBytes > storageLimitBytes) {
        // Clean up uploaded files immediately if limit exceeded
        if (files) {
          files.forEach((file) => {
            fs.unlink(file.path, (err) => {
              if (err)
                logger.error('Failed to clean up file after storage limit exceeded', { path: file.path, error: err });
            });
          });
        }
        const limitMB = Number(storageLimitBytes / (1024n * 1024n));
        const usedMB = Number(storageUsedBytes / (1024n * 1024n));
        const incomingMB = Number(incomingTotalSizeBytes / (1024n * 1024n));
        const availableMB = limitMB - usedMB;

        throw new ApiError(
          `Storage limit exceeded. Limit: ${limitMB} MB, Used: ${usedMB.toFixed(2)} MB, Incoming: ${incomingMB.toFixed(2)} MB. Available: ${availableMB.toFixed(2)} MB.`,
          413, // Payload Too Large
        );
      }
      // --- Storage Limit Check --- END

      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        requestingUserId,
      ]);

      if (projectCheck.rows.length === 0) {
        if (files) files.forEach((file) => allUploadedFilePaths.push(file.path));
        next(new ApiError('Project not found or access denied', 404));
        return;
      }

      if (!files || files.length === 0) {
        res.status(400).json({ message: 'No image files provided' });
        return;
      }

      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        logger.debug('Transaction started for image upload', { projectId });

        // Přímo použijeme requestingUserId jako string (UUID)
        const processingPromises = files.map((file) => processAndStoreImage(file, projectId, requestingUserId, client));

        const insertedImages = await Promise.all(processingPromises);

        insertedImages.forEach((img) => {
          if (img.thumbnail_path) {
            const absoluteThumbnailPath = path.join(UPLOAD_DIR, img.thumbnail_path);
            if (!allUploadedFilePaths.includes(absoluteThumbnailPath)) {
              allUploadedFilePaths.push(absoluteThumbnailPath);
            }
          }
        });

        await client.query('COMMIT');
        logger.debug('Transaction committed for image upload', {
          projectId,
          imagesCount: insertedImages.length,
        });

        // --- Update User Storage Usage (Outside Transaction) --- START
        // It's generally safer to update the aggregate count *after* the main transaction succeeds.
        // Calculate the total size of *successfully* processed and inserted images.
        const successfullyUploadedSize = insertedImages.reduce((sum, img) => sum + BigInt(img.file_size || 0), 0n);

        if (successfullyUploadedSize > 0n) {
          try {
            // First check if the storage_used_bytes column exists
            const checkColumnQuery = `
                            SELECT column_name
                            FROM information_schema.columns
                            WHERE table_name = 'users' AND column_name = 'storage_used_bytes'
                        `;
            const columnCheck = await pool.query(checkColumnQuery);

            if (columnCheck.rows.length > 0) {
              // Column exists, update it
              await pool.query(
                'UPDATE users SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + $1 WHERE id = $2',
                [successfullyUploadedSize.toString(), requestingUserId],
              );
              logger.info('User storage usage updated successfully', {
                userId: requestingUserId,
                addedBytes: successfullyUploadedSize.toString(),
              });
            } else {
              // Column doesn't exist yet, no update needed
              logger.info('Storage columns not yet available, storage tracking skipped');
            }
          } catch (storageUpdateError) {
            // Log this error but don't fail the request, as the images are already saved.
            // This could potentially lead to slight inaccuracies in reported usage if this fails repeatedly.
            logger.error('Failed to update user storage usage after successful upload', {
              userId: requestingUserId,
              addedBytes: successfullyUploadedSize.toString(),
              error: storageUpdateError,
            });
          }
        }
        // --- Update User Storage Usage --- END

        // Format results before sending
        const origin = req.get('origin') || config.baseUrl;
        const formattedImages = insertedImages.map((img) => imageUtils.formatImageForApi(img, origin));

        res.status(201).json(formattedImages);
      } catch (transactionError) {
        await client.query('ROLLBACK');
        logger.error('Transaction rolled back due to error', {
          projectId,
          error: transactionError,
        });

        throw transactionError;
      } finally {
        client.release();
        logger.debug('Database client released', { projectId });
      }
    } catch (error) {
      logger.error('Error uploading images', { 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        projectId,
        filesCount: files?.length || 0,
        userId: requestingUserId
      });
      allUploadedFilePaths.forEach((filePath) => {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            logger.debug('Cleaned up file after global error', {
              path: filePath,
            });
          } catch (unlinkErr) {
            logger.error('Failed to cleanup file after global error', {
              path: filePath,
              error: unlinkErr,
            });
          }
        }
      });
      next(error);
    }
  },
);

/**
 * DELETE /api/projects/:projectId/images/:imageId - Delete a specific image in a project
 *
 * This route:
 * 1. Authenticates the user
 * 2. Verifies project ownership
 * 3. Deletes the image from the database
 * 4. Deletes the image and thumbnail files from the filesystem
 *
 * Error handling:
 * - Returns 404 if project not found or user doesn't have access
 * - Returns 404 if image not found in the project
 */
router.delete(
  '/:projectId/images/:imageId',
  authMiddleware,
  validate(deleteImageSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId } = req.params;
    const imageId = req.params.imageId;

    // No need to handle project- prefix anymore as it's been removed from the frontend
    const originalProjectId = projectId;

    logger.info('Image deletion request received', {
      userId,
      projectId,
      originalProjectId,
      imageId,
    });

    // Check if imageId is a frontend-generated ID (not a UUID)
    if (imageId.startsWith('img-')) {
      logger.warn('Attempting to delete frontend-generated image ID', {
        imageId,
        projectId,
        userId,
      });
      
      // Try to find the actual image by name or storage_filename pattern
      try {
        const imageRes = await pool.query(
          `SELECT i.id, i.storage_filename, i.name FROM images i 
           WHERE i.project_id = $1 
           AND (i.storage_filename LIKE $2 OR i.name LIKE $3)
           ORDER BY i.created_at DESC
           LIMIT 1`,
          [projectId, `%${imageId}%`, `%${imageId}%`]
        );
        
        if (imageRes.rows.length > 0) {
          const actualImageId = imageRes.rows[0].id;
          logger.info('Found actual image ID for frontend-generated ID', {
            frontendId: imageId,
            actualId: actualImageId,
            filename: imageRes.rows[0].storage_filename,
            name: imageRes.rows[0].name
          });
          
          // Use the actual ID for deletion
          const result = await imageDeleteService.deleteImage(actualImageId, projectId, userId!);
          
          if (!result.success) {
            if (result.error?.includes('not found') || result.error?.includes('access denied')) {
              logger.warn('Image deletion denied', {
                projectId,
                imageId: actualImageId,
                error: result.error,
              });
              return res.status(404).json({ message: result.error });
            }
            logger.error('Failed to delete image', {
              projectId,
              imageId: actualImageId,
              error: result.error,
            });
            return res.status(500).json({ message: result.error || 'Failed to delete image' });
          }
          
          // Return success with no content
          return res.status(204).send();
        }
      } catch (lookupError) {
        logger.error('Error looking up image by frontend ID', {
          frontendId: imageId,
          projectId,
          error: lookupError
        });
      }
      
      return res.status(404).json({
        error: 'ImageNotFound',
        message: 'Image with this ID does not exist in the database',
      });
    }

    try {
      // Use the service to delete the image
      if (!userId) {
        throw new Error('User ID is required');
      }
      const result = await imageDeleteService.deleteImage(imageId, projectId, userId);

      if (!result.success) {
        if (result.error?.includes('not found') || result.error?.includes('access denied')) {
          logger.warn('Image deletion denied', {
            projectId,
            originalProjectId,
            imageId,
            error: result.error,
          });
          return res.status(404).json({ message: result.error });
        }
        logger.error('Failed to delete image', {
          projectId,
          originalProjectId,
          imageId,
          error: result.error,
        });
        return res.status(500).json({ message: result.error || 'Failed to delete image' });
      }

      // Return success with no content
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting image', { 
        projectId, 
        imageId, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      next(error);
    }
  },
);

// POST /api/projects/:projectId/images/upload-batch - Upload multiple images to a project in a batch
router.post(
  '/:projectId/images/upload-batch',
  authMiddleware,
  upload.array('images', 50),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Forward to the main image upload endpoint
    req.url = `/projects/${req.params.projectId}/images`;
    return router(req, res, next);
  },
);

// DELETE /api/projects/:projectId/images/:imageId - Delete an image from a project
// This is a duplicate route, the validated version is defined above at line 475

// Legacy route for backward compatibility - will be deprecated
router.delete(
  '/:id',
  authMiddleware,
  validate(imageIdSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const imageId = req.params.id;

    logger.warn('Using deprecated route', {
      route: '/:id',
      method: 'DELETE',
      imageId,
    });

    if (!userId) {
      return res.status(401).json({ message: 'Authentication error' });
    }

    // Check if imageId is a frontend-generated ID (not a UUID)
    if (imageId.startsWith('img-')) {
      logger.warn('Attempting to delete frontend-generated image ID via legacy route', {
        imageId,
        userId,
      });
      
      // Try to find the actual image by storage_filename pattern
      try {
        const imageRes = await pool.query(
          `SELECT i.id, i.project_id, i.storage_filename, i.name 
           FROM images i 
           JOIN projects p ON i.project_id = p.id
           WHERE p.user_id = $1
           AND (i.storage_filename LIKE $2 OR i.name LIKE $3)
           ORDER BY i.created_at DESC
           LIMIT 1`,
          [userId, `%${imageId}%`, `%${imageId}%`]
        );
        
        if (imageRes.rows.length > 0) {
          const actualImageId = imageRes.rows[0].id;
          const projectId = imageRes.rows[0].project_id;
          
          logger.info('Found actual image ID for frontend-generated ID (legacy route)', {
            frontendId: imageId,
            actualId: actualImageId,
            projectId: projectId,
            filename: imageRes.rows[0].storage_filename,
            name: imageRes.rows[0].name
          });
          
          // Use the service to delete the image
          const result = await imageDeleteService.deleteImage(actualImageId, projectId, userId!);
          
          if (!result.success) {
            logger.error('Deprecated route: Failed to delete image', {
              imageId: actualImageId,
              error: result.error,
            });
            return res.status(500).json({
              error: 'DeletionFailed',
              message: result.error || 'Could not delete image',
            });
          }
          
          // Return success with no content
          return res.status(204).send();
        }
      } catch (lookupError) {
        logger.error('Error looking up image by frontend ID (legacy route)', {
          frontendId: imageId,
          error: lookupError
        });
      }
      
      return res.status(404).json({
        error: 'ImageNotFound',
        message: 'Image with this ID does not exist in the database',
      });
    }

    try {
      // First, find which project this image belongs to
      const imageRes = await pool.query(
        'SELECT i.id, i.project_id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId],
      );

      if (imageRes.rows.length === 0) {
        return res.status(404).json({ message: 'Image not found or access denied' });
      }

      const projectId = imageRes.rows[0].project_id;

      // Use the service to delete the image
      const result = await imageDeleteService.deleteImage(imageId, projectId, userId);

      if (!result.success) {
        logger.error('Deprecated route: Failed to delete image', {
          imageId,
          error: result.error,
        });
        return res.status(500).json({
          error: 'DeletionFailed',
          message: result.error || 'Could not delete image',
        });
      }

      // Return success with no content
      res.status(204).send();
    } catch (error) {
      logger.error('Error in deprecated delete route', { imageId, error });
      res.status(500).json({
        error: 'DeletionFailed',
        message: 'Could not delete image',
      });
    }
  },
);

/**
 * GET /api/projects/:projectId/images/:imageId - Get a specific image in a project
 *
 * This route:
 * 1. Authenticates the user
 * 2. Verifies project ownership
 * 3. Finds the image by ID or name
 * 4. Formats the image data for the response
 * 5. Verifies the image file exists
 * 6. Returns the image data
 *
 * The route supports finding images by:
 * - UUID (primary method)
 * - Name in path parameter (fallback)
 * - Name in query parameter (additional fallback)
 *
 * Error handling:
 * - Returns 404 if project not found or user doesn't have access
 * - Returns 404 if image not found
 * - Returns 404 if image file doesn't exist on the filesystem
 */
router.get(
  '/:projectId/images/:imageId',
  authMiddleware,
  validate(imageDetailSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    let { projectId } = req.params;
    const imageId = req.params.imageId;

    // Handle project IDs with "project-" prefix
    const originalProjectId = projectId;
    if (projectId.startsWith('project-')) {
      projectId = projectId.substring(8); // Remove "project-" prefix for database query
      logger.debug('Removed project- prefix for database query', {
        originalId: originalProjectId,
        cleanedId: projectId,
      });
    }

    logger.info('Image detail request received', {
      userId,
      projectId,
      originalProjectId,
      imageId,
    });

    try {
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

      if (projectCheck.rows.length === 0) {
        logger.warn('Project access denied', {
          projectId,
          originalProjectId,
          userId,
        });
        throw new ApiError('Project not found or access denied', 404);
      }

      const imageResult = await pool.query(
        `SELECT 
          i.*,
          COALESCE(sr.status, i.segmentation_status, 'pending') as segmentationStatus,
          sr.id as segmentation_id
        FROM images i
        LEFT JOIN segmentation_results sr ON i.id = sr.image_id
        WHERE i.id = $1 AND i.project_id = $2`,
        [imageId, projectId]
      );

      if (imageResult.rows.length === 0) {
        logger.warn('Image not found in project', { imageId, projectId });
        throw new ApiError('Image not found in this project', 404);
      }

      return formatAndSendImage(imageResult.rows[0], req, res);
    } catch (error) {
      logger.error('Error fetching image', {
        imageId,
        projectId,
        error,
      });
      next(error);
    }
  },
);

/**
 * GET /api/projects/:projectId/images - Get images in a project with optional name filter
 *
 * This route:
 * 1. Authenticates the user
 * 2. Verifies project ownership
 * 3. Retrieves all images for the project
 * 4. Optionally filters by name if query parameter is provided
 * 5. Formats the image data for the response
 * 6. Returns the list of images
 *
 * The images are sorted by creation date in descending order (newest first).
 *
 * Error handling:
 * - Returns 404 if project not found or user doesn't have access
 */
router.get(
  '/:projectId/images',
  authMiddleware,
  validate(listImagesSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId } = req.params;
    const { name } = req.query;

    // No need to handle project- prefix anymore as it's been removed from the frontend
    const originalProjectId = projectId;

    logger.info('Image list request received', {
      userId,
      projectId,
      originalProjectId,
      nameFilter: name || undefined,
    });

    try {
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

      if (projectCheck.rows.length === 0) {
        logger.warn('Project access denied', {
          projectId,
          originalProjectId,
          userId,
        });
        throw new ApiError('Project not found or access denied', 404);
      }

      const imageResult = await pool.query(
        name
          ? `SELECT 
              i.*,
              COALESCE(sr.status, i.segmentation_status, 'pending') as "segmentationStatus",
              sr.id as segmentation_id
            FROM images i
            LEFT JOIN segmentation_results sr ON i.id = sr.image_id
            WHERE i.project_id = $1 AND i.name = $2 
            ORDER BY i.created_at DESC`
          : `SELECT 
              i.*,
              COALESCE(sr.status, i.segmentation_status, 'pending') as "segmentationStatus",
              sr.id as segmentation_id
            FROM images i
            LEFT JOIN segmentation_results sr ON i.id = sr.image_id
            WHERE i.project_id = $1 
            ORDER BY i.created_at DESC`,
        name ? [projectId, name] : [projectId],
      );

      logger.debug('Image query results', { count: imageResult.rows.length });

      // Debug: Check what fields are actually returned
      if (imageResult.rows.length > 0) {
        const firstImage = imageResult.rows[0];
        logger.debug('First image fields from query:', {
          hasSegmentationStatus: 'segmentationStatus' in firstImage,
          hasSegmentation_status: 'segmentation_status' in firstImage,
          segmentationStatus: firstImage.segmentationStatus,
          segmentation_status: firstImage.segmentation_status,
        });
      }

      const verifyFiles = req.query.verifyFiles === 'true';

      const origin = req.get('origin') || '';
      let processedImages = imageResult.rows.map((image: ImageData) => imageUtils.formatImageForApi(image, origin));

      if (verifyFiles) {
        logger.debug('Verifying file existence for images', {
          count: processedImages.length,
        });
        processedImages = processedImages.map((image) => imageUtils.verifyImageFilesForApi(image, UPLOAD_DIR));

        const filterMissing = req.query.filterMissing === 'true';
        if (filterMissing) {
          logger.debug('Filtering out images with missing files');
          processedImages = processedImages.filter((image) => image.file_exists);
          logger.debug('Images after filtering', {
            count: processedImages.length,
          });
        }
      }

      res.status(200).json(processedImages);
    } catch (error) {
      logger.error('Error fetching images', {
        projectId,
        nameFilter: name || undefined,
        error,
      });
      next(error);
    }
  },
);

/**
 * GET /api/projects/:projectId/images/:imageId/verify - Verify image file existence
 *
 * This route:
 * 1. Authenticates the user
 * 2. Verifies project ownership
 * 3. Checks if the image exists in the database
 * 4. Verifies that the image file exists on the filesystem
 * 5. Returns the verification result
 *
 * Error handling:
 * - Returns 404 if project not found or user doesn't have access
 * - Returns 404 if image not found in the project
 * - Returns 200 with exists:false if the file doesn't exist on the filesystem
 */
router.get(
  '/:projectId/images/:imageId/verify',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId } = req.params;
    const imageId = req.params.imageId;

    // No need to handle project- prefix anymore as it's been removed from the frontend
    const originalProjectId = projectId;

    logger.info('Image verification request received', {
      userId,
      projectId,
      originalProjectId,
      imageId,
    });

    try {
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

      if (projectCheck.rows.length === 0) {
        logger.warn('Project access denied', {
          projectId,
          originalProjectId,
          userId,
        });
        throw new ApiError('Project not found or access denied', 404);
      }

      const imageResult = await pool.query('SELECT id, storage_path FROM images WHERE id = $1 AND project_id = $2', [
        imageId,
        projectId,
      ]);

      if (imageResult.rows.length === 0) {
        logger.warn('Image not found in project', { imageId, projectId });
        throw new ApiError('Image not found in this project', 404);
      }

      const storagePath = imageResult.rows[0].storage_path;
      const fullPath = imageUtils.dbPathToFilesystemPath(storagePath, UPLOAD_DIR);
      const exists = fs.existsSync(fullPath);

      logger.debug('Image verification result', {
        imageId,
        projectId,
        storagePath,
        fullPath,
        exists,
      });

      res.json({
        exists,
        path: fullPath,
        message: exists ? 'File exists' : 'File not found',
      });
    } catch (error) {
      logger.error('Image verification error', { projectId, imageId, error });
      next(error);
    }
  },
);

// Legacy route for backward compatibility - will be deprecated
router.get('/verify/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const imageId = req.params.id;

  logger.warn('Using deprecated route', {
    route: '/verify/:id',
    method: 'GET',
    imageId,
  });

  try {
    const imageResult = await pool.query(
      'SELECT i.id, i.project_id, i.storage_path FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
      [imageId, userId],
    );

    if (imageResult.rows.length === 0) {
      logger.warn('Image not found for verification', { imageId });
      return res.status(404).json({ exists: false });
    }

    const projectId = imageResult.rows[0].project_id;

    return res.redirect(307, `/api/projects/${projectId}/images/${imageId}/verify`);
  } catch (error) {
    logger.error('Error in deprecated verify route', { imageId, error });

    res.status(500).json({
      error: 'VerificationFailed',
      message: 'Could not verify image existence',
    });
  }
});

// Direct image access routes (legacy compatibility)
// GET /api/images/:imageId - Get image by ID directly
router.get(
  '/:imageId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const imageId = req.params.imageId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    logger.info('Direct image access request', { userId, imageId });

    try {
      let imageResult;
      
      // Check if imageId looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageId);
      
      if (isUUID) {
        // Try to find by UUID
        imageResult = await pool.query(
          `SELECT 
            i.*, 
            p.user_id,
            COALESCE(sr.status, i.segmentation_status, 'pending') as segmentationStatus,
            sr.id as segmentation_id
          FROM images i 
          JOIN projects p ON i.project_id = p.id 
          LEFT JOIN segmentation_results sr ON i.id = sr.image_id
          WHERE i.id = $1 AND p.user_id = $2`,
          [imageId, userId]
        );
      } else {
        // Try to find by storage_filename pattern or name
        imageResult = await pool.query(
          `SELECT 
            i.*, 
            p.user_id,
            COALESCE(sr.status, i.segmentation_status, 'pending') as segmentationStatus,
            sr.id as segmentation_id
          FROM images i 
          JOIN projects p ON i.project_id = p.id 
          LEFT JOIN segmentation_results sr ON i.id = sr.image_id
          WHERE (i.storage_filename LIKE $1 OR i.name = $2) AND p.user_id = $3`,
          [`%${imageId}%`, imageId, userId]
        );
      }

      if (imageResult.rows.length === 0) {
        logger.warn('Image not found or access denied', { imageId, userId, isUUID });
        return res.status(404).json({ 
          message: 'Image not found or access denied',
          error: 'NOT_FOUND'
        });
      }

      const image = imageResult.rows[0];
      return formatAndSendImage(image, req, res);
    } catch (error) {
      logger.error('Error fetching image directly', { imageId, error });
      next(error);
    }
  }
);

// GET /api/images/:imageId/segmentation - Get image segmentation
router.get(
  '/:imageId/segmentation',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const imageId = req.params.imageId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    logger.info('Image segmentation request', { userId, imageId });

    try {
      let imageResult;
      
      // Check if imageId looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageId);
      
      if (isUUID) {
        // Try to find by UUID
        imageResult = await pool.query(
          'SELECT i.id, i.project_id, p.user_id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
          [imageId, userId]
        );
      } else {
        // Try to find by storage_filename pattern or name
        imageResult = await pool.query(
          'SELECT i.id, i.project_id, p.user_id FROM images i JOIN projects p ON i.project_id = p.id WHERE (i.storage_filename LIKE $1 OR i.name = $2) AND p.user_id = $3',
          [`%${imageId}%`, imageId, userId]
        );
      }

      if (imageResult.rows.length === 0) {
        logger.warn('Image not found or access denied for segmentation', { imageId, userId, isUUID });
        return res.status(404).json({ 
          message: 'Image not found or access denied',
          error: 'NOT_FOUND'
        });
      }

      const actualImageId = imageResult.rows[0].id; // Get the actual UUID

      // Check if segmentation_results table exists
      const segmentationResultsTableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'segmentation_results'
        )
      `);

      if (!segmentationResultsTableCheck.rows[0].exists) {
        logger.warn('Segmentation results table does not exist');
        return res.status(404).json({
          message: 'Segmentation not found',
          error: 'NOT_FOUND'
        });
      }

      // Get segmentation data for this image using the actual UUID
      const segmentationResult = await pool.query(
        'SELECT * FROM segmentation_results WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1',
        [actualImageId]
      );

      if (segmentationResult.rows.length === 0) {
        logger.info('No segmentation found for image', { imageId, actualImageId });
        return res.status(404).json({
          message: 'Segmentation not found for this image',
          error: 'NOT_FOUND'
        });
      }

      const segmentation = segmentationResult.rows[0];
      logger.info('Segmentation found for image', { imageId, actualImageId, segmentationId: segmentation.id });

      res.status(200).json(segmentation);
    } catch (error) {
      logger.error('Error fetching image segmentation', { imageId, error });
      next(error);
    }
  }
);

export default router;
