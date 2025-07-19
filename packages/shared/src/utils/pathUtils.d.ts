/**
 * Path utilities for cross-platform file path handling
 */
/**
 * Normalize a file path for cross-platform compatibility
 */
export declare function normalizePath(filePath: string): string;
/**
 * Get the file extension from a path
 */
export declare function getFileExtension(filePath: string): string;
/**
 * Get the file name without extension
 */
export declare function getFileNameWithoutExtension(filePath: string): string;
/**
 * Join path segments safely
 */
export declare function joinPath(...segments: string[]): string;
/**
 * Get the directory name from a path
 */
export declare function getDirName(filePath: string): string;
/**
 * Check if a path is absolute
 */
export declare function isAbsolutePath(filePath: string): boolean;
/**
 * Resolve a path relative to a base path
 */
export declare function resolvePath(basePath: string, relativePath: string): string;
/**
 * Generate unique filename with timestamp
 */
export declare function generateUniqueFilename(originalName: string): string;
/**
 * Extract filename from path
 */
export declare function extractFilename(filePath: string): string;
/**
 * Extract extension without dot
 */
export declare function extractExtension(filePath: string): string;
/**
 * Extract base name without extension
 */
export declare function extractBaseName(filePath: string): string;
/**
 * Generate storage path for uploads
 */
export declare function generateStoragePath(projectId: string, filename: string): string;
/**
 * Generate thumbnail path
 */
export declare function generateThumbnailPath(originalPath: string): string;
/**
 * Combine URL parts
 */
export declare function combineUrl(...parts: string[]): string;
/**
 * Generate possible image paths for different formats
 */
export declare function generatePossibleImagePaths(basePath: string): string[];
/**
 * Add cache busting parameter to path
 */
export declare function addCacheBusting(filePath: string): string;
/**
 * Check if path is an image
 */
export declare function isImagePath(filePath: string): boolean;
/**
 * Get relative path from base
 */
export declare function getRelativePath(fullPath: string, basePath: string): string;
/**
 * Get directory path
 */
export declare function getDirPath(filePath: string): string;
/**
 * Get absolute path
 */
export declare function getAbsolutePath(relativePath: string, basePath?: string): string;
/**
 * Extract path from URL
 */
export declare function extractPathFromUrl(url: string): string;
/**
 * Convert database path to filesystem path
 */
export declare function dbPathToFilesystemPath(dbPath: string, uploadDir: string): string;
/**
 * Normalize path for database storage
 */
export declare function normalizePathForDb(filePath: string): string;
declare const pathUtils: {
    normalizePath: typeof normalizePath;
    getFileExtension: typeof getFileExtension;
    getFileNameWithoutExtension: typeof getFileNameWithoutExtension;
    joinPath: typeof joinPath;
    getDirName: typeof getDirName;
    isAbsolutePath: typeof isAbsolutePath;
    resolvePath: typeof resolvePath;
    generateUniqueFilename: typeof generateUniqueFilename;
    extractFilename: typeof extractFilename;
    extractExtension: typeof extractExtension;
    extractBaseName: typeof extractBaseName;
    generateStoragePath: typeof generateStoragePath;
    generateThumbnailPath: typeof generateThumbnailPath;
    combineUrl: typeof combineUrl;
    generatePossibleImagePaths: typeof generatePossibleImagePaths;
    addCacheBusting: typeof addCacheBusting;
    isImagePath: typeof isImagePath;
    getRelativePath: typeof getRelativePath;
    getDirPath: typeof getDirPath;
    getAbsolutePath: typeof getAbsolutePath;
    extractPathFromUrl: typeof extractPathFromUrl;
    dbPathToFilesystemPath: typeof dbPathToFilesystemPath;
    normalizePathForDb: typeof normalizePathForDb;
};
export default pathUtils;
//# sourceMappingURL=pathUtils.d.ts.map