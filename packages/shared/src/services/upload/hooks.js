"use strict";
/**
 * React hooks for the unified upload service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useUpload = useUpload;
exports.useImageUpload = useImageUpload;
exports.useAvatarUpload = useAvatarUpload;
exports.useDocumentUpload = useDocumentUpload;
const react_1 = require("react");
const react_dropzone_1 = require("react-dropzone");
const UnifiedUploadService_1 = require("./UnifiedUploadService");
const types_1 = require("./types");
/**
 * Main upload hook with all features
 */
function useUpload(options = {}) {
    const { config, uploadType = 'auto', multiple = true, autoUpload = false, clearOnComplete = false, generatePreviews = true, chunkedUpload = true, resumable = true, projectId, onFilesSelected, onUploadStart, onUploadProgress, onFileComplete: _onFileComplete, onUploadComplete, onError, dropzoneOptions = {}, } = options;
    // State
    const [files, setFiles] = (0, react_1.useState)([]);
    const [isUploading, setIsUploading] = (0, react_1.useState)(false);
    const [uploadProgress, setUploadProgress] = (0, react_1.useState)(0);
    const [activeUploads, setActiveUploads] = (0, react_1.useState)(0);
    // Refs
    const fileInputRef = (0, react_1.useRef)(null);
    const uploadQueueRef = (0, react_1.useRef)(new Map());
    // Initialize service config
    (0, react_1.useEffect)(() => {
        const defaultConfig = getDefaultConfig(uploadType);
        UnifiedUploadService_1.uploadService.setConfig({
            ...defaultConfig,
            ...config,
            generatePreviews,
            projectId,
            enableChunking: chunkedUpload,
            enableResume: resumable,
        });
    }, [uploadType, config, generatePreviews, projectId, chunkedUpload, resumable]);
    // Handle file selection
    const handleFilesSelected = (0, react_1.useCallback)(async (selectedFiles) => {
        try {
            // Validate files
            const newFiles = [];
            for (const file of selectedFiles) {
                const validation = await UnifiedUploadService_1.uploadService.validateFile(file);
                if (!validation.valid) {
                    onError?.(new Error(validation.error || 'Invalid file'), file);
                    continue;
                }
                const uploadFile = {
                    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    status: types_1.UploadStatus.PENDING,
                    progress: 0,
                };
                // Generate preview if needed
                if (generatePreviews && file.type.startsWith('image/')) {
                    uploadFile.preview = await generatePreview(file);
                }
                newFiles.push(uploadFile);
                uploadQueueRef.current.set(uploadFile.id, uploadFile);
            }
            setFiles(prev => [...prev, ...newFiles]);
            onFilesSelected?.(selectedFiles);
            // Auto upload if enabled
            if (autoUpload && newFiles.length > 0) {
                uploadFiles(newFiles.map(f => f.file));
            }
        }
        catch (error) {
            onError?.(error instanceof Error ? error : new Error(String(error)));
        }
    }, [autoUpload, generatePreviews, onFilesSelected, onError]);
    // Upload files
    const uploadFiles = (0, react_1.useCallback)(async (filesToUpload) => {
        if (isUploading) {
            return null;
        }
        const uploadTargets = filesToUpload ||
            files.filter(f => f.status === types_1.UploadStatus.PENDING).map(f => f.file);
        if (uploadTargets.length === 0) {
            return null;
        }
        setIsUploading(true);
        setActiveUploads(uploadTargets.length);
        try {
            onUploadStart?.(uploadTargets);
            const uploadOptions = {
                projectId,
                metadata: { type: uploadType },
                onProgress: (progress) => {
                    const fileId = progress.fileId;
                    // Update individual file progress
                    setFiles(prev => prev.map(f => f.id === fileId
                        ? { ...f, progress: progress.progress, status: types_1.UploadStatus.UPLOADING }
                        : f));
                    // Update overall progress
                    const totalProgress = files.reduce((sum, f) => sum + f.progress, 0) / files.length;
                    setUploadProgress(Math.round(totalProgress));
                    onUploadProgress?.(progress, fileId);
                },
            };
            const result = await UnifiedUploadService_1.uploadService.uploadFiles(uploadTargets, uploadOptions);
            // Update file states based on results
            setFiles(prev => {
                const updated = [...prev];
                result.successful.forEach(successFile => {
                    const index = updated.findIndex(f => f.file === successFile.file);
                    if (index !== -1) {
                        updated[index] = successFile;
                    }
                });
                result.failed.forEach(failedFile => {
                    const index = updated.findIndex(f => f.file === failedFile.file);
                    if (index !== -1) {
                        updated[index] = failedFile;
                    }
                });
                return updated;
            });
            // Clear completed files if requested
            if (clearOnComplete && result.failed.length === 0) {
                setTimeout(() => {
                    setFiles(prev => prev.filter(f => f.status !== types_1.UploadStatus.COMPLETE));
                }, 2000);
            }
            onUploadComplete?.(result);
            return result;
        }
        catch (error) {
            onError?.(error instanceof Error ? error : new Error(String(error)));
            return null;
        }
        finally {
            setIsUploading(false);
            setActiveUploads(0);
            setUploadProgress(0);
        }
    }, [files, isUploading, projectId, uploadType, clearOnComplete, onUploadStart, onUploadProgress, onUploadComplete, onError]);
    // Cancel upload
    const cancelUpload = (0, react_1.useCallback)((fileId) => {
        if (fileId) {
            UnifiedUploadService_1.uploadService.cancelUpload(fileId);
            setFiles(prev => prev.map(f => f.id === fileId
                ? { ...f, status: types_1.UploadStatus.CANCELLED, error: 'Upload cancelled' }
                : f));
        }
        else {
            // Cancel all active uploads
            files
                .filter(f => f.status === types_1.UploadStatus.UPLOADING)
                .forEach(f => UnifiedUploadService_1.uploadService.cancelUpload(f.id));
            setFiles(prev => prev.map(f => f.status === types_1.UploadStatus.UPLOADING
                ? { ...f, status: types_1.UploadStatus.CANCELLED, error: 'Upload cancelled' }
                : f));
        }
    }, [files]);
    // Cancel all uploads
    const cancelAllUploads = (0, react_1.useCallback)(() => {
        cancelUpload();
        setIsUploading(false);
        setActiveUploads(0);
    }, [cancelUpload]);
    // Remove file
    const removeFile = (0, react_1.useCallback)((fileId) => {
        setFiles(prev => {
            const file = prev.find(f => f.id === fileId);
            if (file?.preview && file.preview.startsWith('blob:')) {
                URL.revokeObjectURL(file.preview);
            }
            return prev.filter(f => f.id !== fileId);
        });
        uploadQueueRef.current.delete(fileId);
    }, []);
    // Clear all files
    const clearFiles = (0, react_1.useCallback)(() => {
        files.forEach(file => {
            if (file.preview && file.preview.startsWith('blob:')) {
                URL.revokeObjectURL(file.preview);
            }
        });
        setFiles([]);
        uploadQueueRef.current.clear();
        setUploadProgress(0);
    }, [files]);
    // Retry failed uploads
    const retryFailed = (0, react_1.useCallback)(async () => {
        const failedFiles = files.filter(f => f.status === types_1.UploadStatus.ERROR);
        if (failedFiles.length > 0) {
            // Reset status
            setFiles(prev => prev.map(f => f.status === types_1.UploadStatus.ERROR
                ? { ...f, status: types_1.UploadStatus.PENDING, error: undefined, progress: 0 }
                : f));
            await uploadFiles(failedFiles.map(f => f.file));
        }
    }, [files, uploadFiles]);
    // Resume an upload
    const resumeUpload = (0, react_1.useCallback)(async (uploadId) => {
        try {
            const result = await UnifiedUploadService_1.uploadService.resumeUpload(uploadId);
            if (result) {
                setFiles(prev => [...prev, result]);
            }
        }
        catch (error) {
            onError?.(error instanceof Error ? error : new Error(String(error)));
        }
    }, [onError]);
    // Select files manually
    const selectFiles = (0, react_1.useCallback)(() => {
        if (!fileInputRef.current) {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = multiple;
            input.accept = UnifiedUploadService_1.uploadService['config'].acceptedExtensions.join(',');
            input.onchange = (e) => {
                const target = e.target;
                if (target.files) {
                    handleFilesSelected(Array.from(target.files));
                }
            };
            fileInputRef.current = input;
        }
        fileInputRef.current.click();
    }, [multiple, handleFilesSelected]);
    // Setup dropzone
    const { getRootProps, getInputProps, isDragActive, open } = (0, react_dropzone_1.useDropzone)({
        onDrop: handleFilesSelected,
        multiple,
        accept: UnifiedUploadService_1.uploadService['config'].acceptedTypes.reduce((acc, type) => {
            acc[type] = UnifiedUploadService_1.uploadService['config'].acceptedExtensions;
            return acc;
        }, {}),
        maxSize: UnifiedUploadService_1.uploadService['config'].maxFileSize,
        ...dropzoneOptions,
    });
    // Cleanup on unmount
    (0, react_1.useEffect)(() => {
        return () => {
            if (isUploading) {
                cancelAllUploads();
            }
            files.forEach(file => {
                if (file.preview && file.preview.startsWith('blob:')) {
                    URL.revokeObjectURL(file.preview);
                }
            });
        };
    }, []);
    return {
        // State
        files,
        isUploading,
        uploadProgress,
        activeUploads,
        // Actions
        selectFiles,
        uploadFiles,
        cancelUpload,
        cancelAllUploads,
        removeFile,
        clearFiles,
        retryFailed,
        resumeUpload,
        // Dropzone
        getRootProps,
        getInputProps,
        isDragActive,
        open,
    };
}
/**
 * Specialized hooks for specific upload types
 */
