/**
 * Database Monitoring Setup
 *
 * Initializes and sets up the database monitoring module
 * by integrating it with the application server.
 */

import { Express } from 'express';
import { PoolClient } from 'pg';
import dbMonitoring from './index';
import prometheusIntegration from './prometheusIntegration';
import dbMonitoringMiddleware from '../../middleware/dbMonitoringMiddleware';
import logger from '../../utils/logger';
import pool from '../optimized';

/**
 * Initialize a monitored connection pool by patching the pool methods
 */
function setupMonitoredPool(): void {
  // Get the original connect method to preserve functionality
  const originalConnect = pool.connect.bind(pool);
  // This variable is needed to preserve the original query method, but we're fully replacing it
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const originalQuery = pool.query.bind(pool);

  // Override the query method to monitor all queries - no need to maintain reference to original query
  // as we're completely replacing it with our monitored version
  // TypeScript complains about overriding the method, hence we need to use a type assertion
  (pool as Record<string, unknown>).query = function <T>(...args: unknown[]): Promise<T> {
    const queryText = typeof args[0] === 'string' ? args[0] : (args[0] as Record<string, unknown>)?.text as string;
    const params = typeof args[0] === 'string' ? args[1] || [] : (args[0] as Record<string, unknown>)?.values || [];

    return dbMonitoring.query(queryText, params);
  };

  // Override the connect method to wrap client with monitoring
  (pool as Record<string, unknown>).connect = async function (): Promise<PoolClient> {
    const client = await originalConnect();

    // Wrap the client query method with monitoring
    const originalClientQuery = client.query.bind(client);
    (client as Record<string, unknown>).query = function <T>(...args: unknown[]): Promise<T> {
      const queryText = typeof args[0] === 'string' ? args[0] : (args[0] as Record<string, unknown>)?.text;
      const params = typeof args[0] === 'string' ? args[1] || [] : args[0]?.values || [];

      return dbMonitoring.monitorQuery(queryText, params, () => originalClientQuery(...args));
    };

    return client;
  };

  logger.info('Database pool monitoring enabled');
}

/**
 * Setup the database monitoring module
 */
export function setupDatabaseMonitoring(app: Express): void {
  try {
    // Initialize database monitoring
    dbMonitoring.init();

    // Integrate with Prometheus metrics
    prometheusIntegration.integrateWithAppMetrics();

    // Set up monitored pool
    setupMonitoredPool();

    // Add database monitoring middleware for metrics dashboard
    app.use(dbMonitoringMiddleware);

    logger.info('Database monitoring setup complete');
  } catch (error) {
    logger.error('Failed to set up database monitoring', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Set slow query threshold
 */
export function setSlowQueryThreshold(thresholdMs: number): void {
  dbMonitoring.setSlowQueryThreshold(thresholdMs);
  logger.info('Slow query threshold set', { thresholdMs });
}

export default {
  setupDatabaseMonitoring,
  setSlowQueryThreshold,
};
