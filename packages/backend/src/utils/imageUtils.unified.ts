/**
 * Unified Image Utilities for Server
 *
 * This module provides a comprehensive set of utilities for working with images on the server:
 * - Path generation and manipulation
 * - Image metadata extraction
 * - File system operations
 * - Database path conversion
 *
 * It consolidates functionality from:
 * - server/src/utils/imageUtils.ts
 * - server/src/utils/fileUtils.ts
 * - server/src/services/imageService.ts
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
// Import the local logger instead of shared library for tests
import logger from './logger';

/**
 * Find the longest common suffix (ending) between two arrays
 * Useful for finding common path components
 */
function findLongestCommonSuffix<T>(arr1: T[], arr2: T[]): T[] {
  // Start from the end of both arrays
  let i = arr1.length - 1;
  let j = arr2.length - 1;
  const commonSuffix: T[] = [];

  // While we have elements in both arrays and they match
  while (i >= 0 && j >= 0 && arr1[i] === arr2[j]) {
    commonSuffix.unshift(arr1[i]);
    i--;
    j--;
  }

  return commonSuffix;
}

// Import local path utilities as the shared module isn't available in tests
const pathUtils = {
  dbPathToFilesystemPath: (dbPath: string, uploadDir: string): string => {
    if (!dbPath || !uploadDir) {
      logger.error('Invalid parameters for dbPathToFilesystemPath', {
        dbPath,
        uploadDir,
      });
      return path.join(uploadDir || '.', dbPath || '');
    }

    // Pokud cesta začíná celou absolutní cestou, vraťme ji přímo
    if (dbPath.startsWith(uploadDir)) {
      return dbPath;
    }

    // If path starts with http:// or https://, extract the path component
    if (dbPath.startsWith('http://') || dbPath.startsWith('https://')) {
      try {
        const url = new URL(dbPath);
        dbPath = url.pathname;
        logger.debug('Extracted path from URL', {
          originalPath: dbPath,
          extractedPath: url.pathname,
        });
      } catch (error) {
        logger.warn('Failed to parse URL', { path: dbPath, error });
        // Keep the original path if parsing fails
      }
    }

    // Remove any leading '/uploads' or 'uploads' from the path
    const cleanPath = dbPath.replace(/^\/?(uploads\/)?/, '');

    // Join with the upload directory - ensure uploadDir is absolute
    const absoluteUploadDir = path.isAbsolute(uploadDir) ? uploadDir : path.resolve(process.cwd(), uploadDir);

    const fullPath = path.join(absoluteUploadDir, cleanPath);

    // Log the path conversion for debugging
    logger.debug('dbPathToFilesystemPath conversion', {
      dbPath,
      uploadDir,
      absoluteUploadDir,
      cleanPath,
      fullPath,
    });

    return fullPath;
  },
  normalizePathForDb: (absolutePath: string, uploadDir: string): string => {
    if (!absolutePath || !uploadDir) {
      logger.error('Invalid parameters for normalizePathForDb', {
        absolutePath,
        uploadDir,
      });
      return absolutePath || '';
    }

    // Ensure all paths use forward slashes for consistency
    const normalizedAbsolutePath = absolutePath.replace(/\\/g, '/');

    // Convert uploadDir to absolute path if it's not already
    const absoluteUploadDir = path.isAbsolute(uploadDir) ? uploadDir : path.resolve(process.cwd(), uploadDir);

    const normalizedUploadDir = absoluteUploadDir.replace(/\\/g, '/');

    // Make sure uploadDir doesn't end with a slash
    const normalizedUploadDirTrimmed = normalizedUploadDir.endsWith('/')
      ? normalizedUploadDir.slice(0, -1)
      : normalizedUploadDir;

    // Get the project ID and filename from the absolute path
    const pathParts = normalizedAbsolutePath.split('/');
    const filename = pathParts[pathParts.length - 1];

    // Try to find the project ID in the path
    let projectId = '';
    for (let i = 0; i < pathParts.length; i++) {
      // Look for UUID format pattern in path
      if (pathParts[i].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        projectId = pathParts[i];
        break;
      }
    }

    // If we found a project ID, construct the path directly
    if (projectId) {
      const relativePath = `/uploads/${projectId}/${filename}`;
      logger.debug('normalizePathForDb conversion with projectId', {
        absolutePath,
        uploadDir,
        projectId,
        filename,
        relativePath,
      });
      return relativePath;
    }

    // Fallback to the original logic if we couldn't find a project ID
    // Replace the upload directory with '/uploads' to create a relative path
    let relativePath;
    if (normalizedAbsolutePath.startsWith(normalizedUploadDirTrimmed)) {
      relativePath = normalizedAbsolutePath.replace(normalizedUploadDirTrimmed, '');
    } else {
      // If the path doesn't start with the upload directory, try to find matching segments
      const uploadDirSegments = normalizedUploadDirTrimmed.split('/');
      const pathSegments = normalizedAbsolutePath.split('/');

      // Find the longest common suffix between uploadDir and absolutePath
      // This handles cases where the paths might be different but have common components
      const commonSuffix = findLongestCommonSuffix(uploadDirSegments, pathSegments);

      if (commonSuffix.length > 0) {
        // Found some common segments, use them to extract the relative path
        const commonPart = '/' + commonSuffix.join('/');
        const idx = normalizedAbsolutePath.indexOf(commonPart);
        if (idx >= 0) {
          relativePath = normalizedAbsolutePath.substring(idx);
          logger.debug('Found common path segments', {
            commonPart,
            relativePath,
          });
        } else {
          // Fallback to basename if something unexpected happened
          relativePath = '/' + path.basename(normalizedAbsolutePath);
          logger.warn('Failed to extract relative path using common segments', {
            absolutePath,
            uploadDir,
            commonSuffix,
          });
        }
      } else {
        // If no common segments, just return the basename
        relativePath = '/' + path.basename(normalizedAbsolutePath);
        logger.warn('Path is not within upload directory', {
          absolutePath,
          uploadDir,
          normalizedAbsolutePath,
          normalizedUploadDirTrimmed,
        });
      }
    }

    // Ensure the path starts with /uploads
    if (!relativePath.startsWith('/uploads')) {
      relativePath = '/uploads' + (relativePath.startsWith('/') ? relativePath : `/${relativePath}`);
    }

    // Log the path conversion for debugging
    logger.debug('normalizePathForDb final path', {
      absolutePath,
      uploadDir,
      absoluteUploadDir,
      relativePath,
    });

    return relativePath;
  },
  combineUrl: (baseUrl: string, pathStr: string): string => {
    if (!baseUrl) return pathStr;
    if (!pathStr) return baseUrl;
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
    return `${normalizedBase}${normalizedPath}`;
  },
  extractPathFromUrl: (url: string): string => {
    if (!url) return '';
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.pathname;
    } catch (error) {
      // If not a valid URL, assume it's a path already
      return url;
    }
  },
  // Extrahuje název souboru bez přípony
  extractBaseName: (filePath: string): string => {
    if (!filePath) return '';
    const fileName = path.basename(filePath);
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName;
    return fileName.substring(0, lastDotIndex);
  },
  // Extrahuje příponu souboru
  extractExtension: (filePath: string): string => {
    if (!filePath) return '';
    const ext = path.extname(filePath);
    return ext.startsWith('.') ? ext.substring(1) : ext;
  },
  // Generuje unikátní název souboru
  generateUniqueFilename: (baseName: string, extension: string, prefix?: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const sanitizedBaseName = baseName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const prefixStr = prefix ? `${prefix}-` : '';
    return `${prefixStr}${sanitizedBaseName}-${timestamp}-${randomString}.${extension}`;
  },
  // Generuje cestu pro uložení souboru
  generateStoragePath: (projectId: string, originalFilename: string): string => {
    const uniqueFilename = pathUtils.generateUniqueFilename(
      pathUtils.extractBaseName(originalFilename),
      pathUtils.extractExtension(originalFilename) || 'png',
      'img',
    );
    return path.join('uploads', projectId, uniqueFilename);
  },
  // Generuje cestu pro náhled souboru
  generateThumbnailPath: (projectId: string, originalFilename: string): string => {
    const uniqueFilename = pathUtils.generateUniqueFilename(
      pathUtils.extractBaseName(originalFilename),
      pathUtils.extractExtension(originalFilename) || 'png',
      'thumb',
    );
    return path.join('uploads', projectId, uniqueFilename);
  },
};

