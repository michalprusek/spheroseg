import apiClient from '@/lib/apiClient';
import { ImageData, SegmentationData } from './types';
import { loadImageDirectly } from '@/pages/segmentation/utils/directImageLoader';
import { createLogger } from '@/lib/logger';

// Create a logger for this module
const logger = createLogger('segmentation:api');

/**
 * Fetch image data by ID or name
 */
export const fetchImageData = async (
  projectId: string,
  imageId: string,
  signal?: AbortSignal
): Promise<ImageData> => {
  logger.info(`Starting fetch for projectId=${projectId}, imageId=${imageId}`);

  // Add cache-busting parameter to prevent browser caching
  const cacheBuster = `_cb=${Date.now()}`;

  // First try to get all images in the project and find the one with matching ID
  try {
    logger.debug(`Fetching all images in project ${projectId}`);
    const allImagesResponse = await apiClient.get(
      `/projects/${projectId}/images?${cacheBuster}`,
      { signal }
    );

    if (allImagesResponse.data && Array.isArray(allImagesResponse.data)) {
      logger.debug(`Found ${allImagesResponse.data.length} images in project`);

      // Find the image with the matching ID
      const matchingImage = allImagesResponse.data.find(img => img.id === imageId);

      if (matchingImage) {
        logger.info(`Found matching image by ID in project images: ${matchingImage.id}`);
        return processImageUrl(matchingImage);
      } else {
        logger.warn(`No image with ID ${imageId} found in project images`);
      }
    }
  } catch (error) {
    logger.error(`Error fetching all project images: ${error.message}`);
  }

  // If not found in all images, try direct fetch by ID
  try {
    logger.debug(`Trying direct fetch by ID: /projects/${projectId}/images/${imageId}?${cacheBuster}`);
    const imageResponse = await apiClient.get(
      `/projects/${projectId}/images/${imageId}?${cacheBuster}`,
      { signal }
    );

    if (imageResponse.data) {
      logger.info(`Successfully fetched image by ID: ${imageResponse.data.id}`);
      return processImageUrl(imageResponse.data);
    }
  } catch (idError) {
    logger.error(`Error fetching image by ID: ${idError.message}`);
  }

  // If still not found, try to load directly from filesystem
  try {
    logger.debug(`Attempting to load image directly from filesystem`);
    const directImageResult = await loadImageDirectly(projectId, imageId);

    if (directImageResult) {
      logger.info(`Successfully loaded image directly: ${directImageResult.url}`);

      // Create image data from the direct load result
      const directImageData: ImageData = {
        id: imageId,
        name: `Image ${imageId}`,
        width: directImageResult.width,
        height: directImageResult.height,
        src: directImageResult.url,
        storage_path: directImageResult.url,
        project_id: projectId,
        user_id: 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'completed'
      };

      return directImageData;
    }
  } catch (directError) {
    logger.error(`Error loading image directly: ${directError.message}`);
  }

  // If all attempts fail, throw an error
  logger.error(`All attempts to fetch image failed: projectId=${projectId}, imageId=${imageId}`);
  throw new Error(`Image not found: ${imageId}`);
};

/**
 * Process image URL to ensure it's absolute
 */
const processImageUrl = (imageData: ImageData): ImageData => {
  // First try to use storage_path_full which should be a complete URL
  if (imageData.storage_path_full) {
    imageData.src = imageData.storage_path_full;
  }
  // Then try src which might already be set
  else if (imageData.src) {
    // If URL is not absolute, add base URL
    if (!imageData.src.startsWith('http') && !imageData.src.startsWith('/')) {
      const baseUrl = window.location.origin;
      imageData.src = `${baseUrl}/${imageData.src}`;
    } else if (imageData.src.startsWith('/')) {
      const baseUrl = window.location.origin;
      imageData.src = `${baseUrl}${imageData.src}`;
    }
  }
  // Then try storage_path
  else if (imageData.storage_path) {
    const baseUrl = window.location.origin;
    if (imageData.storage_path.startsWith('/')) {
      imageData.src = `${baseUrl}${imageData.storage_path}`;
    } else {
      imageData.src = `${baseUrl}/${imageData.storage_path}`;
    }
  }
  // If we still don't have a src, that's an error
  else {
    throw new Error("Image data missing src, storage_path_full, and storage_path");
  }

  return imageData;
};

/**
 * Fetch segmentation data for an image
 */
