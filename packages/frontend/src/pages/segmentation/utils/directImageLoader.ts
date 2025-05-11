import { createLogger } from '@/lib/logger';

const logger = createLogger('directImageLoader');

/**
 * Attempts to load an image directly from the file system or local storage
 * This is a fallback mechanism when the server API fails to provide the image
 */
export const loadImageDirectly = async (
  projectId: string,
  imageId: string,
): Promise<{ url: string; width: number; height: number } | null> => {
  logger.info(`Attempting to load image directly: projectId=${projectId}, imageId=${imageId}`);

  try {
    // First try to see if we have cached this image in local storage
    const cachedDataString = localStorage.getItem(`image-cache-${projectId}-${imageId}`);

    if (cachedDataString) {
      try {
        const cachedData = JSON.parse(cachedDataString);
        if (cachedData && cachedData.url && cachedData.width && cachedData.height) {
          logger.info(`Found cached image data for ${imageId}`);
          return cachedData;
        }
      } catch (e) {
        logger.error(`Error parsing cached image data: ${e.message}`);
      }
    }

    // No cached data found, try to derive a URL from known patterns
    const potentialUrls = [
      // Try direct URLs with common patterns - with original filename
      `/uploads/${imageId}`,
      `/uploads/${imageId}.jpg`,
      `/uploads/${imageId}.png`,
      `/uploads/images/${imageId}`,
      `/uploads/images/${imageId}.jpg`,
      `/uploads/images/${imageId}.png`,

      // Try with project ID in path
      `/uploads/${projectId}/${imageId}`,
      `/uploads/${projectId}/${imageId}.jpg`,
      `/uploads/${projectId}/${imageId}.png`,

      // Try with API prefix
      `/api/uploads/${imageId}`,
      `/api/uploads/${imageId}.jpg`,
      `/api/uploads/${imageId}.png`,
      `/api/uploads/${projectId}/${imageId}`,
      `/api/uploads/${projectId}/${imageId}.jpg`,
      `/api/uploads/${projectId}/${imageId}.png`,

      // Try with backend URL - because backend is mapped to port 5001
      `http://localhost:5001/uploads/${imageId}`,
      `http://localhost:5001/uploads/${imageId}.jpg`,
      `http://localhost:5001/uploads/${imageId}.png`,
      `http://localhost:5001/uploads/${projectId}/${imageId}`,
      `http://localhost:5001/uploads/${projectId}/${imageId}.jpg`,
      `http://localhost:5001/uploads/${projectId}/${imageId}.png`,

      // Try with Docker service name
      `http://backend:5001/uploads/${imageId}`,
      `http://backend:5001/uploads/${imageId}.jpg`,
      `http://backend:5001/uploads/${imageId}.png`,
      `http://backend:5001/uploads/${projectId}/${imageId}`,
      `http://backend:5001/uploads/${projectId}/${imageId}.jpg`,
      `http://backend:5001/uploads/${projectId}/${imageId}.png`,

      // Try public URLs
      `/public/uploads/${imageId}`,
      `/public/uploads/${imageId}.jpg`,
      `/public/uploads/${imageId}.png`,
      `/public/uploads/${projectId}/${imageId}`,
      `/public/uploads/${projectId}/${imageId}.jpg`,
      `/public/uploads/${projectId}/${imageId}.png`,

      // Try with project subfolder and images subfolder
      `/uploads/${projectId}/images/${imageId}`,
      `/uploads/${projectId}/images/${imageId}.jpg`,
      `/uploads/${projectId}/images/${imageId}.png`,

      // Try with field name prefix (from multer)
      `/uploads/${projectId}/images-${imageId}`,
      `/uploads/${projectId}/images-${imageId}.jpg`,
      `/uploads/${projectId}/images-${imageId}.png`,
    ];

    // Try each potential URL
    for (const url of potentialUrls) {
      try {
        logger.debug(`Trying to load image from: ${url}`);
        const imageData = await loadAndMeasureImage(url);

        if (imageData) {
          logger.info(`Successfully loaded image from ${url}`);

          // Cache the successful result
          localStorage.setItem(`image-cache-${projectId}-${imageId}`, JSON.stringify(imageData));

          return imageData;
        }
      } catch (error) {
        logger.debug(`Failed to load from ${url}: ${error.message}`);
      }
    }

    logger.warn(`Could not load image directly for projectId=${projectId}, imageId=${imageId}`);
    return null;
  } catch (error) {
    logger.error(`Error in loadImageDirectly: ${error.message}`);
    return null;
  }
};

/**
 * Helper function to load an image and get its dimensions
 */
const loadAndMeasureImage = (url: string): Promise<{ url: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image from ${url}`));
    };

    // Set src after setting up event handlers
    img.src = url;
  });
};
