import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import config from '../config';
import logger from './logger';

/**
 * Create required upload directories for the application (async version)
 */
export async function setupUploadDirectories(): Promise<void> {
  // Define base upload directory
  const uploadDir = config.storage.uploadDir;

  // Create main upload directory if it doesn't exist
  try {
    await fs.access(uploadDir);
    logger.debug('Upload directory already exists', { path: uploadDir });
  } catch {
    logger.debug('Creating upload directory', { path: uploadDir });
    await fs.mkdir(uploadDir, { recursive: true });
  }

  // Create subdirectories
  const directories = [
    path.join(uploadDir, 'avatars'),
    path.join(uploadDir, 'images'),
    path.join(uploadDir, 'segmentation'),
    path.join(uploadDir, 'exports'),
    path.join(uploadDir, 'temp'),
  ];

  // Create all directories in parallel
  await Promise.all(
    directories.map(async (dir) => {
      try {
        await fs.access(dir);
      } catch {
        logger.debug(`Creating directory`, { path: dir });
        await fs.mkdir(dir, { recursive: true });
      }
    })
  );

  // Set appropriate permissions in parallel
  try {
    await Promise.all([
      fs.chmod(uploadDir, 0o777),
      ...directories.map((dir) => fs.chmod(dir, 0o777)),
    ]);
  } catch (error) {
    logger.warn('Failed to set permissions on upload directories', { error });
  }
}

/**
 * Create required upload directories for the application (sync version for legacy compatibility)
 * @deprecated Use setupUploadDirectories() instead
 */
export function setupUploadDirectoriesSync(): void {
  const uploadDir = config.storage.uploadDir;

  if (!fsSync.existsSync(uploadDir)) {
    logger.debug('Creating upload directory', { path: uploadDir });
    fsSync.mkdirSync(uploadDir, { recursive: true });
  }

  const directories = [
    path.join(uploadDir, 'avatars'),
    path.join(uploadDir, 'images'),
    path.join(uploadDir, 'segmentation'),
    path.join(uploadDir, 'exports'),
    path.join(uploadDir, 'temp'),
  ];

  directories.forEach((dir) => {
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Get a list of files in a directory (async version)
 * @param directory Directory path to list
 * @param options Options for listing
 * @returns Array of file paths
 */
export async function listFiles(
  directory: string,
  options: {
    recursive?: boolean;
    filter?: (filename: string) => boolean;
  } = {}
): Promise<string[]> {
  try {
    await fs.access(directory);
  } catch {
    return [];
  }

  const { recursive = false, filter } = options;
  const files: string[] = [];

  const dirEntries = await fs.readdir(directory, { withFileTypes: true });

  const promises = dirEntries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory() && recursive) {
      const subFiles = await listFiles(fullPath, options);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      if (!filter || filter(fullPath)) {
        files.push(fullPath);
      }
    }
  });

  await Promise.all(promises);
  return files;
}

/**
 * Get a list of files in a directory (sync version for legacy compatibility)
 * @deprecated Use listFiles() instead
 */
export function listFilesSync(
  directory: string,
  options: {
    recursive?: boolean;
    filter?: (filename: string) => boolean;
  } = {}
): string[] {
  if (!fsSync.existsSync(directory)) {
    return [];
  }

  const { recursive = false, filter } = options;
  const files: string[] = [];

  const dirEntries = fsSync.readdirSync(directory, { withFileTypes: true });

  for (const entry of dirEntries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory() && recursive) {
      files.push(...listFilesSync(fullPath, options));
    } else if (entry.isFile()) {
      if (!filter || filter(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Create a unique filename to avoid overwrites (async version)
 * @param directory Directory where file will be stored
 * @param filename Original filename
 * @returns Unique filename
 */
export async function createUniqueFilename(directory: string, filename: string): Promise<string> {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);

  let uniqueName = `${baseName}${ext}`;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fs.access(path.join(directory, uniqueName));
      uniqueName = `${baseName}_${counter}${ext}`;
      counter++;
    } catch {
      // File doesn't exist, we can use this name
      break;
    }
  }

  return uniqueName;
}

/**
 * Create a unique filename to avoid overwrites (sync version for legacy compatibility)
 * @deprecated Use createUniqueFilename() instead
 */
export function createUniqueFilenameSync(directory: string, filename: string): string {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);

  let uniqueName = `${baseName}${ext}`;
  let counter = 1;

  while (fsSync.existsSync(path.join(directory, uniqueName))) {
    uniqueName = `${baseName}_${counter}${ext}`;
    counter++;
  }

  return uniqueName;
}

export default {
  setupUploadDirectories,
  setupUploadDirectoriesSync,
  listFiles,
  listFilesSync,
  createUniqueFilename,
  createUniqueFilenameSync,
};
