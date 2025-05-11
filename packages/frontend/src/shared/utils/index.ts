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
  polygonBoundingBoxCache,
  slicePolygon,
} from './polygonOperationsUtils';

// Import utility functions from polygon worker
import {
  executePolygonWorkerOperation,
  calculatePolygonAreaAsync,
  calculatePolygonPerimeterAsync,
  calculateBoundingBoxAsync,
  PolygonWorker,
} from './polygonWorkerUtils';

// Import utility functions from polygon slicing
import {
  Polygon,
  getPointSideOfLine,
  calculateLineIntersection,
  distanceToLineSegment,
  createPolygon,
} from './polygonSlicingUtils';

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
  slicePolygon,

  // From polygonWorkerUtils
  executePolygonWorkerOperation,
  calculatePolygonAreaAsync,
  calculatePolygonPerimeterAsync,
  calculateBoundingBoxAsync,

  // From polygonSlicingUtils
  getPointSideOfLine,
  calculateLineIntersection,
  distanceToLineSegment,
  createPolygon,
};

// Re-export types
export type { BoundingBox, WorkerRequest, WorkerResponse, Polygon, PolygonWorker };
