/**
 * Performance monitoring compatibility layer
 *
 * This file maintains backward compatibility for lib/monitoring imports
 * while using the unified monitoring system internally.
 */

import { performanceMonitoring } from '../../monitoring/unified';

// Re-export performance monitoring
export { performanceMonitoring };

// Export the create function for compatibility
export function createPerformanceMonitoring(options?: any) {
  // The unified monitoring is already a singleton, so just return it
  return performanceMonitoring;
}

// Re-export the BackendPerformanceMonitoring class for type compatibility
export { performanceMonitoring as BackendPerformanceMonitoring };
