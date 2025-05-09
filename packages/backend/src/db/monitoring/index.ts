/**
 * Database Monitoring Module
 * 
 * A comprehensive monitoring system for database operations that provides:
 * - Query performance tracking
 * - Slow query logging
 * - Query pattern collection and analysis
 * - Prometheus metrics integration
 * - Event emitter for metrics integration
 */

import { Registry, Summary, Histogram, Counter, Gauge } from 'prom-client';
import pool from '../optimized';
import logger from '../../utils/logger';
import { PoolClient, QueryResult } from 'pg';
import NodeCache from 'node-cache';
import { EventEmitter } from 'events';
import { MetricType, DatabaseQueryMetric } from '../../../shared/monitoring/metricsTypes';

// Configuration
const SLOW_QUERY_THRESHOLD_MS = 500; // Queries taking longer than 500ms are considered slow
const PATTERN_CACHE_SIZE = 1000; // Maximum number of query patterns to track
const PATTERN_HISTORY_LENGTH = 100; // Number of executions to track per pattern
const METRICS_FLUSH_INTERVAL_MS = 60000; // Flush metrics to Prometheus every minute

// Specialized cache for storing query patterns and their execution statistics
const patternCache = new NodeCache({
  stdTTL: 86400, // 24 hours
  checkperiod: 3600, // Check for expired items every hour
  useClones: false,
  maxKeys: PATTERN_CACHE_SIZE
});

// Create a Prometheus registry for database metrics
const dbMetricsRegistry = new Registry();

// Create an event emitter for metrics
const metricsEmitter = new EventEmitter();

// Create database metrics
const queryDurationHistogram = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [dbMetricsRegistry]
});

const queryThroughputCounter = new Counter({
  name: 'db_query_throughput_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [dbMetricsRegistry]
});

const slowQueryCounter = new Counter({
  name: 'db_slow_query_total',
  help: 'Total number of slow database queries (> 500ms)',
  labelNames: ['operation', 'table'],
  registers: [dbMetricsRegistry]
});

const queryRowsHistogram = new Histogram({
  name: 'db_query_rows',
  help: 'Number of rows returned or affected by database queries',
  labelNames: ['operation', 'table'],
  buckets: [0, 1, 5, 10, 50, 100, 500, 1000, 5000, 10000],
  registers: [dbMetricsRegistry]
});

const connectionPoolGauge = new Gauge({
  name: 'db_connection_pool',
  help: 'Database connection pool statistics',
  labelNames: ['state'], // total, idle, used, waiting, etc.
  registers: [dbMetricsRegistry]
});

const queryPatternCounter = new Counter({
  name: 'db_query_pattern_total',
  help: 'Total executions by query pattern',
  labelNames: ['pattern_id', 'operation'],
  registers: [dbMetricsRegistry]
});

/**
 * Extract operation type (SELECT, INSERT, UPDATE, DELETE, etc.) from query
 */
function extractOperationType(query: string): string {
  const normalizedQuery = query.trim().toUpperCase();
  
  if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
  if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
  if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
  if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
  if (normalizedQuery.startsWith('CREATE')) return 'CREATE';
  if (normalizedQuery.startsWith('ALTER')) return 'ALTER';
  if (normalizedQuery.startsWith('DROP')) return 'DROP';
  if (normalizedQuery.startsWith('TRUNCATE')) return 'TRUNCATE';
  if (normalizedQuery.startsWith('BEGIN')) return 'TRANSACTION';
  if (normalizedQuery.startsWith('COMMIT')) return 'TRANSACTION';
  if (normalizedQuery.startsWith('ROLLBACK')) return 'TRANSACTION';
  
  return 'OTHER';
}

/**
 * Extract table names from a query
 */
