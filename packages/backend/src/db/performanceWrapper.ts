/**
 * Database Performance Wrapper
 *
 * Wraps database queries to automatically track performance metrics
 * including query duration, row counts, and slow query detection.
 */

import { Pool, PoolClient } from 'pg';
import performanceMonitor from '../services/performanceMonitor';
import logger from '../utils/logger';

/**
 * Wraps a pool client to track query performance
 */
export function wrapPoolClient(client: PoolClient): PoolClient {
  const originalQuery = client.query.bind(client);

  // Create a new query function that tracks performance
  const wrappedQuery = async function (...args: unknown[]): Promise<any> {
    const startTime = Date.now();
    let queryText = 'Unknown query';

    try {
      // Extract query text based on argument format
      if (args.length > 0) {
        if (typeof args[0] === 'string') {
          queryText = args[0];
        } else if (args[0] && typeof args[0] === 'object' && 'text' in args[0]) {
          queryText = (args[0] as any).text;
        }
      }

      // Call original query method with all arguments
      const result = await originalQuery.apply(client, args as any);

      // Calculate duration
      const duration = Date.now() - startTime;
      const rowCount = (result as any)?.rowCount || 0;

      // Record the metric
      performanceMonitor.recordDatabaseMetric(queryText, duration, rowCount);

      // Log slow queries
      if (duration > 100) {
        logger.debug('Slow database query detected', {
          query: queryText.substring(0, 200),
          duration,
          rowCount,
        });
      }

      return result;
    } catch (error) {
      // Still track failed queries
      const duration = Date.now() - startTime;

      performanceMonitor.recordDatabaseMetric(queryText, duration, 0);

      logger.error('Database query error', {
        query: queryText.substring(0, 200),
        duration,
        error,
      });

      throw error;
    }
  };

  // Override the query method
  client.query = wrappedQuery as any;

  return client;
}

/**
 * Wraps a database pool to track all query performance
 */
export function wrapPool(pool: Pool): Pool {
  const originalConnect = pool.connect.bind(pool);

  // Override connect to wrap returned clients
  pool.connect = async function (): Promise<PoolClient> {
    const client = await originalConnect();
    return wrapPoolClient(client);
  };

  // Also wrap the pool's direct query method
  const originalQuery = pool.query.bind(pool);

  pool.query = async function (...args: unknown[]): Promise<any> {
    const startTime = Date.now();
    let queryText = 'Unknown query';

    try {
      // Extract query text based on argument format
      if (args.length > 0) {
        if (typeof args[0] === 'string') {
          queryText = args[0];
        } else if (args[0] && typeof args[0] === 'object' && 'text' in args[0]) {
          queryText = (args[0] as any).text;
        }
      }

      // Call original query method with all arguments
      const result = await originalQuery.apply(pool, args as any);

      // Calculate duration
      const duration = Date.now() - startTime;
      const rowCount = (result as any)?.rowCount || 0;

      // Record the metric
      performanceMonitor.recordDatabaseMetric(queryText, duration, rowCount);

      return result;
    } catch (error) {
      // Still track failed queries
      const duration = Date.now() - startTime;

      performanceMonitor.recordDatabaseMetric(queryText, duration, 0);

      throw error;
    }
  };

  return pool;
}

/**
 * Create a performance-tracked pool
 */
export function createTrackedPool(poolConfig: any): Pool {
  const pool = new Pool(poolConfig);
  return wrapPool(pool);
}
