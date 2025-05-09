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
import { getIO } from '../socket'; // Import Socket.IO instance
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
  defaultRetryDelay: 10000 // 10 seconds
});

// Base directory for server root
const SERVER_ROOT = path.resolve(__dirname, '..', '..');

// --- Configuration ---
// Python executable path - use virtual environment if available
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || (fs.existsSync('/venv/bin/python') ? '/venv/bin/python' : 'python3');
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
    '/app/ML/resunet_segmentation.py'
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
    logger.warn(`Script not found at ${SCRIPT_PATH} or any alternative paths. Will continue but segmentation may fail.`);
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
    config.segmentation.checkpointPath
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
  status: 'completed' | 'failed' | 'processing',
  resultPath?: string | null,
  errorLog?: string,
  polygons?: any[]
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
    // Update segmentation_results table with structured data
    await pool.query(
      `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
      [status, clientResultPath ? {
        path: clientResultPath,
        polygons: polygons || [], // Include polygons if available
        metadata: {
          processedAt: new Date().toISOString(),
          modelType: 'resunet',
          hasNestedObjects: polygons ? polygons.some(p => p.type === 'internal') : false
        }
      } : null, imageId] // Store result path, polygons, and metadata in result_data
    );

    // Update images table
    await pool.query(
      `UPDATE images SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, imageId]
    );

    // Notify the client via Socket.IO
    try {
      // Fetch user ID associated with the image to target the correct user room
      const userQuery = await pool.query('SELECT user_id FROM images WHERE id = $1', [imageId]);

      if (userQuery.rows.length > 0) {
        const userId = userQuery.rows[0].user_id;
        logger.debug(`Emitting segmentation update to user room: ${userId}, Image ID: ${imageId}, Status: ${status}`);

        const io = getIO();
        // Emit to user's room - now users automatically join rooms with their userId
        io.to(userId).emit('segmentation_update', {
          imageId: imageId,
          status: status,
          resultPath: clientResultPath, // Send client-accessible path
          error: errorLog,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.error(`Could not find user ID for image ${imageId} to send socket notification.`);
      }
    } catch (socketError) {
      logger.error(`Error sending socket notification for image ${imageId}:`, { error: socketError });
    }
  } catch (dbError) {
    logger.error(`Database error updating status for image ${imageId}:`, { error: dbError });
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
  priority: number = 1
): Promise<string> => {
  logger.info(`Queueing segmentation for imageId: ${imageId}, path: ${imagePath}, priority: ${priority}`);

  try {
    // Check if this is a force resegment task
    const forceResegment = parameters?.force_resegment === true;

    // Update status to indicate segmentation is in progress
    if (forceResegment) {
      await updateSegmentationStatus(imageId, 'processing');
    }

    // Add task to queue
    const taskId = segmentationQueue.addTask(
      SEGMENTATION_TASK_TYPE,
      {
        imageId,
        imagePath,
        parameters
      },
      {
        id: imageId, // Use imageId as taskId for easier tracking
        priority,
        forceRequeue: forceResegment
      }
    );

    return taskId;
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
  const status = segmentationQueue.getStatus();

  try {
    // Get image details for running tasks
    if (status.runningTasks.length > 0) {
      const imagesQuery = await pool.query(
        `SELECT id, name, project_id FROM images WHERE id = ANY($1::uuid[])`,
        [status.runningTasks]
      );

      const processingImages = imagesQuery.rows.map(image => ({
        id: image.id,
        name: image.name,
        projectId: image.project_id
      }));

      // Return enhanced status with image details
      return {
        ...status,
        processingImages
      };
    }
  } catch (error) {
    logger.error('Error enhancing queue status with image details:', { error });
  }

  // Return basic status if there's an error or no running tasks
  return status;
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
  let { imagePath } = task.data;

  logger.info(`Executing segmentation for imageId: ${imageId}, path: ${imagePath}`);

  // Construct absolute paths
  let absoluteImagePath;

  // Log the original path for debugging
  logger.info(`Original image path: ${imagePath}`);

  // Normalize the path to handle various path formats
  // First, handle duplicated 'uploads' in the path (can be multiple occurrences)
  const originalPath = imagePath;
  while (imagePath.includes('uploads/uploads/')) {
    // Using a new variable to avoid modifying the const
    const fixedPath = imagePath.replace(/uploads\/uploads\//i, 'uploads/');
    imagePath = fixedPath; // This assignment will be fixed in the next edit
    logger.info(`Fixed duplicated uploads path to: ${imagePath}`);
  }

  // Create a symbolic link to handle the duplicated uploads path if needed
  try {
    // Extract project ID from the image ID or path
    let projectId = '';

    // Try to extract from imageId (UUID format)
    if (imageId && imageId.includes('-')) {
      projectId = imageId.split('-')[0]; // Extract first part of UUID as project ID
    }

    // Try to extract from path if not found in imageId
    if (!projectId && imagePath) {
      const pathParts = imagePath.split('/');
      for (const part of pathParts) {
        if (part.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          projectId = part;
          break;
        }
      }
    }

    logger.info(`Extracted project ID: ${projectId}`);

    // Create symbolic links and directories
    const uploadsDir = path.join(BASE_UPLOADS_DIR);

    // Create a symbolic link from uploads/uploads to uploads
    const uploadsUploadsDir = path.join(BASE_UPLOADS_DIR, 'uploads');
    if (!fs.existsSync(uploadsUploadsDir)) {
      logger.info(`Creating uploads/uploads directory: ${uploadsUploadsDir}`);
      fs.mkdirSync(uploadsUploadsDir, { recursive: true });
    }

    const symlinkPath = path.join(uploadsUploadsDir, 'uploads');
    if (!fs.existsSync(symlinkPath)) {
      logger.info(`Creating symbolic link: ${symlinkPath} -> ${uploadsDir}`);
      try {
        fs.symlinkSync(uploadsDir, symlinkPath, 'dir');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to create symbolic link: ${errorMessage}`);
      }
    }

    // If we have a project ID, create project directories
    if (projectId) {
      // Create the project directory if it doesn't exist
      const projectDir = path.join(BASE_UPLOADS_DIR, projectId);
      if (!fs.existsSync(projectDir)) {
        logger.info(`Creating project directory: ${projectDir}`);
        fs.mkdirSync(projectDir, { recursive: true });
      }

      // Create the project images directory if it doesn't exist
      const projectImagesDir = path.join(projectDir, 'images');
      if (!fs.existsSync(projectImagesDir)) {
        logger.info(`Creating project images directory: ${projectImagesDir}`);
        fs.mkdirSync(projectImagesDir, { recursive: true });
      }

      // Create a symbolic link for the project in uploads/uploads
      const projectUploadsUploadsDir = path.join(uploadsUploadsDir, projectId);
      if (!fs.existsSync(projectUploadsUploadsDir)) {
        logger.info(`Creating symbolic link for project: ${projectUploadsUploadsDir} -> ${projectDir}`);
        try {
          fs.symlinkSync(projectDir, projectUploadsUploadsDir, 'dir');
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to create project symbolic link: ${errorMessage}`);
        }
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error creating directories: ${errorMessage}`);
  }

  // Extract the filename from the path
  const filename = path.basename(imagePath);
  logger.info(`Extracted filename: ${filename}`);

  // Extract potential project ID from the path
  let projectId = '';
  const pathParts = imagePath.split('/');
  if (pathParts.length >= 2) {
    // Check if the first part looks like a UUID
    const potentialProjectId = pathParts[0];
    if (potentialProjectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      projectId = potentialProjectId;
      logger.info(`Extracted project ID from path: ${projectId}`);
    } else if (pathParts.length >= 3 && pathParts[1].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Check if the second part is a UUID (for paths like uploads/project-id/...)
      projectId = pathParts[1];
      logger.info(`Extracted project ID from second path part: ${projectId}`);
    }
  }

  // Remove any leading 'uploads/' to avoid path resolution issues
  const normalizedPath = imagePath.replace(/^uploads\//i, '');
  logger.info(`Normalized path: ${normalizedPath}`);

  // Generate a list of possible paths to try
  const possiblePaths = [];

  // Handle different path formats
  if (imagePath.startsWith('/app/')) {
    // Docker absolute path
    possiblePaths.push(imagePath);
  }

  if (imagePath.startsWith('/uploads/')) {
    // Path with /uploads/ prefix
    possiblePaths.push(path.join(BASE_UPLOADS_DIR, imagePath.substring('/uploads/'.length)));
  }

  // Add normalized path
  possiblePaths.push(path.join(BASE_UPLOADS_DIR, normalizedPath));

  // Add project-specific paths if we have a project ID
  if (projectId) {
    possiblePaths.push(
      path.join(BASE_UPLOADS_DIR, projectId, filename),
      path.join(BASE_UPLOADS_DIR, projectId, 'images', filename)
    );
  }

  // Add direct filename path as a fallback
  possiblePaths.push(path.join(BASE_UPLOADS_DIR, filename));

  // Try each path and use the first one that exists
  for (const possiblePath of possiblePaths) {
    logger.info(`Checking if file exists at: ${possiblePath}`);
    if (fs.existsSync(possiblePath)) {
      absoluteImagePath = possiblePath;
      logger.info(`Found image at: ${absoluteImagePath}`);
      break;
    }
  }

  // If no path was found, try to create project directories and check again
  if (!absoluteImagePath) {
    logger.warn(`No existing image found, attempting to create project directories`);

    // Create project directories if we have a project ID
    if (projectId) {
      const projectDir = path.join(BASE_UPLOADS_DIR, projectId);
      const projectImagesDir = path.join(projectDir, 'images');

      try {
        // Create project directory if it doesn't exist
        if (!fs.existsSync(projectDir)) {
          logger.info(`Creating project directory: ${projectDir}`);
          fs.mkdirSync(projectDir, { recursive: true });
        }

        // Create images directory if it doesn't exist
        if (!fs.existsSync(projectImagesDir)) {
          logger.info(`Creating project images directory: ${projectImagesDir}`);
          fs.mkdirSync(projectImagesDir, { recursive: true });
        }

        // Try the project paths again
        const projectPaths = [
          path.join(projectDir, filename),
          path.join(projectImagesDir, filename)
        ];

        for (const projectPath of projectPaths) {
          logger.info(`Checking if file exists at (after directory creation): ${projectPath}`);
          if (fs.existsSync(projectPath)) {
            absoluteImagePath = projectPath;
            logger.info(`Found image at (after directory creation): ${absoluteImagePath}`);
            break;
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error creating project directories: ${errorMessage}`);
      }
    }

    // If still no path was found, use the first one as a default
    if (!absoluteImagePath) {
      absoluteImagePath = possiblePaths[0];
      logger.warn(`No existing image found after directory creation, using default path: ${absoluteImagePath}`);
    }
  }

  // Create output directory if it doesn't exist
  const outputDir = path.join(BASE_OUTPUT_DIR, imageId);
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
  let args = [
    SCRIPT_PATH,
    '--image_path', absoluteImagePath,
    '--output_path', absoluteOutputPath,
    '--checkpoint_path', CHECKPOINT_PATH,
    '--output_dir', logOutputDir, // Specify separate dir for logs
  ];

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
      outputDir: fs.existsSync(logOutputDir)
    }
  });

  // Verify that the image file exists before proceeding
  if (!fs.existsSync(absoluteImagePath)) {
    const errorMessage = `Image file not found at path: ${absoluteImagePath}`;
    logger.error(errorMessage);

    // Try to find the image in alternative locations
    logger.info(`Attempting to find image in alternative locations for ${imageId}`);

    // Extract project ID and filename
    // First try to extract from the path format: projectId/images/filename
    let projectId = '';
    const pathParts = imagePath.split('/');

    if (pathParts.length >= 2) {
      // The first part might be the project ID
      projectId = pathParts[0];
      logger.info(`Extracted potential project ID from path: ${projectId}`);
    }

    const filename = path.basename(imagePath);
    logger.info(`Extracted filename: ${filename}`);

    // Create project directory if it doesn't exist
    if (projectId && projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const projectDir = path.join(BASE_UPLOADS_DIR, projectId);
      const projectImagesDir = path.join(projectDir, 'images');

      if (!fs.existsSync(projectDir)) {
        logger.info(`Creating project directory: ${projectDir}`);
        fs.mkdirSync(projectDir, { recursive: true });
      }

      if (!fs.existsSync(projectImagesDir)) {
        logger.info(`Creating project images directory: ${projectImagesDir}`);
        fs.mkdirSync(projectImagesDir, { recursive: true });
      }
    }

    const alternativePaths = [
      path.join(BASE_UPLOADS_DIR, projectId, filename),
      path.join(BASE_UPLOADS_DIR, projectId, 'images', filename),
      path.join(BASE_UPLOADS_DIR, filename)
    ];

    let foundAlternativePath = null;
    for (const altPath of alternativePaths) {
      logger.info(`Checking alternative path: ${altPath}`);
      if (fs.existsSync(altPath)) {
        foundAlternativePath = altPath;
        logger.info(`Found image at alternative path: ${altPath}`);
        break;
      }
    }

    if (foundAlternativePath) {
      absoluteImagePath = foundAlternativePath;
      logger.info(`Using alternative image path: ${absoluteImagePath}`);

      // Update the command arguments with the new image path
      args = [
        SCRIPT_PATH,
        '--image_path', absoluteImagePath,
        '--output_path', absoluteOutputPath,
        '--checkpoint_path', CHECKPOINT_PATH,
        '--output_dir', logOutputDir,
      ];

      logger.info(`Updated command arguments with new image path`);
    } else {
      // If no alternative is found, update status and reject
      await updateSegmentationStatus(imageId, 'failed', null, errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
  }

  // Add any additional parameters from the request
  if (parameters) {
    // Add model_type if available
    if (parameters.model_type) {
      logger.debug(`Using specified model type: ${parameters.model_type}`);
      args.push('--model_type', String(parameters.model_type));
    } else {
      // Use default model_type if not specified
      logger.debug('No model_type specified, using default: resunet');
      args.push('--model_type', 'resunet');
    }

    // Add other parameters
    Object.entries(parameters).forEach(([key, value]) => {
      // Skip priority and model_type parameters
      if (key !== 'priority' && key !== 'model_type' && value !== undefined && value !== null) {
        // Convert camelCase to snake_case for Python arguments
        const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        args.push(`--${snakeCaseKey}`, String(value));
      }
    });
  } else {
    // Use default model_type if no parameters
    logger.debug('No parameters specified, using default model_type: resunet');
    args.push('--model_type', 'resunet');
  }

  // Final check to ensure the image file exists before running the script
  if (!fs.existsSync(absoluteImagePath)) {
    const errorMessage = `Image file not found at final path: ${absoluteImagePath}`;
    logger.error(errorMessage);

    // Try to find the image in the database
    try {
      logger.info(`Attempting to find image in database for imageId: ${imageId}`);
      const imageQuery = await pool.query(
        `SELECT storage_path FROM images WHERE id = $1`,
        [imageId]
      );

      if (imageQuery.rows.length > 0) {
        const dbImagePath = imageQuery.rows[0].storage_path;
        logger.info(`Found image in database with storage_path: ${dbImagePath}`);

        // Check if the database path exists
        const dbAbsolutePath = path.join(BASE_UPLOADS_DIR, dbImagePath.replace(/^\/uploads\//, ''));
        logger.info(`Checking if database path exists: ${dbAbsolutePath}`);

        if (fs.existsSync(dbAbsolutePath)) {
          logger.info(`Found image at database path: ${dbAbsolutePath}`);
          absoluteImagePath = dbAbsolutePath;

          // Update the command arguments with the new image path
          args = [
            SCRIPT_PATH,
            '--image_path', absoluteImagePath,
            '--output_path', absoluteOutputPath,
            '--checkpoint_path', CHECKPOINT_PATH,
            '--output_dir', logOutputDir,
          ];

          logger.info(`Updated command arguments with database path`);
        } else {
          logger.error(`Database path does not exist: ${dbAbsolutePath}`);
          await updateSegmentationStatus(imageId, 'failed', null, `Image file not found at database path: ${dbAbsolutePath}`);
          return Promise.reject(new Error(errorMessage));
        }
      } else {
        logger.error(`Image not found in database for imageId: ${imageId}`);
        await updateSegmentationStatus(imageId, 'failed', null, errorMessage);
        return Promise.reject(new Error(errorMessage));
      }
    } catch (dbError: unknown) {
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      logger.error(`Error querying database for image: ${errorMessage}`);
      await updateSegmentationStatus(imageId, 'failed', null, errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
  }

  // Log the command
  logger.debug(`Running command: ${PYTHON_EXECUTABLE} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    // Spawn Python process
    logger.info(`Spawning Python process for ${imageId}: ${PYTHON_EXECUTABLE} ${args.join(' ')}`);
    const pythonProcess = spawn(PYTHON_EXECUTABLE, args);

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
            logger.debug(`Parsed result data for ${imageId}:`, {
              polygonsCount: resultData.polygons ? resultData.polygons.length : 0,
              hasPolygons: !!resultData.polygons
            });

            // Update status in database
            await updateSegmentationStatus(
              imageId,
              'completed',
              absoluteOutputPath,
              undefined,
              resultData.polygons
            );

            // Resolve the promise (no specific result needed as status is updated)
            resolve();
          } catch (parseError: unknown) {
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            logger.error(`Error parsing segmentation result for ${imageId}:`, { error: parseError });
            await updateSegmentationStatus(imageId, 'failed', null, `Error parsing result: ${errorMessage}`);
            reject(parseError);
          }
        } else {
          logger.error(`Segmentation output file not found for ${imageId}: ${absoluteOutputPath}`);
          await updateSegmentationStatus(imageId, 'failed', null, `Output file not found: ${absoluteOutputPath}`);
          reject(new Error(`Output file not found: ${absoluteOutputPath}`));
        }
      } else {
        logger.error(`Segmentation failed for ${imageId}. Exit code: ${code}. Stdout: ${stdoutData}. Stderr: ${stderrData}`);
        await updateSegmentationStatus(imageId, 'failed', null, `Script failed with code ${code}. Details: ${stderrData || stdoutData || 'No error output'}`);
        reject(new Error(`Script failed with code ${code}`));
      }
    });

    // Handle process errors
    pythonProcess.on('error', async (err) => {
      logger.error(`Failed to start Python script for image ${imageId}:`, { error: err });
      await updateSegmentationStatus(imageId, 'failed', null, `Failed to start script: ${err.message}`);
      reject(err);
    });
  });
}

// Set up event listeners for queue events
segmentationQueue.on('queue:updated', (status) => {
  try {
    // Emit queue status update via WebSocket
    const io = getIO();
    
    // Add timestamp to the status update
    const statusWithTimestamp = {
      ...status,
      timestamp: new Date().toISOString(),
      queueLength: status.pendingTasks?.length || 0,
      activeTasksCount: status.runningTasks?.length || 0
    };
    
    // Broadcast to all authenticated users
    io.emit('segmentation_queue_update', statusWithTimestamp);
    
    logger.debug('Broadcasting queue status update', { 
      queueLength: statusWithTimestamp.queueLength,
      activeTasksCount: statusWithTimestamp.activeTasksCount
    });
  } catch (error) {
    logger.error('Error broadcasting queue status update', {
      error: error instanceof Error ? error.message : String(error)
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
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return false;
  }
};

export default {
  triggerSegmentationTask,
  getSegmentationQueueStatus,
  cancelSegmentationTask,
  segmentationQueue,
  setupSegmentationQueue
};
