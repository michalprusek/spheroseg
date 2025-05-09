/**
 * This file re-exports path utilities from shared utils package to maintain 
 * backward compatibility with existing code that imports from this location.
 * 
 * All path-related functionality has been consolidated into the shared utilities
 * in the shared/utils/pathUtils.ts file.
 * 
 * @deprecated Import from @shared/utils/pathUtils directly for new code
 */

import pathUtils from '@shared/utils/pathUtils';

// Re-export all named exports from shared pathUtils
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
  normalizePathForDb
} = pathUtils;

// Export default for backward compatibility
export default pathUtils;
