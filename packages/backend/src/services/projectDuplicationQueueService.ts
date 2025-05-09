/**
 * Project Duplication Queue Service
 *
 * This service provides a specialized implementation of the task queue
 * for project duplication tasks, using the generic task queue service.
 */

import { Pool } from 'pg';
import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../socket'; // Import Socket.IO instance
import logger from '../utils/logger';
import { createTaskQueue, Task } from './taskQueueService';
import projectDuplicationService, { DuplicationOptions, Project } from './projectDuplicationService';

/**
 * Interface for project duplication task data
 */
export interface ProjectDuplicationTaskData {
  taskId: string; // UUID for the database task record
  originalProjectId: string;
  userId: string;
  options: DuplicationOptions;
}

/**
 * Interface for progress update data
 */
export interface DuplicationProgressUpdate {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  processedItems: number;
  totalItems: number;
  newProjectId?: string;
  result?: any;
  error?: string;
}

/**
 * Project duplication task type
 */
const PROJECT_DUPLICATION_TASK_TYPE = 'project_duplication';

/**
 * Create a specialized project duplication queue
 */
const projectDuplicationQueue = createTaskQueue<ProjectDuplicationTaskData>({
  maxConcurrent: 2, // Only process 2 project duplications at a time to avoid overloading the system
  defaultPriority: 1,
  defaultTimeout: 1800000, // 30 minutes - duplication can take a while for large projects
  defaultRetries: 1,
  defaultRetryDelay: 10000 // 10 seconds
});

/**
 * Register the project duplication task executor
 */
projectDuplicationQueue.registerExecutor(PROJECT_DUPLICATION_TASK_TYPE, executeProjectDuplicationTask);

/**
 * Function to update duplication status in DB and notify client
 *
 * @param pool Database pool
 * @param taskId ID of the duplication task
 * @param update Progress update data
 */
export async function updateDuplicationProgress(
  pool: Pool,
  update: DuplicationProgressUpdate
): Promise<void> {
  logger.debug(`Updating duplication progress for task ${update.taskId}: ${update.status}, ${update.progress}%`);

  try {
    // Update task in database
    const updateQuery = `
      UPDATE project_duplication_tasks SET
        status = $1,
        progress = $2,
        processed_items = $3,
        total_items = $4,
        ${update.newProjectId ? 'new_project_id = $6,' : ''}
        ${update.error ? 'error_message = $7,' : ''}
        result = $5,
        updated_at = NOW()
      WHERE id = $8
      RETURNING user_id
    `;

    // Prepare query parameters
    const params: any[] = [
      update.status,
      update.progress,
      update.processedItems,
      update.totalItems,
      update.result ? JSON.stringify(update.result) : null
    ];

    // Add optional parameters if they exist
    if (update.newProjectId) {
      params.push(update.newProjectId);
    }
    if (update.error) {
      params.push(update.error);
    }
    params.push(update.taskId);

    // Execute the query
    const result = await pool.query(updateQuery, params);

    if (result.rows.length > 0) {
      const userId = result.rows[0].user_id;

      // Notify the client via Socket.IO
      try {
        const io = getIO();

        // Prepare notification data
        const notificationData = {
          taskId: update.taskId,
          status: update.status,
          progress: update.progress,
          processedItems: update.processedItems,
          totalItems: update.totalItems,
          newProjectId: update.newProjectId,
          result: update.result,
          error: update.error,
          timestamp: new Date().toISOString()
        };

        // Emit to user's room - users automatically join rooms with their userId
        logger.debug(`Emitting duplication progress update to user ${userId}`);
        io.to(userId).emit('project_duplication_progress', notificationData);
      } catch (socketError) {
        logger.error(`Error sending socket notification for duplication task ${update.taskId}:`, { error: socketError });
      }
    } else {
      logger.error(`Task ${update.taskId} not found in database when updating progress.`);
    }
  } catch (dbError) {
    logger.error(`Database error updating status for duplication task ${update.taskId}:`, { error: dbError });
  }
}

