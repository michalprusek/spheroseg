/**
 * Segmentation Queue API
 *
 * This module provides functions for interacting with the segmentation queue
 */
import apiClient from '@/lib/apiClient';
import { QueueStatusUpdate } from '@/hooks/useSegmentationUpdates';

// Cache for queue status to avoid repeated API calls
const queueStatusCache: Record<string, { data: QueueStatusUpdate; timestamp: number }> = {};

// Cache expiration time in milliseconds (30 seconds for more frequent updates)
const CACHE_EXPIRATION = 30 * 1000;

/**
 * Fetch the current status of the segmentation queue
 * @param projectId The project ID to fetch queue status for
 * @returns The current queue status
 */
export const fetchQueueStatus = async (projectId: string): Promise<QueueStatusUpdate> => {
  // Check if we have a valid cached response
  const cachedResponse = queueStatusCache[projectId];
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_EXPIRATION) {
    return cachedResponse.data;
  }

  try {
    // Try multiple endpoints to get queue status
    let success = false;
    let lastError = null;

    // Array of endpoints to try
    const endpoints = [
      {
        name: 'Primary endpoint',
        url: `/api/segmentations/queue/status/${projectId}`,
      },
      {
        name: 'Alternative endpoint',
        url: `/api/projects/${projectId}/segmentations/queue`,
      },
      {
        name: 'Legacy endpoint',
        url: `/api/segmentations/queue/status?projectId=${projectId}`,
      },
      {
        name: 'Direct queue endpoint',
        url: `/api/queue/status`,
      },
    ];

    // Try each endpoint in order
    for (const endpoint of endpoints) {
      if (success) break;

      try {
        console.log(`Trying ${endpoint.name}: ${endpoint.url}`);
        const response = await apiClient.get(endpoint.url);
        console.log(`${endpoint.name} response:`, response.data);

        if (response.data) {
          // Normalize the response data to ensure it has all required fields
          const normalizedData: QueueStatusUpdate = {
            pendingTasks: response.data.pendingTasks || response.data.queuedTasks || [],
            runningTasks: response.data.runningTasks || [],
            queueLength: response.data.queueLength || 0,
            activeTasksCount: response.data.activeTasksCount || response.data.runningTasks?.length || 0,
            timestamp: response.data.timestamp || new Date().toISOString(),
            processingImages: response.data.processingImages || [],
          };

          // Cache the successful response
          queueStatusCache[projectId] = {
            data: normalizedData,
            timestamp: Date.now(),
          };

          success = true;
          console.log(`Successfully fetched queue status from ${endpoint.name}`);
          return normalizedData;
        }
      } catch (error) {
        console.warn(`Error fetching queue status from ${endpoint.name}:`, error);
        lastError = error;
      }
    }

    // If all endpoints fail, throw the last error to be handled below
    if (!success && lastError) {
      throw lastError;
    }
  } catch (error) {
    // Log the error
    console.error('Failed to fetch queue status:', error);

    // Use cached response if available, even if expired
    if (cachedResponse) {
      return cachedResponse.data;
    }

    // Return empty queue status instead of throwing an error
    return createEmptyQueueStatus(projectId);
  }
};

/**
 * Trigger segmentation for a single image
 * @param projectId The project ID
 * @param imageId The image ID to segment
 * @returns The response from the server
 */
export const triggerSegmentation = async (projectId: string, imageId: string) => {
  try {
    // Try to trigger segmentation on the server
    const response = await apiClient.post(`/projects/${projectId}/segmentation/trigger`, {
      imageId,
    });
    return response.data;
  } catch (error) {
    console.error('Error triggering segmentation:', error);
    throw error; // Let the caller handle the error
  }
};

/**
 * Trigger batch segmentation for multiple images
 * @param projectId The project ID
 * @param imageIds The image IDs to segment
 * @returns The response from the server
 */
export const triggerBatchSegmentation = async (projectId: string, imageIds: string[]) => {
  try {
    // Try to trigger batch segmentation on the server
    // First try the new API endpoint
    try {
      const response = await apiClient.post(`/projects/${projectId}/segmentation/batch-trigger`, {
        imageIds,
      });
      return response.data;
    } catch (error) {
      // If that fails, try the legacy endpoint
      try {
        const legacyResponse = await apiClient.post(`/images/segmentation/trigger-batch`, {
          imageIds,
          priority: 3,
          model_type: 'resunet',
        });
        return legacyResponse.data;
      } catch (legacyError) {
        // If both fail, throw the original error to be handled below
        throw error;
      }
    }
  } catch (error) {
    console.error('Error triggering batch segmentation:', error);
    throw error; // Let the caller handle the error
  }
};

/**
 * Create a minimal empty queue status
 * @param projectId The project ID
 * @returns An empty queue status
 */
export const createEmptyQueueStatus = (projectId: string): QueueStatusUpdate => {
  // Return empty data with current timestamp
  return {
    pendingTasks: [],
    runningTasks: [],
    queueLength: 0,
    activeTasksCount: 0,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Create mock queue status - referenced on line 66
 * This function is needed to be compatible with the error case in fetchQueueStatus
 * @param projectId The project ID
 * @returns An empty queue status (same as createEmptyQueueStatus)
 */
export const createMockQueueStatus = (projectId: string): QueueStatusUpdate => {
  // Just call createEmptyQueueStatus for consistency
  return createEmptyQueueStatus(projectId);
};

/**
 * Clear the queue status cache for a specific project
 * @param projectId The project ID to clear the cache for
 * @param clearAll Whether to clear all project caches (default: false)
 */
export const clearQueueStatusCache = (projectId: string, clearAll: boolean = false): void => {
  console.log(`Clearing queue status cache for project ${projectId}${clearAll ? ' and all other projects' : ''}`);

  if (clearAll) {
    // Clear all cache entries
    Object.keys(queueStatusCache).forEach((key) => {
      delete queueStatusCache[key];
    });
  } else if (queueStatusCache[projectId]) {
    // Clear only the specified project
    delete queueStatusCache[projectId];
  }

  // Dispatch an event to notify other components that the cache has been cleared
  try {
    const cacheUpdateEvent = new CustomEvent('queue-cache-cleared', {
      detail: {
        projectId,
        clearAll,
        timestamp: Date.now(),
      },
    });
    window.dispatchEvent(cacheUpdateEvent);
  } catch (error) {
    console.error('Error dispatching cache cleared event:', error);
  }
};
