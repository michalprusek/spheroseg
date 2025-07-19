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
import { UploadFile, UploadOptions, FileUploadConfig, ValidationResult, UploadBatchResult, ResumableUploadState } from './types';
export declare class UnifiedUploadService {
    private uploadQueue;
    private activeUploads;
    private resumableUploads;
    private strategies;
    private config;
    private maxConcurrentUploads;
    private isProcessing;
    constructor(config?: Partial<FileUploadConfig>);
    /**
     * Set or update configuration
     */
    setConfig(config: Partial<FileUploadConfig>): void;
    /**
     * Validate a single file
     */
    validateFile(file: File): Promise<ValidationResult>;
    /**
     * Upload a single file with advanced features
     */
    uploadFile(file: File, options?: Partial<UploadOptions>): Promise<UploadFile>;
    /**
     * Upload multiple files with batch optimization
     */
    uploadFiles(files: File[], options?: Partial<UploadOptions>): Promise<UploadBatchResult>;
    /**
     * Resume a previously interrupted upload
     */
    resumeUpload(uploadId: string): Promise<UploadFile | null>;
    /**
     * Cancel an upload
     */
    cancelUpload(fileId: string): void;
    /**
     * Get all uploads in queue
     */
    getUploadQueue(): UploadFile[];
    /**
     * Get resumable uploads
     */
    getResumableUploads(): ResumableUploadState[];
    private processQueue;
    private processUpload;
    private getNextQueueItem;
    private calculatePriority;
    private createUploadFile;
    private updateFileStatus;
    private updateFileProgress;
    private waitForUpload;
    private isFileTypeAccepted;
    private getImageDimensions;
    private formatFileSize;
    private loadResumableUploads;
    private saveResumableUploads;
}
export declare const uploadService: UnifiedUploadService;
export default UnifiedUploadService;
//# sourceMappingURL=UnifiedUploadService.d.ts.map