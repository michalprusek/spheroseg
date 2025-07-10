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