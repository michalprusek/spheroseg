"use strict";
/**
 * Unified Upload Service - Main Export
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPLOAD_PRESETS = exports.UnifiedUploadService = exports.uploadService = void 0;
// Export service
var UnifiedUploadService_1 = require("./UnifiedUploadService");
Object.defineProperty(exports, "uploadService", { enumerable: true, get: function () { return UnifiedUploadService_1.uploadService; } });
Object.defineProperty(exports, "UnifiedUploadService", { enumerable: true, get: function () { return UnifiedUploadService_1.UnifiedUploadService; } });
// Export types
__exportStar(require("./types"), exports);
// Export strategies
__exportStar(require("./strategies"), exports);
// Export hooks
__exportStar(require("./hooks"), exports);
exports.UPLOAD_PRESETS = {
    IMAGE: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 50,
        acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif', 'image/bmp', 'image/webp'],
        acceptedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'],
        batchSize: 20,
        generatePreviews: true,
        autoSegment: false,
        chunkSize: 5 * 1024 * 1024,
        enableChunking: true,
        enableResume: true,
    },
    AVATAR: {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        maxFiles: 1,
        acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
        batchSize: 1,
        generatePreviews: true,
        autoSegment: false,
        enableChunking: false,
        enableResume: false,
    },
    DOCUMENT: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        acceptedTypes: ['application/pdf', 'text/plain', 'application/json'],
        acceptedExtensions: ['.pdf', '.txt', '.json'],
        batchSize: 5,
        generatePreviews: false,
        autoSegment: false,
        chunkSize: 10 * 1024 * 1024,
        enableChunking: true,
        enableResume: true,
    },
    VIDEO: {
        maxFileSize: 500 * 1024 * 1024, // 500MB
        maxFiles: 5,
        acceptedTypes: ['video/mp4', 'video/webm', 'video/ogg'],
        acceptedExtensions: ['.mp4', '.webm', '.ogg'],
        batchSize: 1,
        generatePreviews: true,
        autoSegment: false,
        chunkSize: 10 * 1024 * 1024,
        enableChunking: true,
        enableResume: true,
    },
};
//# sourceMappingURL=index.js.map