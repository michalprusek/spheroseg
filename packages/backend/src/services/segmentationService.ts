import pool from '../db';
import config from '../config';
import logger from '../utils/logger';
import segmentationQueueService from './segmentationQueueService';

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
  logger.info(
    `Queueing segmentation for imageId: ${imageId}, path: ${imagePath}, priority: ${priority}`
  );

  try {
    // Use the centralized segmentation queue service
    return await segmentationQueueService.addTask(imageId, imagePath, parameters, priority);
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
  return segmentationQueueService.getQueueStatus();
};

/**
 * Function to cancel a segmentation task
 *
 * @param imageId ID of the image
 * @returns True if the task was cancelled, false otherwise
 */
export const cancelSegmentationTask = async (imageId: string): Promise<boolean> => {
  return await segmentationQueueService.cancelTask(imageId);
};

// Optional: Add functions to get or update results if needed directly by service
/**
 * Get segmentation data for an image
 */
export const getSegmentation = async (imageId: string) => {
  const result = await pool.query(
    'SELECT * FROM segmentation_results WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1',
    [imageId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
};

/**
 * Save segmentation data
 */
export const saveSegmentation = async (imageId: string, userId: string, segmentationData: any) => {
  const result = await pool.query(
    `INSERT INTO segmentation_results (image_id, user_id, result_data, status) 
     VALUES ($1, $2, $3, 'completed') 
     RETURNING *`,
    [imageId, userId, JSON.stringify(segmentationData)]
  );
  
  return result.rows[0];
};

/**
 * Get segmentation history for an image
 */
export const getSegmentationHistory = async (imageId: string) => {
  const result = await pool.query(
    'SELECT * FROM segmentation_results WHERE image_id = $1 ORDER BY created_at DESC',
    [imageId]
  );
  
  return result.rows;
};

/**
 * Get a specific version of segmentation
 */
export const getSegmentationVersion = async (imageId: string, version: number) => {
  const result = await pool.query(
    'SELECT * FROM segmentation_results WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1 OFFSET $2',
    [imageId, version - 1]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
};

/**
 * Restore a specific version of segmentation
 */
export const restoreSegmentationVersion = async (imageId: string, userId: string, version: number) => {
  // Get the specific version
  const versionData = await getSegmentationVersion(imageId, version);
  
  if (!versionData) {
    throw new ApiError('Segmentation version not found', 404);
  }
  
  // Create a new segmentation entry with the old data
  const result = await pool.query(
    `INSERT INTO segmentation_results (image_id, user_id, result_data, status) 
     VALUES ($1, $2, $3, 'completed') 
     RETURNING *`,
    [imageId, userId, versionData.result_data]
  );
  
  return result.rows[0];
};
