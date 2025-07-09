/**
 * Re-export segmentation status constants from shared package
 */
export {
  SEGMENTATION_STATUS,
  type SegmentationStatus,
  PROCESSING_STATUSES,
  FINAL_STATUSES,
  isProcessingStatus,
  isFinalStatus,
  isValidSegmentationStatus,
} from '@spheroseg/shared';