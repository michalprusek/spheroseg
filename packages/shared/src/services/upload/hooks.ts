/**
 * React hooks for the unified upload service
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import { uploadService } from './UnifiedUploadService';
import {
  UploadFile,
  UploadStatus,
  UploadProgress,
  UploadBatchResult,
  FileUploadConfig,
  UploadOptions,
} from './types';

export interface UseUploadOptions {
  // Configuration
  config?: Partial<FileUploadConfig>;
  uploadType?: 'image' | 'avatar' | 'document' | 'auto';
  
  // Options
  multiple?: boolean;
  autoUpload?: boolean;
  clearOnComplete?: boolean;
  generatePreviews?: boolean;
  chunkedUpload?: boolean;
  resumable?: boolean;
  
  // Project context
  projectId?: string;
  
  // Callbacks
  onFilesSelected?: (files: File[]) => void;
  onUploadStart?: (files: File[]) => void;
  onUploadProgress?: (progress: UploadProgress, fileId: string) => void;
  onFileComplete?: (file: UploadFile) => void;
  onUploadComplete?: (result: UploadBatchResult) => void;
  onError?: (error: Error, file?: File) => void;
  
  // Dropzone options
  dropzoneOptions?: Partial<DropzoneOptions>;
}

export interface UseUploadReturn {
  // State
  files: UploadFile[];
  isUploading: boolean;
  uploadProgress: number;
  activeUploads: number;
  
  // Actions
  selectFiles: () => void;
  uploadFiles: (filesToUpload?: File[]) => Promise<UploadBatchResult | null>;
  cancelUpload: (fileId?: string) => void;
  cancelAllUploads: () => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  retryFailed: () => Promise<void>;
  resumeUpload: (uploadId: string) => Promise<void>;
  
  // Dropzone
  getRootProps: () => any;
  getInputProps: () => any;
  isDragActive: boolean;
  open: () => void;
}

/**
 * Main upload hook with all features
 */
