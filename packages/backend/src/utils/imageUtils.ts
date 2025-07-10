/**
 * Utility functions for handling image paths and formatting
 *
 * This is a re-export of shared image utilities to maintain backward compatibility.
 * For new code, please import directly from @shared/utils/imageUtils
 *
 * @deprecated For new code, use @shared/utils/imageUtils instead
 */

import sharedImageUtils from '@spheroseg/shared/utils/imageUtils';
import imageUtils from './imageUtils.unified';
import * as fs from 'fs';

// Export all from the unified implementation
export * from './imageUtils.unified';

// Re-export types and functions from shared utilities
export type {
  ImageBase,
  ImageDimensions,
  ImageLoadOptions,
} from '@spheroseg/shared/utils/imageUtils';

// For backward compatibility
export interface ImageData {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  storage_path: string;
  thumbnail_path?: string;
  width?: number;
  height?: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
  src?: string;
  storage_path_full?: string;
  thumbnail_path_full?: string;
  file_exists?: boolean;
  thumbnail_exists?: boolean;
  [key: string]: any;
}

/**
 * Format image paths by adding full URLs with origin
 * @deprecated Use formatImageForApi from imageUtils.unified.ts instead
 */
export const formatImagePaths = (image: ImageData, origin: string): ImageData => {
  return imageUtils.formatImageForApi(image, origin);
};

/**
 * Verify if image files exist on the filesystem
 * @deprecated Use the fileExists function from imageUtils.unified.ts instead
 */
export const verifyImageFiles = (image: ImageData, uploadDir: string): ImageData => {
  const result = { ...image };

  // Check if the main image file exists
  if (result.storage_path) {
    const imagePath = imageUtils.dbPathToFilesystemPath(result.storage_path, uploadDir);
    result.file_exists = fs.existsSync(imagePath);
  } else {
    result.file_exists = false;
  }

  // Check if the thumbnail file exists
  if (result.thumbnail_path) {
    const thumbnailPath = imageUtils.dbPathToFilesystemPath(result.thumbnail_path, uploadDir);
    result.thumbnail_exists = fs.existsSync(thumbnailPath);
  } else {
    result.thumbnail_exists = false;
  }

  return result;
};

// Export default object that combines all utilities
export default {
  ...imageUtils,
  ...sharedImageUtils,

  // Include legacy functions in the default export
  formatImagePaths,
  verifyImageFiles,
};
