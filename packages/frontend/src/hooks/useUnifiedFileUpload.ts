/**
 * Unified File Upload Hook
 * 
 * This hook provides a simple interface for file upload functionality,
 * managing upload state and progress with automatic cleanup.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import fileUploadService, {
  FileUploadConfig,
  UploadFile,
  UploadStatus,
  UploadProgress,
  UploadResult,
  UPLOAD_CONFIGS,
} from '@/services/unifiedFileUploadService';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { toast } from 'sonner';

const logger = createLogger('useUnifiedFileUpload');

// ===========================
// Types and Interfaces
// ===========================

export interface UseFileUploadOptions {
  // Configuration
  config?: Partial<FileUploadConfig>;
  configPreset?: keyof typeof UPLOAD_CONFIGS;
  
  // Options
  multiple?: boolean;
  autoUpload?: boolean;
  clearOnComplete?: boolean;
  generatePreviews?: boolean;
  
  // Project context
  projectId?: string;
  
  // Callbacks
  onFilesSelected?: (files: File[]) => void;
  onUploadStart?: (files: File[]) => void;
  onUploadProgress?: (progress: UploadProgress) => void;
  onFileComplete?: (file: UploadFile) => void;
  onUploadComplete?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
  
  // Dropzone options
  dropzoneOptions?: Partial<DropzoneOptions>;
}

export interface UseFileUploadReturn {
  // File state
  files: UploadFile[];
  isUploading: boolean;
  uploadProgress: number;
  
  // Actions
  selectFiles: () => void;
  uploadFiles: (filesToUpload?: File[]) => Promise<UploadResult | null>;
  cancelUpload: (fileId?: string) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  retryFailed: () => Promise<void>;
  
  // Dropzone
  getRootProps: () => any;
  getInputProps: () => any;
  isDragActive: boolean;
  open: () => void;
}

// ===========================
// Main Hook
// ===========================

export function useUnifiedFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const {
    config,
    configPreset = 'IMAGE',
    multiple = true,
    autoUpload = false,
    clearOnComplete = false,
    generatePreviews = true,
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
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Initialize service config
  useEffect(() => {
    const baseConfig = UPLOAD_CONFIGS[configPreset];
    fileUploadService.setConfig({
      ...baseConfig,
      ...config,
      generatePreviews,
      projectId,
    });
  }, [configPreset, config, generatePreviews, projectId]);
  
  // Handle file selection
  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    try {
      logger.info(`Files selected: ${selectedFiles.length}`);
      
      // Validate files
      const validations = await fileUploadService.validateFiles(selectedFiles);
      const newFiles: UploadFile[] = [];
      
      for (const [file, validation] of validations) {
        const uploadFile: UploadFile = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: validation.valid ? UploadStatus.PENDING : UploadStatus.ERROR,
          progress: 0,
          error: validation.error,
        };
        
        // Generate preview if valid
        if (validation.valid && generatePreviews) {
          uploadFile.preview = await fileUploadService.generatePreview(file);
        }
        
        // Show validation warnings
        validation.warnings?.forEach(warning => {
          toast.warning(`${file.name}: ${warning}`);
        });
        
        newFiles.push(uploadFile);
      }
      
      // Update state
      setFiles(prev => [...prev, ...newFiles]);
      
      // Call callback
      onFilesSelected?.(selectedFiles);
      
      // Auto upload if enabled
      if (autoUpload) {
        const validFiles = selectedFiles.filter((_, index) => 
          Array.from(validations.values())[index].valid
        );
        if (validFiles.length > 0) {
          uploadFiles(validFiles);
        }
      }
    } catch (error) {
      logger.error('Error handling file selection:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [generatePreviews, autoUpload, onFilesSelected, onError]);
  
  // Upload files
  const uploadFiles = useCallback(async (filesToUpload?: File[]): Promise<UploadResult | null> => {
    if (isUploading) {
      toast.warning('Upload already in progress');
      return null;
    }
    
    // Get files to upload
    const uploadTargets = filesToUpload || 
      files.filter(f => f.status === UploadStatus.PENDING).map(f => f.file);
    
    if (uploadTargets.length === 0) {
      toast.info('No files to upload');
      return null;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Create abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      // Call upload start callback
      onUploadStart?.(uploadTargets);
      
      // Upload files
      const result = await fileUploadService.uploadFiles(uploadTargets, {
        projectId,
        signal: abortControllerRef.current.signal,
        onProgress: (progress) => {
          // Update file status
          setFiles(prev => prev.map(f => 
            f.id === progress.fileId
              ? { ...f, status: progress.status, progress: progress.progress }
              : f
          ));
          
          // Calculate overall progress
          const totalProgress = files.reduce((sum, f) => sum + f.progress, 0) / files.length;
          setUploadProgress(Math.round(totalProgress));
          
          // Call progress callback
          onUploadProgress?.(progress);
        },
        onFileComplete: (completedFile) => {
          // Update file in state
          setFiles(prev => prev.map(f => 
            f.id === completedFile.id ? completedFile : f
          ));
          
          // Call file complete callback
          onFileComplete?.(completedFile);
        },
      });
      
      // Update files with results
      setFiles(prev => prev.map(file => {
        const resultFile = [...result.successful, ...result.failed, ...result.cancelled]
          .find(f => f.file === file.file);
        return resultFile || file;
      }));
      
      // Clear completed files if requested
      if (clearOnComplete && result.failed.length === 0) {
        setTimeout(() => {
          setFiles(prev => prev.filter(f => f.status !== UploadStatus.COMPLETE));
        }, 2000);
      }
      
      // Call complete callback
      onUploadComplete?.(result);
      
      return result;
    } catch (error) {
      logger.error('Upload error:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
      return null;
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }, [files, isUploading, projectId, clearOnComplete, onUploadStart, onUploadProgress, onFileComplete, onUploadComplete, onError]);
  
  // Cancel upload
  const cancelUpload = useCallback((fileId?: string) => {
    if (fileId) {
      fileUploadService.cancelUpload(fileId);
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: UploadStatus.CANCELLED, error: 'Upload cancelled' }
          : f
      ));
    } else {
      // Cancel all uploads
      abortControllerRef.current?.abort();
      fileUploadService.cancelAllUploads();
      setFiles(prev => prev.map(f => 
        f.status === UploadStatus.UPLOADING
          ? { ...f, status: UploadStatus.CANCELLED, error: 'Upload cancelled' }
          : f
      ));
      setIsUploading(false);
    }
  }, []);
  
  // Remove file
  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);
  
  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setUploadProgress(0);
  }, []);
  
  // Retry failed uploads
  const retryFailed = useCallback(async () => {
    const failedFiles = files
      .filter(f => f.status === UploadStatus.ERROR)
      .map(f => f.file);
    
    if (failedFiles.length > 0) {
      // Reset status
      setFiles(prev => prev.map(f => 
        f.status === UploadStatus.ERROR
          ? { ...f, status: UploadStatus.PENDING, error: undefined, progress: 0 }
          : f
      ));
      
      // Upload again
      await uploadFiles(failedFiles);
    }
  }, [files, uploadFiles]);
  
  // Select files manually
  const selectFiles = useCallback(() => {
    if (!fileInputRef.current) {
      // Create hidden input
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = multiple;
      input.accept = fileUploadService.getConfig().acceptedExtensions.join(',');
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
    accept: fileUploadService.getConfig().acceptedTypes.reduce((acc, type) => {
      acc[type] = fileUploadService.getConfig().acceptedExtensions;
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: fileUploadService.getConfig().maxFileSize,
    ...dropzoneOptions,
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing uploads
      if (isUploading) {
        cancelUpload();
      }
      
      // Revoke object URLs
      files.forEach(file => {
        if (file.preview && file.preview.startsWith('blob:')) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);
  
  return {
    // File state
    files,
    isUploading,
    uploadProgress,
    
    // Actions
    selectFiles,
    uploadFiles,
    cancelUpload,
    removeFile,
    clearFiles,
    retryFailed,
    
    // Dropzone
    getRootProps,
    getInputProps,
    isDragActive,
    open,
  };
}

// ===========================
// Specialized Hooks
// ===========================

/**
 * Hook for image uploads
 */
export function useImageUpload(options: Omit<UseFileUploadOptions, 'configPreset'> = {}) {
  return useUnifiedFileUpload({
    ...options,
    configPreset: 'IMAGE',
  });
}

/**
 * Hook for avatar uploads
 */
export function useAvatarUpload(options: Omit<UseFileUploadOptions, 'configPreset' | 'multiple'> = {}) {
  return useUnifiedFileUpload({
    ...options,
    configPreset: 'AVATAR',
    multiple: false,
  });
}

/**
 * Hook for document uploads
 */
export function useDocumentUpload(options: Omit<UseFileUploadOptions, 'configPreset'> = {}) {
  return useUnifiedFileUpload({
    ...options,
    configPreset: 'DOCUMENT',
  });
}

// ===========================
// Export
// ===========================

export default useUnifiedFileUpload;