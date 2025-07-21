/**
 * Unified Database Access Layer
 *
 * This module consolidates all database operations, caching, monitoring,
 * and transaction handling into a single, consistent interface.
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import NodeCache from 'node-cache';
import config from '../config';
import performanceConfig from '../config/performance';
import logger from '../utils/logger';
import { monitorQuery } from '../monitoring/unified';
// import { wrapPool } from './performanceWrapper';

// =====================
// Cache Configuration
// =====================

// Single cache instance for all database operations
const unifiedCache = new NodeCache({
  stdTTL: 30, // Default 30 seconds for data
  checkperiod: 60, // Cleanup every 60 seconds
  useClones: false, // Better performance
});

// Schema cache with longer TTL
const schemaCache = new NodeCache({
  stdTTL: 300, // 5 minutes for schema
  checkperiod: 120,
  useClones: false,
});

// =====================
// Database Pool
// =====================

// Single database pool instance
let pool: Pool | null = null;

/**
 * Get or create the database pool
 */
export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env["DATABASE_URL"];

    const poolConfig = databaseUrl
      ? {
          connectionString: databaseUrl,
          ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
          max: performanceConfig.database.poolMax,
          min: performanceConfig.database.poolMin,
          idleTimeoutMillis: performanceConfig.database.idleTimeoutMs,
          connectionTimeoutMillis: performanceConfig.database.connectionTimeoutMs,
          allowExitOnIdle: performanceConfig.database.allowExitOnIdle,
        }
      : {
          host: config.db.host,
          port: config.db.port,
          database: config.db.database,
          user: config.db.user,
          password: config.db.password,
          ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
          max: performanceConfig.database.poolMax,
          min: performanceConfig.database.poolMin,
          idleTimeoutMillis: performanceConfig.database.idleTimeoutMs,
          connectionTimeoutMillis: performanceConfig.database.connectionTimeoutMs,
          allowExitOnIdle: performanceConfig.database.allowExitOnIdle,
        };

    pool = new Pool(poolConfig);

    // TODO: Re-enable performance tracking after fixing wrapper
    // pool = wrapPool(pool);

    pool.on('error', (err) => {
      logger.error('Database pool error', { error: err });
    });

    logger.info('Database pool created with performance tracking', {
      max: poolConfig.max,
      database: poolConfig.database || 'from DATABASE_URL',
    });
  }

  return pool;
}

// =====================
// Query Execution
// =====================

/**
 * Execute a database query with monitoring
 */
export async function query<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return monitorQuery(text, params || [], () => pool.query(text, params));
}

/**
 * Execute a cached query
 */
export async function cachedQuery<T extends Record<string, any> = any>(
  text: string,
  params?: any[],
  ttl?: number
): Promise<QueryResult<T>> {
  const cacheKey = `query:${text}:${JSON.stringify(params || [])}`;

  // Check cache first
  const cached = unifiedCache.get(cacheKey) as QueryResult<T> | undefined;
  if (cached) {
    return cached;
  }

  // Execute query with monitoring
  const result = await query<T>(text, params);

  // Cache the result
  if (ttl !== undefined) {
    unifiedCache.set(cacheKey, result, ttl);
  } else {
    unifiedCache.set(cacheKey, result);
  }

  return result;
}

// =====================
// Transaction Handling
// =====================

/**
 * Execute a function within a database transaction
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// =====================
// Schema Checking
// =====================

/**
 * Check if a table exists
 */
export async function checkTableExists(tableName: string): Promise<boolean> {
  const cacheKey = `table:${tableName}`;

  // Check schema cache
  const cached = schemaCache.get<boolean>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );

  const exists = result.rows[0]?.exists || false;
  schemaCache.set(cacheKey, exists);

  return exists;
}

/**
 * Check if a column exists in a table
 */
export async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const cacheKey = `column:${tableName}:${columnName}`;

  // Check schema cache
  const cached = schemaCache.get<boolean>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = $2
    )`,
    [tableName, columnName]
  );

  const exists = result.rows[0]?.exists || false;
  schemaCache.set(cacheKey, exists);

  return exists;
}

/**
 * Check if multiple columns exist in a table
 */
export async function checkColumnsExist(
  tableName: string,
  columnNames: string[]
): Promise<{ [column: string]: boolean }> {
  const results: { [column: string]: boolean } = {};

  // Check each column (could be optimized with a single query)
  for (const columnName of columnNames) {
    results[columnName] = await checkColumnExists(tableName, columnName);
  }

  return results;
}

// =====================
// Cache Management
// =====================

/**
 * Clear cache by pattern
 */
export function clearCacheByPattern(pattern: string): void {
  const keys = unifiedCache.keys();
  const keysToDelete = keys.filter((key) => key.includes(pattern));

  if (keysToDelete.length > 0) {
    unifiedCache.del(keysToDelete);
    logger.debug(`Cleared ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
  }
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  unifiedCache.flushAll();
  schemaCache.flushAll();
  logger.debug('Cleared all cache entries');
}

/**
 * Invalidate cache for a specific table
 */
export function invalidateTableCache(tableName: string): void {
  clearCacheByPattern(`table:${tableName}`);
  clearCacheByPattern(`column:${tableName}`);
}

// =====================
// Utility Functions
// =====================

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    data: {
      keys: unifiedCache.keys().length,
      hits: unifiedCache.getStats().hits,
      misses: unifiedCache.getStats().misses,
      hitRate:
        unifiedCache.getStats().hits /
          (unifiedCache.getStats().hits + unifiedCache.getStats().misses) || 0,
    },
    schema: {
      keys: schemaCache.keys().length,
      hits: schemaCache.getStats().hits,
      misses: schemaCache.getStats().misses,
      hitRate:
        schemaCache.getStats().hits /
          (schemaCache.getStats().hits + schemaCache.getStats().misses) || 0,
    },
  };
}

/**
 * Close the database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

// =====================
// Re-export common types
// =====================

export type { PoolClient, QueryResult } from 'pg';

// Default export for convenience
export default {
  query,
  cachedQuery,
  withTransaction,
  checkTableExists,
  checkColumnExists,
  checkColumnsExist,
  clearCacheByPattern,
  clearAllCache,
  invalidateTableCache,
  getCacheStats,
  getPool,
  closePool,
};
