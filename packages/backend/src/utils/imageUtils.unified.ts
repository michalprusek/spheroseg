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
import { exec } from 'child_process';
import { promisify } from 'util';
import * as util from 'util';
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
    const absoluteUploadDir = path.isAbsolute(uploadDir)
      ? uploadDir
      : path.resolve(process.cwd(), uploadDir);

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
    const absoluteUploadDir = path.isAbsolute(uploadDir)
      ? uploadDir
      : path.resolve(process.cwd(), uploadDir);

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
      relativePath =
        '/uploads' + (relativePath.startsWith('/') ? relativePath : `/${relativePath}`);
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
      'img'
    );
    return path.join('uploads', projectId, uniqueFilename);
  },
  // Generuje cestu pro náhled souboru
  generateThumbnailPath: (projectId: string, originalFilename: string): string => {
    const uniqueFilename = pathUtils.generateUniqueFilename(
      pathUtils.extractBaseName(originalFilename),
      'png', // Always use png extension for thumbnails since they're saved as PNG
      'thumb'
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
const fsReaddir = (
  path: string,
  options?: { withFileTypes?: boolean }
): Promise<string[] | fs.Dirent[]> => {
  return new Promise((resolve, reject) => {
    if (options?.withFileTypes) {
      // Pokud požadujeme Dirent objekty, použijeme správný callback typ
      fs.readdir(path, { withFileTypes: true }, (err: Error | null, files: fs.Dirent[]) => {
        if (err) reject(err);
        else resolve(files);
      });
    } else {
      // Jinak zpracujeme jen stringy
      fs.readdir(path, (err: Error | null, files: string[]) => {
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
  filePath: string
): Promise<{ width: number; height: number; format: string }> => {
  try {
    const ext = path.extname(filePath).toLowerCase();

    // Special handling for BMP and TIFF files
    if (ext === '.bmp' || ext === '.tiff' || ext === '.tif') {
      const format = ext === '.bmp' ? 'bmp' : 'tiff';
      try {
        // Try to read metadata with Sharp
        const metadata = await sharp(filePath).metadata();
        return {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: format,
        };
      } catch (sharpError) {
        // If Sharp fails, return basic info
        logger.warn(`Sharp cannot read ${format.toUpperCase()} metadata, using basic info`, {
          filePath,
        });
        return {
          width: 0,
          height: 0,
          format: format,
        };
      }
    }

    // Get metadata using sharp for other formats
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
    };
  } catch (error) {
    const sharpError = error as Error;
    logger.error(`Error getting image metadata: ${filePath}`, {
      error: sharpError.message,
      stack: sharpError.stack,
    });
    throw error;
  }
};

/**
 * Create a thumbnail from an image
 */
export const createThumbnail = async (
  sourcePath: string,
  targetPath: string,
  options: { width?: number; height?: number; fit?: keyof sharp.FitEnum } = {}
): Promise<void> => {
  try {
    const { width = 300, height = 300, fit = 'inside' } = options;

    // Validate that target path has .png extension
    if (!targetPath.toLowerCase().endsWith('.png')) {
      throw new Error(`Thumbnail target path must have .png extension, got: ${targetPath}`);
    }
    const ext = path.extname(sourcePath).toLowerCase();

    // Special handling for BMP files using Python PIL
    if (ext === '.bmp') {
      const execAsync = promisify(exec);

      const pythonScript = `
import sys
from PIL import Image
img = Image.open(sys.argv[1])
img.thumbnail((${width}, ${height}), Image.Resampling.LANCZOS)
# Save as PNG for lossless compression
img.save(sys.argv[2], 'PNG', optimize=True)
`;

      try {
        // Escape single quotes in paths and use single quotes for the script
        const escapedScript = pythonScript.replace(/'/g, "'\"'\"'");
        const escapedSource = sourcePath.replace(/'/g, "'\"'\"'");
        const escapedTarget = targetPath.replace(/'/g, "'\"'\"'");
        const result = await execAsync(
          `python3 -c '${escapedScript}' '${escapedSource}' '${escapedTarget}'`
        );
        if (result.stderr) {
          logger.warn(`Python thumbnail creation had stderr output`, { stderr: result.stderr });
        }
        logger.debug(`Created BMP thumbnail using PIL: ${sourcePath} -> ${targetPath}`);
      } catch (pilError) {
        logger.error(`BMP thumbnail creation failed`, { sourcePath, error: pilError });
        throw new Error(`Cannot create BMP thumbnail: ${(pilError as Error).message}`);
      }
    } else if (ext === '.tiff' || ext === '.tif') {
      try {
        // Try to create thumbnail directly for TIFF
        await sharp(sourcePath)
          .resize({ width, height, fit })
          .png({
            compressionLevel: 9, // Maximum compression (still lossless)
            adaptiveFiltering: true,
          })
          .toFile(targetPath);
      } catch (sharpError) {
        // If Sharp fails with TIFF, try conversion through PNG
        logger.warn(`Direct conversion of ${ext} failed, trying through temporary file`, {
          sourcePath,
        });

        const tempPath = path.join(path.dirname(sourcePath), `temp_${Date.now()}.png`);
        try {
          // First convert TIFF to PNG
          await sharp(sourcePath).png().toFile(tempPath);

          // Then create thumbnail from PNG
          await sharp(tempPath)
            .resize({ width, height, fit })
            .png({
              compressionLevel: 9,
              adaptiveFiltering: true,
            })
            .toFile(targetPath);

          // Delete temporary file
          try {
            await fs.promises.unlink(tempPath);
          } catch (unlinkError) {
            logger.warn('Failed to delete temporary file', { tempPath });
          }
        } catch (conversionError) {
          logger.error(`${ext} conversion failed completely`, {
            sourcePath,
            error: conversionError,
          });
          throw new Error(`Cannot process ${ext} file: ${(conversionError as Error).message}`);
        }
      }
    } else {
      // Create thumbnail for other formats
      await sharp(sourcePath)
        .resize({ width, height, fit })
        .png({
          compressionLevel: 9, // Maximum compression (still lossless)
          adaptiveFiltering: true,
        })
        .toFile(targetPath);
    }

    logger.debug(`Created thumbnail: ${targetPath}`);
  } catch (error) {
    const sharpError = error as Error;
    logger.error(`Error creating thumbnail: ${sourcePath} -> ${targetPath}`, {
      error: sharpError.message,
      stack: sharpError.stack,
    });
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
export const formatImageForApi = (
  image: Record<string, unknown>,
  _baseUrl: string
): Record<string, unknown> => {
  if (!image) return {} as Record<string, unknown>;

  // Add full URLs for storage_path and thumbnail_path if they exist
  const result = { ...image };

  // Convert snake_case segmentation_status to camelCase segmentationStatus
  // Also handle the case where both might exist (from SQL alias)
  if ('segmentation_status' in image) {
    logger.debug('Converting segmentation_status to segmentationStatus', {
      original: image.segmentation_status,
    });
    result.segmentationStatus = image.segmentation_status;
    delete result.segmentation_status;
  }

  // If the SQL alias worked and we have segmentationStatus directly, keep it
  if ('segmentationStatus' in image && !('segmentationStatus' in result)) {
    logger.debug('Found segmentationStatus directly in image', {
      value: image.segmentationStatus,
    });
    result.segmentationStatus = image.segmentationStatus;
  }

  if (image['storage_path'] && typeof image['storage_path'] === 'string') {
    // If the storage_path is already a full URL with internal Docker hostname, extract the path
    if (
      image['storage_path'].includes('://backend:') ||
      image['storage_path'].includes('://spheroseg-backend:')
    ) {
      try {
        const url = new URL(image['storage_path'] as string);
        // Extract just the pathname part
        const pathname = url.pathname;
        // If pathname starts with /app, remove it since nginx doesn't expect it
        const cleanPath = pathname.startsWith('/app/') ? pathname.substring(4) : pathname;
        result.storage_path = cleanPath;
        logger.debug('Extracted path from internal URL', {
          original: image['storage_path'],
          extracted: cleanPath,
        });
      } catch (error) {
        logger.warn('Failed to parse internal URL, using as-is', {
          path: image['storage_path'],
          error,
        });
        result.storage_path = image['storage_path'];
      }
    } else if (
      (image['storage_path'] as string).startsWith('http://') ||
      (image['storage_path'] as string).startsWith('https://')
    ) {
      // For other full URLs, keep them as-is
      result.storage_path = image.storage_path;
    } else {
      // For relative paths, ensure they start with /
      const cleanPath = (image['storage_path'] as string).startsWith('/')
        ? image['storage_path']
        : `/${image['storage_path']}`;
      result.storage_path = cleanPath;
    }
  }

  if (image['thumbnail_path'] && typeof image['thumbnail_path'] === 'string') {
    // Apply same logic for thumbnail_path
    if (
      (image['thumbnail_path'] as string).includes('://backend:') ||
      (image['thumbnail_path'] as string).includes('://spheroseg-backend:')
    ) {
      try {
        const url = new URL(image['thumbnail_path'] as string);
        const pathname = url.pathname;
        const cleanPath = pathname.startsWith('/app/') ? pathname.substring(4) : pathname;
        result.thumbnail_path = cleanPath;
        logger.debug('Extracted thumbnail path from internal URL', {
          original: image['thumbnail_path'],
          extracted: cleanPath,
        });
      } catch (error) {
        logger.warn('Failed to parse internal thumbnail URL, using as-is', {
          path: image['thumbnail_path'],
          error,
        });
        result.thumbnail_path = image['thumbnail_path'];
      }
    } else if (
      (image['thumbnail_path'] as string).startsWith('http://') ||
      (image['thumbnail_path'] as string).startsWith('https://')
    ) {
      result.thumbnail_path = image.thumbnail_path;
    } else {
      const cleanPath = (image['thumbnail_path'] as string).startsWith('/')
        ? image['thumbnail_path']
        : `/${image['thumbnail_path']}`;
      result.thumbnail_path = cleanPath;
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
    logger.error(`Error copying file: ${sourcePath} -> ${targetPath}`, error as Record<string, unknown>);
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
    logger.error(`Error deleting file: ${filePath}`, error as Record<string, unknown>);
    throw error;
  }
};

/**
 * Get all files in a directory
 */
export const getFilesInDirectory = async (
  dirPath: string,
  options: { recursive?: boolean; filter?: (filename: string) => boolean } = {}
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
    logger.error(`Error getting files in directory: ${dirPath}`, error as Record<string, unknown>);
    throw error;
  }
};

/**
 * Process files in batches
 */
export const processBatch = async <T>(
  items: T[],
  batchSize: number,
  processFn: (batch: T[]) => Promise<void>
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
  originalFilename: string
): { storagePath: string; thumbnailPath: string } => {
  const storagePath = pathUtils.generateStoragePath(projectId, originalFilename);
  const thumbnailPath = pathUtils.generateThumbnailPath(projectId, originalFilename);

  return { storagePath, thumbnailPath };
};

/**
 * Verify that image files exist on the filesystem
 */
export const verifyImageFilesForApi = (
  image: Record<string, unknown>,
  uploadDir: string
): Record<string, unknown> => {
  if (!image) return {} as Record<string, unknown>;

  const result = { ...image, file_exists: true };

  // Check if the main image file exists
  if (image['storage_path'] && typeof image['storage_path'] === 'string') {
    const storagePath = (image['storage_path'] as string).startsWith('http')
      ? pathUtils.extractPathFromUrl(image['storage_path'] as string)
      : image['storage_path'] as string;

    const fullStoragePath = dbPathToFilesystemPath(storagePath, uploadDir);
    const storageExists = fs.existsSync(fullStoragePath);

    if (!storageExists) {
      result.file_exists = false;
      logger.warn(`Image file not found: ${fullStoragePath}`);
    }
  }

  return result;
};

/**
 * Convert a TIFF or BMP image to a web-friendly format (PNG)
 * This is crucial for displaying TIFFs and BMPs in browsers which typically don't support them natively.
 * Using PNG for lossless compression to preserve all image details.
 */
export const convertTiffToWebFriendly = async (
  sourcePath: string,
  targetPath: string
): Promise<void> => {
  const ext = path.extname(sourcePath).toLowerCase();
  const formatName = ext === '.bmp' ? 'BMP' : 'TIFF';

  try {
    // Check file size first to prevent memory issues
    const stats = await fs.promises.stat(sourcePath);
    const maxSizeMB = 100; // 100MB limit for TIFF/BMP files
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (stats.size > maxSizeBytes) {
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const error = new Error(`${formatName} file too large: ${sizeMB}MB (max: ${maxSizeMB}MB)`);
      logger.error(`File size exceeded for ${formatName} conversion`, {
        sourcePath,
        fileSize: stats.size,
        maxSize: maxSizeBytes,
        sizeMB
      });
      throw error;
    }

    // For BMP files, use Python PIL since Sharp doesn't support BMP natively
    if (ext === '.bmp') {
      const execAsync = util.promisify(exec);

      const pythonScript = `
import sys
from PIL import Image
img = Image.open(sys.argv[1])
# Save as PNG for lossless compression
img.save(sys.argv[2], 'PNG', optimize=True)
`;

      // Escape single quotes in paths and use single quotes for the script
      const escapedScript = pythonScript.replace(/'/g, "'\"'\"'");
      const escapedSource = sourcePath.replace(/'/g, "'\"'\"'");
      const escapedTarget = targetPath.replace(/'/g, "'\"'\"'");
      const result = await execAsync(
        `python3 -c '${escapedScript}' '${escapedSource}' '${escapedTarget}'`
      );
      if (result.stderr) {
        logger.warn(`Python conversion had stderr output`, { stderr: result.stderr });
      }
      logger.debug(
        `Converted ${formatName} to web-friendly PNG using PIL: ${sourcePath} -> ${targetPath}`
      );
    } else {
      // For TIFF and other formats, use Sharp directly
      await sharp(sourcePath)
        .png({
          compressionLevel: 9, // Maximum compression (still lossless)
          adaptiveFiltering: true, // Better compression for some images
          palette: false, // Use full color depth
        })
        .toFile(targetPath);
      logger.debug(`Converted ${formatName} to web-friendly PNG: ${sourcePath} -> ${targetPath}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const detailedError = new Error(`Failed to convert ${formatName} file: ${errorMessage}`);
    
    logger.error(
      `Error converting ${formatName} to web-friendly format: ${sourcePath} -> ${targetPath}`,
      {
        error: errorMessage,
        sourcePath,
        targetPath,
        formatName,
        stack: error instanceof Error ? error.stack : undefined
      }
    );
    
    // Add more context to the error
    if (errorMessage.includes('Input file is missing')) {
      throw new Error(`${formatName} file not found at: ${sourcePath}`);
    } else if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
      throw new Error(`${formatName} file too large to process (out of memory)`);
    } else if (errorMessage.includes('unsupported image format')) {
      throw new Error(`Unsupported ${formatName} format or corrupted file`);
    }
    
    throw detailedError;
  }
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
  convertTiffToWebFriendly, // Add the new function to the export
};
