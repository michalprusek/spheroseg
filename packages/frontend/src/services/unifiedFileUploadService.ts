/**
 * Unified File Upload Service
 * 
 * This service consolidates all file upload functionality into a single source of truth.
 * It provides comprehensive upload capabilities with validation, progress tracking, and error handling.
 */

import { createLogger } from '@/utils/logging/unifiedLogger';
import { handleError, ErrorType, ErrorSeverity } from '@/utils/error/unifiedErrorHandler';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import type { ProjectImage } from '@/pages/segmentation/types';

// Create logger instance
const logger = createLogger('UnifiedFileUploadService');

// ===========================
// Types and Interfaces
// ===========================

export interface FileUploadConfig {
  maxFileSize: number;
  maxFiles: number;
  acceptedTypes: string[];
  acceptedExtensions: string[];
  batchSize: number;
  generatePreviews: boolean;
  autoSegment: boolean;
  projectId?: string;
}

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  result?: any;
}

export enum UploadStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: UploadStatus;
  uploaded: number;
  total: number;
}

export interface UploadResult {
  successful: UploadFile[];
  failed: UploadFile[];
  cancelled: UploadFile[];
  totalFiles: number;
  totalSize: number;
  duration: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

// ===========================
// Default Configurations
// ===========================

export const UPLOAD_CONFIGS = {
  IMAGE: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 50,
    acceptedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/tif',
      'image/bmp',
      'image/webp',
    ],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'],
    batchSize: 20,
    generatePreviews: true,
    autoSegment: false,
  },
  AVATAR: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1,
    acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    batchSize: 1,
    generatePreviews: true,
    autoSegment: false,
  },
  DOCUMENT: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    acceptedTypes: ['application/pdf', 'text/plain', 'application/json'],
    acceptedExtensions: ['.pdf', '.txt', '.json'],
    batchSize: 5,
    generatePreviews: false,
    autoSegment: false,
  },
} as const;

// ===========================
// File Upload Service Class
// ===========================

class UnifiedFileUploadService {
  private uploadQueue: Map<string, UploadFile> = new Map();
  private activeUploads: Map<string, AbortController> = new Map();
  private config: FileUploadConfig = UPLOAD_CONFIGS.IMAGE;
  
  /**
   * Set upload configuration
   */
  public setConfig(config: Partial<FileUploadConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Upload config updated:', this.config);
  }
  
  /**
   * Get current configuration
   */
  public getConfig(): FileUploadConfig {
    return { ...this.config };
  }
  
  /**
   * Validate file before upload
   */
  public async validateFile(file: File): Promise<ValidationResult> {
    const warnings: string[] = [];
    
    try {
      // Check file size
      if (file.size > this.config.maxFileSize) {
        return {
          valid: false,
          error: `File size ${this.formatFileSize(file.size)} exceeds maximum ${this.formatFileSize(this.config.maxFileSize)}`,
        };
      }
      
      // Check file type
      const isTypeAccepted = this.config.acceptedTypes.includes(file.type) ||
        this.config.acceptedTypes.includes(file.type.split('/')[0] + '/*');
      
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isExtensionAccepted = this.config.acceptedExtensions.includes(extension);
      
      if (!isTypeAccepted && !isExtensionAccepted) {
        return {
          valid: false,
          error: `File type "${file.type}" is not accepted. Accepted types: ${this.config.acceptedExtensions.join(', ')}`,
        };
      }
      
      // Validate image dimensions if needed
      if (file.type.startsWith('image/')) {
        const dimensions = await this.getImageDimensions(file);
        if (dimensions) {
          if (dimensions.width < 100 || dimensions.height < 100) {
            warnings.push('Image dimensions are very small');
          }
          if (dimensions.width > 10000 || dimensions.height > 10000) {
            warnings.push('Image dimensions are very large, processing may be slow');
          }
        }
      }
      
      // Check for special characters in filename
      if (/[<>:"|?*]/.test(file.name)) {
        warnings.push('Filename contains special characters that may cause issues');
      }
      
      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger.error('File validation error:', error);
      return {
        valid: false,
        error: 'Failed to validate file',
      };
    }
  }
  
  /**
   * Validate multiple files
   */
  public async validateFiles(files: File[]): Promise<Map<File, ValidationResult>> {
    const results = new Map<File, ValidationResult>();
    
    // Check total file count
    if (files.length > this.config.maxFiles) {
      const error = `Too many files. Maximum ${this.config.maxFiles} files allowed.`;
      files.forEach(file => {
        results.set(file, { valid: false, error });
      });
      return results;
    }
    
    // Validate each file
    for (const file of files) {
      const result = await this.validateFile(file);
      results.set(file, result);
    }
    
    return results;
  }
  
  /**
   * Generate preview for file
   */
  public async generatePreview(file: File): Promise<string | undefined> {
    if (!this.config.generatePreviews) return undefined;
    
    try {
      // Handle different file types
      if (file.type.startsWith('image/')) {
        // Special handling for TIFF/BMP
        if (file.type === 'image/tiff' || file.type === 'image/bmp') {
          return await this.generateSpecialPreview(file);
        }
        
        // Standard image preview
        return await this.generateImagePreview(file);
      }
      
      // Add more preview generators for other file types
      return undefined;
    } catch (error) {
      logger.warn('Failed to generate preview:', error);
      return undefined;
    }
  }
  
  /**
   * Upload single file
   */
  public async uploadFile(
    file: File,
    options: {
      projectId?: string;
      onProgress?: (progress: UploadProgress) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<UploadFile> {
    const uploadFile: UploadFile = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: UploadStatus.PENDING,
      progress: 0,
    };
    
    this.uploadQueue.set(uploadFile.id, uploadFile);
    
    try {
      // Update status
      this.updateFileStatus(uploadFile.id, UploadStatus.VALIDATING);
      
      // Validate file
      const validation = await this.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'File validation failed');
      }
      
      // Show warnings if any
      validation.warnings?.forEach(warning => {
        toast.warning(`${file.name}: ${warning}`);
      });
      
      // Generate preview
      if (this.config.generatePreviews) {
        uploadFile.preview = await this.generatePreview(file);
      }
      
      // Update status
      this.updateFileStatus(uploadFile.id, UploadStatus.UPLOADING);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', options.projectId || this.config.projectId || '');
      formData.append('autoSegment', String(this.config.autoSegment));
      
      // Create abort controller
      const abortController = new AbortController();
      this.activeUploads.set(uploadFile.id, abortController);
      
      // Combine signals if provided
      if (options.signal) {
        options.signal.addEventListener('abort', () => abortController.abort());
      }
      
      // Upload file
      const response = await apiClient.post('/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal: abortController.signal,
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          
          this.updateFileProgress(uploadFile.id, progress);
          
          options.onProgress?.({
            fileId: uploadFile.id,
            fileName: file.name,
            progress,
            status: UploadStatus.UPLOADING,
            uploaded: progressEvent.loaded,
            total: progressEvent.total || 0,
          });
        },
      });
      
