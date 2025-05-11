/**
 * Consolidated Image Loader Utility
 *
 * This utility provides a unified interface for loading images from various sources:
 * - Direct file loading
 * - URL loading with cache busting
 * - API-based loading
 * - Docker container path resolution
 *
 * It replaces the following files:
 * - frontend/src/pages/segmentation/utils/directImageLoader.ts
 * - frontend/src/pages/segmentation/utils/dockerImageLoader.ts
 * - frontend/src/pages/segmentation/utils/universalImageLoader.ts
 * - frontend/src/pages/segmentation/utils/imageProxy.ts
 * - frontend/src/pages/segmentation/utils/dockerDirectAccess.ts
 */

import apiClient from '@/lib/apiClient';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:imageLoader');

// Types
export interface ImageLoadResult {
  url: string;
  width: number;
  height: number;
}

export interface ImageLoaderOptions {
  cacheBuster?: boolean;
  crossOrigin?: 'anonymous' | 'use-credentials' | '';
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  showToasts?: boolean;
}

const DEFAULT_OPTIONS: ImageLoaderOptions = {
  cacheBuster: true,
  crossOrigin: 'anonymous',
  maxRetries: 2,
  retryDelay: 1000,
  timeout: 30000,
  showToasts: false,
};

/**
 * Add cache-busting parameter to URL
 */
export const addCacheBuster = (url: string): string => {
  const cacheBuster = `_cb=${Date.now()}`;
  return url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
};

/**
 * Check if an image exists at the given URL
 */
export const checkImageExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    return response.ok;
  } catch (error) {
    logger.debug(`Image does not exist at ${url}:`, error);
    return false;
  }
};

/**
 * Load an image directly from a URL
 */
export const loadImageFromUrl = (url: string, options: ImageLoaderOptions = {}): Promise<HTMLImageElement> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();

    if (opts.crossOrigin) {
      img.crossOrigin = opts.crossOrigin;
    }

    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);

    // Add cache-busting if enabled
    img.src = opts.cacheBuster ? addCacheBuster(url) : url;
  });
};

/**
 * Load an image from a File object
 */
export const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (error) => reject(error);
        img.src = event.target.result as string;
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Load an image from any source (URL or File)
 */
export const loadImage = (source: string | File, options: ImageLoaderOptions = {}): Promise<HTMLImageElement> => {
  if (typeof source === 'string') {
    return loadImageFromUrl(source, options);
  } else {
    return loadImageFromFile(source);
  }
};

/**
 * Get dimensions of an image from its URL
 */
export const getImageDimensions = async (
  url: string,
  options: ImageLoaderOptions = {},
): Promise<{ width: number; height: number } | null> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve) => {
    const img = new Image();

    if (opts.crossOrigin) {
      img.crossOrigin = opts.crossOrigin;
    }

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      logger.error(`Failed to load image from ${url}`);
      resolve(null);
    };

    // Add cache-busting if enabled
    img.src = opts.cacheBuster ? addCacheBuster(url) : url;
  });
};

/**
 * Generate possible URLs for an image based on project and image IDs
 */
export const generatePossibleImageUrls = (originalUrl: string, projectId?: string, imageId?: string): string[] => {
  // Extract filename from URL
  const urlParts = originalUrl.split('/');
  const filename = urlParts[urlParts.length - 1];

  // Extract base URL and path without origin
  const urlObj = new URL(originalUrl, window.location.origin);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  const urlWithoutOrigin = originalUrl.replace(baseUrl, '');

  // Generate possible URLs
  const urls = [
    originalUrl, // Original URL

    // Try with different origins
    `${baseUrl}${urlWithoutOrigin}`,

    // Try with /uploads prefix
    `/uploads/${filename}`,

    // Try with different extensions if no extension in original
    ...(!filename.includes('.') ? [`${originalUrl}.png`, `${originalUrl}.jpg`, `${originalUrl}.jpeg`] : []),

    // Try with direct path
    `/api${urlWithoutOrigin}`,
  ];

  // Add project-specific paths if projectId is provided
  if (projectId) {
    urls.push(`/uploads/${projectId}/${filename}`, `/api/uploads/${projectId}/${filename}`);

    // Add image-specific paths if imageId is provided
    if (imageId) {
      urls.push(
        `/uploads/${projectId}/${imageId}`,
        `/uploads/${projectId}/${imageId}.png`,
        `/uploads/${projectId}/${imageId}.jpg`,
        `/api/uploads/${projectId}/${imageId}`,
        `/api/uploads/${projectId}/${imageId}.png`,
      );
    }
  }

  // Filter out duplicates
  return [...new Set(urls)];
};

/**
 * Try to load an image from multiple possible URLs
 */
