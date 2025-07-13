/**
 * Async version of critical parts of image routes
 * This file demonstrates async/await replacements for sync file operations
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import logger from '../utils/logger';
import config from '../config';
import { exists, ensureDir } from '../utils/fileOperationsAsync';

// Async version of upload directory setup
export async function setupUploadDirectory(): Promise<void> {
  const UPLOAD_DIR = config.storage.uploadDir;

  try {
    const dirExists = await exists(UPLOAD_DIR);
    if (!dirExists) {
      await ensureDir(UPLOAD_DIR);
      logger.info('Created upload directory', { path: UPLOAD_DIR });
    } else {
      logger.debug('Upload directory already exists', { path: UPLOAD_DIR });
    }
  } catch (error) {
    logger.error('Failed to create upload directory', {
      path: UPLOAD_DIR,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Async version of file cleanup
export async function cleanupUploadedFiles(filePaths: string[]): Promise<void> {
  const cleanupPromises = filePaths.map(async (filePath) => {
    try {
      const fileExists = await exists(filePath);
      if (fileExists) {
        await fs.unlink(filePath);
        logger.debug('Cleaned up file after error', { path: filePath });
      }
    } catch (unlinkErr) {
      logger.error('Failed to cleanup file after error', {
        path: filePath,
        error: unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr),
      });
    }
  });

  await Promise.all(cleanupPromises);
}

// Async version of project directory creation
export async function ensureProjectDirectory(projectId: string): Promise<string> {
  const projectDir = path.join(config.storage.uploadDir, 'uploads', projectId);

  try {
    await ensureDir(projectDir);
    logger.debug('Ensured project directory exists', { projectId, path: projectDir });
    return projectDir;
  } catch (error) {
    logger.error('Failed to create project directory', {
      projectId,
      path: projectDir,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Async version of file existence check
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsSync.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Async version of batch file operations
export async function processFilesAsync<T>(
  files: T[],
  processor: (file: T) => Promise<any>,
  options: { parallel?: boolean } = { parallel: true }
): Promise<any[]> {
  if (options.parallel) {
    // Process files in parallel
    return Promise.all(files.map(processor));
  } else {
    // Process files sequentially
    const results = [];
    for (const file of files) {
      results.push(await processor(file));
    }
    return results;
  }
}

// Export all async utilities
export default {
  setupUploadDirectory,
  cleanupUploadedFiles,
  ensureProjectDirectory,
  checkFileExists,
  processFilesAsync,
};
