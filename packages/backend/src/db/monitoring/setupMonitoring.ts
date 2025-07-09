/**
 * Database Monitoring Setup - Compatibility Layer
 *
 * This file is kept for backward compatibility but delegates to the unified monitoring system.
 */

import { Express } from 'express';
import dbMonitoring from './index';
import dbMonitoringMiddleware from '../../middleware/dbMonitoringMiddleware';
import { unifiedLogger } from '../../monitoring/unified';
import pool from '../optimized';

/**
 * Setup the database monitoring module
 */
export function setupDatabaseMonitoring(app: Express): void {
  try {
    // Initialize database monitoring (already done by unified system)
    dbMonitoring.init();

    // Add database monitoring middleware for metrics dashboard
    app.use(dbMonitoringMiddleware);

    // Setup pool metrics updates
    setInterval(() => {
      dbMonitoring.updatePoolMetrics(pool);
    }, 15000);

    unifiedLogger.info('Database monitoring setup complete');
  } catch (error) {
    unifiedLogger.error('Failed to set up database monitoring', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Set slow query threshold
 */
export function setSlowQueryThreshold(thresholdMs: number): void {
  dbMonitoring.setSlowQueryThreshold(thresholdMs);
  unifiedLogger.info('Slow query threshold set', { thresholdMs });
}

export default {
  setupDatabaseMonitoring,
  setSlowQueryThreshold,
};
