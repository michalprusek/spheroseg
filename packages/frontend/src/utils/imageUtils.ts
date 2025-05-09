/**
 * This file re-exports image utilities to maintain backward compatibility
 * with existing code that imports from this location.
 *
 * @deprecated Import from @shared/utils/imageUtils directly for new code
 */

import sharedImageUtils from '@shared/utils/imageUtils';

// Re-export types
export type { ImageBase, ImageDimensions, ImageLoadOptions } from '@shared/utils/imageUtils';

// Re-export functions for backward compatibility
export const checkFileExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    return response.ok;
  } catch (error) {
    console.debug(`Image does not exist at ${url}:`, error);
    return false;
  }
};

export const getImageDimensions = async (url: string): Promise<{ width: number; height: number } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      console.error(`Failed to load image from ${url}`);
      resolve(null);
    };

    img.src = url;
  });
};

export const createDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    return null;
  } catch (error) {
    console.error(`Error creating data URL:`, error);
    return null;
  }
};

export const loadImageFromApi = async (projectId: string, imageId: string): Promise<any> => {
  console.warn('loadImageFromApi is deprecated. Use shared utilities instead.');
  return null;
};

export const loadImageByPath = async (projectId: string, imageId: string): Promise<any> => {
  console.warn('loadImageByPath is deprecated. Use shared utilities instead.');
  return null;
};

export const loadImage = async (projectId: string, imageId: string): Promise<any> => {
  console.warn('loadImage is deprecated. Use shared utilities instead.');
  return null;
};

export const batchProcess = async (urls: string[]): Promise<string | null> => {
  for (const url of urls) {
    const exists = await checkFileExists(url);
    if (exists) return url;
  }
  return null;
};

// Use shared utility for path generation
export const generatePossibleImagePaths = sharedImageUtils.generatePossibleImagePaths;

// Export default that combines both
export default {
  ...sharedImageUtils,
  checkFileExists,
  getImageDimensions,
  createDataUrl,
  loadImageFromApi,
  loadImageByPath,
  loadImage,
  batchProcess,
  generatePossibleImagePaths
};
