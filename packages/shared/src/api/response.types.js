"use strict";
/**
 * Unified API Response Types
 *
 * This module provides standardized types for all API responses across the application.
 * All API responses should conform to these types to ensure consistency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApiSuccess = isApiSuccess;
exports.isApiError = isApiError;
/**
 * Type guard to check if response is successful
 */
function isApiSuccess(response) {
    return response.success === true;
}
/**
 * Type guard to check if response is an error
 */
function isApiError(response) {
    return response.success === false;
}
//# sourceMappingURL=response.types.js.map