/**
 * Function to get all duplication tasks for a user
 *
 * @param pool Database pool
 * @param userId User ID
 * @returns Array of duplication tasks
 */
export async function getDuplicationTasks(pool: Pool, userId: string): Promise<any[]> {
  try {
    const tasksQuery = `
      SELECT 
        t.id, 
        t.status, 
        t.progress, 
        t.processed_items, 
        t.total_items,
        t.original_project_id,
        t.new_project_id,
        t.options,
        t.error_message,
        t.result,
        t.created_at,
        t.updated_at,
        op.title as original_project_title,
        np.title as new_project_title
      FROM 
        project_duplication_tasks t
      LEFT JOIN 
        projects op ON t.original_project_id = op.id
      LEFT JOIN 
        projects np ON t.new_project_id = np.id
      WHERE 
        t.user_id = $1
      ORDER BY 
        t.created_at DESC
    `;

    const result = await pool.query(tasksQuery, [userId]);
    return result.rows;
  } catch (error) {
    logger.error(`Error getting duplication tasks for user ${userId}:`, { error });
    throw error;
  }
}

/**
 * Function to get a specific duplication task
 *
 * @param pool Database pool
 * @param taskId Task ID
 * @param userId User ID (for authorization)
 * @returns Duplication task or null if not found
 */