export const fetchSegmentationData = async (
  imageId: string,
  signal?: AbortSignal,
  projectId?: string
): Promise<SegmentationData> => {
  logger.info(`Starting fetch for segmentation data, imageId=${imageId}, projectId=${projectId || 'not provided'}`);

  // Add cache-busting parameter to prevent browser caching
  const cacheBuster = `_cb=${Date.now()}`;

  // Try multiple endpoint formats in sequence
  const endpointsToTry = [
    // First try with project ID if available (new API format)
    ...(projectId ? [`/projects/${projectId}/segmentations/${imageId}?${cacheBuster}`] : []),
    // Then try the default endpoints
    `/images/${imageId}/segmentation?${cacheBuster}`,
    `/api/images/${imageId}/segmentation?${cacheBuster}`
  ];

  let lastError;

  // Try each endpoint in sequence
  for (const endpoint of endpointsToTry) {
    try {
      logger.debug(`Fetching from: ${endpoint}`);
      const segmentationResponse = await apiClient.get(endpoint, { signal });
      const fetchedSegmentation = segmentationResponse.data;

      logger.debug(`Received segmentation data from ${endpoint} for imageId=${imageId}`);

      // Convert API data to the format expected by our application
      if (fetchedSegmentation && fetchedSegmentation.result_data && fetchedSegmentation.result_data.polygons) {
        // If we have data in format { result_data: { polygons: [...] } }
        logger.info(`Found ${fetchedSegmentation.result_data.polygons.length} polygons in result_data for imageId=${imageId}`);
        fetchedSegmentation.polygons = fetchedSegmentation.result_data.polygons;
      } else if (fetchedSegmentation && Array.isArray(fetchedSegmentation.polygons)) {
        // If we have data in format { polygons: [...] }
        logger.info(`Found ${fetchedSegmentation.polygons.length} polygons directly for imageId=${imageId}`);
        // Already in the correct format
      } else if (fetchedSegmentation && !fetchedSegmentation.polygons) {
        // If we don't have polygons, create an empty array
        logger.warn(`No polygons found for imageId=${imageId}, creating empty array`);
        fetchedSegmentation.polygons = [];
      }

      return fetchedSegmentation;
    } catch (error) {
      logger.error(`Error fetching from ${endpoint} for imageId=${imageId}: ${error.message}`);
      lastError = error;
      // Continue to the next endpoint
    }
  }

  // If we get here, all endpoints failed
  logger.error(`All endpoints failed for imageId=${imageId}`);
  throw lastError; // Throw the last error encountered
};

/**
 * Create empty segmentation data
 */
export const createEmptySegmentation = (imageId: string): SegmentationData => {
  logger.info(`Creating empty segmentation for imageId=${imageId}`);

  const timestamp = new Date().toISOString();

  return {
    id: `empty-${imageId}-${Date.now()}`,
    image_id: imageId,
    status: 'completed', // Mark as completed so it can be edited
    result_data: {
      polygons: []
    },
    polygons: [],
    created_at: timestamp,
    updated_at: timestamp,
    parameters: {
      model: 'manual',
      threshold: 0.5
    }
  };
};

/**
 * Save segmentation data
 */
export const saveSegmentationData = async (
  projectId: string,
  imageId: string,
  actualId: string | undefined,
  segmentationData: SegmentationData
): Promise<void> => {
  // Prepare the data for saving
  const dataToSave = {
    ...segmentationData,
    image_id: imageId,
    result_data: {
      polygons: segmentationData.polygons
    }
  };

  // Get the correct ID to use for saving
  const saveId = actualId || imageId;

  // Try multiple endpoint formats in sequence
  const endpointsToTry = [
    // First try the new API format with projectId
    `/projects/${projectId}/segmentations/${saveId}`,
    // Then try the default endpoints
    `/images/${saveId}/segmentation`,
    `/projects/${projectId}/images/${saveId}/segmentation`
  ];

  let savedSuccessfully = false;
  let lastError;

  // Try each endpoint in sequence until one succeeds
  for (const endpoint of endpointsToTry) {
    try {
      logger.debug(`Attempting to save to endpoint: ${endpoint}`);
      await apiClient.put(endpoint, dataToSave);
      logger.info(`Successfully saved to ${endpoint}`);
      savedSuccessfully = true;
      break; // Exit the loop on success
    } catch (error) {
      logger.error(`Error saving to ${endpoint}: ${error.message}`);
      lastError = error;
      // Continue to the next endpoint
    }
  }

  // If no endpoint succeeded, throw the last error
  if (!savedSuccessfully && lastError) {
    throw lastError;
  }
};
