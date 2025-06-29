/**
 * Frontend Polygon Worker Utilities
 * 
 * This file re-exports worker utilities from the shared package.
 * All polygon-related functionality has been unified in @spheroseg/shared/utils/polygonUtils
 * 
 * @deprecated Import directly from @spheroseg/shared/utils/polygonUtils for new code
 */

export {
  // Types
  Point,
  Polygon,
  BoundingBox,
  
  // Functions
  isValidPolygon,
  calculatePolygonArea,
  isPointInPolygon as isPointInsidePolygon,
  calculatePolygonPerimeter,
  calculateBoundingBox,
  
  // Async functions
  calculatePolygonAreaAsync,
  calculatePolygonPerimeterAsync,
  calculateBoundingBoxAsync,
  executePolygonWorkerOperation
} from '@spheroseg/shared/utils/polygonUtils';