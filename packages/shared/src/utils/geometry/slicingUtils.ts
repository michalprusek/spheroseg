/**
 * Slicing Utilities
 * 
 * This file re-exports slicing-related functions from the unified polygon utilities
 * for backward compatibility. All new code should import from polygonUtils directly.
 * 
 * @deprecated Use @spheroseg/shared/utils/polygonUtils instead
 */

// Re-export types separately to satisfy isolatedModules
export type { Polygon } from '../polygonUtils';

// Re-export slicing functions
export { slicePolygon, slicePolygonObject, createPolygon } from '../polygonUtils';