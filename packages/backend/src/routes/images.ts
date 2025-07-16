import express, { Request, Response, Router, NextFunction } from 'express';
import { getPool } from '../db';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
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
import { cacheControl, combineCacheStrategies } from '../middleware/cache';
import cacheService from '../services/cacheService';

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
    cb: (error: Error | null, destination: string) => void
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
    cb: (error: Error | null, filename: string) => void
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
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/tiff', 'image/tif', 'image/bmp'];
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
  client: PoolClient
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

    // Provide more specific error messages for common issues
    let errorMessage = processError.message || 'Unknown error';
    let statusCode = 500;

    if (errorMessage.includes('file too large')) {
      errorMessage = `Image file is too large. TIFF/BMP files must be under 100MB`;
      statusCode = 413; // Payload Too Large
    } else if (errorMessage.includes('unsupported') || errorMessage.includes('corrupted')) {
      errorMessage = `Invalid or corrupted image file format`;
      statusCode = 415; // Unsupported Media Type
    } else if (errorMessage.includes('out of memory')) {
      errorMessage = `Image too complex to process. Please try a smaller or simpler image`;
      statusCode = 413;
    }

    throw new ApiError(`Failed to process ${file.originalname}: ${errorMessage}`, statusCode);
  }

  // Normalize paths for database storage
  // Use finalStoragePath for the main image path
  const relativePath = imageUtils.normalizePathForDb(finalStoragePath, UPLOAD_DIR);
  const relativeThumbnailPath = thumbnailPath
    ? imageUtils.normalizePathForDb(thumbnailPath, UPLOAD_DIR)
    : null;

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
    'INSERT INTO images (project_id, user_id, name, storage_filename, storage_path, thumbnail_path, width, height, metadata, file_size, segmentation_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
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
      'without_segmentation', // Explicitly set initial segmentation status
    ]
  );

  return imageResult.rows[0];
}

