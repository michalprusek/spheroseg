import apiClient from '@/lib/apiClient';
import { ImageData, SegmentationData, Polygon } from './types';
import { loadImageDirectly } from '@/pages/segmentation/utils/directImageLoader';
import { createLogger } from '@/lib/logger';
import { requestDeduplicator } from '@/utils/requestDeduplicator';

// Create a logger for this module
const logger = createLogger('segmentation:api');

/**
 * Fetch image data by ID or name
 */
export const fetchImageData = async (projectId: string, imageId: string, signal?: AbortSignal): Promise<ImageData> => {
  logger.info(`Starting fetch for projectId=${projectId}, imageId=${imageId}`);

  // Check if this is a local image (starts with 'img-')
  const isLocalImage = imageId.startsWith('img-');

  // For local images, try to get from localStorage first
  if (isLocalImage) {
    try {
      const storageKey = `spheroseg_uploaded_images_${projectId}`;
      const storedImagesJson = localStorage.getItem(storageKey);

      if (storedImagesJson) {
        const storedImages = JSON.parse(storedImagesJson);
        const localImage = storedImages.find((img: any) => img.id === imageId);

        if (localImage) {
          logger.info(`Found local image ${imageId} in localStorage`);

          // Create image data from the localStorage result
          const localImageData: ImageData = {
            id: imageId,
            name: localImage.name || `Image ${imageId}`,
            width: localImage.width || 800,
            height: localImage.height || 600,
            src: localImage.url,
            storage_path: localImage.url,
            project_id: projectId,
            created_at: localImage.createdAt || new Date().toISOString(),
            updated_at: localImage.updatedAt || new Date().toISOString(),
            status: 'completed',
            alternativeUrls: [localImage.url],
          };

          return processImageUrl(localImageData);
        }
      }
    } catch (localStorageError) {
      logger.warn(
        `Error fetching image from localStorage: ${localStorageError instanceof Error ? localStorageError.message : String(localStorageError)}`,
      );
    }
  }

  // Add cache-busting parameter to prevent browser caching
  const cacheBuster = `_cb=${Date.now()}`;

  // First try to get all images in the project and find the one with matching ID
  try {
    logger.debug(`Fetching all images in project ${projectId}`);
    const allImagesResponse = await requestDeduplicator.execute(
      `/api/projects/${projectId}/images`,
      () => apiClient.get(`/api/projects/${projectId}/images?${cacheBuster}`, { signal }),
      { method: 'GET' },
    );

    if (allImagesResponse.data && Array.isArray(allImagesResponse.data)) {
      logger.debug(`Found ${allImagesResponse.data.length} images in project`);

      // Find the image with the matching ID
      const matchingImage = allImagesResponse.data.find((img) => img.id === imageId);

      if (matchingImage) {
        logger.info(`Found matching image by ID in project images: ${matchingImage.id}`);
        logger.debug('Raw image data from API:', JSON.stringify(matchingImage));
        return processImageUrl(matchingImage);
      } else {
        logger.warn(`No image with ID ${imageId} found in project images`);
      }
    }
  } catch (error) {
    // Only log if it's not a cancellation error
    if (error instanceof Error && error.message !== 'canceled') {
      logger.error(`Error fetching all project images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // If not found in all images, try direct fetch by ID
  try {
    logger.debug(`Trying direct fetch by ID: /api/projects/${projectId}/images/${imageId}?${cacheBuster}`);
    const imageResponse = await requestDeduplicator.execute(
      `/api/projects/${projectId}/images/${imageId}`,
      () => apiClient.get(`/api/projects/${projectId}/images/${imageId}?${cacheBuster}`, { signal }),
      { method: 'GET' },
    );

    if (imageResponse.data) {
      logger.info(`Successfully fetched image by ID: ${imageResponse.data.id}`);
      return processImageUrl(imageResponse.data);
    }
  } catch (idError) {
    // Only log if it's not a cancellation error
    if (idError instanceof Error && idError.message !== 'canceled' && idError.name !== 'AbortError') {
      logger.error(`Error fetching image by ID: ${idError instanceof Error ? idError.message : String(idError)}`);
    }
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'completed',
        alternativeUrls: [directImageResult.url],
      };

      return processImageUrl(directImageData);
    }
  } catch (directError) {
    // Only log if it's not a cancellation error
    if (directError instanceof Error && directError.message !== 'canceled' && directError.name !== 'AbortError') {
      logger.error(
        `Error loading image directly: ${directError instanceof Error ? directError.message : String(directError)}`,
      );
    }
  }

  // If all attempts fail, create a placeholder (for any image, not just local ones)
  logger.info(`Creating placeholder for image ${imageId}`);

  // Create a placeholder image data with a blank image
  const placeholderCacheBuster = `_cb=${Date.now()}`;
  const placeholderUrl = `/placeholder.svg?${placeholderCacheBuster}`;

  const placeholderImageData: ImageData = {
    id: imageId,
    name: `Image ${imageId}`,
    width: 800,
    height: 600,
    src: placeholderUrl,
    storage_path: placeholderUrl,
    project_id: projectId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'completed',
    alternativeUrls: [
      placeholderUrl,
      `/api/placeholder.svg?${placeholderCacheBuster}`,
      `/public/placeholder.svg?${placeholderCacheBuster}`,
    ],
  };

  // Log the fallback to placeholder
  logger.warn(`All attempts to fetch image failed, using placeholder: projectId=${projectId}, imageId=${imageId}`);
  return processImageUrl(placeholderImageData);
};

/**
 * Process image URL to ensure it's absolute and attempts multiple URL formats
 */
const processImageUrl = (imageData: ImageData): ImageData => {
  logger.debug(
    `Processing image URL for image ${imageData.id}, storage_path: ${imageData.storage_path}, src: ${imageData.src}`,
  );

  // First try to use storage_path_full which should be a complete URL
  if (imageData.storage_path_full) {
    imageData.src = imageData.storage_path_full;
    imageData.alternativeUrls = [];
  }
  // Then try src which might already be set
  else if (imageData.src) {
    // Create alternative URLs
    imageData.alternativeUrls = [];

    // If URL is not absolute, add base URL
    if (!imageData.src.startsWith('http') && !imageData.src.startsWith('/')) {
      const baseUrl = window.location.origin;
      imageData.src = `${baseUrl}/${imageData.src}`;
      // Add original as alternative
      imageData.alternativeUrls.push(imageData.src);
    } else if (imageData.src.startsWith('/')) {
      const baseUrl = window.location.origin;
      imageData.src = `${baseUrl}${imageData.src}`;
      // Add original as alternative
      imageData.alternativeUrls.push(imageData.src);
    }
    // If it's already an absolute URL (http:// or https://), leave it as is
  }
  // Then try storage_path
  else if (imageData.storage_path) {
    const baseUrl = window.location.origin;
    imageData.alternativeUrls = [];

    // Check if storage_path is already a full URL
    if (imageData.storage_path.startsWith('http://') || imageData.storage_path.startsWith('https://')) {
      // Extract the path part from the URL to use relative paths
      try {
        const url = new URL(imageData.storage_path);
        const pathOnly = url.pathname;

        // Use the pathname directly without prepending baseUrl (nginx will handle routing)
        imageData.src = pathOnly;

        // Add alternatives
        imageData.alternativeUrls.push(`${baseUrl}${pathOnly}`);
        imageData.alternativeUrls.push(`/api${pathOnly}`);
        imageData.alternativeUrls.push(pathOnly);
      } catch (e) {
        // If URL parsing fails, try to extract path manually
        logger.warn('Failed to parse storage_path as URL:', e);
        const match = imageData.storage_path.match(/https?:\/\/[^\/]+(\/.+)/);
        if (match && match[1]) {
          imageData.src = match[1];
        } else {
          imageData.src = imageData.storage_path;
        }
      }
    } else if (imageData.storage_path.startsWith('/')) {
      imageData.src = `${baseUrl}${imageData.storage_path}`;
      // Add variations as alternatives
      imageData.alternativeUrls.push(`${baseUrl}/api${imageData.storage_path}`);
      imageData.alternativeUrls.push(`${baseUrl}/public${imageData.storage_path}`);
    } else {
      imageData.src = `${baseUrl}/${imageData.storage_path}`;
      // Add variations as alternatives
      imageData.alternativeUrls.push(`${baseUrl}/api/${imageData.storage_path}`);
      imageData.alternativeUrls.push(`${baseUrl}/public/${imageData.storage_path}`);
    }

    // Add API version with image ID
    if (imageData.id) {
      imageData.alternativeUrls.push(`${baseUrl}/api/images/${imageData.id}`);
      imageData.alternativeUrls.push(`${baseUrl}/api/images/${imageData.id}/file`);
      imageData.alternativeUrls.push(`${baseUrl}/uploads/${imageData.id}`);
    }
  }
  // If we still don't have a src, that's an error
  else {
    throw new Error('Image data missing src, storage_path_full, and storage_path');
  }

  // Add cache buster to avoid browser caching issues
  if (imageData.src) {
    const cacheBuster = `_cb=${Date.now()}`;
    imageData.src = imageData.src.includes('?') ? `${imageData.src}&${cacheBuster}` : `${imageData.src}?${cacheBuster}`;
  }

  // Generate comprehensive alternative URLs, but only use storage_path based URLs
  // Don't generate URLs based on image ID as they won't match the actual storage structure
  if (imageData.storage_path) {
    const baseUrl = window.location.origin;
    const storagePath = imageData.storage_path.replace(/^\//, ''); // Remove leading slash if present

    // Add properly formed alternative URLs based on actual storage path
    const additionalUrls = [
      `${baseUrl}/${storagePath}`,
      `${baseUrl}/api/${storagePath}`,
      `/${storagePath}`,
      `/api/${storagePath}`,
    ];

    // Merge with existing alternatives, removing duplicates
    const allUrls = [...(imageData.alternativeUrls || []), ...additionalUrls];
    imageData.alternativeUrls = [...new Set(allUrls)];
  }

  // Add cache busters to all alternative URLs
  if (imageData.alternativeUrls) {
    imageData.alternativeUrls = imageData.alternativeUrls.map((url) => {
      const cacheBuster = `_cb=${Date.now()}`;
      return url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
    });
  }

  logger.debug(`Processed image URL: ${imageData.src} with ${imageData.alternativeUrls?.length || 0} alternatives`);
  return imageData;
};

/**
 * Fetch segmentation data for an image
 */
export const fetchSegmentationData = async (
  imageId: string,
  signal?: AbortSignal,
  projectId?: string,
): Promise<SegmentationData> => {
  logger.info(`Starting fetch for segmentation data, imageId=${imageId}, projectId=${projectId || 'not provided'}`);

  // Add cache-busting parameter to prevent browser caching
  const cacheBuster = `_cb=${Date.now()}`;

  // Try multiple endpoint formats in sequence
  const endpointsToTry = [`/api/images/${imageId}/segmentation?${cacheBuster}`];

  for (const endpoint of endpointsToTry) {
    try {
      logger.debug(`Fetching from: ${endpoint}`);
      const segmentationResponse = await requestDeduplicator.execute(
        endpoint.split('?')[0], // Use endpoint without cache buster as key
        () => apiClient.get(endpoint, { signal }),
        { method: 'GET' },
      );
      const fetchedSegmentation = segmentationResponse.data;

      logger.debug(`Received segmentation data from ${endpoint} for imageId=${imageId}`);

      // Convert API data to the format expected by our application
      if (fetchedSegmentation && fetchedSegmentation.result_data && fetchedSegmentation.result_data.polygons) {
        // If we have data in format { result_data: { polygons: [...] } }
        logger.info(
          `Found ${fetchedSegmentation.result_data.polygons.length} polygons in result_data for imageId=${imageId}`,
        );

        // Process polygons to ensure they have the correct format
        const processedPolygons = fetchedSegmentation.result_data.polygons
          .filter((polygon: Polygon) => polygon && Array.isArray(polygon.points) && polygon.points.length >= 3)
          .map((polygon: Polygon) => ({
            ...polygon,
            id: polygon.id || `poly-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: polygon.type || 'external',
            points: polygon.points.map((p: any) => {
              // Handle both {x,y} and [x,y] formats
              if (Array.isArray(p)) {
                return { x: p[0], y: p[1] };
              } else if (typeof p === 'object' && 'x' in p && 'y' in p) {
                return { x: p.x, y: p.y };
              }
              return p;
            }),
          }));

        logger.info(`Processed ${processedPolygons.length} valid polygons for imageId=${imageId}`);
        fetchedSegmentation.polygons = processedPolygons;
      } else if (fetchedSegmentation && Array.isArray(fetchedSegmentation.polygons)) {
        // If we have data in format { polygons: [...] }
        logger.info(`Found ${fetchedSegmentation.polygons.length} polygons directly for imageId=${imageId}`);

        // Process polygons to ensure they have the correct format
        const processedPolygons = fetchedSegmentation.polygons
          .filter((polygon: Polygon) => polygon && Array.isArray(polygon.points) && polygon.points.length >= 3)
          .map((polygon: Polygon) => ({
            ...polygon,
            id: polygon.id || `poly-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: polygon.type || 'external',
            points: polygon.points.map((p: any) => {
              // Handle both {x,y} and [x,y] formats
              if (Array.isArray(p)) {
                return { x: p[0], y: p[1] };
              } else if (typeof p === 'object' && 'x' in p && 'y' in p) {
                return { x: p.x, y: p.y };
              }
              return p;
            }),
          }));

        logger.info(`Processed ${processedPolygons.length} valid polygons for imageId=${imageId}`);
        fetchedSegmentation.polygons = processedPolygons;
      } else if (fetchedSegmentation && !fetchedSegmentation.polygons) {
        // If we don't have polygons, create an empty array
        logger.warn(`No polygons found for imageId=${imageId}, creating empty array`);
        fetchedSegmentation.polygons = [];
      }

      return fetchedSegmentation;
    } catch (error) {
      // Only log if it's not a cancellation error
      if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
        logger.error(
          `Error fetching from ${endpoint} for imageId=${imageId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      // Continue to the next endpoint
    }
  }

  // If we get here, all endpoints failed - create empty segmentation data instead of throwing
  logger.error(`All endpoints failed for imageId=${imageId}, creating empty segmentation data`);
  return createEmptySegmentation(imageId);
};

/**
 * Create empty segmentation data
 */
export const createEmptySegmentation = (imageId: string): SegmentationData => {
  logger.info(`Creating empty segmentation for imageId=${imageId}`);

  const timestamp = new Date().toISOString();

  return {
    image_id: imageId,
    status: 'completed', // Mark as completed so it can be edited
    result_data: {
      polygons: [],
    },
    polygons: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
};

/**
 * Save segmentation data
 */
export const saveSegmentationData = async (
  projectId: string,
  imageId: string,
  actualId: string | undefined,
  segmentationData: SegmentationData,
): Promise<void> => {
  // Process polygons to ensure they have the correct format
  const processedPolygons = segmentationData.polygons
    .filter((polygon) => polygon && Array.isArray(polygon.points) && polygon.points.length >= 3)
    .map((polygon) => ({
      ...polygon,
      id: polygon.id || `poly-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: polygon.type || 'external',
    }));

  logger.info(`Saving ${processedPolygons.length} valid polygons for imageId=${imageId}`);

  // Prepare the data for saving - backend expects status field
  const dataToSave = {
    status: 'completed', // Backend requires this field
    result_data: {
      polygons: processedPolygons,
      metadata: {
        processedAt: new Date().toISOString(),
        modelType: 'resunet',
        source: 'editor',
      },
    },
  };

  // Get the correct ID to use for saving
  const saveId = actualId || imageId;

  // Try multiple endpoint formats in sequence
  const endpointsToTry = [`/api/images/${saveId}/segmentation`];

  let savedSuccessfully = false;

  // Try each endpoint in sequence until one succeeds
  for (const endpoint of endpointsToTry) {
    try {
      logger.debug(`Attempting to save to endpoint: ${endpoint}`);
      await apiClient.put(endpoint, dataToSave);
      logger.info(`Successfully saved to ${endpoint}`);
      savedSuccessfully = true;
      break; // Exit the loop on success
    } catch (error) {
      // Only log if it's not a cancellation error
      if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
        logger.error(`Error saving to ${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Continue to the next endpoint
    }
  }

  // If no endpoint succeeded, throw the last error
  if (!savedSuccessfully) {
    // Create a synthetic axios-like error for permission detection
    const error = new Error(`Failed to save segmentation data for imageId=${imageId}`);
    // Permission errors are handled by the API client, just throw the error
    throw error;
  }
};

/**
 * Delete segmentation data
 */
export const deleteSegmentationData = async (projectId: string, imageId: string): Promise<void> => {
  logger.info(`Deleting segmentation data for imageId=${imageId} in projectId=${projectId}`);

  // Try multiple endpoint formats in sequence
  const endpointsToTry = [`/api/images/${imageId}/segmentation`];

  let deletedSuccessfully = false;

  // Try each endpoint in sequence until one succeeds
  for (const endpoint of endpointsToTry) {
    try {
      logger.debug(`Attempting to delete from endpoint: ${endpoint}`);
      await apiClient.delete(endpoint);
      logger.info(`Successfully deleted from ${endpoint}`);
      deletedSuccessfully = true;
      break; // Exit the loop on success
    } catch (error) {
      // Only log if it's not a cancellation error
      if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
        logger.error(`Error deleting from ${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Continue to the next endpoint
    }
  }

  // If no endpoint succeeded, throw the last error
  if (!deletedSuccessfully) {
    throw new Error(`Failed to delete segmentation data for imageId=${imageId}`);
  }
};

/**
 * Fetch project data
 */
export const fetchProjectData = async (projectId: string): Promise<any> => {
  logger.info(`Fetching project data for projectId=${projectId}`);

  try {
    const response = await apiClient.get(`/api/projects/${projectId}`);
    return response.data;
  } catch (error) {
    // Only log if it's not a cancellation error
    if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
      logger.error(`Error fetching project data: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
};

/**
 * Fetch project images
 */
export const fetchProjectImages = async (projectId: string): Promise<any[]> => {
  logger.info(`Fetching images for projectId=${projectId}`);

  try {
    const response = await apiClient.get(`/api/projects/${projectId}/images`);
    return response.data;
  } catch (error) {
    // Only log if it's not a cancellation error
    if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
      logger.error(`Error fetching project images: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
};

/**
 * Fetch image segmentation status
 */
export const fetchImageSegmentationStatus = async (imageId: string): Promise<string> => {
  logger.info(`Fetching segmentation status for imageId=${imageId}`);

  try {
    const response = await apiClient.get(`/api/images/${imageId}/segmentation/status`);
    return response.data.status;
  } catch (error) {
    // Only log if it's not a cancellation error
    if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
      logger.error(`Error fetching segmentation status: ${error instanceof Error ? error.message : String(error)}`);
    }
    return 'unknown';
  }
};

/**
 * Trigger segmentation for an image
 */
export const triggerSegmentation = async (imageId: string, parameters?: Record<string, any>): Promise<any> => {
  logger.info(`Triggering segmentation for imageId=${imageId}`);

  try {
    // Always use ResUNet model
    const segmentationParams = {
      ...parameters,
      model_type: 'resunet',
    };

    const response = await apiClient.post(`/api/images/${imageId}/segmentation`, {
      parameters: segmentationParams,
    });

    return response.data;
  } catch (error) {
    // Only log if it's not a cancellation error
    if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
      logger.error(`Error triggering segmentation: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
};

/**
 * Fetch segmentation queue status
 */
export const fetchSegmentationQueueStatus = async (): Promise<any> => {
  logger.info('Fetching segmentation queue status');

  try {
    const response = await apiClient.get('/api/segmentation/queue');
    return response.data;
  } catch (error) {
    // Only log if it's not a cancellation error
    if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
      logger.error(
        `Error fetching segmentation queue status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    throw error;
  }
};

/**
 * Get polygons for an image
 */
export const getPolygonsForImage = async (imageId: string, projectId: string): Promise<any[]> => {
  try {
    logger.info(`Fetching polygons for image ${imageId} in project ${projectId}`);

    // Fetch segmentation data from API
    const segmentationData = await fetchSegmentationData(imageId, undefined, projectId);

    if (!segmentationData) {
      logger.warn(`No segmentation data found for image ${imageId}`);
      return [];
    }

    // Extract polygons from segmentation data
    let polygons: any[] = [];

    if (segmentationData.result_data && segmentationData.result_data.polygons) {
      logger.info(`Found ${segmentationData.result_data.polygons.length} polygons in result_data for image ${imageId}`);
      polygons = segmentationData.result_data.polygons;
    } else if (segmentationData.polygons) {
      logger.info(`Found ${segmentationData.polygons.length} polygons at root level for image ${imageId}`);
      polygons = segmentationData.polygons;
    }

    // Validate polygons
    if (!polygons || !Array.isArray(polygons)) {
      logger.warn(`Invalid polygons data for image ${imageId}`);
      return [];
    }

    // Filter and process polygons
    const validPolygons = polygons.filter(
      (polygon) => polygon && Array.isArray(polygon.points) && polygon.points.length >= 3,
    );

    logger.info(`Found ${validPolygons.length} valid polygons for image ${imageId}`);

    return validPolygons;
  } catch (error) {
    // Only log if it's not a cancellation error
    if (error instanceof Error && error.message !== 'canceled' && error.name !== 'AbortError') {
      logger.error(`Error fetching polygons for image ${imageId}:`, error);
    }
    return [];
  }
};
