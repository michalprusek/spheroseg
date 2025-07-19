"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadService = exports.UnifiedUploadService = void 0;
const logger_1 = require("@/utils/logger");
const types_1 = require("./types");
const strategies_1 = require("./strategies");
const logger = new logger_1.SharedLogger('UnifiedUploadService');
class UnifiedUploadService {
    constructor(config = {}) {
        this.uploadQueue = new Map();
        this.activeUploads = new Map();
        this.resumableUploads = new Map();
        this.strategies = new Map();
        this.maxConcurrentUploads = 3;
        this.isProcessing = false;
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
    setConfig(config) {
        this.config = { ...this.config, ...config };
        logger.info('Upload config updated:', this.config);
    }
    /**
     * Validate a single file
     */
    async validateFile(file) {
        const warnings = [];
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
        }
        catch (error) {
            logger.error('File validation error:', error);
            return { valid: false, error: 'Failed to validate file' };
        }
    }
    /**
     * Upload a single file with advanced features
     */
    async uploadFile(file, options = {}) {
        const uploadFile = this.createUploadFile(file);
        try {
            // Validate file
            this.updateFileStatus(uploadFile.id, types_1.UploadStatus.VALIDATING);
            const validation = await this.validateFile(file);
            if (!validation.valid) {
                throw new Error(validation.error || 'File validation failed');
            }
            // Select strategy
            const strategy = (0, strategies_1.createUploadStrategy)(file, options.metadata?.['type']);
            // Add to queue
            const queueItem = {
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
        }
        catch (error) {
            this.updateFileStatus(uploadFile.id, types_1.UploadStatus.ERROR);
            uploadFile.error = error instanceof Error ? error.message : 'Upload failed';
            throw error;
        }
    }
    /**
     * Upload multiple files with batch optimization
     */
    async uploadFiles(files, options = {}) {
        const startTime = Date.now();
        const result = {
            successful: [],
            failed: [],
            cancelled: [],
            totalFiles: files.length,
            totalSize: files.reduce((sum, file) => sum + file.size, 0),
            duration: 0,
        };
        // Validate all files first
        const validFiles = [];
        for (const file of files) {
            const validation = await this.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            }
            else {
                const uploadFile = this.createUploadFile(file);
                uploadFile.status = types_1.UploadStatus.ERROR;
                uploadFile.error = validation.error;
                result.failed.push(uploadFile);
            }
        }
        // Upload valid files
        const uploadPromises = validFiles.map(file => this.uploadFile(file, options)
            .then(uploadFile => {
            result.successful.push(uploadFile);
        })
            .catch(error => {
            const uploadFile = this.createUploadFile(file);
            uploadFile.status = types_1.UploadStatus.ERROR;
            uploadFile.error = error.message;
            result.failed.push(uploadFile);
        }));
        await Promise.allSettled(uploadPromises);
        result.duration = Date.now() - startTime;
        return result;
    }
    /**
     * Resume a previously interrupted upload
     */
    async resumeUpload(uploadId) {
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
    cancelUpload(fileId) {
        const controller = this.activeUploads.get(fileId);
        if (controller) {
            controller.abort();
            this.activeUploads.delete(fileId);
        }
        const queueItem = this.uploadQueue.get(fileId);
        if (queueItem) {
            this.updateFileStatus(fileId, types_1.UploadStatus.CANCELLED);
            this.uploadQueue.delete(fileId);
        }
        logger.info('Upload cancelled:', fileId);
    }
    /**
     * Get all uploads in queue
     */
    getUploadQueue() {
        return Array.from(this.uploadQueue.values()).map(item => item.file);
    }
    /**
     * Get resumable uploads
     */
    getResumableUploads() {
        return Array.from(this.resumableUploads.values());
    }
    // Private methods
    async processQueue() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        while (this.uploadQueue.size > 0 && this.activeUploads.size < this.maxConcurrentUploads) {
            const nextItem = this.getNextQueueItem();
            if (!nextItem)
                break;
            this.processUpload(nextItem);
        }
        this.isProcessing = false;
    }
    async processUpload(item) {
        const { file, options, strategy: strategyName } = item;
        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
            logger.error('Strategy not found:', strategyName);
            this.updateFileStatus(file.id, types_1.UploadStatus.ERROR);
            file.error = 'Upload strategy not found';
            return;
        }
        const abortController = new AbortController();
        this.activeUploads.set(file.id, abortController);
        try {
            this.updateFileStatus(file.id, types_1.UploadStatus.UPLOADING);
            const result = await strategy.upload(file.file, {
                ...options,
                signal: abortController.signal,
            });
            this.updateFileStatus(file.id, types_1.UploadStatus.COMPLETE);
            file.result = result;
            file.progress = 100;
            // Remove from queue on success
            this.uploadQueue.delete(file.id);
            logger.info('Upload completed:', file.name);
        }
        catch (error) {
            const isCancelled = error instanceof Error && error.name === 'CanceledError';
            if (isCancelled) {
                this.updateFileStatus(file.id, types_1.UploadStatus.CANCELLED);
                file.error = 'Upload cancelled';
                this.uploadQueue.delete(file.id);
            }
            else {
                // Handle retry logic
                item.retries++;
                if (item.retries < item.maxRetries) {
                    logger.warn(`Upload failed, retrying (${item.retries}/${item.maxRetries}):`, file.name);
                    // Exponential backoff
                    setTimeout(() => {
                        this.processUpload(item);
                    }, Math.pow(2, item.retries) * 1000);
                }
                else {
                    this.updateFileStatus(file.id, types_1.UploadStatus.ERROR);
                    file.error = error instanceof Error ? error.message : 'Upload failed';
                    this.uploadQueue.delete(file.id);
                    logger.error('Upload failed after retries:', file.name, error);
                }
            }
        }
        finally {
            this.activeUploads.delete(file.id);
            // Process next item in queue
            this.processQueue();
        }
    }
    getNextQueueItem() {
        if (this.uploadQueue.size === 0)
            return null;
        // Sort by priority (higher priority first)
        const sorted = Array.from(this.uploadQueue.values())
            .sort((a, b) => b.priority - a.priority);
        return sorted[0] || null;
    }
    calculatePriority(file) {
        // Smaller files get higher priority
        const sizePriority = file.size < 1024 * 1024 ? 10 : 5;
        // Images get higher priority
        const typePriority = file.type.startsWith('image/') ? 5 : 0;
        return sizePriority + typePriority;
    }
    createUploadFile(file) {
        return {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: types_1.UploadStatus.PENDING,
            progress: 0,
        };
    }
    updateFileStatus(fileId, status) {
        const item = this.uploadQueue.get(fileId);
        if (item) {
            item.file.status = status;
        }
    }
    updateFileProgress(fileId, progress) {
        const item = this.uploadQueue.get(fileId);
        if (item) {
            item.file.progress = progress;
        }
    }
    async waitForUpload(fileId) {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const item = this.uploadQueue.get(fileId);
                if (!item) {
                    clearInterval(checkInterval);
                    reject(new Error('Upload item not found'));
                    return;
                }
                const { file } = item;
                if (file.status === types_1.UploadStatus.COMPLETE) {
                    clearInterval(checkInterval);
                    resolve(file);
                }
                else if (file.status === types_1.UploadStatus.ERROR || file.status === types_1.UploadStatus.CANCELLED) {
                    clearInterval(checkInterval);
                    reject(new Error(file.error || 'Upload failed'));
                }
            }, 100);
        });
    }
    isFileTypeAccepted(file) {
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        return (this.config.acceptedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.slice(0, -2));
            }
            return file.type === type;
        }) ||
            this.config.acceptedExtensions.includes(extension));
    }
    async getImageDimensions(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(file);
        });
    }
    formatFileSize(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    loadResumableUploads() {
        try {
            const saved = localStorage.getItem('resumableUploads');
            if (saved) {
                const uploads = JSON.parse(saved);
                uploads.forEach(upload => {
                    if (new Date(upload.expiresAt) > new Date()) {
                        this.resumableUploads.set(upload.uploadId, upload);
                    }
                });
            }
        }
        catch (error) {
            logger.error('Failed to load resumable uploads:', error);
        }
    }
    saveResumableUploads() {
        try {
            const uploads = Array.from(this.resumableUploads.values());
            localStorage.setItem('resumableUploads', JSON.stringify(uploads));
        }
        catch (error) {
            logger.error('Failed to save resumable uploads:', error);
        }
    }
}
exports.UnifiedUploadService = UnifiedUploadService;
// Export singleton instance
exports.uploadService = new UnifiedUploadService();
// Export for testing and custom instances
exports.default = UnifiedUploadService;
//# sourceMappingURL=UnifiedUploadService.js.map