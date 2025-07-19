"use strict";
// Index file for @spheroseg/shared
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
exports.pathUtils = exports.imageUtils = exports.polygonUtils = exports.distanceToLineSegment = exports.getPolygonPerimeter = exports.getPolygonArea = exports.getBoundingBox = exports.calculateLineIntersection = exports.isPointInPolygonObj = exports.isValidPolygon = exports.clonePolygon = exports.createPolygon = exports.polygonBoundingBoxCache = exports.PolygonBoundingBoxCache = exports.calculateBoundingBoxAsync = exports.calculatePolygonPerimeterAsync = exports.calculatePolygonAreaAsync = exports.executePolygonWorkerOperation = exports.isBoxVisible = exports.calculateMetrics = exports.calculateFeretDiameter = exports.doPolygonsIntersect = exports.simplifyClosedPolygon = exports.simplifyPolygon = exports.slicePolygonObject = exports.slicePolygon = exports.ensureCounterClockwise = exports.ensureClockwise = exports.isClockwise = exports.calculateConvexHull = exports.calculateLinePolygonIntersections = exports.calculateIntersection = exports.perpendicularDistance = exports.getPointSideOfLine = exports.isPointInPolygonXY = exports.isPointInPolygon = exports.calculateCentroid = exports.calculatePolygonPerimeter = exports.calculatePolygonArea = exports.calculateBoundingBoxRect = exports.calculateBoundingBox = exports.distance = void 0;
// Export all polygon utilities
var polygonUtils_1 = require("./utils/polygonUtils");
Object.defineProperty(exports, "distance", { enumerable: true, get: function () { return polygonUtils_1.distance; } });
Object.defineProperty(exports, "calculateBoundingBox", { enumerable: true, get: function () { return polygonUtils_1.calculateBoundingBox; } });
Object.defineProperty(exports, "calculateBoundingBoxRect", { enumerable: true, get: function () { return polygonUtils_1.calculateBoundingBoxRect; } });
Object.defineProperty(exports, "calculatePolygonArea", { enumerable: true, get: function () { return polygonUtils_1.calculatePolygonArea; } });
Object.defineProperty(exports, "calculatePolygonPerimeter", { enumerable: true, get: function () { return polygonUtils_1.calculatePolygonPerimeter; } });
Object.defineProperty(exports, "calculateCentroid", { enumerable: true, get: function () { return polygonUtils_1.calculateCentroid; } });
Object.defineProperty(exports, "isPointInPolygon", { enumerable: true, get: function () { return polygonUtils_1.isPointInPolygon; } });
Object.defineProperty(exports, "isPointInPolygonXY", { enumerable: true, get: function () { return polygonUtils_1.isPointInPolygonXY; } });
Object.defineProperty(exports, "getPointSideOfLine", { enumerable: true, get: function () { return polygonUtils_1.getPointSideOfLine; } });
Object.defineProperty(exports, "perpendicularDistance", { enumerable: true, get: function () { return polygonUtils_1.perpendicularDistance; } });
Object.defineProperty(exports, "calculateIntersection", { enumerable: true, get: function () { return polygonUtils_1.calculateIntersection; } });
Object.defineProperty(exports, "calculateLinePolygonIntersections", { enumerable: true, get: function () { return polygonUtils_1.calculateLinePolygonIntersections; } });
Object.defineProperty(exports, "calculateConvexHull", { enumerable: true, get: function () { return polygonUtils_1.calculateConvexHull; } });
Object.defineProperty(exports, "isClockwise", { enumerable: true, get: function () { return polygonUtils_1.isClockwise; } });
Object.defineProperty(exports, "ensureClockwise", { enumerable: true, get: function () { return polygonUtils_1.ensureClockwise; } });
Object.defineProperty(exports, "ensureCounterClockwise", { enumerable: true, get: function () { return polygonUtils_1.ensureCounterClockwise; } });
Object.defineProperty(exports, "slicePolygon", { enumerable: true, get: function () { return polygonUtils_1.slicePolygon; } });
Object.defineProperty(exports, "slicePolygonObject", { enumerable: true, get: function () { return polygonUtils_1.slicePolygonObject; } });
Object.defineProperty(exports, "simplifyPolygon", { enumerable: true, get: function () { return polygonUtils_1.simplifyPolygon; } });
Object.defineProperty(exports, "simplifyClosedPolygon", { enumerable: true, get: function () { return polygonUtils_1.simplifyClosedPolygon; } });
Object.defineProperty(exports, "doPolygonsIntersect", { enumerable: true, get: function () { return polygonUtils_1.doPolygonsIntersect; } });
Object.defineProperty(exports, "calculateFeretDiameter", { enumerable: true, get: function () { return polygonUtils_1.calculateFeretDiameter; } });
Object.defineProperty(exports, "calculateMetrics", { enumerable: true, get: function () { return polygonUtils_1.calculateMetrics; } });
Object.defineProperty(exports, "isBoxVisible", { enumerable: true, get: function () { return polygonUtils_1.isBoxVisible; } });
Object.defineProperty(exports, "executePolygonWorkerOperation", { enumerable: true, get: function () { return polygonUtils_1.executePolygonWorkerOperation; } });
Object.defineProperty(exports, "calculatePolygonAreaAsync", { enumerable: true, get: function () { return polygonUtils_1.calculatePolygonAreaAsync; } });
Object.defineProperty(exports, "calculatePolygonPerimeterAsync", { enumerable: true, get: function () { return polygonUtils_1.calculatePolygonPerimeterAsync; } });
Object.defineProperty(exports, "calculateBoundingBoxAsync", { enumerable: true, get: function () { return polygonUtils_1.calculateBoundingBoxAsync; } });
Object.defineProperty(exports, "PolygonBoundingBoxCache", { enumerable: true, get: function () { return polygonUtils_1.PolygonBoundingBoxCache; } });
Object.defineProperty(exports, "polygonBoundingBoxCache", { enumerable: true, get: function () { return polygonUtils_1.polygonBoundingBoxCache; } });
Object.defineProperty(exports, "createPolygon", { enumerable: true, get: function () { return polygonUtils_1.createPolygon; } });
Object.defineProperty(exports, "clonePolygon", { enumerable: true, get: function () { return polygonUtils_1.clonePolygon; } });
Object.defineProperty(exports, "isValidPolygon", { enumerable: true, get: function () { return polygonUtils_1.isValidPolygon; } });
Object.defineProperty(exports, "isPointInPolygonObj", { enumerable: true, get: function () { return polygonUtils_1.isPointInPolygonObj; } });
Object.defineProperty(exports, "calculateLineIntersection", { enumerable: true, get: function () { return polygonUtils_1.calculateLineIntersection; } });
Object.defineProperty(exports, "getBoundingBox", { enumerable: true, get: function () { return polygonUtils_1.getBoundingBox; } });
Object.defineProperty(exports, "getPolygonArea", { enumerable: true, get: function () { return polygonUtils_1.getPolygonArea; } });
Object.defineProperty(exports, "getPolygonPerimeter", { enumerable: true, get: function () { return polygonUtils_1.getPolygonPerimeter; } });
Object.defineProperty(exports, "distanceToLineSegment", { enumerable: true, get: function () { return polygonUtils_1.distanceToLineSegment; } });
var polygonUtils_2 = require("./utils/polygonUtils");
Object.defineProperty(exports, "polygonUtils", { enumerable: true, get: function () { return __importDefault(polygonUtils_2).default; } });
// Export monitoring utilities
__exportStar(require("./monitoring"), exports);
// Export segmentation status constants
__exportStar(require("./constants/segmentationStatus"), exports);
// Export image utilities
__exportStar(require("./utils/imageUtils"), exports);
var imageUtils_1 = require("./utils/imageUtils");
Object.defineProperty(exports, "imageUtils", { enumerable: true, get: function () { return __importDefault(imageUtils_1).default; } });
// Export path utilities
__exportStar(require("./utils/pathUtils"), exports);
var pathUtils_1 = require("./utils/pathUtils");
Object.defineProperty(exports, "pathUtils", { enumerable: true, get: function () { return __importDefault(pathUtils_1).default; } });
// Export API response handling utilities
__exportStar(require("./api"), exports);
//# sourceMappingURL=index.js.map