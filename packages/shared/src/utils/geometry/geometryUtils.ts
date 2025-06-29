/**
 * Geometry Utilities
 * 
 * This file re-exports geometry-related functions from the unified polygon utilities
 * for backward compatibility. All new code should import from polygonUtils directly.
 * 
 * @deprecated Use @spheroseg/shared/utils/polygonUtils instead
 */

// Re-export types separately to satisfy isolatedModules
export type { BoundingBox } from '../polygonUtils';

// Re-export all functions and values
export * from '../polygonUtils';