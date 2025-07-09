/**
 * Performance Monitoring Compatibility File
 *
 * This file is kept for backward compatibility but delegates to the unified monitoring system.
 * All functionality has been moved to the unified monitoring module.
 */

import { performanceMonitoring } from '../../monitoring/unified';

// Re-export the unified monitoring instance as BackendPerformanceMonitoring
export class BackendPerformanceMonitoring {
  private static instance = performanceMonitoring;

  public static getInstance(options?: any): typeof performanceMonitoring {
    return performanceMonitoring;
  }

  // Delegate all methods to the unified monitoring instance
  recordApiResponseTimeMetric =
    performanceMonitoring.recordApiResponseTime.bind(performanceMonitoring);
  recordDatabaseQueryMetric = performanceMonitoring.recordDatabaseQuery.bind(performanceMonitoring);
  recordFileOperationMetric = performanceMonitoring.recordFileOperation.bind(performanceMonitoring);
  recordMLInferenceMetric = performanceMonitoring.recordMLInference.bind(performanceMonitoring);
}

export function createPerformanceMonitoring(options?: any) {
  return performanceMonitoring;
}
