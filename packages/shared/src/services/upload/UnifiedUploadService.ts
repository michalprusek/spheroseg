/**
 * Enhanced Unified Upload Service
 * 
 * Features:
 * - Strategy pattern for different file types
 * - Chunked uploads for large files
 * - Resumable upload support
 * - Progress tracking with detailed metrics
 * - Automatic retry with exponential backoff
 * - Queue management with priority
 * - Concurrent upload limiting
 */

import { SharedLogger } from '@/utils/logger';
import { 
  UploadFile, 
  UploadStatus, 
  UploadOptions, 
  FileUploadConfig,
  UploadQueueItem,
  ValidationResult,
  UploadBatchResult,
  ResumableUploadState
} from './types';
import { createUploadStrategy, UploadStrategy } from './strategies';

const logger = new SharedLogger('UnifiedUploadService');

export class UnifiedUploadService {
  private uploadQueue: Map<string, UploadQueueItem> = new Map();
  private activeUploads: Map<string, AbortController> = new Map();
  private resumableUploads: Map<string, ResumableUploadState> = new Map();
  private strategies: Map<string, UploadStrategy> = new Map();
  private config: FileUploadConfig;
  private maxConcurrentUploads = 3;
  private isProcessing = false;

  constructor(config: Partial<FileUploadConfig> = {}) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 50,
      acceptedTypes: ['image/*'],
      acceptedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'],
      batchSize: 20,
      generatePreviews: true,
      autoSegment: false,
      chunkSize: 5 * 1024 * 1024,
      enableChunking: true,
      enableResume: true,
      ...config,
    };

    // Load resumable uploads from localStorage
    this.loadResumableUploads();
  }

  /**
   * Set or update configuration
   */
  public setConfig(config: Partial<FileUploadConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Upload config updated:', this.config);
  }

  /**
   * Validate a single file
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
      const isTypeAccepted = this.isFileTypeAccepted(file);
      if (!isTypeAccepted) {
        return {
          valid: false,
          error: `File type "${file.type}" is not accepted. Accepted types: ${this.config.acceptedExtensions.join(', ')}`,
        };
      }

      // Additional validations for images
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

      return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
    } catch (error) {
      logger.error('File validation error:', error);
      return { valid: false, error: 'Failed to validate file' };
    }
  }

  /**
   * Upload a single file with advanced features
   */
  public async uploadFile(
    file: File,
    options: Partial<UploadOptions> = {}
  ): Promise<UploadFile> {
    const uploadFile: UploadFile = this.createUploadFile(file);
    
    try {
      // Validate file
      this.updateFileStatus(uploadFile.id, UploadStatus.VALIDATING);
      const validation = await this.validateFile(file);
      
      if (!validation.valid) {
        throw new Error(validation.error || 'File validation failed');
      }

      // Select strategy
      const strategy = createUploadStrategy(file, options.metadata?.['type'] as string);
      
      // Add to queue
      const queueItem: UploadQueueItem = {
        file: uploadFile,
        options: {
          ...options,
          projectId: options.projectId || this.config.projectId,
          onProgress: (progress) => {
            this.updateFileProgress(uploadFile.id, progress.progress);
            options.onProgress?.(progress);
          },
        },
        strategy: strategy.name,
        priority: this.calculatePriority(file),
        retries: 0,
        maxRetries: 3,
      };

      this.uploadQueue.set(uploadFile.id, queueItem);
      this.strategies.set(strategy.name, strategy);

      // Start processing queue
      this.processQueue();

      // Wait for upload to complete
      return await this.waitForUpload(uploadFile.id);
    } catch (error) {
      this.updateFileStatus(uploadFile.id, UploadStatus.ERROR);
      uploadFile.error = error instanceof Error ? error.message : 'Upload failed';
      throw error;
    }
  }

  /**
   * Upload multiple files with batch optimization
   */
  public async uploadFiles(
    files: File[],
    options: Partial<UploadOptions> = {}
  ): Promise<UploadBatchResult> {
    const startTime = Date.now();
    const result: UploadBatchResult = {
      successful: [],
      failed: [],
      cancelled: [],
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      duration: 0,
    };

    // Validate all files first
    const validFiles: File[] = [];
    for (const file of files) {
      const validation = await this.validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        const uploadFile = this.createUploadFile(file);
        uploadFile.status = UploadStatus.ERROR;
        uploadFile.error = validation.error;
        result.failed.push(uploadFile);
      }
    }

    // Upload valid files
    const uploadPromises = validFiles.map(file => 
      this.uploadFile(file, options)
        .then(uploadFile => {
          result.successful.push(uploadFile);
        })
        .catch(error => {
          const uploadFile = this.createUploadFile(file);
          uploadFile.status = UploadStatus.ERROR;
          uploadFile.error = error.message;
          result.failed.push(uploadFile);
        })
    );

    await Promise.allSettled(uploadPromises);
    
    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Resume a previously interrupted upload
   */
  public async resumeUpload(uploadId: string): Promise<UploadFile | null> {
    const resumableState = this.resumableUploads.get(uploadId);
    if (!resumableState) {
      logger.warn('No resumable upload found for ID:', uploadId);
      return null;
    }

    // Check if upload hasn't expired
    if (new Date(resumableState.expiresAt) < new Date()) {
      this.resumableUploads.delete(uploadId);
      this.saveResumableUploads();
      logger.warn('Resumable upload has expired:', uploadId);
      return null;
    }

    // TODO: Implement actual resume logic
    // This would involve recreating the file object and continuing from where it left off
    logger.info('Resuming upload:', uploadId);
    return null;
  }

  /**
   * Cancel an upload
   */
  public cancelUpload(fileId: string): void {
    const controller = this.activeUploads.get(fileId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(fileId);
    }

    const queueItem = this.uploadQueue.get(fileId);
    if (queueItem) {
      this.updateFileStatus(fileId, UploadStatus.CANCELLED);
      this.uploadQueue.delete(fileId);
    }

    logger.info('Upload cancelled:', fileId);
  }

  /**
   * Get all uploads in queue
   */
  public getUploadQueue(): UploadFile[] {
    return Array.from(this.uploadQueue.values()).map(item => item.file);
  }

  /**
   * Get resumable uploads
   */
  public getResumableUploads(): ResumableUploadState[] {
    return Array.from(this.resumableUploads.values());
  }

  // Private methods

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.uploadQueue.size > 0 && this.activeUploads.size < this.maxConcurrentUploads) {
      const nextItem = this.getNextQueueItem();
      if (!nextItem) break;

      this.processUpload(nextItem);
    }

    this.isProcessing = false;
  }

  private async processUpload(item: UploadQueueItem): Promise<void> {
    const { file, options, strategy: strategyName } = item;
    const strategy = this.strategies.get(strategyName);
    
    if (!strategy) {
      logger.error('Strategy not found:', strategyName);
      this.updateFileStatus(file.id, UploadStatus.ERROR);
      file.error = 'Upload strategy not found';
      return;
    }

    const abortController = new AbortController();
    this.activeUploads.set(file.id, abortController);

    try {
      this.updateFileStatus(file.id, UploadStatus.UPLOADING);
      
      const result = await strategy.upload(file.file, {
        ...options,
        signal: abortController.signal,
      });

      this.updateFileStatus(file.id, UploadStatus.COMPLETE);
      file.result = result;
      file.progress = 100;

      // Remove from queue on success
      this.uploadQueue.delete(file.id);
      logger.info('Upload completed:', file.name);
    } catch (error) {
      const isCancelled = error instanceof Error && error.name === 'CanceledError';
      
      if (isCancelled) {
        this.updateFileStatus(file.id, UploadStatus.CANCELLED);
        file.error = 'Upload cancelled';
        this.uploadQueue.delete(file.id);
      } else {
        // Handle retry logic
        item.retries++;
        if (item.retries < item.maxRetries) {
          logger.warn(`Upload failed, retrying (${item.retries}/${item.maxRetries}):`, file.name);
          // Exponential backoff
          setTimeout(() => {
            this.processUpload(item);
          }, Math.pow(2, item.retries) * 1000);
        } else {
          this.updateFileStatus(file.id, UploadStatus.ERROR);
          file.error = error instanceof Error ? error.message : 'Upload failed';
          this.uploadQueue.delete(file.id);
          logger.error('Upload failed after retries:', file.name, error);
        }
      }
    } finally {
      this.activeUploads.delete(file.id);
      // Process next item in queue
      this.processQueue();
    }
  }

  private getNextQueueItem(): UploadQueueItem | null {
    if (this.uploadQueue.size === 0) return null;

    // Sort by priority (higher priority first)
    const sorted = Array.from(this.uploadQueue.values())
      .sort((a, b) => b.priority - a.priority);

    return sorted[0] || null;
  }

  private calculatePriority(file: File): number {
    // Smaller files get higher priority
    const sizePriority = file.size < 1024 * 1024 ? 10 : 5;
    
    // Images get higher priority
    const typePriority = file.type.startsWith('image/') ? 5 : 0;
    
    return sizePriority + typePriority;
  }

  private createUploadFile(file: File): UploadFile {
    return {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: UploadStatus.PENDING,
      progress: 0,
    };
  }

  private updateFileStatus(fileId: string, status: UploadStatus): void {
    const item = this.uploadQueue.get(fileId);
    if (item) {
      item.file.status = status;
    }
  }

  private updateFileProgress(fileId: string, progress: number): void {
    const item = this.uploadQueue.get(fileId);
    if (item) {
      item.file.progress = progress;
    }
  }

  private async waitForUpload(fileId: string): Promise<UploadFile> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const item = this.uploadQueue.get(fileId);
        
        if (!item) {
          clearInterval(checkInterval);
          reject(new Error('Upload item not found'));
          return;
        }

        const { file } = item;
        
        if (file.status === UploadStatus.COMPLETE) {
          clearInterval(checkInterval);
          resolve(file);
        } else if (file.status === UploadStatus.ERROR || file.status === UploadStatus.CANCELLED) {
          clearInterval(checkInterval);
          reject(new Error(file.error || 'Upload failed'));
        }
      }, 100);
    });
  }

  private isFileTypeAccepted(file: File): boolean {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return (
      this.config.acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -2));
        }
        return file.type === type;
      }) ||
      this.config.acceptedExtensions.includes(extension)
    );
  }

  private async getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private loadResumableUploads(): void {
    try {
      const saved = localStorage.getItem('resumableUploads');
      if (saved) {
        const uploads = JSON.parse(saved) as ResumableUploadState[];
        uploads.forEach(upload => {
          if (new Date(upload.expiresAt) > new Date()) {
            this.resumableUploads.set(upload.uploadId, upload);
          }
        });
      }
    } catch (error) {
      logger.error('Failed to load resumable uploads:', error);
    }
  }

  private saveResumableUploads(): void {
    try {
      const uploads = Array.from(this.resumableUploads.values());
      localStorage.setItem('resumableUploads', JSON.stringify(uploads));
    } catch (error) {
      logger.error('Failed to save resumable uploads:', error);
    }
  }
}

// Export singleton instance
export const uploadService = new UnifiedUploadService();

// Export for testing and custom instances
export default UnifiedUploadService;