/**
 * @openapi
 * /projects/{projectId}/images:
 *   post:
 *     tags: [Images]
 *     summary: Upload images to project
 *     description: |
 *       Upload one or more images to a project. Supports JPEG, PNG, TIFF, and BMP formats.
 *       Automatically generates thumbnails and extracts metadata for each image.
 *       Only the project owner can upload images.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID to upload images to
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files to upload (max 20 files)
 *                 maxItems: 20
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadedImages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Image'
 *                 failedUploads:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                         example: "image.jpg"
 *                       error:
 *                         type: string
 *                         example: "Unsupported file format"
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 5
 *                     successful:
 *                       type: integer
 *                       example: 4
 *                     failed:
 *                       type: integer
 *                       example: 1
 *       400:
 *         description: Validation error or no files provided
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - user is not the project owner
 *       404:
 *         description: Project not found
 *       413:
 *         description: Payload too large - file size exceeds limit
 *       500:
 *         description: Internal server error
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
    // Get database pool at the beginning
    const pool = getPool();

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
        const storageInfoRes = await getPool().query(
          'SELECT storage_limit_bytes, storage_used_bytes FROM users WHERE id = $1',
          [requestingUserId]
        );

        if (storageInfoRes.rows.length === 0) {
          logger.warn('User not found for storage check, using defaults', {
            userId: requestingUserId,
          });
        } else {
          // Use values from database if columns exist
          storageLimitBytes = BigInt(
            storageInfoRes.rows[0].storage_limit_bytes || defaultLimitBytes
          );
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
                logger.error('Failed to clean up file after storage limit exceeded', {
                  path: file.path,
                  error: err,
                });
            });
          });
        }
        const limitMB = Number(storageLimitBytes / (1024n * 1024n));
        const usedMB = Number(storageUsedBytes / (1024n * 1024n));
        const incomingMB = Number(incomingTotalSizeBytes / (1024n * 1024n));
        const availableMB = limitMB - usedMB;

        throw new ApiError(
          `Storage limit exceeded. Limit: ${limitMB} MB, Used: ${usedMB.toFixed(2)} MB, Incoming: ${incomingMB.toFixed(2)} MB. Available: ${availableMB.toFixed(2)} MB.`,
          413 // Payload Too Large
        );
      }
      // --- Storage Limit Check --- END

      // Use projectService to check access (ownership or sharing)
      const projectService = await import('../services/projectService');
      const project = await projectService.getProjectById(getPool(), projectId, requestingUserId);
      
      if (!project) {
        if (files) files.forEach((file) => allUploadedFilePaths.push(file.path));
        next(new ApiError('Project not found or access denied', 404));
        return;
      }
      
      // Check if user has edit permission (owner or shared with 'edit' permission)
      const hasEditPermission = project.is_owner || project.permission === 'edit';
      if (!hasEditPermission) {
        if (files) files.forEach((file) => allUploadedFilePaths.push(file.path));
        next(new ApiError('You do not have permission to upload images to this project', 403));
        return;
      }

      if (!files || files.length === 0) {
        res.status(400).json({ message: 'No image files provided' });
        return;
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        logger.debug('Transaction started for image upload', { projectId });

        // Přímo použijeme requestingUserId jako string (UUID)
        const processingPromises = files.map((file) =>
          processAndStoreImage(file, projectId, requestingUserId, client)
        );

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

        // Verify that images are actually in the database before proceeding
        const verifyQuery = await getPool().query(
          'SELECT COUNT(*) FROM images WHERE project_id = $1 AND id = ANY($2::uuid[])',
          [projectId, insertedImages.map((img) => img.id)]
        );
        const verifiedCount = parseInt(verifyQuery.rows[0].count, 10);
        if (verifiedCount !== insertedImages.length) {
          logger.error('Image count mismatch after commit', {
            expected: insertedImages.length,
            actual: verifiedCount,
            projectId,
          });
        } else {
          logger.debug('Images verified in database after commit', {
            count: verifiedCount,
            projectId,
          });
        }

        // --- Update User Storage Usage (Outside Transaction) --- START
        // It's generally safer to update the aggregate count *after* the main transaction succeeds.
        // Calculate the total size of *successfully* processed and inserted images.
        const successfullyUploadedSize = insertedImages.reduce(
          (sum, img) => sum + BigInt(img.file_size || 0),
          0n
        );

        if (successfullyUploadedSize > 0n) {
          try {
            // First check if the storage_used_bytes column exists
            const checkColumnQuery = `
                            SELECT column_name
                            FROM information_schema.columns
                            WHERE table_name = 'users' AND column_name = 'storage_used_bytes'
                        `;
            const columnCheck = await getPool().query(checkColumnQuery);

            if (columnCheck.rows.length > 0) {
              // Column exists, update it
              await getPool().query(
                'UPDATE users SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + $1 WHERE id = $2',
                [successfullyUploadedSize.toString(), requestingUserId]
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

        // Invalidate image list cache for this project
        await cacheService.invalidateImageList(projectId);

        // Format results before sending
        const origin = req.get('origin') || config.baseUrl;
        const formattedImages = insertedImages.map((img) =>
          imageUtils.formatImageForApi(img, origin)
        );

        // Emit WebSocket events for real-time updates with a small delay
        const io = req.app.get('io');
        if (io) {
          // Add a small delay to ensure database changes are fully propagated
          setTimeout(() => {
            // Emit to project room for each uploaded image
            formattedImages.forEach((image) => {
              io.to(`project-${projectId}`).emit('image:created', {
                projectId,
                image,
                timestamp: new Date().toISOString(),
              });

              // Also emit to alternative room formats for compatibility
              io.to(`project_${projectId}`).emit('image:created', {
                projectId,
                image,
                timestamp: new Date().toISOString(),
              });
            });

            logger.debug('Emitted image:created events via WebSocket', {
              projectId,
              imageCount: formattedImages.length,
            });
          }, 100); // 100ms delay for database propagation
        }

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
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
        projectId,
        filesCount: files?.length || 0,
        userId: requestingUserId,
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
  }
);

/**
 * @openapi
 * /projects/{projectId}/images/{imageId}:
 *   delete:
 *     tags: [Images]
 *     summary: Delete image
 *     description: |
 *       Delete a specific image from a project. This removes the image from the database
 *       and deletes the image and thumbnail files from the filesystem.
 *       Only the project owner can delete images.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID containing the image
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *       - name: imageId
 *         in: path
 *         required: true
 *         description: Image ID to delete
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "987fcdeb-51a2-43d7-8765-123456789abc"
 *     responses:
 *       204:
 *         description: Image deleted successfully
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - user is not the project owner
 *       404:
 *         description: Project or image not found
 *       500:
 *         description: Internal server error
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
        const imageRes = await getPool().query(
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
            name: imageRes.rows[0].name,
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

          // Emit WebSocket event for real-time updates
          const io = req.app.get('io');
          if (io) {
            io.to(`project-${projectId}`).emit('image:deleted', {
              projectId,
              imageId: actualImageId,
              timestamp: new Date().toISOString(),
            });

            // Also emit to alternative room formats
            io.to(`project_${projectId}`).emit('image:deleted', {
              projectId,
              imageId: actualImageId,
              timestamp: new Date().toISOString(),
            });

            logger.debug('Emitted image:deleted event via WebSocket', {
              projectId,
              imageId: actualImageId,
            });
          }

          // Return success with no content
          return res.status(204).send();
        }
      } catch (lookupError) {
        logger.error('Error looking up image by frontend ID', {
          frontendId: imageId,
          projectId,
          error: lookupError,
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

      // Emit WebSocket event for real-time updates
      const io = req.app.get('io');
      if (io) {
        io.to(`project-${projectId}`).emit('image:deleted', {
          projectId,
          imageId,
          timestamp: new Date().toISOString(),
        });

        // Also emit to alternative room formats
        io.to(`project_${projectId}`).emit('image:deleted', {
          projectId,
          imageId,
          timestamp: new Date().toISOString(),
        });

        logger.debug('Emitted image:deleted event via WebSocket', {
          projectId,
          imageId,
        });
      }

      // Return success with no content
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting image', {
        projectId,
        imageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      next(error);
    }
  }
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
  }
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
        const imageRes = await getPool().query(
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
            name: imageRes.rows[0].name,
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
          error: lookupError,
        });
      }

      return res.status(404).json({
        error: 'ImageNotFound',
        message: 'Image with this ID does not exist in the database',
      });
    }

    try {
      // First, find which project this image belongs to
      const imageRes = await getPool().query(
        'SELECT i.id, i.project_id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId]
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
  }
);

/**
 * @openapi
 * /projects/{projectId}/images/{imageId}:
 *   get:
 *     tags: [Images]
 *     summary: Get image by ID
 *     description: |
 *       Retrieve a specific image from a project by its ID or name.
 *       Supports finding images by UUID, name in path, or name in query parameter.
 *       Only the project owner can access images.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID containing the image
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *       - name: imageId
 *         in: path
 *         required: true
 *         description: Image ID or name to retrieve
 *         schema:
 *           type: string
 *           example: "987fcdeb-51a2-43d7-8765-123456789abc"
 *       - name: name
 *         in: query
 *         description: Alternative way to specify image name
 *         schema:
 *           type: string
 *           example: "cell_sample.tiff"
 *     responses:
 *       200:
 *         description: Image retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Image'
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - user is not the project owner
 *       404:
 *         description: Project or image not found, or image file missing
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:projectId/images/:imageId',
  authMiddleware,
  combineCacheStrategies(cacheControl.short, cacheControl.etag),
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
      const pool = getPool();
      
      // Use projectService to check access (ownership or sharing)
      const projectService = await import('../services/projectService');
      const project = await projectService.getProjectById(pool, projectId, userId);
      
      if (!project) {
        logger.warn('Project access denied', {
          projectId,
          originalProjectId,
          userId,
        });
        throw new ApiError('Project not found or access denied', 404);
      }

      const imageResult = await getPool().query(
        `SELECT 
          i.*,
          COALESCE(i.segmentation_status, 'without_segmentation') as segmentationStatus,
          sr.id as segmentation_id,
          sr.status as result_status
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
  }
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
  combineCacheStrategies(cacheControl.short, cacheControl.etag),
  validate(listImagesSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId } = req.params;
    const { name, limit = 50, page } = req.query;
    // Calculate offset from page if provided, otherwise use offset
    const offset = page ? (Number(page) - 1) * Number(limit) : Number(req.query.offset || 0);

    // No need to handle project- prefix anymore as it's been removed from the frontend
    const originalProjectId = projectId;

    logger.info('Image list request received', {
      userId,
      projectId,
      originalProjectId,
      nameFilter: name || undefined,
      limit,
      offset,
    });

    try {
      // Try to get from cache first (only if no filters)
      if (!name && !req.query.verifyFiles) {
        const cached = await cacheService.getCachedImageList(
          projectId,
          Number(page || 1),
          Number(limit)
        );
        if (cached) {
          logger.debug('Returning cached image list', { projectId, page, limit });
          return res.status(200).json(cached);
        }
      }

      const pool = getPool();
      
      // Use projectService to check access (ownership or sharing)
      const projectService = await import('../services/projectService');
      const project = await projectService.getProjectById(pool, projectId, userId);
      
      if (!project) {
        logger.warn('Project access denied', {
          projectId,
          originalProjectId,
          userId,
        });
        throw new ApiError('Project not found or access denied', 404);
      }

      // Get total count for pagination metadata
      const countResult = await getPool().query(
        name
          ? `SELECT COUNT(*) FROM images WHERE project_id = $1 AND name = $2`
          : `SELECT COUNT(*) FROM images WHERE project_id = $1`,
        name ? [projectId, name] : [projectId]
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);

      // Get paginated images
      const imageResult = await getPool().query(
        name
          ? `SELECT 
              i.*,
              COALESCE(i.segmentation_status, 'without_segmentation') as "segmentationStatus",
              sr.id as segmentation_id,
              sr.status as result_status
            FROM images i
            LEFT JOIN segmentation_results sr ON i.id = sr.image_id
            WHERE i.project_id = $1 AND i.name = $2 
            ORDER BY i.created_at DESC
            LIMIT $3 OFFSET $4`
          : `SELECT 
              i.*,
              COALESCE(i.segmentation_status, 'without_segmentation') as "segmentationStatus",
              sr.id as segmentation_id,
              sr.status as result_status
            FROM images i
            LEFT JOIN segmentation_results sr ON i.id = sr.image_id
            WHERE i.project_id = $1 
            ORDER BY i.created_at DESC
            LIMIT $2 OFFSET $3`,
        name ? [projectId, name, limit, offset] : [projectId, limit, offset]
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
      let processedImages = imageResult.rows.map((image: ImageData) =>
        imageUtils.formatImageForApi(image, origin)
      );

      if (verifyFiles) {
        logger.debug('Verifying file existence for images', {
          count: processedImages.length,
        });
        processedImages = processedImages.map((image) =>
          imageUtils.verifyImageFilesForApi(image, UPLOAD_DIR)
        );

        const filterMissing = req.query.filterMissing === 'true';
        if (filterMissing) {
          logger.debug('Filtering out images with missing files');
          processedImages = processedImages.filter((image) => image.file_exists);
          logger.debug('Images after filtering', {
            count: processedImages.length,
          });
        }
      }

      const response = {
        images: processedImages,
        data: processedImages, // Keep for backward compatibility
        total: totalCount,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          page: page ? Number(page) : Math.floor(Number(offset) / Number(limit)) + 1,
          totalPages: Math.ceil(totalCount / Number(limit)),
          hasMore: Number(offset) + processedImages.length < totalCount,
        },
      };

      // Cache the response (only if no filters)
      if (!name && !req.query.verifyFiles) {
        await cacheService.cacheImageList(
          projectId,
          Number(page || 1),
          Number(limit),
          response.images
        );
      }

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error fetching images', {
        projectId,
        nameFilter: name || undefined,
        error,
      });
      next(error);
    }
  }
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
  cacheControl.noCache,
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
      const pool = getPool();
      
      // Use projectService to check access (ownership or sharing)
      const projectService = await import('../services/projectService');
      const project = await projectService.getProjectById(pool, projectId, userId);
      
      if (!project) {
        logger.warn('Project access denied', {
          projectId,
          originalProjectId,
          userId,
        });
        throw new ApiError('Project not found or access denied', 404);
      }

      const imageResult = await getPool().query(
        'SELECT id, storage_path FROM images WHERE id = $1 AND project_id = $2',
        [imageId, projectId]
      );

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
  }
);

// Legacy route for backward compatibility - will be deprecated
router.get(
  '/verify/:id',
  authMiddleware,
  cacheControl.noCache,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const imageId = req.params.id;

    logger.warn('Using deprecated route', {
      route: '/verify/:id',
      method: 'GET',
      imageId,
    });

    try {
      const pool = getPool();
      const imageResult = await getPool().query(
        'SELECT i.id, i.project_id, i.storage_path FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId]
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
  }
);

// Direct image access routes (legacy compatibility)
// GET /api/images/:imageId - Get image by ID directly
router.get(
  '/:imageId',
  authMiddleware,
  combineCacheStrategies(cacheControl.short, cacheControl.etag),
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
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        imageId
      );

      if (isUUID) {
        // Try to find by UUID
        imageResult = await getPool().query(
          `SELECT 
            i.*, 
            p.user_id,
            COALESCE(i.segmentation_status, 'without_segmentation') as segmentationStatus,
            sr.id as segmentation_id,
            sr.status as result_status
          FROM images i 
          JOIN projects p ON i.project_id = p.id 
          LEFT JOIN segmentation_results sr ON i.id = sr.image_id
          WHERE i.id = $1 AND p.user_id = $2`,
          [imageId, userId]
        );
      } else {
        // Try to find by storage_filename pattern or name
        imageResult = await getPool().query(
          `SELECT 
            i.*, 
            p.user_id,
            COALESCE(i.segmentation_status, 'without_segmentation') as segmentationStatus,
            sr.id as segmentation_id,
            sr.status as result_status
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
          error: 'NOT_FOUND',
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
  combineCacheStrategies(cacheControl.medium, cacheControl.etag),
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
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        imageId
      );

      if (isUUID) {
        // Try to find by UUID
        imageResult = await getPool().query(
          'SELECT i.id, i.project_id, p.user_id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
          [imageId, userId]
        );
      } else {
        // Try to find by storage_filename pattern or name
        imageResult = await getPool().query(
          'SELECT i.id, i.project_id, p.user_id FROM images i JOIN projects p ON i.project_id = p.id WHERE (i.storage_filename LIKE $1 OR i.name = $2) AND p.user_id = $3',
          [`%${imageId}%`, imageId, userId]
        );
      }

      if (imageResult.rows.length === 0) {
        logger.warn('Image not found or access denied for segmentation', {
          imageId,
          userId,
          isUUID,
        });
        return res.status(404).json({
          message: 'Image not found or access denied',
          error: 'NOT_FOUND',
        });
      }

      const actualImageId = imageResult.rows[0].id; // Get the actual UUID

      // Check if segmentation_results table exists
      const segmentationResultsTableCheck = await getPool().query(`
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
          error: 'NOT_FOUND',
        });
      }

      // Get segmentation data for this image using the actual UUID
      const segmentationResult = await getPool().query(
        'SELECT * FROM segmentation_results WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1',
        [actualImageId]
      );

      if (segmentationResult.rows.length === 0) {
        logger.info('No segmentation found for image', { imageId, actualImageId });
        return res.status(404).json({
          message: 'Segmentation not found for this image',
          error: 'NOT_FOUND',
        });
      }

      const segmentation = segmentationResult.rows[0];
      logger.info('Segmentation found for image', {
        imageId,
        actualImageId,
        segmentationId: segmentation.id,
      });

      res.status(200).json(segmentation);
    } catch (error) {
      logger.error('Error fetching image segmentation', { imageId, error });
      next(error);
    }
  }
);

export default router;
