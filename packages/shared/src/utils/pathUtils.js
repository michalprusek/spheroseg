"use strict";
/**
 * Path utilities for cross-platform file path handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
exports.getFileExtension = getFileExtension;
exports.getFileNameWithoutExtension = getFileNameWithoutExtension;
exports.joinPath = joinPath;
exports.getDirName = getDirName;
exports.isAbsolutePath = isAbsolutePath;
exports.resolvePath = resolvePath;
exports.generateUniqueFilename = generateUniqueFilename;
exports.extractFilename = extractFilename;
exports.extractExtension = extractExtension;
exports.extractBaseName = extractBaseName;
exports.generateStoragePath = generateStoragePath;
exports.generateThumbnailPath = generateThumbnailPath;
exports.combineUrl = combineUrl;
exports.generatePossibleImagePaths = generatePossibleImagePaths;
exports.addCacheBusting = addCacheBusting;
exports.isImagePath = isImagePath;
exports.getRelativePath = getRelativePath;
exports.getDirPath = getDirPath;
exports.getAbsolutePath = getAbsolutePath;
exports.extractPathFromUrl = extractPathFromUrl;
exports.dbPathToFilesystemPath = dbPathToFilesystemPath;
exports.normalizePathForDb = normalizePathForDb;
const path_1 = __importDefault(require("path"));
/**
 * Normalize a file path for cross-platform compatibility
 */
function normalizePath(filePath) {
    return path_1.default.normalize(filePath).replace(/\\/g, '/');
}
/**
 * Get the file extension from a path
 */
function getFileExtension(filePath) {
    return path_1.default.extname(filePath).toLowerCase();
}
/**
 * Get the file name without extension
 */
function getFileNameWithoutExtension(filePath) {
    const fileName = path_1.default.basename(filePath);
    const ext = path_1.default.extname(fileName);
    return fileName.slice(0, -ext.length);
}
/**
 * Join path segments safely
 */
function joinPath(...segments) {
    return normalizePath(path_1.default.join(...segments));
}
/**
 * Get the directory name from a path
 */
function getDirName(filePath) {
    return normalizePath(path_1.default.dirname(filePath));
}
/**
 * Check if a path is absolute
 */
function isAbsolutePath(filePath) {
    return path_1.default.isAbsolute(filePath);
}
/**
 * Resolve a path relative to a base path
 */
function resolvePath(basePath, relativePath) {
    return normalizePath(path_1.default.resolve(basePath, relativePath));
}
/**
 * Generate unique filename with timestamp
 */
function generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    const ext = getFileExtension(originalName);
    const basename = getFileNameWithoutExtension(originalName);
    return `${basename}-${timestamp}-${randomNum}${ext}`;
}
/**
 * Extract filename from path
 */
function extractFilename(filePath) {
    return path_1.default.basename(filePath);
}
/**
 * Extract extension without dot
 */
function extractExtension(filePath) {
    const ext = getFileExtension(filePath);
    return ext.startsWith('.') ? ext.slice(1) : ext;
}
/**
 * Extract base name without extension
 */
function extractBaseName(filePath) {
    return getFileNameWithoutExtension(filePath);
}
/**
 * Generate storage path for uploads
 */
function generateStoragePath(projectId, filename) {
    return joinPath('uploads', projectId, filename);
}
/**
 * Generate thumbnail path
 */
function generateThumbnailPath(originalPath) {
    const dir = getDirName(originalPath);
    const basename = getFileNameWithoutExtension(originalPath);
    const ext = getFileExtension(originalPath);
    return joinPath(dir, 'thumbnails', `${basename}_thumb${ext}`);
}
/**
 * Combine URL parts
 */
function combineUrl(...parts) {
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
function generatePossibleImagePaths(basePath) {
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif'];
    const baseWithoutExt = basePath.replace(/\.[^/.]+$/, '');
    return extensions.map(ext => baseWithoutExt + ext);
}
/**
 * Add cache busting parameter to path
 */
function addCacheBusting(filePath) {
    const timestamp = Date.now();
    const separator = filePath.includes('?') ? '&' : '?';
    return `${filePath}${separator}v=${timestamp}`;
}
/**
 * Check if path is an image
 */
function isImagePath(filePath) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif'];
    const ext = getFileExtension(filePath).toLowerCase();
    return imageExtensions.includes(ext);
}
/**
 * Get relative path from base
 */
function getRelativePath(fullPath, basePath) {
    return path_1.default.relative(basePath, fullPath).replace(/\\/g, '/');
}
/**
 * Get directory path
 */
function getDirPath(filePath) {
    return getDirName(filePath);
}
/**
 * Get absolute path
 */
function getAbsolutePath(relativePath, basePath = process.cwd()) {
    return resolvePath(basePath, relativePath);
}
/**
 * Extract path from URL
 */
function extractPathFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname;
    }
    catch {
        // If not a valid URL, assume it's already a path
        return url;
    }
}
/**
 * Convert database path to filesystem path
 */
function dbPathToFilesystemPath(dbPath, uploadDir) {
    // Remove any leading slashes and normalize
    const cleanPath = dbPath.replace(/^\/+/, '');
    return joinPath(uploadDir, cleanPath);
}
/**
 * Normalize path for database storage
 */
function normalizePathForDb(filePath) {
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
exports.default = pathUtils;
//# sourceMappingURL=pathUtils.js.map