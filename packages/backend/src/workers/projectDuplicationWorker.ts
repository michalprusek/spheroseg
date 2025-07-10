/**
 * Project Duplication Worker
 *
 * This worker handles project duplication in a separate thread to avoid
 * blocking the main event loop. It uses worker_threads to run in a separate
 * thread and performs parallel file operations for better performance.
 */

import { workerData, parentPort } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { Pool, PoolClient } from 'pg';
import { promisify } from 'util';
import * as os from 'os';

// Promisify fs methods
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

// Database pool
let pool: Pool;

// Interface for worker data
interface DuplicationWorkerData {
  taskId: string;
  originalProjectId: string;
  newProjectId: string;
  userId: string;
  options: {
    newTitle?: string;
    copyFiles?: boolean;
    copySegmentations?: boolean;
    resetStatus?: boolean;
    baseDir?: string;
  };
  totalItems?: number;
}

// Message types
type WorkerMessage =
  | {
      type: 'progress';
      progress: number;
      processedItems: number;
      totalItems: number;
    }
  | {
      type: 'complete';
      result: Record<string, unknown>;
      processedItems: number;
      totalItems: number;
    }
  | {
      type: 'error';
      error: string;
      progress?: number;
      processedItems?: number;
      totalItems?: number;
    };

/**
 * Function to send a message to the parent thread
 */
function sendMessage(message: WorkerMessage): void {
  if (parentPort) {
    parentPort.postMessage(message);
  }
}

/**
 * Function to send progress updates back to the parent thread
 */
function sendProgress(progress: number, processedItems: number, totalItems: number): void {
  sendMessage({
    type: 'progress',
    progress,
    processedItems,
    totalItems,
  });
}

/**
 * Function to send completion notification back to the parent thread
 */
function sendComplete(
  result: Record<string, unknown>,
  processedItems: number,
  totalItems: number
): void {
  sendMessage({
    type: 'complete',
    result,
    processedItems,
    totalItems,
  });
}

/**
 * Function to send error notification back to the parent thread
 */
function sendError(error: Error | string, progress = 0, processedItems = 0, totalItems = 0): void {
  sendMessage({
    type: 'error',
    error: error instanceof Error ? error.message : String(error),
    progress,
    processedItems,
    totalItems,
  });
}

/**
 * Function to setup database connection
 */
