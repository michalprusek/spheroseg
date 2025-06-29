/**
 * Compatibility export for unified monitoring system
 * 
 * This file maintains backward compatibility while transitioning to the unified monitoring system.
 * All exports are now proxied from the unified module.
 */

import unifiedMonitoring from './unified';

// Re-export everything from unified monitoring
export const {
  logger,
  requestLoggerMiddleware,
  errorHandlerMiddleware,
  measureDatabaseQuery,
  measureMlServiceRequest,
  updateSegmentationQueueSize,
  getMetrics,
} = unifiedMonitoring;

// Default export for compatibility
export default unifiedMonitoring;