      // Update status
      this.updateFileStatus(uploadFile.id, UploadStatus.COMPLETE);
      uploadFile.result = response.data;
      
      logger.info(`File uploaded successfully: ${file.name}`);
      return this.uploadQueue.get(uploadFile.id)!;
    } catch (error) {
      const isCancelled = error instanceof Error && error.name === 'CanceledError';
      
      if (isCancelled) {
        this.updateFileStatus(uploadFile.id, UploadStatus.CANCELLED);
        uploadFile.error = 'Upload cancelled';
      } else {
        const errorInfo = handleError(error, {
          context: `File upload: ${file.name}`,
          errorInfo: {
            type: ErrorType.NETWORK,
            severity: ErrorSeverity.ERROR,
          },
        });
        
        this.updateFileStatus(uploadFile.id, UploadStatus.ERROR);
        uploadFile.error = errorInfo.message;
      }
      
      throw error;
    } finally {
      this.activeUploads.delete(uploadFile.id);
    }
  }
  
  /**
   * Upload multiple files
   */
  public async uploadFiles(
    files: File[],
    options: {
      projectId?: string;
      onProgress?: (progress: UploadProgress) => void;
      onFileComplete?: (file: UploadFile) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const result: UploadResult = {
      successful: [],
      failed: [],
      cancelled: [],
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      duration: 0,
    };
    
    try {
      logger.info(`Starting upload of ${files.length} files`);
      
      // Validate all files first
      const validations = await this.validateFiles(files);
      const validFiles: File[] = [];
      
      for (const [file, validation] of validations) {
        if (validation.valid) {
          validFiles.push(file);
        } else {
          const uploadFile: UploadFile = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: UploadStatus.ERROR,
            progress: 0,
            error: validation.error,
          };
          result.failed.push(uploadFile);
        }
      }
      
      // Upload valid files in batches
      for (let i = 0; i < validFiles.length; i += this.config.batchSize) {
        if (options.signal?.aborted) break;
        
        const batch = validFiles.slice(i, i + this.config.batchSize);
        const batchPromises = batch.map(file => 
          this.uploadFile(file, {
            ...options,
            onProgress: (progress) => {
              options.onProgress?.(progress);
            },
          }).then(uploadFile => {
            result.successful.push(uploadFile);
            options.onFileComplete?.(uploadFile);
          }).catch(error => {
            if (error.name === 'CanceledError') {
              const uploadFile = Array.from(this.uploadQueue.values())
                .find(f => f.file === file);
              if (uploadFile) {
                result.cancelled.push(uploadFile);
              }
            } else {
              const uploadFile = Array.from(this.uploadQueue.values())
                .find(f => f.file === file);
              if (uploadFile) {
                result.failed.push(uploadFile);
              }
            }
          })
        );
        
        await Promise.allSettled(batchPromises);
      }
      
      result.duration = Date.now() - startTime;
      
      // Show summary
      if (result.successful.length > 0) {
        toast.success(
          `Successfully uploaded ${result.successful.length} of ${files.length} files`
        );
      }
      
      if (result.failed.length > 0) {
        toast.error(
          `Failed to upload ${result.failed.length} files`
        );
      }
      
      logger.info('Upload completed:', result);
      return result;
    } catch (error) {
      logger.error('Batch upload error:', error);
      throw error;
    }
  }
  
  /**
   * Upload with local storage fallback
   */
  public async uploadWithFallback(
    files: File[],
    options: {
      projectId?: string;
      onProgress?: (progress: UploadProgress) => void;
    } = {}
  ): Promise<UploadResult> {
    try {
      // Try normal upload first
      return await this.uploadFiles(files, options);
    } catch (error) {
      logger.warn('Upload failed, falling back to local storage:', error);
      
      // Create local storage entries
      const result: UploadResult = {
        successful: [],
        failed: [],
        cancelled: [],
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        duration: 0,
      };
      
      for (const file of files) {
        try {
          const localImage = await this.createLocalImage(file, options.projectId);
          const uploadFile: UploadFile = {
            id: localImage.id,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: UploadStatus.COMPLETE,
            progress: 100,
            result: localImage,
          };
          result.successful.push(uploadFile);
        } catch (localError) {
          logger.error('Failed to create local image:', localError);
          const uploadFile: UploadFile = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: UploadStatus.ERROR,
            progress: 0,
            error: 'Failed to save locally',
          };
          result.failed.push(uploadFile);
        }
      }
      
      toast.warning('Files saved locally due to connection issues');
      return result;
    }
  }
  
  /**
   * Cancel upload
   */
  public cancelUpload(fileId: string): void {
    const controller = this.activeUploads.get(fileId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(fileId);
      this.updateFileStatus(fileId, UploadStatus.CANCELLED);
      logger.info(`Upload cancelled: ${fileId}`);
    }
  }
  
  /**
   * Cancel all uploads
   */
  public cancelAllUploads(): void {
    for (const [fileId, controller] of this.activeUploads) {
      controller.abort();
      this.updateFileStatus(fileId, UploadStatus.CANCELLED);
    }
    this.activeUploads.clear();
    logger.info('All uploads cancelled');
  }
  
  /**
   * Get upload queue
   */
  public getUploadQueue(): UploadFile[] {
    return Array.from(this.uploadQueue.values());
  }
  
  /**
   * Clear completed uploads from queue
   */
  public clearCompleted(): void {
    for (const [id, file] of this.uploadQueue) {
      if (file.status === UploadStatus.COMPLETE || file.status === UploadStatus.ERROR) {
        this.uploadQueue.delete(id);
      }
    }
  }
  
  // ===========================
  // Private Helper Methods
  // ===========================
  
  private updateFileStatus(fileId: string, status: UploadStatus): void {
    const file = this.uploadQueue.get(fileId);
    if (file) {
      file.status = status;
      if (status === UploadStatus.COMPLETE) {
        file.progress = 100;
      }
    }
  }
  
  private updateFileProgress(fileId: string, progress: number): void {
    const file = this.uploadQueue.get(fileId);
    if (file) {
      file.progress = progress;
    }
  }
  
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  private async getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = URL.createObjectURL(file);
    });
  }
  
  private async generateImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  private async generateSpecialPreview(file: File): Promise<string> {
    try {
      // Try server-side preview generation for TIFF/BMP
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiClient.post('/images/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
      });
      
      return URL.createObjectURL(response.data);
    } catch (error) {
      logger.warn('Server preview generation failed, using fallback');
      // Fallback to basic preview
      return this.generateImagePreview(file);
    }
  }
  
  private async createLocalImage(file: File, projectId?: string): Promise<ProjectImage> {
    // Create object URL for local storage
    const url = URL.createObjectURL(file);
    
    // Get image dimensions
    const dimensions = await this.getImageDimensions(file);
    
    // Create local image object
    const localImage: ProjectImage = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId: projectId || '',
      name: file.name,
      filename: file.name,
      url,
      thumbnailUrl: url,
      size: file.size,
      mimeType: file.type,
      width: dimensions?.width,
      height: dimensions?.height,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      segmentationStatus: 'pending',
      isLocal: true,
    };
    
    // Store in localStorage
    const localImages = JSON.parse(localStorage.getItem('localImages') || '[]');
    localImages.push(localImage);
    localStorage.setItem('localImages', JSON.stringify(localImages));
    
    return localImage;
  }
}

// ===========================
// Singleton Instance
// ===========================

const fileUploadService = new UnifiedFileUploadService();

// ===========================
// Export Public API
// ===========================

export default fileUploadService;

// Named exports for convenience
export const {
  setConfig,
  getConfig,
  validateFile,
  validateFiles,
  generatePreview,
  uploadFile,
  uploadFiles,
  uploadWithFallback,
  cancelUpload,
  cancelAllUploads,
  getUploadQueue,
  clearCompleted,
} = fileUploadService;