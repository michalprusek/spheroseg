/**
 * Type definitions for the unified upload service
 */

export interface UploadOptions {
  endpoint?: string;
  projectId?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  chunkSize?: number;
  onProgress?: (progress: UploadProgress) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  progress: number; // 0-100
}

export interface UploadResult {
  id: string;
  url?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
  duration: number;
}

export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
  blob: Blob;
  hash: string;
}

export interface ResumableUploadState {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: string;
  expiresAt: string;
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
  result?: unknown;
  uploadId?: string; // For resumable uploads
}

export interface FileUploadConfig {
  maxFileSize: number;
  maxFiles: number;
  acceptedTypes: string[];
  acceptedExtensions: string[];
  batchSize: number;
  generatePreviews: boolean;
  autoSegment: boolean;
  projectId?: string;
  chunkSize?: number;
  enableChunking?: boolean;
  enableResume?: boolean;
}

export interface UploadQueueItem {
  file: UploadFile;
  options: UploadOptions;
  strategy: string;
  priority: number;
  retries: number;
  maxRetries: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface UploadBatchResult {
  successful: UploadFile[];
  failed: UploadFile[];
  cancelled: UploadFile[];
  totalFiles: number;
  totalSize: number;
  duration: number;
}