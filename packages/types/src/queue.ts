/**
 * Queue-related type definitions
 */

export interface QueueStatus {
  projectId: string;
  queuedCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  lastUpdated: string;
}

export interface QueueTask {
  id: string;
  imageId: string;
  projectId: string;
  status: QueueTaskStatus;
  priority: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  attempts: number;
  maxAttempts: number;
}

export enum QueueTaskStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ProjectStats {
  projectId: string;
  imageCount: number;
  processedImageCount: number;
  cellCount: number;
  avgCellsPerImage: number;
  totalStorageUsed: number;
  lastActivity: string;
  collaboratorCount: number;
}