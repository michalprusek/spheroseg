/**
 * Segmentation status constants used across the backend
 */

export const SEGMENTATION_STATUS = {
  WITHOUT_SEGMENTATION: 'without_segmentation',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type SegmentationStatus = (typeof SEGMENTATION_STATUS)[keyof typeof SEGMENTATION_STATUS];

// Helper arrays for common status checks
export const PROCESSING_STATUSES = [
  SEGMENTATION_STATUS.QUEUED,
  SEGMENTATION_STATUS.PROCESSING,
] as const;

export const FINAL_STATUSES = [
  SEGMENTATION_STATUS.COMPLETED,
  SEGMENTATION_STATUS.FAILED,
  SEGMENTATION_STATUS.WITHOUT_SEGMENTATION,
] as const;

// Type guards
export function isProcessingStatus(status: string): status is (typeof PROCESSING_STATUSES)[number] {
  return PROCESSING_STATUSES.includes(status as SegmentationStatus);
}

export function isFinalStatus(status: string): status is (typeof FINAL_STATUSES)[number] {
  return FINAL_STATUSES.includes(status as SegmentationStatus);
}

export function isValidSegmentationStatus(status: string): status is SegmentationStatus {
  return Object.values(SEGMENTATION_STATUS).includes(status as SegmentationStatus);
}
