"use strict";
/**
 * Segmentation status constants used across the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINAL_STATUSES = exports.PROCESSING_STATUSES = exports.SEGMENTATION_STATUS = void 0;
exports.isProcessingStatus = isProcessingStatus;
exports.isFinalStatus = isFinalStatus;
exports.isValidSegmentationStatus = isValidSegmentationStatus;
exports.SEGMENTATION_STATUS = {
    WITHOUT_SEGMENTATION: 'without_segmentation',
    QUEUED: 'queued',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
};
// Helper arrays for common status checks
exports.PROCESSING_STATUSES = [
    exports.SEGMENTATION_STATUS.QUEUED,
    exports.SEGMENTATION_STATUS.PROCESSING,
];
exports.FINAL_STATUSES = [
    exports.SEGMENTATION_STATUS.COMPLETED,
    exports.SEGMENTATION_STATUS.FAILED,
    exports.SEGMENTATION_STATUS.WITHOUT_SEGMENTATION,
];
// Type guards
function isProcessingStatus(status) {
    return exports.PROCESSING_STATUSES.includes(status);
}
function isFinalStatus(status) {
    return exports.FINAL_STATUSES.includes(status);
}
function isValidSegmentationStatus(status) {
    return Object.values(exports.SEGMENTATION_STATUS).includes(status);
}
//# sourceMappingURL=segmentationStatus.js.map