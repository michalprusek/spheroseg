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
export function createPerformanceMonitoring(_options?: any): any {
  // The unified monitoring is already a singleton, so just return it
  return performanceMonitoring;
}

// Create a dummy class for backward compatibility
export class BackendPerformanceMonitoring {
  recordApiResponseTime(metric: any) {
    return (performanceMonitoring as unknown).recordApiResponseTime(metric);
  }

  recordDatabaseQuery(metric: any) {
    return (performanceMonitoring as unknown).recordDatabaseQuery(metric);
  }

  recordFileOperation(metric: any) {
    return (performanceMonitoring as unknown).recordFileOperation(metric);
  }

  recordMLInference(metric: any) {
    return (performanceMonitoring as unknown).recordMLInference(metric);
  }

  recordMemoryHeap(metric: any) {
    return (performanceMonitoring as unknown).recordMemoryHeap(metric);
  }

  recordCPUUsage(metric: any) {
    return (performanceMonitoring as unknown).recordCPUUsage(metric);
  }
}

// Export the default implementation directly to avoid TypeScript error TS4094
export const monitoring: any = performanceMonitoring;
