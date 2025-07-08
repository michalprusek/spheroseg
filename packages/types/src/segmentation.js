"use strict";
/**
 * Segmentation specific types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SegmentationStatus = void 0;
var SegmentationStatus;
(function (SegmentationStatus) {
    SegmentationStatus["QUEUED"] = "queued";
    SegmentationStatus["PROCESSING"] = "processing";
    SegmentationStatus["COMPLETED"] = "completed";
    SegmentationStatus["FAILED"] = "failed";
    SegmentationStatus["SAVING"] = "saving";
    SegmentationStatus["WITHOUT_SEGMENTATION"] = "without_segmentation";
})(SegmentationStatus || (exports.SegmentationStatus = SegmentationStatus = {}));
//# sourceMappingURL=segmentation.js.map