"use strict";
/**
 * Slicing Utilities
 *
 * This file re-exports slicing-related functions from the unified polygon utilities
 * for backward compatibility. All new code should import from polygonUtils directly.
 *
 * @deprecated Use @spheroseg/shared/utils/polygonUtils instead
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPolygon = exports.slicePolygonObject = exports.slicePolygon = void 0;
// Re-export slicing functions
var polygonUtils_1 = require("../polygonUtils");
Object.defineProperty(exports, "slicePolygon", { enumerable: true, get: function () { return polygonUtils_1.slicePolygon; } });
Object.defineProperty(exports, "slicePolygonObject", { enumerable: true, get: function () { return polygonUtils_1.slicePolygonObject; } });
Object.defineProperty(exports, "createPolygon", { enumerable: true, get: function () { return polygonUtils_1.createPolygon; } });
//# sourceMappingURL=slicingUtils.js.map