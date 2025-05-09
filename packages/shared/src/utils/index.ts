// Import utility functions from polygon operations
import {
  BoundingBox,
  WorkerRequest,
  WorkerResponse,
  calculateBoundingBox,
  isPointInPolygon,
  calculateIntersection,
  calculateLinePolygonIntersections,
  perpendicularDistance,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  simplifyPolygon,
  isBoxVisible,
  PolygonBoundingBoxCache,
  polygonBoundingBoxCache
} from './polygonOperationsUtils';

// Import utility functions from polygon slicing
import {
  Polygon,
  getPointSideOfLine,
  calculateLineIntersection,
  distanceToLineSegment,
  createPolygon
} from './polygonSlicingUtils';

// Import the slicePolygon functions separately
import { slicePolygon as slicePolygonPoints } from './polygonOperationsUtils';
import { slicePolygon as slicePolygonObject } from './polygonSlicingUtils';

// Import worker utilities
import * as polygonWorkerUtils from './polygonWorkerUtils';

// Re-export types
export type { BoundingBox, WorkerRequest, WorkerResponse } from './polygonOperationsUtils';
export type { Polygon } from './polygonSlicingUtils';

// Re-export functions and values
export {
  // From polygonOperationsUtils
  calculateBoundingBox,
  isPointInPolygon,
  calculateIntersection,
  calculateLinePolygonIntersections,
  perpendicularDistance,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  simplifyPolygon,
  isBoxVisible,
  PolygonBoundingBoxCache,
  polygonBoundingBoxCache,
  
  // From polygonSlicingUtils
  getPointSideOfLine,
  calculateLineIntersection,
  distanceToLineSegment,
  createPolygon,
  
  // Renamed slicePolygon functions to avoid conflicts
  slicePolygonPoints,   // The version that works with Point[]
  slicePolygonObject,   // The version that works with Polygon objects
};

// Re-export worker utilities
export * from './polygonWorkerUtils';