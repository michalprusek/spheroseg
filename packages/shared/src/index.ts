// Index file for @spheroseg/shared
// Export utility functions - explicitly import and re-export to avoid ambiguity
import { 
  // Types
  BoundingBox, WorkerRequest, WorkerResponse,
  // Functions
  calculateBoundingBox, isPointInPolygon, calculateIntersection,
  calculateLinePolygonIntersections, perpendicularDistance,
  calculatePolygonArea, calculatePolygonPerimeter, simplifyPolygon, isBoxVisible,
  // Classes and instances
  PolygonBoundingBoxCache, polygonBoundingBoxCache,
  // Renamed functions to avoid conflicts
  slicePolygonPoints
} from './utils';

import {
  // Types
  Polygon,
  // Functions
  getPointSideOfLine, calculateLineIntersection, distanceToLineSegment, createPolygon,
  // Renamed functions to avoid conflicts
  slicePolygonObject
} from './utils';

// Re-export utility types and functions
export type { BoundingBox, WorkerRequest, WorkerResponse, Polygon };
export {
  // Functions from polygonOperationsUtils
  calculateBoundingBox, isPointInPolygon, calculateIntersection,
  calculateLinePolygonIntersections, perpendicularDistance,
  calculatePolygonArea, calculatePolygonPerimeter, simplifyPolygon, isBoxVisible,
  // Classes and instances
  PolygonBoundingBoxCache, polygonBoundingBoxCache,
  
  // Functions from polygonSlicingUtils
  getPointSideOfLine, calculateLineIntersection, distanceToLineSegment, createPolygon,
  
  // Renamed slicePolygon functions to avoid conflicts
  slicePolygonPoints, slicePolygonObject
};

// Export monitoring utilities
export * from './monitoring';

// Export worker utilities
export * from './utils/polygonWorkerUtils';