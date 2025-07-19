/**
 * Database Monitoring Compatibility Layer
 *
 * This module provides backward compatibility for database monitoring
 * while using the unified monitoring system internally.
 */

import { getPool, withTransaction } from '../unified';
import { PoolClient } from 'pg';
import unifiedMonitoring from '../../monitoring/unified';

// Re-export unified monitoring functions with database-specific interface
const dbMonitoring = {
  // Monitored query functions
  query: async function(text: string, params?: unknown[]): Promise<any> {
    return unifiedMonitoring.monitorQuery(text, params || [], () => getPool().query(text, params));
  },
  withTransaction: async function <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    return withTransaction(async (client) => {
      const monitoredClient = unifiedMonitoring.wrapClientQuery(client);
      return callback(monitoredClient);
    });
  },

  // Metrics access
  registry: unifiedMonitoring.registry,
  getMetrics: unifiedMonitoring.getMetrics,
  getContentType: unifiedMonitoring.getMetricsContentType,

  // Pattern analysis
  getTopSlowQueries: unifiedMonitoring.getTopSlowQueries,
  getQueryPatternsByTable: unifiedMonitoring.getQueryPatternsByTable,
  getQueryFrequencyStats: unifiedMonitoring.getQueryFrequencyStats,
  resetPatternStats: unifiedMonitoring.resetPatternStats,

  // Events
  on: unifiedMonitoring.on,
  off: unifiedMonitoring.off,
  once: unifiedMonitoring.once,

  // Configuration
  setSlowQueryThreshold: (thresholdMs: number) => {
    // This would need to be implemented in unified monitoring if needed
    unifiedMonitoring.logger.info('Slow query threshold update requested', { thresholdMs });
  },

  // Initialization
  init: () => {
    // Already initialized by unified monitoring
    unifiedMonitoring.logger.info('Database monitoring initialized via unified system');
  },

  // Access to the underlying pool for metrics
  pool: getPool(),

  // Add monitorQuery for compatibility
  monitorQuery: unifiedMonitoring.monitorQuery,
};

export default dbMonitoring;