export const tryMultipleImageUrls = async (
  urls: string[],
  options: ImageLoaderOptions = {},
): Promise<ImageLoadResult | null> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  logger.debug(`Trying to load image from ${urls.length} URLs:`, urls);

  if (opts.showToasts) {
    toast.info(`Trying to load image from ${urls.length} possible locations...`);
  }

  for (const url of urls) {
    try {
      // First check if the image exists
      const exists = await checkImageExists(url);

      if (exists) {
        // Then try to load it to get dimensions
        const dimensions = await getImageDimensions(url, opts);

        if (dimensions) {
          logger.info(`Successfully loaded image from ${url} with dimensions ${dimensions.width}x${dimensions.height}`);

          if (opts.showToasts) {
            toast.success(`Image loaded successfully: ${dimensions.width}x${dimensions.height}`);
          }

          return {
            url,
            ...dimensions,
          };
        }
      }
    } catch (error) {
      logger.error(`Error trying to load image from ${url}:`, error);
    }
  }

  if (opts.showToasts) {
    toast.error('Failed to load image from any URL');
  }

  logger.error('Failed to load image from any URL');
  return null;
};

/**
 * Load image from API
 */
export const loadImageFromApi = async (
  projectId: string,
  imageId: string,
  options: ImageLoaderOptions = {},
): Promise<ImageLoadResult | null> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Add cache-busting query parameter
    const url = `/api/projects/${projectId}/images/${imageId}${opts.cacheBuster ? `?_=${Date.now()}` : ''}`;

    const response = await apiClient.get(url, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (response.data && response.data.storage_path) {
      const imageUrl = response.data.storage_path;
      const dimensions = await getImageDimensions(imageUrl, opts);

      if (dimensions) {
        return {
          url: imageUrl,
          ...dimensions,
        };
      }
    }

    return null;
  } catch (error) {
    logger.error(`Error loading image from API:`, error);
    return null;
  }
};

/**
 * Convert an image to a canvas element
 */
export const imageToCanvas = (img: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0);
  }

  return canvas;
};

/**
 * Get image data from an image
 */
export const getImageData = (img: HTMLImageElement): ImageData | null => {
  const canvas = imageToCanvas(img);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  return null;
};

/**
 * Universal image loader that tries all possible methods to load an image
 */
export const universalImageLoader = async (
  projectId: string,
  imageId: string,
  options: ImageLoaderOptions = {},
): Promise<ImageLoadResult | null> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.showToasts) {
    toast.info('Loading image...');
  }

  logger.debug(`Loading image: projectId=${projectId}, imageId=${imageId}`);

  // Method 1: Try to load from API
  try {
    if (opts.showToasts) {
      toast.info('Trying API method...');
    }

    const apiResult = await loadImageFromApi(projectId, imageId, opts);

    if (apiResult) {
      if (opts.showToasts) {
        toast.success('Image loaded from API');
      }

      return apiResult;
    }
  } catch (error) {
    logger.error(`Error loading from API:`, error);
  }

  // Method 2: Try to load by generating possible paths
  try {
    if (opts.showToasts) {
      toast.info('Trying path method...');
    }

    // Generate possible URLs
    const possibleUrls = generatePossibleImageUrls(`/uploads/${projectId}/${imageId}`, projectId, imageId);

    // Try each URL
    const pathResult = await tryMultipleImageUrls(possibleUrls, opts);

    if (pathResult) {
      if (opts.showToasts) {
        toast.success('Image loaded by path');
      }

      return pathResult;
    }
  } catch (error) {
    logger.error(`Error loading by path:`, error);
  }

  // Method 3: Try Docker-specific paths
  try {
    if (opts.showToasts) {
      toast.info('Trying Docker paths...');
    }

    // Generate Docker-specific URLs
    const dockerUrls = [
      `http://cellseg-backend:5000/uploads/${projectId}/${imageId}`,
      `http://cellseg-backend:5000/uploads/${projectId}/${imageId}.png`,
      `http://cellseg-backend:5000/uploads/${projectId}/${imageId}.jpg`,
    ];

    // Try each URL
    const dockerResult = await tryMultipleImageUrls(dockerUrls, opts);

    if (dockerResult) {
      if (opts.showToasts) {
        toast.success('Image loaded from Docker path');
      }

      return dockerResult;
    }
  } catch (error) {
    logger.error(`Error loading from Docker path:`, error);
  }

  if (opts.showToasts) {
    toast.error('Failed to load image');
  }

  logger.error(`Failed to load image: projectId=${projectId}, imageId=${imageId}`);
  return null;
};

export default {
  loadImageFromUrl,
  loadImageFromFile,
  loadImage,
  getImageDimensions,
  tryMultipleImageUrls,
  loadImageFromApi,
  universalImageLoader,
  imageToCanvas,
  getImageData,
  addCacheBuster,
  checkImageExists,
  generatePossibleImageUrls,
};