// Create Promise-based fs functions for testing
const fsExists = (path: string): Promise<boolean> => {
  return new Promise((resolve) => {
    fs.access(path, fs.constants.F_OK, (err) => {
      resolve(!err);
    });
  });
};

const fsMkdir = (path: string, options?: fs.MakeDirectoryOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.mkdir(path, options || {}, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Specifická implementace pro fs.readdir s lepším typováním
const fsReaddir = (path: string, options?: { withFileTypes?: boolean }): Promise<string[] | fs.Dirent[]> => {
  return new Promise((resolve, reject) => {
    if (options?.withFileTypes) {
      // Pokud požadujeme Dirent objekty, použijeme správný callback typ
      fs.readdir(path, { withFileTypes: true }, (err: NodeJS.ErrnoException | null, files: fs.Dirent[]) => {
        if (err) reject(err);
        else resolve(files);
      });
    } else {
      // Jinak zpracujeme jen stringy
      fs.readdir(path, (err: NodeJS.ErrnoException | null, files: string[]) => {
        if (err) reject(err);
        else resolve(files);
      });
    }
  });
};

const fsUnlink = (path: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(path, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const fsCopyFile = (src: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.copyFile(src, dest, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

/**
 * Check if a file exists
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    return await fsExists(filePath);
  } catch (error) {
    logger.error(`Error checking if file exists: ${filePath}`, error);
    return false;
  }
};

/**
 * Create a directory if it doesn't exist
 */
export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    if (!(await fsExists(dirPath))) {
      await fsMkdir(dirPath, { recursive: true });
      logger.debug(`Created directory: ${dirPath}`);
    }
  } catch (error) {
    logger.error(`Error creating directory: ${dirPath}`, error);
    throw error;
  }
};

/**
 * Get image metadata using sharp
 */
export const getImageMetadata = async (
  filePath: string,
): Promise<{ width: number; height: number; format: string }> => {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
    };
  } catch (error) {
    logger.error(`Error getting image metadata: ${filePath}`, error);
    throw error;
  }
};

/**
 * Create a thumbnail from an image
 */
export const createThumbnail = async (
  sourcePath: string,
  targetPath: string,
  options: { width?: number; height?: number; fit?: keyof sharp.FitEnum } = {},
): Promise<void> => {
  try {
    const { width = 300, height = 300, fit = 'inside' } = options;

    await sharp(sourcePath).resize({ width, height, fit }).toFile(targetPath);

    logger.debug(`Created thumbnail: ${targetPath}`);
  } catch (error) {
    logger.error(`Error creating thumbnail: ${sourcePath} -> ${targetPath}`, error);
    throw error;
  }
};

/**
 * Convert a database-stored path to a filesystem path
 */
export const dbPathToFilesystemPath = (dbPath: string, uploadDir: string): string => {
  return pathUtils.dbPathToFilesystemPath(dbPath, uploadDir);
};

/**
 * Normalize an absolute path for storage in the database
 */
export const normalizePathForDb = (absolutePath: string, uploadDir: string): string => {
  return pathUtils.normalizePathForDb(absolutePath, uploadDir);
};

/**
 * Format image data for API responses
 */
export const formatImageForApi = (image: Record<string, unknown>, baseUrl: string): Record<string, unknown> => {
  if (!image) return {} as Record<string, unknown>;

  // Add full URLs for storage_path and thumbnail_path if they exist
  const result = { ...image };

  if (image.storage_path && typeof image.storage_path === 'string') {
    // If the storage_path is already a full URL, don't modify it
    if (image.storage_path.startsWith('http://') || image.storage_path.startsWith('https://')) {
      result.storage_path = image.storage_path;
    } else {
      // Otherwise, combine with the base URL
      result.storage_path = pathUtils.combineUrl(baseUrl, image.storage_path);
    }
  }

  if (image.thumbnail_path && typeof image.thumbnail_path === 'string') {
    // If the thumbnail_path is already a full URL, don't modify it
    if (image.thumbnail_path.startsWith('http://') || image.thumbnail_path.startsWith('https://')) {
      result.thumbnail_path = image.thumbnail_path;
    } else {
      // Otherwise, combine with the base URL
      result.thumbnail_path = pathUtils.combineUrl(baseUrl, image.thumbnail_path);
    }
  }

  return result;
};

/**
 * Copy a file from one location to another
 */
export const copyFile = async (sourcePath: string, targetPath: string): Promise<void> => {
  try {
    // Ensure the target directory exists
    const targetDir = path.dirname(targetPath);
    await ensureDirectoryExists(targetDir);

    // Copy the file
    await fsCopyFile(sourcePath, targetPath);
    logger.debug(`Copied file: ${sourcePath} -> ${targetPath}`);
  } catch (error) {
    logger.error(`Error copying file: ${sourcePath} -> ${targetPath}`, error);
    throw error;
  }
};

/**
 * Delete a file
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    if (await fileExists(filePath)) {
      await fsUnlink(filePath);
      logger.debug(`Deleted file: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Error deleting file: ${filePath}`, error);
    throw error;
  }
};

/**
 * Get all files in a directory
 */
export const getFilesInDirectory = async (
  dirPath: string,
  options: { recursive?: boolean; filter?: (filename: string) => boolean } = {},
): Promise<string[]> => {
  try {
    const { recursive = false, filter } = options;

    if (!(await fileExists(dirPath))) {
      return [];
    }

    const entries = (await fsReaddir(dirPath, {
      withFileTypes: true,
    })) as fs.Dirent[];
    let files: string[] = [];

    for (const entry of entries as fs.Dirent[]) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        const subDirFiles = await getFilesInDirectory(fullPath, options);
        files = [...files, ...subDirFiles];
      } else if (entry.isFile()) {
        if (!filter || filter(entry.name)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  } catch (error) {
    logger.error(`Error getting files in directory: ${dirPath}`, error);
    throw error;
  }
};

/**
 * Process files in batches
 */
export const processBatch = async <T>(
  items: T[],
  batchSize: number,
  processFn: (batch: T[]) => Promise<void>,
): Promise<void> => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processFn(batch);
  }
};

/**
 * Generate a unique filename for an image
 */
export const generateUniqueImageFilename = (originalFilename: string, prefix?: string): string => {
  const baseName = pathUtils.extractBaseName(originalFilename);
  const extension = pathUtils.extractExtension(originalFilename) || 'png';

  return pathUtils.generateUniqueFilename(baseName, extension, prefix);
};

/**
 * Generate storage paths for an image
 */
export const generateImagePaths = (
  projectId: string,
  originalFilename: string,
): { storagePath: string; thumbnailPath: string } => {
  const storagePath = pathUtils.generateStoragePath(projectId, originalFilename);
  const thumbnailPath = pathUtils.generateThumbnailPath(projectId, originalFilename);

  return { storagePath, thumbnailPath };
};

/**
 * Verify that image files exist on the filesystem
 */
export const verifyImageFilesForApi = (image: Record<string, unknown>, uploadDir: string): Record<string, unknown> => {
  if (!image) return {} as Record<string, unknown>;

  const result = { ...image, file_exists: true };

  // Check if the main image file exists
  if (image.storage_path && typeof image.storage_path === 'string') {
    const storagePath = image.storage_path.startsWith('http')
      ? pathUtils.extractPathFromUrl(image.storage_path)
      : image.storage_path;

    const fullStoragePath = dbPathToFilesystemPath(storagePath, uploadDir);
    const storageExists = fs.existsSync(fullStoragePath);

    if (!storageExists) {
      result.file_exists = false;
      logger.warn(`Image file not found: ${fullStoragePath}`);
    }
  }

  return result;
};

export default {
  fileExists,
  ensureDirectoryExists,
  getImageMetadata,
  createThumbnail,
  dbPathToFilesystemPath,
  normalizePathForDb,
  formatImageForApi,
  verifyImageFilesForApi,
  copyFile,
  deleteFile,
  getFilesInDirectory,
  processBatch,
  generateUniqueImageFilename,
  generateImagePaths,
};
