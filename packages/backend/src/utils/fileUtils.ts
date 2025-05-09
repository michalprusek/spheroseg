import fs from 'fs';
import path from 'path';
import config from '../config';
import logger from './logger';

/**
 * Create required upload directories for the application
 */
export function setupUploadDirectories(): void {
  // Define base upload directory
  const uploadDir = config.uploads?.path || path.join(process.cwd(), 'uploads');
  
  // Create main upload directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    logger.debug('Creating upload directory', { path: uploadDir });
    fs.mkdirSync(uploadDir, { recursive: true });
  } else {
    logger.debug('Upload directory already exists', { path: uploadDir });
  }
  
  // Create subdirectories
  const avatarDir = path.join(uploadDir, 'avatars');
  console.log(`Ensuring avatar directory exists: ${avatarDir}`);
  if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
  }
  
  // Create images directory
  const imagesDir = path.join(uploadDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  // Create segmentation directory
  const segmentationDir = path.join(uploadDir, 'segmentation');
  if (!fs.existsSync(segmentationDir)) {
    fs.mkdirSync(segmentationDir, { recursive: true });
  }
  
  // Create exports directory
  const exportsDir = path.join(uploadDir, 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
  
  // Create temporary directory
  const tempDir = path.join(uploadDir, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Set appropriate permissions
  try {
    fs.chmodSync(uploadDir, 0o777);
    fs.chmodSync(avatarDir, 0o777);
    fs.chmodSync(imagesDir, 0o777);
    fs.chmodSync(segmentationDir, 0o777);
    fs.chmodSync(exportsDir, 0o777);
    fs.chmodSync(tempDir, 0o777);
  } catch (error) {
    logger.warn('Failed to set permissions on upload directories', { error });
  }
}

/**
 * Get a list of files in a directory
 * @param directory Directory path to list
 * @param options Options for listing
 * @returns Array of file paths
 */
export function listFiles(
  directory: string, 
  options: { 
    recursive?: boolean; 
    filter?: (filename: string) => boolean;
  } = {}
): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }
  
  const { recursive = false, filter } = options;
  const files: string[] = [];
  
  const dirEntries = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const entry of dirEntries) {
    const fullPath = path.join(directory, entry.name);
    
    if (entry.isDirectory() && recursive) {
      files.push(...listFiles(fullPath, options));
    } else if (entry.isFile()) {
      if (!filter || filter(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Create a unique filename to avoid overwrites
 * @param directory Directory where file will be stored
 * @param filename Original filename
 * @returns Unique filename
 */
export function createUniqueFilename(directory: string, filename: string): string {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  
  let uniqueName = `${baseName}${ext}`;
  let counter = 1;
  
  while (fs.existsSync(path.join(directory, uniqueName))) {
    uniqueName = `${baseName}_${counter}${ext}`;
    counter++;
  }
  
  return uniqueName;
}

export default {
  setupUploadDirectories,
  listFiles,
  createUniqueFilename
};