"use strict";
/**
 * Type definitions for the unified upload service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadStatus = void 0;
var UploadStatus;
(function (UploadStatus) {
    UploadStatus["PENDING"] = "pending";
    UploadStatus["VALIDATING"] = "validating";
    UploadStatus["UPLOADING"] = "uploading";
    UploadStatus["PROCESSING"] = "processing";
    UploadStatus["COMPLETE"] = "complete";
    UploadStatus["ERROR"] = "error";
    UploadStatus["CANCELLED"] = "cancelled";
})(UploadStatus || (exports.UploadStatus = UploadStatus = {}));
//# sourceMappingURL=types.js.map