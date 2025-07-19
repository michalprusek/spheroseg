/**
 * Unified Upload Service - Main Export
 */

// Export service
export { uploadService, UnifiedUploadService } from './UnifiedUploadService';

// Export types
export * from './types';

// Export strategies
export * from './strategies';

// Export hooks
export * from './hooks';

// Export preset configurations
import { FileUploadConfig } from './types';

export const UPLOAD_PRESETS: Record<string, Partial<FileUploadConfig>> = {
  IMAGE: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 50,
    acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif', 'image/bmp', 'image/webp'] as string[],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'] as string[],
    batchSize: 20,
    generatePreviews: true,
    autoSegment: false,
    chunkSize: 5 * 1024 * 1024,
    enableChunking: true,
    enableResume: true,
  },
  AVATAR: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1,
    acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as string[],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'] as string[],
    batchSize: 1,
    generatePreviews: true,
    autoSegment: false,
    enableChunking: false,
    enableResume: false,
  },
  DOCUMENT: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    acceptedTypes: ['application/pdf', 'text/plain', 'application/json'] as string[],
    acceptedExtensions: ['.pdf', '.txt', '.json'] as string[],
    batchSize: 5,
    generatePreviews: false,
    autoSegment: false,
    chunkSize: 10 * 1024 * 1024,
    enableChunking: true,
    enableResume: true,
  },
  VIDEO: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    maxFiles: 5,
    acceptedTypes: ['video/mp4', 'video/webm', 'video/ogg'] as string[],
    acceptedExtensions: ['.mp4', '.webm', '.ogg'] as string[],
    batchSize: 1,
    generatePreviews: true,
    autoSegment: false,
    chunkSize: 10 * 1024 * 1024,
    enableChunking: true,
    enableResume: true,
  },
};