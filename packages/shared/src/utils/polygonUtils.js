"use strict";
/**
 * Polygon Utilities
 *
 * Re-exports the unified polygon utilities module for backward compatibility.
 * All new code should import from this module.
 *
 * @module @spheroseg/shared/utils/polygonUtils
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
exports.default = void 0;
// Re-export everything from the unified module
__exportStar(require("./polygonUtils.unified"), exports);
var polygonUtils_unified_1 = require("./polygonUtils.unified");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(polygonUtils_unified_1).default; } });
//# sourceMappingURL=polygonUtils.js.map