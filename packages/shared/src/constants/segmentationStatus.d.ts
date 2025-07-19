/**
 * Segmentation status constants used across the application
 */
export declare const SEGMENTATION_STATUS: {
    readonly WITHOUT_SEGMENTATION: "without_segmentation";
    readonly QUEUED: "queued";
    readonly PROCESSING: "processing";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
};
export type SegmentationStatus = typeof SEGMENTATION_STATUS[keyof typeof SEGMENTATION_STATUS];
export declare const PROCESSING_STATUSES: readonly ["queued", "processing"];
export declare const FINAL_STATUSES: readonly ["completed", "failed", "without_segmentation"];
export declare function isProcessingStatus(status: string): status is typeof PROCESSING_STATUSES[number];
export declare function isFinalStatus(status: string): status is typeof FINAL_STATUSES[number];
export declare function isValidSegmentationStatus(status: string): status is SegmentationStatus;
//# sourceMappingURL=segmentationStatus.d.ts.map