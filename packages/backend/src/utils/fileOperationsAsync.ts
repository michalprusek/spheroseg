/**
 * Async File Operations Utilities
 * 
 * Provides async/await alternatives to synchronous file operations
 * to prevent blocking the Node.js event loop
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import logger from './logger';

/**
 * Check if a file or directory exists (async)
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create directory recursively (async)
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // If error is not EEXIST, rethrow
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Remove file or directory (async)
 */
export async function remove(filePath: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await fs.rmdir(filePath, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }
  } catch (error) {
    // If error is not ENOENT, rethrow
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Copy file (async)
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  // Ensure destination directory exists
  const destDir = path.dirname(dest);
  await ensureDir(destDir);
  
  // Copy the file
  await fs.copyFile(src, dest);
}

/**
 * Move/rename file (async)
 */
export async function move(src: string, dest: string): Promise<void> {
  try {
    // Try rename first (fastest if on same filesystem)
    await fs.rename(src, dest);
  } catch (error) {
    // If cross-device, copy then delete
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
      await copyFile(src, dest);
      await remove(src);
    } else {
      throw error;
    }
  }
}

/**
 * Read directory contents (async)
 */
export async function readDir(dirPath: string): Promise<string[]> {
  return fs.readdir(dirPath);
}

/**
 * Get file stats (async)
 */
export async function stat(filePath: string): Promise<fsSync.Stats> {
  return fs.stat(filePath);
}

/**
 * Write file with atomic operation (async)
 */
export async function writeFileAtomic(
  filePath: string, 
  data: string | Buffer,
  options?: { encoding?: BufferEncoding }
): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  
  try {
    // Write to temp file
    await fs.writeFile(tempPath, data, options);
    
    // Atomically rename to target
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await remove(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Ensure multiple directories exist (async, parallel)
 */
export async function ensureDirs(dirPaths: string[]): Promise<void> {
  await Promise.all(dirPaths.map(dirPath => ensureDir(dirPath)));
}

/**
 * Remove multiple files (async, parallel)
 */
export async function removeFiles(filePaths: string[]): Promise<void> {
  await Promise.all(filePaths.map(filePath => remove(filePath)));
}

/**
 * Generate unique filename in directory (async)
 */
export async function generateUniqueFilename(
  directory: string,
  baseName: string,
  extension: string
): Promise<string> {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  let uniqueName = `${baseName}${ext}`;
  let counter = 1;

  while (await exists(path.join(directory, uniqueName))) {
    uniqueName = `${baseName}_${counter}${ext}`;
    counter++;
  }

  return uniqueName;
}

/**
 * Setup upload directories (async)
 */
export async function setupUploadDirectories(uploadDir: string): Promise<void> {
  logger.debug('Setting up upload directories', { uploadDir });

  // Create main upload directory
  await ensureDir(uploadDir);

  // Create subdirectories in parallel
  const subdirs = [
    'images',
    'thumbnails',
    'temp',
    'exports',
    'segmentations'
  ];

  await ensureDirs(subdirs.map(subdir => path.join(uploadDir, subdir)));
  
  logger.info('Upload directories created successfully', { uploadDir });
}

/**
 * Clean up temporary files older than specified age (async)
 */
export async function cleanupOldFiles(
  directory: string,
  maxAgeMs: number
): Promise<number> {
  let deletedCount = 0;
  const now = Date.now();

  try {
    const files = await readDir(directory);
    
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directory, file);
        try {
          const stats = await stat(filePath);
          const age = now - stats.mtimeMs;
          
          if (age > maxAgeMs && stats.isFile()) {
            await remove(filePath);
            deletedCount++;
            logger.debug('Deleted old file', { filePath, ageMs: age });
          }
        } catch (error) {
          logger.warn('Failed to process file during cleanup', { filePath, error });
        }
      })
    );
    
    logger.info('Cleanup completed', { directory, deletedCount });
  } catch (error) {
    logger.error('Failed to clean up old files', { directory, error });
  }
  
  return deletedCount;
}

export default {
  exists,
  ensureDir,
  remove,
  copyFile,
  move,
  readDir,
  stat,
  writeFileAtomic,
  ensureDirs,
  removeFiles,
  generateUniqueFilename,
  setupUploadDirectories,
  cleanupOldFiles,
};