async function setupDatabase(): Promise<boolean> {
  try {
    // Initialize the database pool
    // Note: In a real worker thread environment, we'd need to load the config from a file
    // or receive it through workerData. This is a simplified version.
    const dbConfig = {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'spheroseg',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

    pool = new Pool(dbConfig);

    // Test connection
    await pool.query('SELECT NOW()');
    return true;
  } catch (error) {
    // Log error and send it to parent process
    sendError(
      'Failed to connect to database: ' + (error instanceof Error ? error.message : String(error))
    );
    return false;
  }
}

/**
 * Function to copy a file with error handling
 */
async function copyImageFile(
  sourcePath: string,
  targetPath: string,
  baseDir: string
): Promise<boolean> {
  try {
    // Normalize paths
    const normalizedSourcePath = sourcePath.startsWith('/') ? sourcePath.substring(1) : sourcePath;
    const normalizedTargetPath = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;

    // Create full paths
    const fullSourcePath = path.join(baseDir, normalizedSourcePath);
    const fullTargetPath = path.join(baseDir, normalizedTargetPath);

    // Create target directory if it doesn't exist
    const targetDir = path.dirname(fullTargetPath);
    if (!(await exists(targetDir))) {
      await mkdir(targetDir, { recursive: true });
    }

    // Check if source file exists
    if (await exists(fullSourcePath)) {
      // Copy file
      await copyFile(fullSourcePath, fullTargetPath);
      return true;
    } else {
      // Log warning through parent process
      sendMessage({
        type: 'progress',
        progress: 0,
        processedItems: 0,
        totalItems: 0,
        message: `Source file not found: ${fullSourcePath}`,
      });
      return false;
    }
  } catch (error) {
    // Log error through parent process
    sendMessage({
      type: 'error',
      error: `Error copying file: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
}

/**
 * Function to generate new file paths for duplicated image
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
 * Process a batch of images for duplication
 */
async function processBatch(
  client: PoolClient,
  batch: Record<string, unknown>[],
  newProjectId: string,
  userId: string,
  options: DuplicationWorkerData['options'],
  processedItems: number,
  totalItems: number
): Promise<number> {
  // Process files in parallel
  const fileOperations = [];
  const dbOperations = [];

  for (const image of batch) {
    try {
      // Generate new file paths
      const { newStoragePath, newThumbnailPath } = generateNewFilePaths(
        image.storage_path,
        image.thumbnail_path,
        newProjectId
      );

      // Prepare segmentation variables
      let segmentationStatus = 'pending';
      let segmentationResultPath: string | null = null;
      let segmentationOperation = Promise.resolve(true);

      // Check if we need to copy segmentation results
      if (
        options.copySegmentations &&
        !options.resetStatus &&
        image.segmentation_status === 'completed' &&
        image.segmentation_result_path
      ) {
        // Generate new segmentation result path
        const segmentationFileName = image.segmentation_result_path.split('/').pop() || '';
        const newSegmentationPath = `/uploads/${newProjectId}/segmentation-${Date.now()}-${segmentationFileName}`;

        // Add segmentation file copy operation if needed
        if (options.copyFiles) {
          const baseDir = options.baseDir || process.cwd();
          segmentationOperation = copyImageFile(
            image.segmentation_result_path,
            newSegmentationPath,
            path.join(baseDir, 'public')
          );
        }

        segmentationStatus = 'completed';
        segmentationResultPath = newSegmentationPath;
      }

      // Add file copy operations if needed
      if (options.copyFiles) {
        const baseDir = options.baseDir || process.cwd();

        // Copy main image
        fileOperations.push(
          copyImageFile(image.storage_path, newStoragePath, path.join(baseDir, 'public'))
        );

        // Copy thumbnail if exists
        if (image.thumbnail_path && newThumbnailPath) {
          fileOperations.push(
            copyImageFile(image.thumbnail_path, newThumbnailPath, path.join(baseDir, 'public'))
          );
        }

        // Add segmentation file copy operation
        fileOperations.push(segmentationOperation);
      }

      // Add database operation
      dbOperations.push({
        sql: `
          INSERT INTO images (
            project_id, user_id, name, storage_path, thumbnail_path,
            width, height, metadata, status, segmentation_status, segmentation_result_path
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `,
        params: [
          newProjectId,
          userId,
          `${image.name} (Copy)`,
          newStoragePath,
          newThumbnailPath,
          image.width,
          image.height,
          image.metadata,
          options.resetStatus ? 'pending' : image.status,
          segmentationStatus,
          segmentationResultPath,
        ],
      });
    } catch (imageError) {
      // Log error through parent process
      sendMessage({
        type: 'error',
        error: `Error preparing image duplication for ${image.id}: ${imageError instanceof Error ? imageError.message : String(imageError)}`,
      });
      // Continue with other images, don't fail the whole task
    }
  }

  // Wait for all file operations to complete
  if (fileOperations.length > 0) {
    await Promise.all(fileOperations);
  }

  // Execute all database operations sequentially
  for (const op of dbOperations) {
    try {
      await client.query(op.sql, op.params);
      processedItems++;

      // Send progress update
      const progress = Math.floor((processedItems / totalItems) * 100);
      if (processedItems % 5 === 0 || progress >= 100) {
        // Don't send too many updates
        sendProgress(progress, processedItems, totalItems);
      }
    } catch (dbError) {
      // Log error through parent process
      sendMessage({
        type: 'error',
        error: `Error executing database operation: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
      });
      // Continue with other operations, don't fail the whole task
    }
  }

  return processedItems;
}

/**
 * Main function to process the duplication
 */
async function processProjectDuplication(): Promise<void> {
  try {
    // Extract data from worker data
    const {
      taskId,
      originalProjectId,
      newProjectId,
      userId,
      options,
      totalItems: initialTotalItems,
    } = workerData as DuplicationWorkerData;

    // Send log message through parentPort
    sendMessage({
      type: 'progress',
      progress: 0,
      processedItems: 0,
      totalItems: initialTotalItems || 0,
      message: `Starting project duplication task ${taskId}`,
    });

    // Setup database connection
    if (!(await setupDatabase())) {
      return;
    }

    // Get the updated new project
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [newProjectId]);

    if (projectResult.rows.length === 0) {
      throw new Error('New project not found');
    }

    // Fetch images from the original project
    const imagesResult = await pool.query('SELECT * FROM images WHERE project_id = $1', [
      originalProjectId,
    ]);

    const originalImages = imagesResult.rows;
    const totalItems = initialTotalItems || originalImages.length + 1; // +1 for project creation
    let processedItems = 1; // Project creation already done

    // Send log message through parentPort
    sendMessage({
      type: 'progress',
      progress: processedItems / totalItems,
      processedItems,
      totalItems,
      message: `Processing ${originalImages.length} images for duplication task ${taskId}`,
    });

    // Create project directory if copying files
    if (options.copyFiles) {
      const baseDir = options.baseDir || process.cwd();
      const projectDir = path.join(baseDir, 'public', 'uploads', newProjectId);

      if (!(await exists(projectDir))) {
        await mkdir(projectDir, { recursive: true });
        // Log directory creation
        sendMessage({
          type: 'progress',
          progress: processedItems / totalItems,
          processedItems,
          totalItems,
          message: `Created directory for new project: ${projectDir}`,
        });
      }
    }

    // Send initial progress update
    sendProgress(5, processedItems, totalItems);

    // Get a client for transaction
    const client = await pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Determine the batch size based on system resources
      const cpuCount = os.cpus().length;
      const OPTIMAL_BATCH_SIZE = Math.max(3, Math.min(10, cpuCount));

      // Process images in batches to optimize performance
      const BATCH_SIZE = OPTIMAL_BATCH_SIZE;
      const batches = Math.ceil(originalImages.length / BATCH_SIZE);

      // Process batches sequentially (each batch processes files in parallel)
      for (let i = 0; i < batches; i++) {
        const batchStart = i * BATCH_SIZE;
        const batchEnd = Math.min((i + 1) * BATCH_SIZE, originalImages.length);
        const batch = originalImages.slice(batchStart, batchEnd);

        // Log batch processing progress
        sendMessage({
          type: 'progress',
          progress: processedItems / totalItems,
          processedItems,
          totalItems,
          message: `Processing batch ${i + 1}/${batches} for duplication task ${taskId}`,
        });

        // Process this batch
        processedItems = await processBatch(
          client,
          batch,
          newProjectId,
          userId,
          options,
          processedItems,
          totalItems
        );
      }

      // Commit the transaction
      await client.query('COMMIT');

      // Get the updated project after all images are processed
      const updatedProjectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [
        newProjectId,
      ]);

      const updatedProject = updatedProjectResult.rows[0];

      // Return success
      sendComplete(updatedProject, totalItems, totalItems);
    } catch (error) {
      // Rollback the transaction on error
      await client.query('ROLLBACK');
      // Log transaction error using sendError
      sendError(
        error instanceof Error ? error : String(error),
        Math.floor((processedItems / totalItems) * 100),
        processedItems,
        totalItems
      );
    } finally {
      // Release the client
      client.release();
    }
  } catch (error) {
    // Send error to parent through sendError
    sendError(error instanceof Error ? error : String(error));
  } finally {
    // Close the pool when done
    if (pool) {
      await pool.end();
    }
  }
}

// Listen for messages from the parent thread
if (parentPort) {
  parentPort.on('message', (message) => {
    if (message === 'cancel') {
      sendMessage({
        type: 'progress',
        progress: 100,
        processedItems: 0,
        totalItems: 0,
        message: 'Received cancel message, shutting down worker',
      });
      process.exit(0);
    }
  });
}

// Start processing
processProjectDuplication().catch((error) => {
  sendError(`Unhandled error in worker: ${error instanceof Error ? error.message : String(error)}`);
});
