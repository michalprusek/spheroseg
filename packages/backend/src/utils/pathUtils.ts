/**
 * This file re-exports path utilities from shared utils package to maintain
 * backward compatibility with existing code that imports from this location.
 *
 * All path-related functionality has been consolidated into the shared utilities
 * in the shared/utils/pathUtils.ts file.
 *
 * @deprecated Import from @shared/utils/pathUtils directly for new code
 */

import pathUtils from '@spheroseg/shared/utils/pathUtils';
import config from '../config';

// Re-export most of the functions from shared pathUtils
export const {
  generateUniqueFilename,
  extractFilename,
  extractExtension,
  extractBaseName,
  generateStoragePath,
  generateThumbnailPath,
  normalizePath,
  combineUrl,
  generatePossibleImagePaths,
  addCacheBusting,
  isImagePath,
  getRelativePath,
  getDirPath,
  getAbsolutePath,
  extractPathFromUrl,
  dbPathToFilesystemPath,
  normalizePathForDb,
} = pathUtils;

// Maintain legacy function signature for getFileName for backward compatibility
export function getFileName(filePath: string): string {
  return pathUtils.extractFilename(filePath);
}

// Maintain legacy function signature for getFileExtension for backward compatibility
export function getFileExtension(filePath: string): string {
  const ext = pathUtils.extractExtension(filePath);
  return ext ? `.${ext}` : '';
}

// Add server-specific functions that aren't in the shared utils
export function getPublicUrl(filePath: string): string {
  // Ensure path starts with a slash
  const normalizedPath = normalizePath(filePath);

  // Construct URL with base URL from config
  return combineUrl(config.baseUrl, normalizedPath);
}

// Export default for backward compatibility
export default {
  ...pathUtils,
  getPublicUrl,
  getFileName,
  getFileExtension,
};
