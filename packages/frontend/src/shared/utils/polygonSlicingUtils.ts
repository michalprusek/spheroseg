/**
 * Frontend Polygon Slicing Utilities
 * 
 * This file re-exports slicing utilities from the shared package.
 * All polygon-related functionality has been unified in @spheroseg/shared/utils/polygonUtils
 * 
 * @deprecated Import directly from @spheroseg/shared/utils/polygonUtils for new code
 */

export {
  // Types
  Point,
  Polygon,
  Intersection,
  
  // Functions
  calculateIntersection as lineIntersection,
  slicePolygon,
  perpendicularDistance as distanceToLineSegment,
  getPointSideOfLine,
  createPolygon
} from '@spheroseg/shared/utils/polygonUtils';

// Legacy type for compatibility
export interface SliceResult {
  polygon1: Point[];
  polygon2: Point[];
}