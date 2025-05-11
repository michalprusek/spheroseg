/**
 * Segmentation Queue Service
 *
 * This service provides a specialized implementation of the task queue
 * for segmentation tasks, using the generic task queue service.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import pool from '../db';
import { getSocketIO } from '../services/socketService'; // Updated import
import config from '../config';
import logger from '../utils/logger';
import { createTaskQueue, Task } from './taskQueueService';
import fetch from 'node-fetch';

/**
 * Interface for segmentation task data
 */
export interface SegmentationTaskData {
  imageId: string;
  imagePath: string;
  parameters: any;
}

/**
 * Segmentation task type
 */
const SEGMENTATION_TASK_TYPE = 'segmentation';

/**
 * Create a specialized segmentation queue
 */
const segmentationQueue = createTaskQueue<SegmentationTaskData>({
  maxConcurrent: config.segmentation.maxConcurrentTasks || 2,
  defaultPriority: 1,
  defaultTimeout: 600000, // 10 minutes
  defaultRetries: 1,
  defaultRetryDelay: 10000, // 10 seconds
});

// Base directory for server root
const SERVER_ROOT = path.resolve(__dirname, '..', '..');

// --- Configuration ---
// Python executable path - use virtual environment if available
const PYTHON_EXECUTABLE =
  process.env.PYTHON_EXECUTABLE || (fs.existsSync('/venv/bin/python') ? '/venv/bin/python' : 'python3');
logger.info(`Using Python executable: ${PYTHON_EXECUTABLE}`);

// Path to Python script - Consistent path based on Docker mount
let SCRIPT_PATH = '/app/ML/resunet_segmentation.py'; // Unified path inside the Docker container
logger.info(`Checking for script at: ${SCRIPT_PATH}`);

// Check if the script exists at the expected path
if (!fs.existsSync(SCRIPT_PATH)) {
  // Try alternative paths
  const paths = [
    path.join(SERVER_ROOT, '..', 'ML', 'resunet_segmentation.py'),
    path.join(SERVER_ROOT, 'ML', 'resunet_segmentation.py'),
    '/ML/resunet_segmentation.py',
    '/app/ML/resunet_segmentation.py',
  ];

  for (const altPath of paths) {
    if (fs.existsSync(altPath)) {
      SCRIPT_PATH = altPath;
      logger.info(`Found script at alternative path: ${SCRIPT_PATH}`);
      break;
    }
  }

  if (SCRIPT_PATH === '/app/ML/resunet_segmentation.py') {
    // If we didn't find the script at any alternative path
    logger.warn(
      `Script not found at ${SCRIPT_PATH} or any alternative paths. Will continue but segmentation may fail.`,
    );
  }
} else {
  logger.info(`Found script at: ${SCRIPT_PATH}`);
}

// ML service URL - if set, will be used instead of local script execution
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || '';
if (ML_SERVICE_URL) {
  logger.info(`Using ML service URL: ${ML_SERVICE_URL}`);
} else {
  logger.info(`Using direct Python execution with script: ${SCRIPT_PATH}`);
}

// Use checkpoint path from configuration
const CHECKPOINT_PATH = process.env.ML_CHECKPOINT_PATH || '/app/ML/checkpoint_epoch_9.pth.tar';
logger.info(`Using checkpoint path: ${CHECKPOINT_PATH}`);

// Check if checkpoint exists
const checkpointExists = fs.existsSync(CHECKPOINT_PATH);
if (checkpointExists) {
  logger.info(`Using checkpoint: ${CHECKPOINT_PATH}`);
} else {
  logger.warn(`Checkpoint not found at: ${CHECKPOINT_PATH}. Will try alternative paths.`);

  // Try alternative paths
  const altPaths = [
    path.join(SERVER_ROOT, '..', 'ML', 'checkpoint_epoch_9.pth.tar'),
    path.join(SERVER_ROOT, 'ML', 'checkpoint_epoch_9.pth.tar'),
    '/ML/checkpoint_epoch_9.pth.tar',
    config.segmentation.checkpointPath,
  ];

  let foundCheckpoint = false;
  for (const altPath of altPaths) {
    if (fs.existsSync(altPath)) {
      logger.info(`Found checkpoint at alternative path: ${altPath}`);
      foundCheckpoint = true;
      break;
    }
  }

  if (!foundCheckpoint) {
    logger.error('Checkpoint not found at any path. Segmentation will likely fail.');
  }
}

// Base directory for input images
const BASE_UPLOADS_DIR = config.storage.uploadDir; // Assuming src/services is two levels down
const BASE_OUTPUT_DIR = path.join(SERVER_ROOT, 'uploads', 'segmentations');

/**
 * Register the segmentation task executor
 */
segmentationQueue.registerExecutor(SEGMENTATION_TASK_TYPE, executeSegmentationTask);

/**
 * Function to update status in DB and notify client
 *
 * @param imageId ID of the image
 * @param status Status to update
 * @param resultPath Path to the result file
 * @param errorLog Error log if any
 * @param polygons Polygons if any
 */
