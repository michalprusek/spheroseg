"use strict";
/**
 * Shared utilities index
 * Re-exports all polygon utilities from the consolidated polygonUtils module
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.polygonUtils = void 0;
// Import and re-export everything from the consolidated polygon utilities
__exportStar(require("./polygonUtils"), exports);
// Default export for convenience
var polygonUtils_1 = require("./polygonUtils");
Object.defineProperty(exports, "polygonUtils", { enumerable: true, get: function () { return __importDefault(polygonUtils_1).default; } });
// Export path utilities
__exportStar(require("./pathUtils"), exports);
//# sourceMappingURL=index.js.map