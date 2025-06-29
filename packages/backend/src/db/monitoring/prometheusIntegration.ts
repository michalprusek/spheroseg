/**
 * Database Monitoring - Prometheus Integration Compatibility Layer
 *
 * This file is kept for backward compatibility but uses the unified monitoring system.
 */

import { unifiedLogger } from '../../monitoring/unified';
import dbMonitoring from './index';

/**
 * Register database metrics with the application's Prometheus registry
 */
export function integrateWithAppMetrics(): void {
  // Metrics are already integrated in the unified monitoring system
  unifiedLogger.info('Database metrics already integrated with unified Prometheus registry');
}

/**
 * Initialize database metrics collection
 */
export function initDbMetricsCollection(): void {
  // Initialize the database monitoring
  dbMonitoring.init();
  
  // Integration is automatic with unified registry
  unifiedLogger.info('Database metrics collection initialized via unified monitoring');
}

export default {
  integrateWithAppMetrics,
  initDbMetricsCollection,
};