"use strict";
/**
 * Unified API Response Module
 *
 * This module exports all types, handlers, and schemas needed for
 * standardized API communication across the application.
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
exports.createPaginatedSchema = exports.ApiErrorResponseSchema = exports.ApiResponseSchema = exports.ResponseHandler = exports.UnifiedResponseHandler = void 0;
// Export all types
__exportStar(require("./response.types"), exports);
// Export the response handler
var responseHandler_1 = require("./responseHandler");
Object.defineProperty(exports, "UnifiedResponseHandler", { enumerable: true, get: function () { return responseHandler_1.UnifiedResponseHandler; } });
// Export all schemas
__exportStar(require("./schemas"), exports);
// Export entity schemas
__exportStar(require("./entitySchemas"), exports);
// Re-export commonly used items for convenience
var responseHandler_2 = require("./responseHandler");
Object.defineProperty(exports, "ResponseHandler", { enumerable: true, get: function () { return responseHandler_2.UnifiedResponseHandler; } });
var schemas_1 = require("./schemas");
Object.defineProperty(exports, "ApiResponseSchema", { enumerable: true, get: function () { return schemas_1.ApiResponseSchema; } });
Object.defineProperty(exports, "ApiErrorResponseSchema", { enumerable: true, get: function () { return schemas_1.ApiErrorResponseSchema; } });
Object.defineProperty(exports, "createPaginatedSchema", { enumerable: true, get: function () { return schemas_1.createPaginatedSchema; } });
//# sourceMappingURL=index.js.map