export function useUpload(options: UseUploadOptions = {}): UseUploadReturn {
  const {
    config,
    uploadType = 'auto',
    multiple = true,
    autoUpload = false,
    clearOnComplete = false,
    generatePreviews = true,
    chunkedUpload = true,
    resumable = true,
    projectId,
    onFilesSelected,
    onUploadStart,
    onUploadProgress,
    onFileComplete,
    onUploadComplete,
    onError,
    dropzoneOptions = {},
  } = options;

  // State
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeUploads, setActiveUploads] = useState(0);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadQueueRef = useRef<Map<string, UploadFile>>(new Map());

  // Initialize service config
  useEffect(() => {
    const defaultConfig = getDefaultConfig(uploadType);
    uploadService.setConfig({
      ...defaultConfig,
      ...config,
      generatePreviews,
      projectId,
      enableChunking: chunkedUpload,
      enableResume: resumable,
    });
  }, [uploadType, config, generatePreviews, projectId, chunkedUpload, resumable]);

  // Handle file selection
  const handleFilesSelected = useCallback(
    async (selectedFiles: File[]) => {
      try {
        // Validate files
        const newFiles: UploadFile[] = [];
        
        for (const file of selectedFiles) {
          const validation = await uploadService.validateFile(file);
          
          if (!validation.valid) {
            onError?.(new Error(validation.error || 'Invalid file'), file);
            continue;
          }

          const uploadFile: UploadFile = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: UploadStatus.PENDING,
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
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [autoUpload, generatePreviews, onFilesSelected, onError]
  );

  // Upload files
  const uploadFiles = useCallback(
    async (filesToUpload?: File[]): Promise<UploadBatchResult | null> => {
      if (isUploading) {
        return null;
      }

      const uploadTargets = filesToUpload || 
        files.filter(f => f.status === UploadStatus.PENDING).map(f => f.file);

      if (uploadTargets.length === 0) {
        return null;
      }

      setIsUploading(true);
      setActiveUploads(uploadTargets.length);

      try {
        onUploadStart?.(uploadTargets);

        const uploadOptions: Partial<UploadOptions> = {
          projectId,
          metadata: { type: uploadType },
          onProgress: (progress, fileId) => {
            // Update individual file progress
            setFiles(prev =>
              prev.map(f =>
                f.id === fileId
                  ? { ...f, progress: progress.progress, status: UploadStatus.UPLOADING }
                  : f
              )
            );

            // Update overall progress
            const totalProgress = files.reduce((sum, f) => sum + f.progress, 0) / files.length;
            setUploadProgress(Math.round(totalProgress));

            onUploadProgress?.(progress, fileId);
          },
        };

        const result = await uploadService.uploadFiles(uploadTargets, uploadOptions);

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
            setFiles(prev => prev.filter(f => f.status !== UploadStatus.COMPLETE));
          }, 2000);
        }

        onUploadComplete?.(result);
        return result;
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
        return null;
      } finally {
        setIsUploading(false);
        setActiveUploads(0);
        setUploadProgress(0);
      }
    },
    [files, isUploading, projectId, uploadType, clearOnComplete, onUploadStart, onUploadProgress, onUploadComplete, onError]
  );

  // Cancel upload
  const cancelUpload = useCallback((fileId?: string) => {
    if (fileId) {
      uploadService.cancelUpload(fileId);
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? { ...f, status: UploadStatus.CANCELLED, error: 'Upload cancelled' }
            : f
        )
      );
    } else {
      // Cancel all active uploads
      files
        .filter(f => f.status === UploadStatus.UPLOADING)
        .forEach(f => uploadService.cancelUpload(f.id));
      
      setFiles(prev =>
        prev.map(f =>
          f.status === UploadStatus.UPLOADING
            ? { ...f, status: UploadStatus.CANCELLED, error: 'Upload cancelled' }
            : f
        )
      );
    }
  }, [files]);

  // Cancel all uploads
  const cancelAllUploads = useCallback(() => {
    cancelUpload();
    setIsUploading(false);
    setActiveUploads(0);
  }, [cancelUpload]);

  // Remove file
  const removeFile = useCallback((fileId: string) => {
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
  const clearFiles = useCallback(() => {
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
  const retryFailed = useCallback(async () => {
    const failedFiles = files.filter(f => f.status === UploadStatus.ERROR);
    
    if (failedFiles.length > 0) {
      // Reset status
      setFiles(prev =>
        prev.map(f =>
          f.status === UploadStatus.ERROR
            ? { ...f, status: UploadStatus.PENDING, error: undefined, progress: 0 }
            : f
        )
      );

      await uploadFiles(failedFiles.map(f => f.file));
    }
  }, [files, uploadFiles]);

  // Resume an upload
  const resumeUpload = useCallback(async (uploadId: string) => {
    try {
      const result = await uploadService.resumeUpload(uploadId);
      if (result) {
        setFiles(prev => [...prev, result]);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [onError]);

  // Select files manually
  const selectFiles = useCallback(() => {
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = multiple;
      input.accept = uploadService['config'].acceptedExtensions.join(',');
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) {
          handleFilesSelected(Array.from(target.files));
        }
      };
      fileInputRef.current = input;
    }
    fileInputRef.current.click();
  }, [multiple, handleFilesSelected]);

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleFilesSelected,
    multiple,
    accept: uploadService['config'].acceptedTypes.reduce(
      (acc, type) => {
        acc[type] = uploadService['config'].acceptedExtensions;
        return acc;
      },
      {} as Record<string, string[]>
    ),
    maxSize: uploadService['config'].maxFileSize,
    ...dropzoneOptions,
  });

  // Cleanup on unmount
  useEffect(() => {
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

export function useImageUpload(options: Omit<UseUploadOptions, 'uploadType'> = {}) {
  return useUpload({ ...options, uploadType: 'image' });
}

export function useAvatarUpload(options: Omit<UseUploadOptions, 'uploadType' | 'multiple'> = {}) {
  return useUpload({ ...options, uploadType: 'avatar', multiple: false });
}

export function useDocumentUpload(options: Omit<UseUploadOptions, 'uploadType'> = {}) {
  return useUpload({ ...options, uploadType: 'document' });
}

// Helper functions

function getDefaultConfig(type: string): Partial<FileUploadConfig> {
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

async function generatePreview(file: File): Promise<string | undefined> {
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
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  } catch {
    return undefined;
  }
}

function createPlaceholderPreview(file: File): string {
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