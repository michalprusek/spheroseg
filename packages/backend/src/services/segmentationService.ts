import pool from '../db';
import config from '../config';
import logger from '../utils/logger';
import segmentationQueueService from './segmentationQueueServiceV2';

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
    // Use the centralized segmentation queue service V2
    // Convert priority number to TaskPriority enum
    const taskPriority = priority >= 10 ? 10 : priority >= 5 ? 5 : 1; // HIGH, NORMAL, LOW
    return await segmentationQueueService.addTask(imageId, imagePath, parameters, taskPriority);
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
 * Function to get the status of the segmentation queue for a specific project
 *
 * @param projectId ID of the project
 * @returns Project-specific queue status
 */
export const getProjectSegmentationQueueStatus = async (projectId: string): Promise<any> => {
  return await segmentationQueueService.getProjectQueueStatus(projectId);
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
// export const getSegmentationResult = async (imageId: string) => { ... };
// export const updateSegmentationResult = async (imageId: string, result: any) => { ... };
