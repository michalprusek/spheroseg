/**
 * Utility for loading images and checking if they exist
 */
import { generatePossibleImagePaths, isImageUrl, ImageLoadOptions } from '../../../../shared/utils/imageUtils';

/**
 * Checks if an image exists at the given URL
 * @param url The URL to check
 * @returns A promise that resolves to true if the image exists, false otherwise
 */
export const checkImageExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error(`Error checking if image exists at ${url}:`, error);
    return false;
  }
};

/**
 * Loads an image and returns its dimensions
 * @param url The URL of the image to load
 * @returns A promise that resolves to the image dimensions, or null if the image couldn't be loaded
 */
export const loadImageDimensions = (url: string): Promise<{ width: number; height: number } | null> => {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      console.error(`Failed to load image from ${url}`);
      resolve(null);
    };

    img.src = url;
  });
};

/**
 * Tries to load an image from multiple URLs
 * @param urls Array of URLs to try
 * @returns A promise that resolves to the first URL that works and its dimensions, or null if none work
 */
export const tryMultipleImageUrls = async (
  urls: string[],
): Promise<{ url: string; width: number; height: number } | null> => {
  console.log(`Trying to load image from ${urls.length} URLs:`, urls);

  for (const url of urls) {
    try {
      // First check if the image exists
      const exists = await checkImageExists(url);

      if (exists) {
        // Then try to load it to get dimensions
        const dimensions = await loadImageDimensions(url);

        if (dimensions) {
          console.log(`Successfully loaded image from ${url} with dimensions ${dimensions.width}x${dimensions.height}`);
          return {
            url,
            ...dimensions,
          };
        }
      }
    } catch (error) {
      console.error(`Error trying to load image from ${url}:`, error);
    }
  }

  console.error('Failed to load image from any URL');
  return null;
};

/**
 * Generates alternative URLs for an image
 * @param originalUrl The original URL
 * @param projectId Optional project ID to use in generated URLs
 * @param imageId Optional image ID to use in generated URLs
 * @returns An array of alternative URLs to try
 */
export const generateAlternativeUrls = (originalUrl: string, projectId?: string, imageId?: string): string[] => {
  const baseUrl = window.location.origin;
  const urlWithoutOrigin = originalUrl.replace(baseUrl, '');
  const filename = originalUrl.split('/').pop() || '';

  // Start with standard paths
  let urls = [
    originalUrl, // Original URL
    `${baseUrl}${urlWithoutOrigin}`, // Try with base URL
    `/api${urlWithoutOrigin}`, // Try with API prefix
  ];

  // If we have project and image IDs, get possible paths
  if (projectId && imageId) {
    urls = [...urls, ...generatePossibleImagePaths(projectId, imageId, filename, baseUrl)];
  } else {
    // Otherwise add some common patterns
    urls.push(`/uploads/${filename}`, `/api/uploads/${filename}`);

    // Try with different extensions if no extension in original
    if (!isImageUrl(filename)) {
      urls.push(`${originalUrl}.png`, `${originalUrl}.jpg`, `${originalUrl}.jpeg`);
    }
  }

  // Filter out duplicates
  return [...new Set(urls)];
};