function useImageUpload(options = {}) {
    return useUpload({ ...options, uploadType: 'image' });
}
function useAvatarUpload(options = {}) {
    return useUpload({ ...options, uploadType: 'avatar', multiple: false });
}
function useDocumentUpload(options = {}) {
    return useUpload({ ...options, uploadType: 'document' });
}
// Helper functions
function getDefaultConfig(type) {
    switch (type) {
        case 'avatar':
            return {
                maxFileSize: 5 * 1024 * 1024,
                maxFiles: 1,
                acceptedTypes: ['image/*'],
                acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
            };
        case 'document':
            return {
                maxFileSize: 50 * 1024 * 1024,
                maxFiles: 10,
                acceptedTypes: ['application/pdf', 'text/plain', 'application/json'],
                acceptedExtensions: ['.pdf', '.txt', '.json'],
            };
        case 'image':
        default:
            return {
                maxFileSize: 10 * 1024 * 1024,
                maxFiles: 50,
                acceptedTypes: ['image/*'],
                acceptedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'],
            };
    }
}
async function generatePreview(file) {
    try {
        // Special handling for TIFF/BMP
        const ext = file.name.toLowerCase();
        if (ext.endsWith('.tiff') || ext.endsWith('.tif') || ext.endsWith('.bmp')) {
            // Return a placeholder for now
            return createPlaceholderPreview(file);
        }
        // Standard image preview
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result);
            reader.onerror = () => resolve(undefined);
            reader.readAsDataURL(file);
        });
    }
    catch {
        return undefined;
    }
}
function createPlaceholderPreview(file) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 200;
    if (ctx) {
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, 200, 200);
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        ctx.fillText(ext, 100, 100);
    }
    return canvas.toDataURL('image/png');
}
//# sourceMappingURL=hooks.js.map