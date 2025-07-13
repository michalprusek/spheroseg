/**
 * Path utilities for cross-platform file path handling
 */

import path from 'path';

/**
 * Normalize a file path for cross-platform compatibility
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * Get the file extension from a path
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Get the file name without extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName);
  return fileName.slice(0, -ext.length);
}

/**
 * Join path segments safely
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(path.join(...segments));
}

/**
 * Get the directory name from a path
 */
export function getDirName(filePath: string): string {
  return normalizePath(path.dirname(filePath));
}

/**
 * Check if a path is absolute
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * Resolve a path relative to a base path
 */
export function resolvePath(basePath: string, relativePath: string): string {
  return normalizePath(path.resolve(basePath, relativePath));
}

/**
 * Generate unique filename with timestamp
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000);
  const ext = getFileExtension(originalName);
  const basename = getFileNameWithoutExtension(originalName);
  return `${basename}-${timestamp}-${randomNum}${ext}`;
}

/**
 * Extract filename from path
 */
export function extractFilename(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Extract extension without dot
 */
export function extractExtension(filePath: string): string {
  const ext = getFileExtension(filePath);
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

/**
 * Extract base name without extension
 */
export function extractBaseName(filePath: string): string {
  return getFileNameWithoutExtension(filePath);
}

/**
 * Generate storage path for uploads
 */
export function generateStoragePath(projectId: string, filename: string): string {
  return joinPath('uploads', projectId, filename);
}

/**
 * Generate thumbnail path
 */
export function generateThumbnailPath(originalPath: string): string {
  const dir = getDirName(originalPath);
  const basename = getFileNameWithoutExtension(originalPath);
  const ext = getFileExtension(originalPath);
  return joinPath(dir, 'thumbnails', `${basename}_thumb${ext}`);
}

/**
 * Combine URL parts
 */
export function combineUrl(...parts: string[]): string {
  return parts
    .map((part, index) => {
      if (index === 0) {
        return part.replace(/\/$/, '');
      }
      return part.replace(/^\//, '').replace(/\/$/, '');
    })
    .join('/');
}

/**
 * Generate possible image paths for different formats
 */
export function generatePossibleImagePaths(basePath: string): string[] {
  const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif'];
  const baseWithoutExt = basePath.replace(/\.[^/.]+$/, '');
  return extensions.map(ext => baseWithoutExt + ext);
}

/**
 * Add cache busting parameter to path
 */
export function addCacheBusting(filePath: string): string {
  const timestamp = Date.now();
  const separator = filePath.includes('?') ? '&' : '?';
  return `${filePath}${separator}v=${timestamp}`;
}

/**
 * Check if path is an image
 */
export function isImagePath(filePath: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif'];
  const ext = getFileExtension(filePath).toLowerCase();
  return imageExtensions.includes(ext);
}

/**
 * Get relative path from base
 */
export function getRelativePath(fullPath: string, basePath: string): string {
  return path.relative(basePath, fullPath).replace(/\\/g, '/');
}

/**
 * Get directory path
 */
export function getDirPath(filePath: string): string {
  return getDirName(filePath);
}

/**
 * Get absolute path
 */
export function getAbsolutePath(relativePath: string, basePath: string = process.cwd()): string {
  return resolvePath(basePath, relativePath);
}

/**
 * Extract path from URL
 */
export function extractPathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    // If not a valid URL, assume it's already a path
    return url;
  }
}

/**
 * Convert database path to filesystem path
 */
export function dbPathToFilesystemPath(dbPath: string, uploadDir: string): string {
  // Remove any leading slashes and normalize
  const cleanPath = dbPath.replace(/^\/+/, '');
  return joinPath(uploadDir, cleanPath);
}

/**
 * Normalize path for database storage
 */
export function normalizePathForDb(filePath: string): string {
  // Remove upload directory prefix if present and normalize slashes
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

// Default export with all functions
const pathUtils = {
  normalizePath,
  getFileExtension,
  getFileNameWithoutExtension,
  joinPath,
  getDirName,
  isAbsolutePath,
  resolvePath,
  generateUniqueFilename,
  extractFilename,
  extractExtension,
  extractBaseName,
  generateStoragePath,
  generateThumbnailPath,
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
};

export default pathUtils;