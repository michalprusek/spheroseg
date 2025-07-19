/**
 * React hooks for the unified upload service
 */
import { DropzoneOptions } from 'react-dropzone';
import { UploadFile, UploadProgress, UploadBatchResult, FileUploadConfig } from './types';
export interface UseUploadOptions {
    config?: Partial<FileUploadConfig>;
    uploadType?: 'image' | 'avatar' | 'document' | 'auto';
    multiple?: boolean;
    autoUpload?: boolean;
    clearOnComplete?: boolean;
    generatePreviews?: boolean;
    chunkedUpload?: boolean;
    resumable?: boolean;
    projectId?: string;
    onFilesSelected?: (files: File[]) => void;
    onUploadStart?: (files: File[]) => void;
    onUploadProgress?: (progress: UploadProgress, fileId: string) => void;
    onFileComplete?: (file: UploadFile) => void;
    onUploadComplete?: (result: UploadBatchResult) => void;
    onError?: (error: Error, file?: File) => void;
    dropzoneOptions?: Partial<DropzoneOptions>;
}
export interface UseUploadReturn {
    files: UploadFile[];
    isUploading: boolean;
    uploadProgress: number;
    activeUploads: number;
    selectFiles: () => void;
    uploadFiles: (filesToUpload?: File[]) => Promise<UploadBatchResult | null>;
    cancelUpload: (fileId?: string) => void;
    cancelAllUploads: () => void;
    removeFile: (fileId: string) => void;
    clearFiles: () => void;
    retryFailed: () => Promise<void>;
    resumeUpload: (uploadId: string) => Promise<void>;
    getRootProps: () => any;
    getInputProps: () => any;
    isDragActive: boolean;
    open: () => void;
}
/**
 * Main upload hook with all features
 */
export declare function useUpload(options?: UseUploadOptions): UseUploadReturn;
/**
 * Specialized hooks for specific upload types
 */
export declare function useImageUpload(options?: Omit<UseUploadOptions, 'uploadType'>): UseUploadReturn;
export declare function useAvatarUpload(options?: Omit<UseUploadOptions, 'uploadType' | 'multiple'>): UseUploadReturn;
export declare function useDocumentUpload(options?: Omit<UseUploadOptions, 'uploadType'>): UseUploadReturn;
//# sourceMappingURL=hooks.d.ts.map