async function updateSegmentationStatus(
  imageId: string,
  status: 'completed' | 'failed' | 'processing' | 'queued',
  resultPath?: string | null,
  errorLog?: string,
  polygons?: any[],
): Promise<void> {
  logger.debug(`Updating status for image ${imageId} to ${status}. Result path: ${resultPath}, Error: ${errorLog}`);

  let clientResultPath: string | null = null;

  if (resultPath) {
    // Convert absolute server path to a relative URL path accessible by the client
    if (resultPath.startsWith('/uploads/')) {
      clientResultPath = resultPath; // Already in the correct format
    } else if (resultPath.startsWith('/app/uploads/')) {
      clientResultPath = resultPath.replace('/app/uploads/', '/uploads/');
    } else if (resultPath.startsWith(BASE_UPLOADS_DIR)) {
      clientResultPath = '/uploads/' + path.relative(BASE_UPLOADS_DIR, resultPath);
    } else {
      // If we can't determine the client path, use the original path
      clientResultPath = resultPath;
    }
  }

  try {
    // Check if segmentation_results record exists for this image
    const checkResult = await pool.query(`SELECT 1 FROM segmentation_results WHERE image_id = $1`, [imageId]);

    // Prepare result data with polygons and metadata
    const resultData = clientResultPath
      ? {
          path: clientResultPath,
          polygons: polygons || [], // Include polygons if available
          metadata: {
            processedAt: new Date().toISOString(),
            modelType: 'resunet',
            hasNestedObjects: polygons ? polygons.some((p) => p.type === 'internal') : false,
            source: 'resunet',
          },
        }
      : null;

    try {
      // Use UPSERT pattern with ON CONFLICT to handle both insert and update in one query
      await pool.query(
        `INSERT INTO segmentation_results (image_id, status, result_data, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (image_id) DO UPDATE SET
         status = EXCLUDED.status,
         result_data = EXCLUDED.result_data,
         updated_at = NOW()`,
        [imageId, status, resultData],
      );
      logger.debug(`Upserted segmentation_results record for image ${imageId}`);
    } catch (insertError) {
      logger.error(`Error upserting segmentation_results for image ${imageId}:`, { error: insertError });

      // Try update as fallback if insert failed
      try {
        await pool.query(
          `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
          [status, resultData, imageId],
        );
        logger.debug(`Updated segmentation_results record for image ${imageId} after insert failed`);
      } catch (updateError) {
        logger.error(`Error updating segmentation_results for image ${imageId} after insert failed:`, {
          error: updateError,
        });
      }
    }

    // Update images table
    await pool.query(`UPDATE images SET status = $1, updated_at = NOW() WHERE id = $2`, [status, imageId]);

    // Notify the client via Socket.IO
    try {
      // Fetch user ID and project ID associated with the image to target the correct rooms
      const userQuery = await pool.query('SELECT user_id, project_id FROM images WHERE id = $1', [imageId]);

      if (userQuery.rows.length > 0) {
        const userId = userQuery.rows[0].user_id;
        const projectId = userQuery.rows[0].project_id;
        logger.debug(
          `Emitting segmentation update to user room: ${userId}, Project ID: ${projectId}, Image ID: ${imageId}, Status: ${status}`,
        );

        const io = getSocketIO(); // Updated function call
        if (io) {
          // Create the update data object
          const updateData = {
            imageId: imageId,
            status: status,
            resultPath: clientResultPath, // Send client-accessible path
            error: errorLog,
            timestamp: new Date().toISOString(),
          };

          // Emit to user's room - now users automatically join rooms with their userId
          io.to(userId).emit('segmentation_update', updateData);

          // Also emit to project room if available
          if (projectId) {
            const projectRoom = `project-${projectId}`;
            logger.debug(`Also emitting to project room: ${projectRoom}`);
            io.to(projectRoom).emit('segmentation_update', updateData);

            // Also emit queue status update for this project
            try {
              const queueStatus = await getSegmentationQueueStatus();
              logger.debug(`Emitting queue status update for project ${projectId}:`, queueStatus);
              io.to(projectRoom).emit('segmentation_queue_update', queueStatus);
              io.to(userId).emit('segmentation_queue_update', queueStatus);
            } catch (queueErr) {
              logger.error(`Failed to get queue status for project ${projectId}:`, queueErr);
            }
          }

          // Also emit to all clients for better reliability
          logger.debug(`Also broadcasting to all clients`);
          io.emit('segmentation_update', updateData);
        } else {
          logger.warn('Socket.IO not available, cannot broadcast segmentation update.');
        }
      } else {
        logger.error(`Could not find user ID for image ${imageId} to send socket notification.`);
      }
    } catch (socketError) {
      logger.error(`Error sending socket notification for image ${imageId}:`, {
        error: socketError,
      });
    }
  } catch (dbError) {
    logger.error(`Database error updating status for image ${imageId}:`, {
      error: dbError,
    });
  }
}

/**
 * Function to add a segmentation task to the queue
 *
 * @param imageId ID of the image
 * @param imagePath Path to the image
 * @param parameters Parameters for segmentation
 * @param priority Priority of the task
 * @returns Task ID
 */
export const triggerSegmentationTask = async (
  imageId: string,
  imagePath: string,
  parameters: any,
  priority: number = 1,
): Promise<string> => {
  logger.info(`Queueing segmentation for imageId: ${imageId}, path: ${imagePath}, priority: ${priority}`);

  try {
    // Check if this is a force resegment task
    const forceResegment = parameters?.force_resegment === true;

    // Update status to indicate segmentation is queued
    await updateSegmentationStatus(imageId, 'queued');

    // Add task to queue
    const taskId = segmentationQueue.addTask(
      SEGMENTATION_TASK_TYPE,
      {
        imageId,
        imagePath,
        parameters,
      },
      {
        id: imageId, // Use imageId as taskId for easier tracking
        priority,
        // forceRequeue is not a valid option in TaskOptions
      },
    );

    return imageId; // Return imageId as the task identifier
  } catch (error) {
    logger.error(`Error adding segmentation task for image ${imageId} to queue:`, { error });
    throw error; // Re-throw to allow caller to handle the error
  }
};

/**
 * Function to get the status of the segmentation queue
 *
 * @returns Queue status
 */
export const getSegmentationQueueStatus = async (): Promise<any> => {
  // Get queue status - we need to implement our own status method since getStatus() doesn't exist
  // Get only the task IDs to avoid circular references
  const pendingTaskIds = segmentationQueue.getPendingTasks().map((task) => task.id);
  const runningTaskIds = segmentationQueue.getRunningTasks().map((task) => task.id);

  // Logujeme počty úloh pro debugging
  logger.debug('Segmentation queue status:', {
    pendingTasksCount: pendingTaskIds.length,
    runningTasksCount: runningTaskIds.length,
  });

  const status = {
    pendingTasks: pendingTaskIds,
    runningTasks: runningTaskIds,
    completedTasks: [],
    failedTasks: [],
  };

  try {
    // Get image details for running tasks and pending tasks
    const processingImages: { id: string; name: string; projectId: string }[] = [];
    const queuedImages: { id: string; name: string; projectId: string }[] = [];

    if (status.runningTasks && status.runningTasks.length > 0) {
      const imagesQuery = await pool.query(`SELECT id, name, project_id FROM images WHERE id = ANY($1::uuid[])`, [
        status.runningTasks,
      ]);

      imagesQuery.rows.forEach((image) => {
        processingImages.push({
          id: image.id,
          name: image.name,
          projectId: image.project_id,
        });
      });
    }

    if (status.pendingTasks && status.pendingTasks.length > 0) {
      const imagesQuery = await pool.query(`SELECT id, name, project_id FROM images WHERE id = ANY($1::uuid[])`, [
        status.pendingTasks,
      ]);

      imagesQuery.rows.forEach((image) => {
        queuedImages.push({
          id: image.id,
          name: image.name,
          projectId: image.project_id,
        });
      });
    }

    // Return enhanced status with image details and timestamp
    const result = {
      ...status,
      processingImages,
      queuedImages,
      timestamp: new Date().toISOString(),
      queueLength: status.pendingTasks?.length || 0,
      activeTasksCount: status.runningTasks?.length || 0,
    };

    // Logujeme výsledek pro debugging
    logger.debug('Enhanced segmentation queue status:', {
      pendingTasksCount: result.pendingTasks.length,
      runningTasksCount: result.runningTasks.length,
      queueLength: result.queueLength,
      activeTasksCount: result.activeTasksCount,
      processingImagesCount: processingImages.length,
      queuedImagesCount: queuedImages.length,
    });

    return result;
  } catch (error) {
    logger.error('Error enhancing queue status with image details:', { error });

    // Return basic status with timestamp if there's an error
    const fallbackResult = {
      ...status,
      processingImages: [],
      queuedImages: [],
      timestamp: new Date().toISOString(),
      queueLength: status.pendingTasks?.length || 0,
      activeTasksCount: status.runningTasks?.length || 0,
    };

    // Logujeme fallback výsledek pro debugging
    logger.debug('Fallback segmentation queue status (after error):', {
      pendingTasksCount: fallbackResult.pendingTasks.length,
      runningTasksCount: fallbackResult.runningTasks.length,
      queueLength: fallbackResult.queueLength,
      activeTasksCount: fallbackResult.activeTasksCount,
    });

    return fallbackResult;
  }
};

/**
 * Function to cancel a segmentation task
 *
 * @param imageId ID of the image
 * @returns True if the task was cancelled, false otherwise
 */
export const cancelSegmentationTask = (imageId: string): boolean => {
  return segmentationQueue.cancelTask(imageId);
};

/**
 * Actual execution function that processes a segmentation task
 *
 * @param task Segmentation task
 * @returns Result of the segmentation
 */
async function executeSegmentationTask(task: Task<SegmentationTaskData>): Promise<void> {
  const { imageId, parameters } = task.data;
  const { imagePath } = task.data; // Original imagePath from task data

  logger.info(`Executing segmentation for imageId: ${imageId}, original task imagePath: ${imagePath}`);

  // Update status to indicate segmentation is now actively processing
  await updateSegmentationStatus(imageId, 'processing');

  // --- Start: Consolidated Project ID Extraction ---
  let determinedProjectId: string = '';

  // Try to extract from imageId (UUID format: e.g., projectUuid- বাকি অংশ)
  if (imageId && imageId.includes('-')) {
    // Assuming project ID could be the part before the first hyphen if imageId is structured like projectUuid-timestamp-random
    // Or, if imageId itself is the project's image UUID, we might need to fetch project_id from the database for this imageId.
    // For now, let's assume a simple split or that imageId might BE the project-specific image UUID that can give us project ID.
    // This part needs to be robust based on actual imageId and projectId relationship.
    // Let's placeholder with a direct attempt from imageId or fallback to path search.
    // Example: if imageId = "projectABC-12345.png", projectId = "projectABC"
    // This is a simplification. A DB lookup for imageId to get its project_id might be more robust.
    const imageIdParts = imageId.split('-');
    if (imageIdParts.length > 1 && imageIdParts[0].length === 36) {
      // Check if first part looks like a full UUID
      // This case might mean imageId itself is a global UUID, not directly giving projectID without a lookup.
      // For now, let's assume project ID is not directly in imageId this way unless it's a prefix.
    }
    // A more direct assumption: if the image ID is from the DB, it should have a project_id associated.
    // For now, we will rely on path-based extraction or a prefixed imageId.
  }

  // Try to extract from imagePath if not found or clear from imageId
  // Looking for a UUID structure in the path parts, e.g., /uploads/PROJECT_ID_UUID/images/image.png
  const pathPartsForIdExtraction = imagePath.split('/');
  for (const part of pathPartsForIdExtraction) {
    if (part.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      determinedProjectId = part;
      logger.info(`Project ID extracted from imagePath ('${imagePath}'): ${determinedProjectId}`);
      break;
    }
  }
  // If imageId is a compound key like `projectId_imageName`, extract projectId
  if (!determinedProjectId && imageId.includes('_') && imageId.split('_')[0].length > 5) {
    // Basic check
    const potentialProjectIdFromImageId = imageId.split('_')[0];
    // Further validation if potentialProjectIdFromImageId looks like a UUID or known project key format
    if (
      potentialProjectIdFromImageId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ||
      potentialProjectIdFromImageId.startsWith('proj_')
    ) {
      determinedProjectId = potentialProjectIdFromImageId;
      logger.info(`Project ID extracted from complex imageId ('${imageId}'): ${determinedProjectId}`);
    }
  }

  if (!determinedProjectId) {
    logger.warn(
      `Could not determine Project ID for imageId: ${imageId} from path: ${imagePath}. Segmentation might use a general path.`,
    );
  }
  // --- End: Consolidated Project ID Extraction ---

  // Normalize the path to handle various path formats and duplicated 'uploads'
  let normalizedWorkerImagePath = imagePath;
  while (normalizedWorkerImagePath.includes('uploads/uploads/')) {
    normalizedWorkerImagePath = normalizedWorkerImagePath.replace(/uploads\/uploads\//gi, 'uploads/');
    logger.info(`Fixed duplicated 'uploads' in worker path to: ${normalizedWorkerImagePath}`);
  }
  if (normalizedWorkerImagePath.startsWith('/app/uploads/')) {
    normalizedWorkerImagePath = normalizedWorkerImagePath.substring('/app'.length);
  }
  if (normalizedWorkerImagePath.startsWith('uploads/')) {
    normalizedWorkerImagePath = `/${normalizedWorkerImagePath}`;
  }
  if (!normalizedWorkerImagePath.startsWith('/uploads/')) {
    normalizedWorkerImagePath = `/uploads/${normalizedWorkerImagePath.split('/').pop()}`; // Fallback to just filename under /uploads
  }
  logger.info(`Normalized worker imagePath: ${normalizedWorkerImagePath}`);

  // Construct absolute paths
  let absoluteImagePath: string | undefined = undefined; // Initialize
  const filename = path.basename(normalizedWorkerImagePath); // Use normalized path for basename
  logger.info(`Extracted filename: ${filename}`);

  // Create symbolic links and directories (this part seems complex and might need review for necessity)
  // The symlink creation for 'uploads/uploads' might be an attempt to fix incorrect pathing issues elsewhere.
  try {
    const uploadsDir = path.join(BASE_UPLOADS_DIR);
    const uploadsUploadsDir = path.join(BASE_UPLOADS_DIR, 'uploads'); // uploads/uploads path
    if (!fs.existsSync(uploadsUploadsDir)) {
      logger.info(`Creating directory: ${uploadsUploadsDir}`);
      fs.mkdirSync(uploadsUploadsDir, { recursive: true });
    }
    // Symlink uploads/uploads -> uploads (BASE_UPLOADS_DIR)
    // This seems to be trying to make /uploads/uploads/file.png accessible if /uploads/file.png is the real path
    const symlinkTargetForUploadsUploads = path.join(uploadsUploadsDir, 'uploads'); // This results in /uploads/uploads/uploads
    if (!fs.existsSync(symlinkTargetForUploadsUploads)) {
      // Check if /uploads/uploads/uploads exists
      // fs.symlinkSync(uploadsDir, symlinkTargetForUploadsUploads, 'dir'); // This symlinks /uploads -> /uploads/uploads/uploads. Review this logic.
      // Corrected logic should be: if 'uploads/uploads' is requested, it means the system expects 'uploads'
      // It might be safer to adjust paths than create nested symlinks like this.
    }

    if (determinedProjectId) {
      const projectDir = path.join(BASE_UPLOADS_DIR, determinedProjectId);
      if (!fs.existsSync(projectDir)) {
        logger.info(`Creating project directory: ${projectDir}`);
        fs.mkdirSync(projectDir, { recursive: true });
      }
      const projectImagesDir = path.join(projectDir, 'images');
      if (!fs.existsSync(projectImagesDir)) {
        logger.info(`Creating project images directory: ${projectImagesDir}`);
        fs.mkdirSync(projectImagesDir, { recursive: true });
      }
      // Symlink for project in uploads/uploads, e.g. /uploads/uploads/PROJECT_ID -> /uploads/PROJECT_ID
      const projectUploadsUploadsDir = path.join(uploadsUploadsDir, determinedProjectId);
      if (!fs.existsSync(projectUploadsUploadsDir)) {
        // fs.symlinkSync(projectDir, projectUploadsUploadsDir, 'dir'); // Review this symlink logic
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error during initial directory/symlink setup: ${errorMessage}`);
  }

  // Generate a list of possible paths to try
  const possiblePaths: string[] = [];

  // Get the image record from the database to find the correct path
  try {
    const imageResult = await pool.query(
      'SELECT storage_path, storage_filename, project_id FROM images WHERE id = $1',
      [imageId],
    );

    if (imageResult.rows.length > 0) {
      const dbStoragePath = imageResult.rows[0].storage_path;
      const dbStorageFilename = imageResult.rows[0].storage_filename;
      const dbProjectId = imageResult.rows[0].project_id;

      logger.info(
        `Found image record in database: storage_path=${dbStoragePath}, storage_filename=${dbStorageFilename}, project_id=${dbProjectId}`,
      );

      // Add the exact path from the database as the first option
      if (dbStoragePath) {
        // The storage_path in the database is like "/uploads/project_id/filename.png"
        // We need to convert it to the actual file system path
        if (dbStoragePath.startsWith('/uploads/')) {
          // Convert /uploads/project_id/filename.png to /app/uploads/project_id/filename.png
          const actualPath = path.join('/app', dbStoragePath);
          possiblePaths.push(actualPath);

          // Also try without the /app prefix
          possiblePaths.push(dbStoragePath.replace('/uploads/', '/app/uploads/'));

          // Also try with just the BASE_UPLOADS_DIR
          const relativePath = dbStoragePath.substring('/uploads/'.length);
          possiblePaths.push(path.join(BASE_UPLOADS_DIR, relativePath));
        } else if (dbStoragePath.startsWith('/')) {
          // If it's an absolute path
          possiblePaths.push(dbStoragePath);
          // Also try with BASE_UPLOADS_DIR
          possiblePaths.push(path.join(BASE_UPLOADS_DIR, dbStoragePath.substring(1)));
        } else {
          // If it's a relative path
          possiblePaths.push(path.join(BASE_UPLOADS_DIR, dbStoragePath));
        }
      }

      // Try with the storage filename
      if (dbStorageFilename) {
        possiblePaths.push(path.join(BASE_UPLOADS_DIR, dbStorageFilename));
        if (dbProjectId) {
          // This is the most likely path based on the directory structure we observed
          possiblePaths.push(path.join(BASE_UPLOADS_DIR, dbProjectId, dbStorageFilename));
          possiblePaths.push(path.join(BASE_UPLOADS_DIR, dbProjectId, 'images', dbStorageFilename));
        }
      }

      // Use the project ID from the database if available
      if (dbProjectId) {
        determinedProjectId = dbProjectId;
      }
    }
  } catch (error) {
    logger.error(`Error fetching image record from database:`, {
      error,
      imageId,
    });
  }

  // 1. If a project ID was determined, try the structured project path first.
  if (determinedProjectId) {
    possiblePaths.push(path.join(BASE_UPLOADS_DIR, determinedProjectId, 'images', filename));
    possiblePaths.push(path.join(BASE_UPLOADS_DIR, determinedProjectId, filename));
    // Also try with the original filename from the upload
    const originalFilename = filename.replace(/^images-/, '');
    possiblePaths.push(path.join(BASE_UPLOADS_DIR, determinedProjectId, 'images', originalFilename));
    possiblePaths.push(path.join(BASE_UPLOADS_DIR, determinedProjectId, originalFilename));
  }

  // 2. Try with the normalizedWorkerImagePath (which should be like /uploads/filename.png or /uploads/maybeProjectId/filename.png)
  if (normalizedWorkerImagePath.startsWith('/uploads/')) {
    possiblePaths.push(path.join(BASE_UPLOADS_DIR, normalizedWorkerImagePath.substring('/uploads/'.length)));

    // Try with the project ID in the path
    const pathParts = normalizedWorkerImagePath.substring('/uploads/'.length).split('/');
    if (pathParts.length > 1) {
      const potentialProjectId = pathParts[0];
      const potentialFilename = pathParts[pathParts.length - 1];
      possiblePaths.push(path.join(BASE_UPLOADS_DIR, potentialProjectId, 'images', potentialFilename));
      possiblePaths.push(path.join(BASE_UPLOADS_DIR, potentialProjectId, potentialFilename));
    }
  }

  // 3. Handle cases where original imagePath might be an absolute path within a Docker container context (e.g., /app/uploads/...)
  if (imagePath.startsWith('/app/uploads/')) {
    possiblePaths.push(imagePath); // The original path if it's absolute and starts with /app/uploads/
    possiblePaths.push(imagePath.replace('/app/uploads/', path.join(BASE_UPLOADS_DIR, ''))); // Map to host BASE_UPLOADS_DIR

    // Try with the project ID in the path
    const pathParts = imagePath.replace('/app/uploads/', '').split('/');
    if (pathParts.length > 1) {
      const potentialProjectId = pathParts[0];
      const potentialFilename = pathParts[pathParts.length - 1];
      possiblePaths.push(path.join(BASE_UPLOADS_DIR, potentialProjectId, 'images', potentialFilename));
      possiblePaths.push(path.join(BASE_UPLOADS_DIR, potentialProjectId, potentialFilename));
    }
  }

  // 4. Try with the Docker container path
  possiblePaths.push(path.join('/app/uploads', determinedProjectId || '', filename));
  possiblePaths.push(path.join('/app/uploads', determinedProjectId || '', 'images', filename));

  // 5. Fallback to a direct path under BASE_UPLOADS_DIR using just the filename
  possiblePaths.push(path.join(BASE_UPLOADS_DIR, filename));

  // 6. Try with the original filename from the upload
  const originalFilename = filename.replace(/^images-/, '');
  possiblePaths.push(path.join(BASE_UPLOADS_DIR, originalFilename));

  // 7. Add the original imagePath as a last resort if it's different and not yet included
  if (!possiblePaths.includes(imagePath)) {
    possiblePaths.push(imagePath);
  }

  // Deduplicate possiblePaths
  const uniquePossiblePaths = [...new Set(possiblePaths)];
  logger.info('Attempting to find image in these possible paths:', uniquePossiblePaths);

  for (const p of uniquePossiblePaths) {
    logger.debug(`Checking if file exists at: ${p}`);
    if (fs.existsSync(p)) {
      absoluteImagePath = p;
      logger.info(`Found image at: ${absoluteImagePath}`);
      break;
    }
  }

  if (!absoluteImagePath) {
    // This block of trying to create directories again if not found might be redundant if the earlier one for determinedProjectId ran.
    // However, it can act as a fallback if determinedProjectId was not found initially but path hints at it.
    logger.warn(`Image not found in initial check. Attempting to create directories if projectId available from path.`);
    let fallbackProjectId = '';
    const fpParts = normalizedWorkerImagePath.split('/'); // e.g. /uploads/PROJECT_ID/file.png
    if (fpParts.length >= 3 && fpParts[1] === 'uploads') {
      if (
        fpParts[2] !== filename &&
        fpParts[2].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      ) {
        fallbackProjectId = fpParts[2];
      }
    }

    if (fallbackProjectId) {
      const projectDir = path.join(BASE_UPLOADS_DIR, fallbackProjectId);
      const projectImagesDir = path.join(projectDir, 'images');
      try {
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
        if (!fs.existsSync(projectImagesDir)) fs.mkdirSync(projectImagesDir, { recursive: true });

        const projectSpecificPath = path.join(projectImagesDir, filename);
        if (fs.existsSync(projectSpecificPath)) {
          absoluteImagePath = projectSpecificPath;
          logger.info(`Found image at project-specific path after directory creation: ${absoluteImagePath}`);
        } else {
          const projectDirectPath = path.join(projectDir, filename);
          if (fs.existsSync(projectDirectPath)) {
            absoluteImagePath = projectDirectPath;
            logger.info(`Found image at direct project path after directory creation: ${absoluteImagePath}`);
          }
        }
      } catch (e: unknown) {
        logger.error(`Error creating fallback project directories: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!absoluteImagePath) {
      // If still not found, use the first unique path as a default or error out
      absoluteImagePath = uniquePossiblePaths[0]; // This could be problematic if none exist.
      logger.error(
        `Image file NOT FOUND after all checks. Defaulting to: ${absoluteImagePath}. Segmentation WILL LIKELY FAIL.`,
      );
      // It's critical to ensure image exists. Update status to failed if not found.
      await updateSegmentationStatus(
        imageId,
        'failed',
        null,
        `Image not found at any checked paths. Last tried: ${absoluteImagePath}`,
      );
      return; // Exit early
    }
  }

  // Create output directory if it doesn't exist
  const outputDir = path.join(BASE_OUTPUT_DIR, imageId); // imageId is used for output folder, ensuring uniqueness
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create log output directory
  const logOutputDir = path.join(outputDir, 'logs');
  if (!fs.existsSync(logOutputDir)) {
    fs.mkdirSync(logOutputDir, { recursive: true });
  }

  // Generate output file path
  const timestamp = Date.now();
  const outputFilename = `segmentation-${timestamp}.json`;
  const absoluteOutputPath = path.join(outputDir, outputFilename);

  // Command arguments for segmentation script
  const args = [
    SCRIPT_PATH,
    '--image_path',
    absoluteImagePath,
    '--output_path',
    absoluteOutputPath,
    '--checkpoint_path',
    CHECKPOINT_PATH,
    '--output_dir',
    logOutputDir, // Specify separate dir for logs
  ];

  // Nastavení proměnných prostředí pro Python proces
  const env = {
    ...process.env,
    // Předáme preferenci zařízení z konfigurace nebo přímo z env proměnné
    DEVICE_PREFERENCE: process.env.DEVICE_PREFERENCE || 'best',
  };

  // Log paths for debugging
  logger.info(`Segmentation paths for ${imageId}:`, {
    scriptPath: SCRIPT_PATH,
    imagePath: absoluteImagePath,
    outputPath: absoluteOutputPath,
    checkpointPath: CHECKPOINT_PATH,
    logOutputDir: logOutputDir,
    exists: {
      script: fs.existsSync(SCRIPT_PATH),
      image: fs.existsSync(absoluteImagePath),
      checkpoint: fs.existsSync(CHECKPOINT_PATH),
      outputDir: fs.existsSync(logOutputDir),
    },
  });

  // Verify that the image file exists before proceeding
  if (!fs.existsSync(absoluteImagePath)) {
    const errorMessage = `CRITICAL: Image file confirmed NOT FOUND at path just before Python script execution: ${absoluteImagePath}`;
    logger.error(errorMessage);
    await updateSegmentationStatus(imageId, 'failed', null, errorMessage);
    return; // Exit early
  }

  logger.info(
    `Starting segmentation process for image ${imageId} with command: ${PYTHON_EXECUTABLE} ${args.join(' ')}`,
  );

  return new Promise((resolve, reject) => {
    // Spawn Python process
    logger.info(`Spawning Python process for ${imageId}: ${PYTHON_EXECUTABLE} ${args.join(' ')}`);
    logger.debug(`Using device preference: ${env.DEVICE_PREFERENCE}`);

    // Předáme nastavené proměnné prostředí Python procesu
    const pythonProcess = spawn(PYTHON_EXECUTABLE, args, { env });

    let stderrData = '';
    let stdoutData = '';

    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      logger.debug(`Segmentation stdout for ${imageId}: ${data.toString()}`);
    });

    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      logger.debug(`Segmentation stderr for ${imageId}: ${data.toString()}`);
    });

    // Handle process completion
    pythonProcess.on('close', async (code) => {
      logger.info(`Python process for ${imageId} closed with code ${code}`);

      if (code === 0) {
        logger.info(`Segmentation completed successfully for ${imageId}`);

        // Check if output file exists
        if (fs.existsSync(absoluteOutputPath)) {
          try {
            // Read the segmentation result
            const resultData = JSON.parse(fs.readFileSync(absoluteOutputPath, 'utf8'));

            // Validate the result data
            if (!resultData.polygons || !Array.isArray(resultData.polygons)) {
              throw new Error('Segmentation did not return valid polygons array');
            }

            // Validate each polygon has required properties
            const validPolygons = resultData.polygons.filter((polygon: any) => {
              return polygon && Array.isArray(polygon.points) && polygon.points.length >= 3;
            });

            if (validPolygons.length === 0) {
              throw new Error('Segmentation did not return any valid polygons with at least 3 points');
            }

            // Ensure each polygon has a type (default to 'external' if not specified)
            const processedPolygons = validPolygons.map((polygon: any) => ({
              ...polygon,
              type: polygon.type || 'external',
              id: polygon.id || `poly-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            }));

            logger.debug(`Processed segmentation result for ${imageId}:`, {
              totalPolygons: resultData.polygons.length,
              validPolygons: validPolygons.length,
              processedPolygons: processedPolygons.length,
              externalPolygons: processedPolygons.filter((p: any) => p.type === 'external').length,
              internalPolygons: processedPolygons.filter((p: any) => p.type === 'internal').length,
            });

            // Update status in database with processed polygons
            await updateSegmentationStatus(imageId, 'completed', absoluteOutputPath, undefined, processedPolygons);

            // Resolve the promise (no specific result needed as status is updated)
            resolve();
          } catch (parseError: unknown) {
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            logger.error(`Error parsing segmentation result for ${imageId}:`, {
              error: parseError,
            });
            await updateSegmentationStatus(imageId, 'failed', null, `Error parsing result: ${errorMessage}`);
            reject(parseError);
          }
        } else {
          logger.error(`Segmentation output file not found for ${imageId}: ${absoluteOutputPath}`);
          await updateSegmentationStatus(imageId, 'failed', null, `Output file not found: ${absoluteOutputPath}`);
          reject(new Error(`Output file not found: ${absoluteOutputPath}`));
        }
      } else {
        // Podrobnější zpracování chyb podle návratového kódu
        let errorMessage = '';
        let errorType = 'unknown';

        switch (code) {
          case 1:
            errorType = 'input_error';
            errorMessage = 'Chyba při načítání vstupního obrázku nebo parametrů';
            break;
          case 2:
            errorType = 'general_error';
            errorMessage = 'Obecná chyba při segmentaci';
            break;
          case 3:
            errorType = 'cuda_out_of_memory';
            errorMessage = 'CUDA out of memory - nedostatek paměti GPU';
            // Automaticky nastavíme preferenci na CPU pro další úlohy
            process.env.DEVICE_PREFERENCE = 'cpu';
            logger.warn('Nastavuji DEVICE_PREFERENCE=cpu kvůli CUDA out of memory chybě');
            break;
          case 4:
            errorType = 'device_error';
            errorMessage = 'Chyba zařízení (CUDA/GPU)';
            // Automaticky nastavíme preferenci na CPU pro další úlohy
            process.env.DEVICE_PREFERENCE = 'cpu';
            logger.warn('Nastavuji DEVICE_PREFERENCE=cpu kvůli chybě zařízení');
            break;
          default:
            errorType = 'unknown_error';
            errorMessage = `Neznámá chyba (kód ${code})`;
        }

        logger.error(
          `Segmentation failed for ${imageId}. Exit code: ${code} (${errorType}). Stdout: ${stdoutData}. Stderr: ${stderrData}`,
        );

        // Pokusíme se extrahovat detailnější chybovou zprávu z výstupu
        let detailedError = stderrData || stdoutData || 'No error output';

        // Pokud je výstup ve formátu JSON, pokusíme se z něj získat chybovou zprávu
        try {
          if (stdoutData && stdoutData.includes('"error":')) {
            const jsonMatch = stdoutData.match(/\{.*\}/s);
            if (jsonMatch) {
              const errorJson = JSON.parse(jsonMatch[0]);
              if (errorJson.error) {
                detailedError = errorJson.error;
                if (errorJson.error_type) {
                  errorType = errorJson.error_type;
                }
                if (errorJson.recommendation) {
                  detailedError += ` (${errorJson.recommendation})`;
                }
              }
            }
          }
        } catch (jsonError) {
          logger.warn(`Nepodařilo se zpracovat JSON chybovou zprávu: ${jsonError}`);
        }

        // Pokud došlo k chybě zařízení, zkusíme úlohu znovu s CPU
        if (errorType === 'cuda_out_of_memory' || errorType === 'device_error') {
          logger.info(`Zkouším znovu segmentaci pro ${imageId} s CPU...`);

          // Přidáme úlohu znovu do fronty s vyšší prioritou a CPU preferencí
          try {
            // Vytvoříme nové prostředí s CPU preferencí
            const cpuEnv = {
              ...env,
              DEVICE_PREFERENCE: 'cpu',
            };

            logger.info(`Spouštím nový proces s CPU preferencí pro ${imageId}`);

            // Spustíme nový proces s CPU preferencí
            const cpuProcess = spawn(PYTHON_EXECUTABLE, args, { env: cpuEnv });

            let cpuStderrData = '';
            let cpuStdoutData = '';

            cpuProcess.stdout.on('data', (data) => {
              cpuStdoutData += data.toString();
              logger.debug(`CPU segmentation stdout for ${imageId}: ${data.toString()}`);
            });

            cpuProcess.stderr.on('data', (data) => {
              cpuStderrData += data.toString();
              logger.debug(`CPU segmentation stderr for ${imageId}: ${data.toString()}`);
            });

            cpuProcess.on('close', async (cpuCode) => {
              if (cpuCode === 0) {
                logger.info(`CPU segmentation successful for ${imageId}`);

                // Zpracujeme výsledek stejně jako v původním případě
                if (fs.existsSync(absoluteOutputPath)) {
                  try {
                    const resultData = JSON.parse(fs.readFileSync(absoluteOutputPath, 'utf8'));

                    // Validate the result data
                    if (!resultData.polygons || !Array.isArray(resultData.polygons)) {
                      throw new Error('Segmentation did not return valid polygons array');
                    }

                    // Validate each polygon has required properties
                    const validPolygons = resultData.polygons.filter((polygon: any) => {
                      return polygon && Array.isArray(polygon.points) && polygon.points.length >= 3;
                    });

                    if (validPolygons.length === 0) {
                      throw new Error('Segmentation did not return any valid polygons with at least 3 points');
                    }

                    // Ensure each polygon has a type (default to 'external' if not specified)
                    const processedPolygons = validPolygons.map((polygon: any) => ({
                      ...polygon,
                      type: polygon.type || 'external',
                      id: polygon.id || `poly-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    }));

                    // Update status in database with processed polygons
                    await updateSegmentationStatus(imageId, 'completed', absoluteOutputPath, undefined, processedPolygons);

                    // Resolve the promise (no specific result needed as status is updated)
                    resolve();
                  } catch (parseError) {
                    logger.error(`Error parsing CPU segmentation result for ${imageId}:`, { error: parseError });
                    await updateSegmentationStatus(
                      imageId,
                      'failed',
                      null,
                      `${errorMessage}. Details: ${detailedError}. CPU fallback also failed: ${parseError}`
                    );
                    reject(parseError);
                  }
                } else {
                  logger.error(`CPU segmentation output file not found for ${imageId}: ${absoluteOutputPath}`);
                  await updateSegmentationStatus(
                    imageId,
                    'failed',
                    null,
                    `${errorMessage}. Details: ${detailedError}. CPU fallback failed: Output file not found`
                  );
                  reject(new Error(`Output file not found after CPU segmentation: ${absoluteOutputPath}`));
                }
              } else {
                logger.error(`CPU segmentation also failed for ${imageId} with code ${cpuCode}`);
                await updateSegmentationStatus(
                  imageId,
                  'failed',
                  null,
                  `${errorMessage}. Details: ${detailedError}. CPU fallback failed with code ${cpuCode}`
                );
                reject(new Error(`Script failed with code ${code} and CPU fallback also failed with code ${cpuCode}`));
              }
            });

            cpuProcess.on('error', async (err) => {
              logger.error(`Failed to start CPU Python script for image ${imageId}:`, { error: err });
              await updateSegmentationStatus(
                imageId,
                'failed',
                null,
                `${errorMessage}. Details: ${detailedError}. CPU fallback failed to start: ${err.message}`
              );
              reject(err);
            });

            // Neukončujeme zde, protože čekáme na výsledek CPU procesu
            return;
          } catch (cpuError: unknown) {
            const cpuErrorMessage = cpuError instanceof Error ? cpuError.message : String(cpuError);
            logger.error(`Error starting CPU segmentation for ${imageId}:`, { error: cpuError });
            await updateSegmentationStatus(
              imageId,
              'failed',
              null,
              `${errorMessage}. Details: ${detailedError}. CPU fallback failed to start: ${cpuErrorMessage}`
            );
            reject(new Error(`Script failed with code ${code} and CPU fallback failed to start: ${cpuErrorMessage}`));
            return;
          }
        }

        // Pro ostatní chyby jen aktualizujeme stav a odmítneme promise
        await updateSegmentationStatus(
          imageId,
          'failed',
          null,
          `${errorMessage}. Details: ${detailedError}`,
        );

        reject(new Error(`Script failed with code ${code} (${errorType}): ${errorMessage}`));
      }
    });

    // Handle process errors
    pythonProcess.on('error', async (err) => {
      logger.error(`Failed to start Python script for image ${imageId}:`, {
        error: err,
      });
      await updateSegmentationStatus(imageId, 'failed', null, `Failed to start script: ${err.message}`);
      reject(err);
    });
  });
}

// Set up event listeners for queue events
segmentationQueue.on('queue:updated', (status) => {
  try {
    // Emit queue status update via WebSocket
    const io = getSocketIO(); // Updated function call
    if (io) {
      // Add timestamp to the status update
      const statusWithTimestamp = {
        ...status,
        timestamp: new Date().toISOString(),
        queueLength: status.pendingTasks?.length || 0,
        activeTasksCount: status.runningTasks?.length || 0,
      };

      // Broadcast to all authenticated users
      io.emit('segmentation_queue_update', statusWithTimestamp);

      logger.debug('Broadcasting queue status update', {
        queueLength: statusWithTimestamp.queueLength,
        activeTasksCount: statusWithTimestamp.activeTasksCount,
      });
    } else {
      logger.warn('Socket.IO not available, cannot broadcast queue status update.');
    }
  } catch (error) {
    logger.error('Error broadcasting queue status update', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Setup the segmentation queue and verify that all required resources are available
 * @returns Promise<boolean> - True if setup was successful, false otherwise
 */
export const setupSegmentationQueue = async (): Promise<boolean> => {
  logger.info('Setting up segmentation queue...');

  try {
    // Check if the script exists
    const scriptExists = fs.existsSync(SCRIPT_PATH);
    if (!scriptExists) {
      logger.error(`Segmentation script not found at ${SCRIPT_PATH}`);
      return false;
    }

    // Check if the checkpoint exists
    const checkpointExists = fs.existsSync(CHECKPOINT_PATH);
    if (!checkpointExists) {
      logger.error(`Checkpoint not found at ${CHECKPOINT_PATH}`);
      return false;
    }

    // Check if the ML service is available (if configured)
    if (ML_SERVICE_URL) {
      try {
        // Make a simple request to the ML service to check if it's available
        const response = await fetch(`${ML_SERVICE_URL}/health`);
        if (!response.ok) {
          logger.error(`ML service health check failed: ${response.status} ${response.statusText}`);
          return false;
        }
        logger.info('ML service is available');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error connecting to ML service: ${errorMessage}`);
        return false;
      }
    }

    // Create output directories if they don't exist
    if (!fs.existsSync(BASE_OUTPUT_DIR)) {
      logger.info(`Creating output directory: ${BASE_OUTPUT_DIR}`);
      fs.mkdirSync(BASE_OUTPUT_DIR, { recursive: true });
    }

    // Register the task executor
    segmentationQueue.registerExecutor(SEGMENTATION_TASK_TYPE, executeSegmentationTask);

    logger.info('Segmentation queue setup complete');
    return true;
  } catch (error) {
    logger.error('Error setting up segmentation queue:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
    });
    return false;
  }
};

export default {
  triggerSegmentationTask,
  getSegmentationQueueStatus,
  cancelSegmentationTask,
  segmentationQueue,
  setupSegmentationQueue,
};
