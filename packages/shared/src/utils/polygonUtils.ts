/**
 * Polygon Utilities
 * 
 * Re-exports the unified polygon utilities module for backward compatibility.
 * All new code should import from this module.
 * 
 * @module @spheroseg/shared/utils/polygonUtils
 */

// Re-export Point type explicitly
export type { Point } from '@spheroseg/types';

// Re-export everything from the unified module
export * from './polygonUtils.unified';
export { default } from './polygonUtils.unified';