function extractTables(query: string): string[] {
  const tables: string[] = [];
  const normalizedQuery = query.trim().toUpperCase();
  
  // Extract tables mentioned after FROM
  const fromRegex = /\bFROM\s+([a-zA-Z0-9_"]+)/gi;
  let match;
  while ((match = fromRegex.exec(normalizedQuery)) !== null) {
    tables.push(match[1].replace(/"/g, '').toLowerCase());
  }
  
  // Extract tables mentioned after JOIN
  const joinRegex = /\bJOIN\s+([a-zA-Z0-9_"]+)/gi;
  while ((match = joinRegex.exec(normalizedQuery)) !== null) {
    tables.push(match[1].replace(/"/g, '').toLowerCase());
  }
  
  // Extract tables mentioned after UPDATE
  const updateRegex = /\bUPDATE\s+([a-zA-Z0-9_"]+)/gi;
  while ((match = updateRegex.exec(normalizedQuery)) !== null) {
    tables.push(match[1].replace(/"/g, '').toLowerCase());
  }
  
  // Extract tables mentioned after INSERT INTO
  const insertRegex = /\bINSERT\s+INTO\s+([a-zA-Z0-9_"]+)/gi;
  while ((match = insertRegex.exec(normalizedQuery)) !== null) {
    tables.push(match[1].replace(/"/g, '').toLowerCase());
  }
  
  // Extract tables mentioned after DELETE FROM
  const deleteRegex = /\bDELETE\s+FROM\s+([a-zA-Z0-9_"]+)/gi;
  while ((match = deleteRegex.exec(normalizedQuery)) !== null) {
    tables.push(match[1].replace(/"/g, '').toLowerCase());
  }
  
  // Remove duplicates
  return [...new Set(tables)];
}

/**
 * Normalize a query to identify patterns
 * Replaces literal values with placeholders
 */
function normalizeQuery(query: string): string {
  return query
    .replace(/\s+/g, ' ')                   // Normalize whitespace
    .replace(/\$\d+/g, '$n')                // Normalize parameterized queries
    .replace(/'[^']*'/g, "'?'")             // Replace string literals
    .replace(/\b\d+\b/g, "?")               // Replace numeric literals
    .replace(/\b(true|false)\b/gi, "?")     // Replace boolean literals
    .trim();
}

/**
 * Generate a unique ID for a query pattern
 */
function generatePatternId(normalizedQuery: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalizedQuery.length; i++) {
    const char = normalizedQuery.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `pattern_${Math.abs(hash).toString(16)}`;
}

/**
 * Interface for pattern statistics
 */
interface QueryPatternStats {
  patternId: string;
  normalized: string;
  operation: string;
  tables: string[];
  executions: {
    timestamp: number;
    durationMs: number;
    rowCount?: number;
    query: string;
  }[];
  totalExecutions: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  lastExecuted: number;
}

/**
 * Initialize or update statistics for a query pattern
 */
function updateQueryPatternStats(
  query: string, 
  durationMs: number, 
  rowCount?: number
): QueryPatternStats {
  const normalizedQuery = normalizeQuery(query);
  const patternId = generatePatternId(normalizedQuery);
  const operation = extractOperationType(query);
  const tables = extractTables(query);
  
  // Get existing stats or initialize new ones
  let stats: QueryPatternStats = patternCache.get(patternId) || {
    patternId,
    normalized: normalizedQuery,
    operation,
    tables,
    executions: [],
    totalExecutions: 0,
    avgDurationMs: 0,
    maxDurationMs: 0,
    minDurationMs: durationMs,
    lastExecuted: Date.now()
  };
  
  // Add new execution (keeping limited history)
  stats.executions.push({
    timestamp: Date.now(),
    durationMs,
    rowCount,
    query
  });
  
  // Keep only the most recent executions
  if (stats.executions.length > PATTERN_HISTORY_LENGTH) {
    stats.executions = stats.executions.slice(-PATTERN_HISTORY_LENGTH);
  }
  
  // Update statistics
  stats.totalExecutions++;
  stats.lastExecuted = Date.now();
  stats.maxDurationMs = Math.max(stats.maxDurationMs, durationMs);
  stats.minDurationMs = Math.min(stats.minDurationMs, durationMs);
  
  // Recalculate average duration
  const totalDuration = stats.executions.reduce((sum, exec) => sum + exec.durationMs, 0);
  stats.avgDurationMs = totalDuration / stats.executions.length;
  
  // Store updated stats
  patternCache.set(patternId, stats);
  
  // Update Prometheus counter for this pattern
  queryPatternCounter.inc({ pattern_id: patternId, operation }, 1);
  
  return stats;
}

/**
 * Track a database query and collect metrics
 */
async function monitorQuery<T>(
  queryText: string,
  params: any[],
  queryFn: () => Promise<QueryResult<T>>
): Promise<QueryResult<T>> {
  const startTime = Date.now();
  const operation = extractOperationType(queryText);
  const tables = extractTables(queryText);
  const primaryTable = tables.length > 0 ? tables[0] : 'unknown';
  
  try {
    // Execute the query
    const result = await queryFn();
    
    // Calculate duration
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    
    // Record metrics
    queryDurationHistogram.observe(
      { operation, table: primaryTable, status: 'success' }, 
      durationSec
    );
    
    queryThroughputCounter.inc(
      { operation, table: primaryTable, status: 'success' }, 
      1
    );
    
    if (result.rows) {
      queryRowsHistogram.observe(
        { operation, table: primaryTable }, 
        result.rowCount || 0
      );
    }
    
    // Check for slow queries
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      slowQueryCounter.inc({ operation, table: primaryTable }, 1);
      
      // Log slow query
      logger.warn('Slow query detected', {
        query: queryText,
        params,
        duration_ms: durationMs,
        threshold_ms: SLOW_QUERY_THRESHOLD_MS,
        operation,
        table: primaryTable,
        rows: result.rowCount
      });
    }
    
    // Update query pattern statistics
    updateQueryPatternStats(queryText, durationMs, result.rowCount);
    
    // Emit database query metric event
    const metricData: DatabaseQueryMetric = {
      type: MetricType.DATABASE_QUERY,
      timestamp: Date.now(),
      value: durationMs,
      operation,
      table: primaryTable,
      duration: durationMs,
      rowCount: result.rowCount || 0,
      labels: {
        status: 'success',
        pattern_id: generatePatternId(normalizeQuery(queryText))
      }
    };
    
    metricsEmitter.emit(MetricType.DATABASE_QUERY, metricData);
    
    return result;
  } catch (error) {
    // Calculate duration even for failed queries
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    
    // Record error metrics
    queryDurationHistogram.observe(
      { operation, table: primaryTable, status: 'error' }, 
      durationSec
    );
    
    queryThroughputCounter.inc(
      { operation, table: primaryTable, status: 'error' }, 
      1
    );
    
    // Log the error with query details
    logger.error('Database query error', {
      query: queryText,
      params,
      duration_ms: durationMs,
      operation,
      table: primaryTable,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Update query pattern statistics
    updateQueryPatternStats(queryText, durationMs);
    
    // Emit database query metric event with error
    const metricData: DatabaseQueryMetric = {
      type: MetricType.DATABASE_QUERY,
      timestamp: Date.now(),
      value: durationMs,
      operation,
      table: primaryTable,
      duration: durationMs,
      rowCount: 0,
      labels: {
        status: 'error',
        pattern_id: generatePatternId(normalizeQuery(queryText)),
        error: error instanceof Error ? error.message : String(error)
      }
    };
    
    metricsEmitter.emit(MetricType.DATABASE_QUERY, metricData);
    
    // Re-throw the error
    throw error;
  }
}

/**
 * Monitored version of the database query function
 */
async function monitoredQuery<T>(
  queryText: string, 
  params: any[] = []
): Promise<QueryResult<T>> {
  return monitorQuery(
    queryText, 
    params, 
    () => pool.query(queryText, params)
  );
}

/**
 * Monitored version of client query for transactions
 */
function wrapClientQuery(client: PoolClient): PoolClient {
  const originalQuery = client.query.bind(client);
  
  // Override the query method
  client.query = function<T>(textOrConfig: string | any, values?: any): Promise<QueryResult<T>> {
    const queryText = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    const params = values || (typeof textOrConfig === 'string' ? [] : textOrConfig.values || []);
    
    return monitorQuery(
      queryText,
      params,
      () => originalQuery(textOrConfig, values)
    );
  };
  
  return client;
}

/**
 * Monitored version of the transaction helper
 */
async function monitoredTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  const monitoredClient = wrapClientQuery(client);
  
  try {
    await monitoredClient.query('BEGIN');
    const result = await callback(monitoredClient);
    await monitoredClient.query('COMMIT');
    return result;
  } catch (error) {
    await monitoredClient.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update connection pool metrics based on current pool state
 */
function updatePoolMetrics() {
  // Using an any type because the internal properties are not exposed in the type definitions
  const poolState = (pool as any)._pulseQueue;
  
  if (poolState && typeof poolState.getStats === 'function') {
    const stats = poolState.getStats();
    
    connectionPoolGauge.set({ state: 'total' }, stats.total);
    connectionPoolGauge.set({ state: 'idle' }, stats.idle);
    connectionPoolGauge.set({ state: 'waiting' }, stats.waiting);
    connectionPoolGauge.set({ state: 'size' }, stats.size);
  } else {
    // Fallback to basic metrics if pool doesn't expose detailed stats
    connectionPoolGauge.set({ state: 'total' }, pool.totalCount);
    connectionPoolGauge.set({ state: 'idle' }, pool.idleCount);
    connectionPoolGauge.set({ state: 'waiting' }, pool.waitingCount);
  }
}

/**
 * Get the top N slow query patterns
 */
function getTopSlowQueries(limit: number = 10): QueryPatternStats[] {
  const patterns = patternCache.keys().map(key => patternCache.get<QueryPatternStats>(key)!);
  
  // Sort by average duration (descending)
  return patterns
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, limit);
}

/**
 * Get query patterns by table
 */
function getQueryPatternsByTable(table: string): QueryPatternStats[] {
  const patterns = patternCache.keys().map(key => patternCache.get<QueryPatternStats>(key)!);
  
  return patterns.filter(pattern => 
    pattern.tables.some(t => t.toLowerCase() === table.toLowerCase())
  );
}

/**
 * Get query frequency statistics
 */
function getQueryFrequencyStats(): Record<string, number> {
  const patterns = patternCache.keys().map(key => patternCache.get<QueryPatternStats>(key)!);
  const stats: Record<string, number> = {};
  
  // Group by operation type
  patterns.forEach(pattern => {
    if (!stats[pattern.operation]) {
      stats[pattern.operation] = 0;
    }
    stats[pattern.operation] += pattern.totalExecutions;
  });
  
  return stats;
}

/**
 * Reset all pattern statistics
 */
function resetPatternStats(): void {
  patternCache.flushAll();
}

/**
 * Initialize database monitoring
 */
function initDatabaseMonitoring(): void {
  // Update pool metrics every 15 seconds
  setInterval(updatePoolMetrics, 15000);
  
  // Initialize first pool metrics reading
  updatePoolMetrics();
  
  // Log initialization
  logger.info('Database monitoring initialized', {
    slow_query_threshold_ms: SLOW_QUERY_THRESHOLD_MS,
    metrics_registry: 'enabled'
  });
}

// Export the database monitoring interface
export default {
  // Monitored query functions
  query: monitoredQuery,
  withTransaction: monitoredTransaction,
  
  // Metrics access
  registry: dbMetricsRegistry,
  getMetrics: async () => dbMetricsRegistry.metrics(),
  getContentType: () => dbMetricsRegistry.contentType,
  
  // Pattern analysis
  getTopSlowQueries,
  getQueryPatternsByTable,
  getQueryFrequencyStats,
  resetPatternStats,
  
  // Events
  on: (event: string, listener: (...args: any[]) => void) => metricsEmitter.on(event, listener),
  off: (event: string, listener: (...args: any[]) => void) => metricsEmitter.off(event, listener),
  once: (event: string, listener: (...args: any[]) => void) => metricsEmitter.once(event, listener),
  
  // Configuration
  setSlowQueryThreshold: (thresholdMs: number) => {
    if (thresholdMs > 0) {
      SLOW_QUERY_THRESHOLD_MS = thresholdMs;
    }
  },
  
  // Initialization
  init: initDatabaseMonitoring,
  
  // Access to the underlying pool for metrics
  pool
};