export async function getDuplicationTask(pool: Pool, taskId: string, userId: string): Promise<any | null> {
  try {
    const taskQuery = `
      SELECT 
        t.id, 
        t.status, 
        t.progress, 
        t.processed_items, 
        t.total_items,
        t.original_project_id,
        t.new_project_id,
        t.options,
        t.error_message,
        t.result,
        t.created_at,
        t.updated_at,
        op.title as original_project_title,
        np.title as new_project_title
      FROM 
        project_duplication_tasks t
      LEFT JOIN 
        projects op ON t.original_project_id = op.id
      LEFT JOIN 
        projects np ON t.new_project_id = np.id
      WHERE 
        t.id = $1 AND t.user_id = $2
    `;

    const result = await pool.query(taskQuery, [taskId, userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Error getting duplication task ${taskId}:`, { error });
    throw error;
  }
}

/**
 * Function to cancel a duplication task
 *
 * @param pool Database pool
 * @param taskId Task ID
 * @param userId User ID (for authorization)
 * @returns True if the task was cancelled, false otherwise
 */
export async function cancelDuplicationTask(pool: Pool, taskId: string, userId: string): Promise<boolean> {
  try {
    // First check if the task exists and belongs to the user
    const taskQuery = `
      SELECT id, status FROM project_duplication_tasks
      WHERE id = $1 AND user_id = $2
    `;

    const taskResult = await pool.query(taskQuery, [taskId, userId]);

    if (taskResult.rows.length === 0) {
      logger.info(`Task ${taskId} not found or doesn't belong to user ${userId}`);
      return false;
    }

    const task = taskResult.rows[0];

    // Can only cancel tasks that are pending or processing
    if (task.status !== 'pending' && task.status !== 'processing') {
      logger.info(`Cannot cancel task ${taskId} with status ${task.status}`);
      return false;
    }

    // First try to cancel it in the queue
    const queueCancelled = projectDuplicationQueue.cancelTask(taskId);

    // Update the database regardless of queue cancellation result
    // (it might not be in the queue anymore but still in the database)
    const updateQuery = `
      UPDATE project_duplication_tasks
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;

    const updateResult = await pool.query(updateQuery, [taskId, userId]);
    const dbCancelled = updateResult.rowCount > 0;

    // Notify the client about the cancellation
    if (dbCancelled) {
      await updateDuplicationProgress(pool, {
        taskId,
        status: 'cancelled',
        progress: 0,
        processedItems: 0,
        totalItems: 0,
        error: 'Task cancelled by user'
      });
    }

    return queueCancelled || dbCancelled;
  } catch (error) {
    logger.error(`Error cancelling duplication task ${taskId}:`, { error });
    throw error;
  }
}

/**
 * Function to add a project duplication task
 *
 * @param pool Database pool
 * @param originalProjectId ID of the project to duplicate
 * @param userId ID of the user performing the duplication
 * @param options Duplication options
 * @returns Task ID
 */
export async function triggerProjectDuplication(
  pool: Pool,
  originalProjectId: string,
  userId: string,
  options: DuplicationOptions = {}
): Promise<string> {
  logger.info(`Triggering project duplication for projectId: ${originalProjectId}, userId: ${userId}`);

  try {
    // Create a task record in the database
    const createTaskQuery = `
      INSERT INTO project_duplication_tasks (
        id, user_id, original_project_id, status, options
      ) VALUES (
        $1, $2, $3, 'pending', $4
      ) RETURNING id
    `;

    const taskId = uuidv4();
    const taskOptions = {
      ...options,
      newTitle: options.newTitle || undefined, // Don't store null values
      copyFiles: options.copyFiles !== false, // Default to true
      copySegmentations: options.copySegmentations === true, // Default to false
      resetStatus: options.resetStatus !== false // Default to true
    };

    await pool.query(createTaskQuery, [
      taskId,
      userId,
      originalProjectId,
      JSON.stringify(taskOptions)
    ]);

    logger.info(`Created duplication task record with ID: ${taskId}`);

    // Add task to the queue
    projectDuplicationQueue.addTask(
      PROJECT_DUPLICATION_TASK_TYPE,
      {
        taskId,
        originalProjectId,
        userId,
        options: taskOptions
      },
      {
        id: taskId, // Use taskId from database as queue task ID
        priority: 1
      }
    );

    // Notify the client that the task has been queued
    await updateDuplicationProgress(pool, {
      taskId,
      status: 'pending',
      progress: 0,
      processedItems: 0,
      totalItems: 0
    });

    return taskId;
  } catch (error) {
    logger.error(`Error triggering project duplication for project ${originalProjectId}:`, { error });
    throw error;
  }
}

/**
 * Function to execute a project duplication task
 *
 * @param task Project duplication task
 * @returns Result of the duplication
 */
async function executeProjectDuplicationTask(task: Task<ProjectDuplicationTaskData>): Promise<Project> {
  const { taskId, originalProjectId, userId, options } = task.data;
  
  logger.info(`Executing project duplication task ${taskId} for project ${originalProjectId}`);
  
  try {
    // Get database pool
    const pool = require('../db').default;
    
    // Update status to processing
    await updateDuplicationProgress(pool, {
      taskId,
      status: 'processing',
      progress: 0,
      processedItems: 0,
      totalItems: 100 // Initial estimate, will be updated later
    });
    
    // First, estimate the work to be done by counting images in the project
    const countImagesQuery = `
      SELECT COUNT(*) as count FROM images WHERE project_id = $1
    `;
    
    const countResult = await pool.query(countImagesQuery, [originalProjectId]);
    const imageCount = parseInt(countResult.rows[0].count, 10);
    
    // Update total items count
    await updateDuplicationProgress(pool, {
      taskId,
      status: 'processing',
      progress: 5, // Show some initial progress
      processedItems: 0,
      totalItems: imageCount > 0 ? imageCount + 1 : 10 // +1 for project creation, or default to 10 if no images
    });
    
    // Step 1: Create the new project
    logger.info(`Creating new project for duplication task ${taskId}`);
    
    // First, fetch original project data
    const projectQuery = `
      SELECT title, description FROM projects WHERE id = $1 AND user_id = $2
    `;
    
    const projectResult = await pool.query(projectQuery, [originalProjectId, userId]);
    
    if (projectResult.rows.length === 0) {
      throw new Error('Original project not found or access denied');
    }
    
    const originalProject = projectResult.rows[0];
    const newTitle = options.newTitle || `${originalProject.title} (Copy)`;
    
    // Create new project entry
    const createProjectQuery = `
      INSERT INTO projects (user_id, title, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const newProjectResult = await pool.query(
      createProjectQuery,
      [userId, newTitle, originalProject.description]
    );
    
    const newProject = newProjectResult.rows[0];
    
    // Update task with new project ID and progress
    await updateDuplicationProgress(pool, {
      taskId,
      status: 'processing',
      progress: 10,
      processedItems: 1,
      totalItems: imageCount > 0 ? imageCount + 1 : 10,
      newProjectId: newProject.id,
      result: newProject
    });
    
    // Step 2: Start the worker to process images in the background
    const processImagesInWorker = false; // Set to true to use worker threads when available
    
    if (processImagesInWorker && Worker) {
      logger.info(`Using worker thread for image duplication in task ${taskId}`);
      
      // Create a worker thread for copying files
      const workerPath = path.join(__dirname, '../workers/projectDuplicationWorker.js');
      
      // Check if the worker file exists
      if (!fs.existsSync(workerPath)) {
        logger.warn(`Worker file not found at ${workerPath}, falling back to synchronous processing`);
        
        // Fall back to synchronous processing
        return processImagesSynchronously(pool, taskId, originalProjectId, newProject.id, userId, options);
      }
      
      // Create worker
      const worker = new Worker(workerPath, {
        workerData: {
          taskId,
          originalProjectId,
          newProjectId: newProject.id,
          userId,
          options
        }
      });
      
      return new Promise((resolve, reject) => {
        worker.on('message', async (message) => {
          if (message.type === 'progress') {
            // Update progress
            await updateDuplicationProgress(pool, {
              taskId,
              status: 'processing',
              progress: message.progress,
              processedItems: message.processedItems,
              totalItems: message.totalItems,
              newProjectId: newProject.id
            });
          } else if (message.type === 'complete') {
            // Task completed successfully
            await updateDuplicationProgress(pool, {
              taskId,
              status: 'completed',
              progress: 100,
              processedItems: message.totalItems,
              totalItems: message.totalItems,
              newProjectId: newProject.id,
              result: message.result
            });
            
            resolve(newProject);
          } else if (message.type === 'error') {
            // Task failed
            await updateDuplicationProgress(pool, {
              taskId,
              status: 'failed',
              progress: message.progress || 0,
              processedItems: message.processedItems || 0,
              totalItems: message.totalItems || 0,
              newProjectId: newProject.id,
              error: message.error
            });
            
            reject(new Error(message.error));
          }
        });
        
        worker.on('error', async (err) => {
          logger.error(`Worker error in duplication task ${taskId}:`, { error: err });
          
          await updateDuplicationProgress(pool, {
            taskId,
            status: 'failed',
            progress: 0,
            processedItems: 0,
            totalItems: imageCount > 0 ? imageCount + 1 : 10,
            newProjectId: newProject.id,
            error: err.message
          });
          
          reject(err);
        });
        
        worker.on('exit', (code) => {
          if (code !== 0) {
            logger.error(`Worker stopped with exit code ${code} in duplication task ${taskId}`);
          }
        });
      });
    } else {
      // Process images synchronously
      return processImagesSynchronously(pool, taskId, originalProjectId, newProject.id, userId, options);
    }
  } catch (error) {
    // Handle errors
    logger.error(`Error executing project duplication task ${taskId}:`, { error });
    
    try {
      // Get database pool
      const pool = require('../db').default;
      
      // Update task status to failed
      await updateDuplicationProgress(pool, {
        taskId,
        status: 'failed',
        progress: 0,
        processedItems: 0,
        totalItems: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    } catch (updateError) {
      logger.error(`Error updating failed status for duplication task ${taskId}:`, { error: updateError });
    }
    
    throw error;
  }
}

/**
 * Process images synchronously (without worker threads)
 * 
 * @param pool Database pool
 * @param taskId Task ID
 * @param originalProjectId Original project ID
 * @param newProjectId New project ID
 * @param userId User ID
 * @param options Duplication options
 * @returns The new project
 */
async function processImagesSynchronously(
  pool: Pool,
  taskId: string,
  originalProjectId: string,
  newProjectId: string,
  userId: string,
  options: DuplicationOptions
): Promise<Project> {
  // Fetch images from the original project
  const imagesQuery = `SELECT * FROM images WHERE project_id = $1`;
  const imagesResult = await pool.query(imagesQuery, [originalProjectId]);
  const images = imagesResult.rows;
  
  const totalItems = images.length + 1; // +1 for project creation
  let processedItems = 1; // Project creation already done
  
  logger.info(`Processing ${images.length} images for duplication task ${taskId}`);
  
  // Create directory for new project if copying files
  if (options.copyFiles) {
    const baseDir = options.baseDir || process.cwd();
    const projectDir = path.join(baseDir, 'public', 'uploads', newProjectId);
    
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
      logger.debug(`Created directory for new project: ${projectDir}`);
    }
  }
  
  // Process images in batches to avoid overwhelming the system
  const BATCH_SIZE = 5;
  const batches = Math.ceil(images.length / BATCH_SIZE);
  
  for (let i = 0; i < batches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batchEnd = Math.min((i + 1) * BATCH_SIZE, images.length);
    const batch = images.slice(batchStart, batchEnd);
    
    logger.debug(`Processing batch ${i + 1}/${batches} for duplication task ${taskId}`);
    
    // Process batch in parallel
    await Promise.all(batch.map(async (image) => {
      try {
        // Use existing service to duplicate the image
        await projectDuplicationService.duplicateImage(
          await pool.connect(), // Get a client for this operation
          image,
          newProjectId,
          userId,
          options
        );
        
        // Update progress
        processedItems++;
        const progress = Math.floor((processedItems / totalItems) * 100);
        
        await updateDuplicationProgress(pool, {
          taskId,
          status: 'processing',
          progress,
          processedItems,
          totalItems,
          newProjectId
        });
      } catch (error) {
        logger.error(`Error duplicating image ${image.id} in duplication task ${taskId}:`, { error });
        // Continue with other images, don't fail the whole task
      }
    }));
  }
  
  // Get the updated project after all images are processed
  const updatedProjectQuery = `SELECT * FROM projects WHERE id = $1`;
  const updatedProjectResult = await pool.query(updatedProjectQuery, [newProjectId]);
  const updatedProject = updatedProjectResult.rows[0];
  
  // Mark the task as completed
  await updateDuplicationProgress(pool, {
    taskId,
    status: 'completed',
    progress: 100,
    processedItems,
    totalItems,
    newProjectId,
    result: updatedProject
  });
  
  logger.info(`Project duplication task ${taskId} completed successfully`);
  
  return updatedProject;
}

// Set up event listeners for queue events
projectDuplicationQueue.on('queue:updated', (status) => {
  try {
    // Emit queue status update via WebSocket
    const io = getIO();
    
    // Add timestamp to the status update
    const statusWithTimestamp = {
      ...status,
      timestamp: new Date().toISOString(),
      queueLength: status.queueLength,
      activeTasksCount: status.runningCount
    };
    
    // Broadcast to all authenticated users
    io.emit('project_duplication_queue_update', statusWithTimestamp);
    
    logger.debug('Broadcasting project duplication queue status update', { 
      queueLength: statusWithTimestamp.queueLength,
      activeTasksCount: statusWithTimestamp.activeTasksCount
    });
  } catch (error) {
    logger.error('Error broadcasting project duplication queue status update', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default {
  triggerProjectDuplication,
  getDuplicationTasks,
  getDuplicationTask,
  cancelDuplicationTask,
  updateDuplicationProgress
};