/**
 * Frontend Polygon Worker Utilities
 * 
 * This file re-exports worker utilities from the shared package.
 * All polygon-related functionality has been unified in @spheroseg/shared/utils/polygonUtils
 * 
 * @deprecated Import directly from @spheroseg/shared/utils/polygonUtils for new code
 */

// Import types from @spheroseg/types
export type { Point } from '@spheroseg/types';

// Re-export everything else from shared utils
export {
  // Types (except Point)
  type Polygon,
  type BoundingBox,
  
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