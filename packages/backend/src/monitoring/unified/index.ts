/**
 * Unified Monitoring System
 *
 * This module combines all monitoring functionality from:
 * - General monitoring (logging, HTTP, errors)
 * - Performance monitoring (system metrics, performance tracking)
 * - Database monitoring (query patterns, slow queries, connection pools)
 *
 * All metrics use a single Prometheus registry for consistency.
 */

import { Request as ExpressRequest, Response, NextFunction } from 'express';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { EventEmitter } from 'events';
import { PoolClient, QueryResult } from 'pg';
import NodeCache from 'node-cache';
import config from '../../config';
import {
  MetricType,
  PerformanceMonitoringOptions,
  ApiResponseTimeMetric,
  DatabaseQueryMetric,
  FileOperationMetric,
  MLInferenceMetric,
  MemoryHeapMetric,
  CPUUsageMetric,
} from '@spheroseg/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

type Request = ExpressRequest;

// Configuration
const LOG_LEVEL = config.logging.level || 'info';
const METRICS_ENABLED = config.monitoring.metricsEnabled !== false;
const METRICS_PREFIX = config.monitoring.metricsPrefix || 'spheroseg_';
const REQUEST_TIMEOUT_MS = config.monitoring.requestTimeoutMs || 30000;
const SLOW_QUERY_THRESHOLD_MS = 500;
const PATTERN_CACHE_SIZE = 1000;
const PATTERN_HISTORY_LENGTH = 100;

// Create single unified Prometheus registry
export const unifiedRegistry = new Registry();

// Collect default metrics
collectDefaultMetrics({
  register: unifiedRegistry,
  prefix: METRICS_PREFIX,
});

// Event emitter for metrics integration
export const metricsEmitter = new EventEmitter();

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Initialize Winston logger
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'spheroseg-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...rest }) => {
          const meta = Object.keys(rest).length ? JSON.stringify(rest) : '';
          return `${timestamp} [${level}]: ${message} ${meta}`;
        })
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Create all metrics with single registry
// HTTP Metrics
const httpRequestDurationHistogram = new Histogram({
  name: `${METRICS_PREFIX}http_request_duration_seconds`,
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [unifiedRegistry],
});

const httpRequestCounter = new Counter({
  name: `${METRICS_PREFIX}http_requests_total`,
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [unifiedRegistry],
});

const httpErrorCounter = new Counter({
  name: `${METRICS_PREFIX}http_errors_total`,
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code', 'error_type'],
  registers: [unifiedRegistry],
});

// Database Metrics
const databaseQueryDurationHistogram = new Histogram({
  name: `${METRICS_PREFIX}database_query_duration_seconds`,
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [unifiedRegistry],
});

const databaseErrorCounter = new Counter({
  name: `${METRICS_PREFIX}database_errors_total`,
  help: 'Total number of database errors',
  labelNames: ['operation', 'table', 'error_type'],
  registers: [unifiedRegistry],
});

const slowQueryCounter = new Counter({
  name: `${METRICS_PREFIX}slow_query_total`,
  help: 'Total number of slow database queries (> 500ms)',
  labelNames: ['operation', 'table'],
  registers: [unifiedRegistry],
});

const queryRowsHistogram = new Histogram({
  name: `${METRICS_PREFIX}query_rows`,
  help: 'Number of rows returned or affected by database queries',
  labelNames: ['operation', 'table'],
  buckets: [0, 1, 5, 10, 50, 100, 500, 1000, 5000, 10000],
  registers: [unifiedRegistry],
});

const connectionPoolGauge = new Gauge({
  name: `${METRICS_PREFIX}connection_pool`,
  help: 'Database connection pool statistics',
  labelNames: ['state'],
  registers: [unifiedRegistry],
});

const queryPatternCounter = new Counter({
  name: `${METRICS_PREFIX}query_pattern_total`,
  help: 'Total executions by query pattern',
  labelNames: ['pattern_id', 'operation'],
  registers: [unifiedRegistry],
});

// ML Service Metrics
const mlServiceRequestDurationHistogram = new Histogram({
  name: `${METRICS_PREFIX}ml_service_request_duration_seconds`,
  help: 'Duration of ML service requests in seconds',
  labelNames: ['endpoint', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [unifiedRegistry],
});

const mlServiceErrorCounter = new Counter({
  name: `${METRICS_PREFIX}ml_service_errors_total`,
  help: 'Total number of ML service errors',
  labelNames: ['endpoint', 'error_type'],
  registers: [unifiedRegistry],
});

// System Metrics
const activeRequestsGauge = new Gauge({
  name: `${METRICS_PREFIX}active_requests`,
  help: 'Number of active requests',
  registers: [unifiedRegistry],
});

const segmentationQueueSizeGauge = new Gauge({
  name: `${METRICS_PREFIX}segmentation_queue_size`,
  help: 'Size of the segmentation queue',
  labelNames: ['status'],
  registers: [unifiedRegistry],
});

const memoryHeapTotalGauge = new Gauge({
  name: `${METRICS_PREFIX}memory_heap_total_bytes`,
  help: 'Node.js heap total size in bytes',
  registers: [unifiedRegistry],
});

const memoryHeapUsedGauge = new Gauge({
  name: `${METRICS_PREFIX}memory_heap_used_bytes`,
  help: 'Node.js heap used size in bytes',
  registers: [unifiedRegistry],
});

const memoryRssGauge = new Gauge({
  name: `${METRICS_PREFIX}memory_rss_bytes`,
  help: 'Node.js RSS memory usage in bytes',
  registers: [unifiedRegistry],
});

const cpuUsageGauge = new Gauge({
  name: `${METRICS_PREFIX}cpu_usage_percent`,
  help: 'Node.js CPU usage percentage',
  registers: [unifiedRegistry],
});

// Query pattern cache
const patternCache = new NodeCache({
  stdTTL: 86400, // 24 hours
  checkperiod: 3600, // Check every hour
  useClones: false,
  maxKeys: PATTERN_CACHE_SIZE,
});

// Query pattern statistics interface
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

// CPU usage tracking
let cpuUsageLastSample: {
  user: number;
  system: number;
  idle: number;
} | null = null;

/**
 * Monitoring class for singleton pattern
 */
class UnifiedMonitoring {
  private static instance: UnifiedMonitoring | null = null;
  private metricsQueue: any[] = [];
  private flushInterval: NodeJS.Timer | null = null;
  private options: PerformanceMonitoringOptions;

  constructor(options: Partial<PerformanceMonitoringOptions> = {}) {
    this.options = {
      enabled: METRICS_ENABLED,
      flushInterval: 60000, // 1 minute
      maxMetricsInQueue: 1000,
      consoleLogging: false,
      globalLabels: {
        app: 'backend',
        environment: process.env.NODE_ENV || 'development',
      },
      ...options,
    };

    if (this.options.enabled) {
      this.startSystemMonitoring();
      this.startFlushInterval();
    }
  }

  static getInstance(options?: Partial<PerformanceMonitoringOptions>): UnifiedMonitoring {
    if (!UnifiedMonitoring.instance) {
      UnifiedMonitoring.instance = new UnifiedMonitoring(options);
    }
    return UnifiedMonitoring.instance;
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    // Monitor memory usage
    setInterval(() => {
      this.recordMemoryHeapMetric();
    }, 30000); // Every 30 seconds

    // Monitor CPU usage
    setInterval(() => {
      this.recordCPUUsageMetric();
    }, 30000); // Every 30 seconds
  }

  /**
   * Start flush interval
   */
  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, this.options.flushInterval);
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: any): void {
    if (!this.options.enabled) return;

    this.metricsQueue.push(metric);

    if (this.metricsQueue.length >= this.options.maxMetricsInQueue) {
      this.flushMetrics();
    }

    if (this.options.consoleLogging) {
      console.log('Metric recorded:', metric);
    }
  }

  /**
   * Flush metrics
   */
  private async flushMetrics(): Promise<void> {
    if (!this.options.enabled || this.metricsQueue.length === 0) return;

    const metrics = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      // In production, send to monitoring service
      if (this.options.consoleLogging) {
        console.log(`Flushing ${metrics.length} metrics`);
      }
    } catch (error) {
      console.error('Error flushing metrics:', error);
      // Put metrics back in queue
      this.metricsQueue = [...metrics, ...this.metricsQueue];
    }
  }

  /**
   * Record memory heap metric
   */
  private recordMemoryHeapMetric(): void {
    if (!this.options.enabled) return;

    try {
      const memoryUsage = process.memoryUsage();

      memoryHeapTotalGauge.set(memoryUsage.heapTotal);
      memoryHeapUsedGauge.set(memoryUsage.heapUsed);
      memoryRssGauge.set(memoryUsage.rss);

      const metric: MemoryHeapMetric = {
        type: MetricType.MEMORY_HEAP,
        timestamp: Date.now(),
        value: memoryUsage.heapUsed,
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      };

      this.recordMetric(metric);
      metricsEmitter.emit(MetricType.MEMORY_HEAP, metric);
    } catch (e) {
      console.error('Error recording memory metrics:', e);
    }
  }

  /**
   * Record CPU usage metric
   */
  private recordCPUUsageMetric(): void {
    if (!this.options.enabled) return;

    try {
      const cpus = os.cpus();
      const totalUser = cpus.reduce((acc, cpu) => acc + cpu.times.user, 0);
      const totalSystem = cpus.reduce((acc, cpu) => acc + cpu.times.sys, 0);
      const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);

      if (cpuUsageLastSample) {
        const userDiff = totalUser - cpuUsageLastSample.user;
        const systemDiff = totalSystem - cpuUsageLastSample.system;
        const idleDiff = totalIdle - cpuUsageLastSample.idle;
        const totalDiff = userDiff + systemDiff + idleDiff;

        const userPercentage = (userDiff / totalDiff) * 100;
        const systemPercentage = (systemDiff / totalDiff) * 100;
        const totalPercentage = ((userDiff + systemDiff) / totalDiff) * 100;

        cpuUsageGauge.set(totalPercentage);

        const metric: CPUUsageMetric = {
          type: MetricType.CPU_USAGE,
          timestamp: Date.now(),
          value: totalPercentage,
          user: userPercentage,
          system: systemPercentage,
          percentage: totalPercentage,
        };

        this.recordMetric(metric);
        metricsEmitter.emit(MetricType.CPU_USAGE, metric);
      }

      cpuUsageLastSample = {
        user: totalUser,
        system: totalSystem,
        idle: totalIdle,
      };
    } catch (e) {
      console.error('Error recording CPU metrics:', e);
    }
  }

  /**
   * Public methods for recording metrics
   */
  recordApiResponseTime(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userId?: string
  ): void {
    if (!this.options.enabled) return;

    const metric: ApiResponseTimeMetric = {
      type: MetricType.API_RESPONSE_TIME,
      timestamp: Date.now(),
      value: responseTime,
      endpoint,
      method,
      statusCode,
      responseTime,
      userId,
    };

    this.recordMetric(metric);
    metricsEmitter.emit(MetricType.API_RESPONSE_TIME, metric);
  }

  recordDatabaseQuery(operation: string, table: string, duration: number, rowCount?: number): void {
    if (!this.options.enabled) return;

    const metric: DatabaseQueryMetric = {
      type: MetricType.DATABASE_QUERY,
      timestamp: Date.now(),
      value: duration,
      operation,
      table,
      duration,
      rowCount,
    };

    this.recordMetric(metric);
    metricsEmitter.emit(MetricType.DATABASE_QUERY, metric);
  }

  recordFileOperation(
    operation: string,
    filePath: string,
    duration: number,
    fileSize?: number
  ): void {
    if (!this.options.enabled) return;

    const metric: FileOperationMetric = {
      type: MetricType.FILE_OPERATION,
      timestamp: Date.now(),
      value: duration,
      operation,
      filePath,
      duration,
      fileSize,
    };

    this.recordMetric(metric);
    metricsEmitter.emit(MetricType.FILE_OPERATION, metric);
  }

  recordMLInference(
    model: string,
    inputSize: number,
    duration: number,
    memoryUsage?: number
  ): void {
    if (!this.options.enabled) return;

    const metric: MLInferenceMetric = {
      type: MetricType.ML_INFERENCE,
      timestamp: Date.now(),
      value: duration,
      model,
      inputSize,
      duration,
      memoryUsage,
    };

    this.recordMetric(metric);
    metricsEmitter.emit(MetricType.ML_INFERENCE, metric);
  }
}

// Create singleton instance
const monitoring = UnifiedMonitoring.getInstance();

/**
 * Extract operation type from SQL query
 */
function extractOperationType(query: string): string {
  if (typeof query !== 'string') {
    return 'UNKNOWN';
  }
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
 * Extract table names from query
 */
function extractTables(query: string): string[] {
  if (typeof query !== 'string') {
    return [];
  }
  const tables: string[] = [];
  const normalizedQuery = query.trim().toUpperCase();

  // Extract tables from various SQL clauses
  const patterns = [
    /\bFROM\s+([a-zA-Z0-9_"]+)/gi,
    /\bJOIN\s+([a-zA-Z0-9_"]+)/gi,
    /\bUPDATE\s+([a-zA-Z0-9_"]+)/gi,
    /\bINSERT\s+INTO\s+([a-zA-Z0-9_"]+)/gi,
    /\bDELETE\s+FROM\s+([a-zA-Z0-9_"]+)/gi,
  ];

  patterns.forEach((regex) => {
    let match;
    while ((match = regex.exec(normalizedQuery)) !== null) {
      tables.push(match[1].replace(/"/g, '').toLowerCase());
    }
  });

  return [...new Set(tables)];
}

/**
 * Normalize query for pattern matching
 */
function normalizeQuery(query: string): string {
  if (typeof query !== 'string') {
    return '';
  }
  return query
    .replace(/\s+/g, ' ')
    .replace(/\$\d+/g, '$n')
    .replace(/'[^']*'/g, "'?'")
    .replace(/\b\d+\b/g, '?')
    .replace(/\b(true|false)\b/gi, '?')
    .trim();
}

/**
 * Generate pattern ID
 */
function generatePatternId(normalizedQuery: string): string {
  let hash = 0;
  for (let i = 0; i < normalizedQuery.length; i++) {
    const char = normalizedQuery.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `pattern_${Math.abs(hash).toString(16)}`;
}

/**
 * Update query pattern statistics
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

  const stats: QueryPatternStats = patternCache.get(patternId) || {
    patternId,
    normalized: normalizedQuery,
    operation,
    tables,
    executions: [],
    totalExecutions: 0,
    avgDurationMs: 0,
    maxDurationMs: 0,
    minDurationMs: durationMs,
    lastExecuted: Date.now(),
  };

  stats.executions.push({
    timestamp: Date.now(),
    durationMs,
    rowCount,
    query,
  });

  if (stats.executions.length > PATTERN_HISTORY_LENGTH) {
    stats.executions = stats.executions.slice(-PATTERN_HISTORY_LENGTH);
  }

  stats.totalExecutions++;
  stats.lastExecuted = Date.now();
  stats.maxDurationMs = Math.max(stats.maxDurationMs, durationMs);
  stats.minDurationMs = Math.min(stats.minDurationMs, durationMs);

  const totalDuration = stats.executions.reduce((sum, exec) => sum + exec.durationMs, 0);
  stats.avgDurationMs = totalDuration / stats.executions.length;

  patternCache.set(patternId, stats);
  queryPatternCounter.inc({ pattern_id: patternId, operation }, 1);

  return stats;
}

/**
 * Middleware for request logging
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = uuidv4();
  req.requestId = requestId;

  const startTime = Date.now();
  req.startTime = startTime;

  logger.info(`HTTP ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  if (METRICS_ENABLED) {
    activeRequestsGauge.inc();
  }

  const timeoutId = setTimeout(() => {
    logger.warn(`Request timeout: HTTP ${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      elapsedMs: Date.now() - startTime,
    });
  }, REQUEST_TIMEOUT_MS);

  res.on('finish', () => {
    clearTimeout(timeoutId);

    const duration = (Date.now() - startTime) / 1000;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel](`HTTP ${req.method} ${req.path} ${res.statusCode}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationSeconds: duration,
    });

    if (METRICS_ENABLED) {
      const route = req.route?.path || 'unknown';

      httpRequestDurationHistogram
        .labels(req.method, route, res.statusCode.toString())
        .observe(duration);
      httpRequestCounter.labels(req.method, route, res.statusCode.toString()).inc();

      if (res.statusCode >= 400) {
        httpErrorCounter
          .labels(
            req.method,
            route,
            res.statusCode.toString(),
            res.statusCode >= 500 ? 'server_error' : 'client_error'
          )
          .inc();
      }

      activeRequestsGauge.dec();

      // Record performance metric
      monitoring.recordApiResponseTime(route, req.method, res.statusCode, duration * 1000);
    }
  });

  next();
}

/**
 * Error handling middleware integrated with unified monitoring
 */
export function errorHandlerMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  // Don't respond if response was already sent
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.requestId || uuidv4();
  const startTime = req.startTime || Date.now();
  const duration = (Date.now() - startTime) / 1000;

  // Import ApiError for proper error handling
  const { ApiError } = require('../../utils/ApiError');

  // Convert to ApiError if needed
  let apiError = err;
  if (!(err instanceof ApiError)) {
    apiError = new ApiError(
      err.message || 'Internal Server Error',
      err.statusCode || 500,
      err.code || 'INTERNAL_SERVER_ERROR',
      err.details,
      false // Non-operational error
    );
  }

  logger.error(`Error in HTTP ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    error: apiError.message,
    code: apiError.code,
    statusCode: apiError.statusCode,
    stack: apiError.stack,
    durationSeconds: duration,
    isOperational: apiError.isOperational,
  });

  if (METRICS_ENABLED) {
    const route = req.route?.path || 'unknown';
    const statusCode = apiError.statusCode;

    httpRequestDurationHistogram.labels(req.method, route, statusCode.toString()).observe(duration);
    httpRequestCounter.labels(req.method, route, statusCode.toString()).inc();
    httpErrorCounter
      .labels(req.method, route, statusCode.toString(), apiError.code || 'UNKNOWN_ERROR')
      .inc();
    activeRequestsGauge.dec();
  }

  res.status(apiError.statusCode).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Monitor database query
 */
export async function monitorQuery<T>(
  queryText: string,
  params: any[],
  queryFn: () => Promise<QueryResult<T>>
): Promise<QueryResult<T>> {
  const startTime = Date.now();
  const operation = extractOperationType(queryText);
  const tables = extractTables(queryText);
  const primaryTable = tables.length > 0 ? tables[0] : 'unknown';

  try {
    const result = await queryFn();
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;

    databaseQueryDurationHistogram.observe(
      { operation, table: primaryTable, status: 'success' },
      durationSec
    );

    if (result.rows) {
      queryRowsHistogram.observe({ operation, table: primaryTable }, result.rowCount || 0);
    }

    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      slowQueryCounter.inc({ operation, table: primaryTable }, 1);
      logger.warn('Slow query detected', {
        query: queryText,
        params,
        duration_ms: durationMs,
        threshold_ms: SLOW_QUERY_THRESHOLD_MS,
        operation,
        table: primaryTable,
        rows: result.rowCount,
      });
    }

    updateQueryPatternStats(queryText, durationMs, result.rowCount);
    monitoring.recordDatabaseQuery(operation, primaryTable, durationMs, result.rowCount);

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;

    databaseQueryDurationHistogram.observe(
      { operation, table: primaryTable, status: 'error' },
      durationSec
    );
    databaseErrorCounter
      .labels(operation, primaryTable, error instanceof Error ? error.name : 'DatabaseError')
      .inc();

    logger.error('Database query error', {
      query: queryText,
      params,
      duration_ms: durationMs,
      operation,
      table: primaryTable,
      error: error instanceof Error ? error.message : String(error),
    });

    updateQueryPatternStats(queryText, durationMs);
    monitoring.recordDatabaseQuery(operation, primaryTable, durationMs, 0);

    throw error;
  }
}

/**
 * Measure database query - compatibility function
 */
export function measureDatabaseQuery<T>(queryType: string, queryFn: () => Promise<T>): Promise<T> {
  const startTime = Date.now();

  return queryFn()
    .then((result) => {
      const duration = Date.now() - startTime;
      monitoring.recordDatabaseQuery(queryType, 'unknown', duration);
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      logger.error(`Database query error: ${queryType}`, {
        queryType,
        error: error.message,
        stack: error.stack,
        durationMs: duration,
      });
      monitoring.recordDatabaseQuery(queryType, 'unknown', duration);
      throw error;
    });
}

/**
 * Measure ML service request
 */
export function measureMlServiceRequest<T>(
  endpoint: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return requestFn()
    .then((result) => {
      const duration = (Date.now() - startTime) / 1000;
      mlServiceRequestDurationHistogram.labels(endpoint, 'default').observe(duration);
      monitoring.recordMLInference('default', 0, duration * 1000);
      return result;
    })
    .catch((error) => {
      const duration = (Date.now() - startTime) / 1000;
      mlServiceRequestDurationHistogram.labels(endpoint, 'default').observe(duration);
      mlServiceErrorCounter.labels(endpoint, error.name || 'MlServiceError').inc();

      logger.error(`ML service request error: ${endpoint}`, {
        endpoint,
        error: error.message,
        stack: error.stack,
        durationSeconds: duration,
      });

      throw error;
    });
}

/**
 * Update segmentation queue size
 */
export function updateSegmentationQueueSize(
  pendingCount: number,
  processingCount: number,
  completedCount: number,
  failedCount: number
) {
  if (METRICS_ENABLED) {
    segmentationQueueSizeGauge.labels('pending').set(pendingCount);
    segmentationQueueSizeGauge.labels('processing').set(processingCount);
    segmentationQueueSizeGauge.labels('completed').set(completedCount);
    segmentationQueueSizeGauge.labels('failed').set(failedCount);
  }
}

/**
 * Update connection pool metrics
 */
export function updatePoolMetrics(pool: any) {
  if (!METRICS_ENABLED) return;

  try {
    connectionPoolGauge.set({ state: 'total' }, pool.totalCount || 0);
    connectionPoolGauge.set({ state: 'idle' }, pool.idleCount || 0);
    connectionPoolGauge.set({ state: 'waiting' }, pool.waitingCount || 0);
  } catch (error) {
    logger.error('Error updating pool metrics', error);
  }
}

/**
 * Wrap client query for monitoring
 */
export function wrapClientQuery(client: PoolClient): PoolClient {
  const originalQuery = client.query.bind(client);

  client.query = function <T>(textOrConfig: string | any, values?: any): Promise<QueryResult<T>> {
    const queryText = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    const params = values || (typeof textOrConfig === 'string' ? [] : textOrConfig.values || []);

    return monitorQuery(queryText, params, () => originalQuery(textOrConfig, values));
  };

  return client;
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  if (!METRICS_ENABLED) {
    return '# Metrics are disabled';
  }

  return unifiedRegistry.metrics();
}

/**
 * Get content type for metrics
 */
export function getMetricsContentType(): string {
  return unifiedRegistry.contentType;
}

/**
 * Query pattern analysis functions
 */
export function getTopSlowQueries(limit: number = 10): QueryPatternStats[] {
  const patterns = patternCache.keys().map((key) => patternCache.get<QueryPatternStats>(key)!);
  return patterns.sort((a, b) => b.avgDurationMs - a.avgDurationMs).slice(0, limit);
}

export function getQueryPatternsByTable(table: string): QueryPatternStats[] {
  const patterns = patternCache.keys().map((key) => patternCache.get<QueryPatternStats>(key)!);
  return patterns.filter((pattern) =>
    pattern.tables.some((t) => t.toLowerCase() === table.toLowerCase())
  );
}

export function getQueryFrequencyStats(): Record<string, number> {
  const patterns = patternCache.keys().map((key) => patternCache.get<QueryPatternStats>(key)!);
  const stats: Record<string, number> = {};

  patterns.forEach((pattern) => {
    if (!stats[pattern.operation]) {
      stats[pattern.operation] = 0;
    }
    stats[pattern.operation] += pattern.totalExecutions;
  });

  return stats;
}

export function resetPatternStats(): void {
  patternCache.flushAll();
}

/**
 * Initialize monitoring system
 */
export function initializeMonitoring(): void {
  logger.info('Unified monitoring system initialized', {
    metrics_enabled: METRICS_ENABLED,
    slow_query_threshold_ms: SLOW_QUERY_THRESHOLD_MS,
    metrics_prefix: METRICS_PREFIX,
  });
}

// Initialize on module load
initializeMonitoring();

// Export unified monitoring interface
export default {
  // Logger
  logger,

  // Middleware
  requestLoggerMiddleware,
  errorHandlerMiddleware,

  // Measurement functions
  measureDatabaseQuery,
  measureMlServiceRequest,
  monitorQuery,
  updateSegmentationQueueSize,
  updatePoolMetrics,
  wrapClientQuery,

  // Metrics access
  getMetrics,
  getMetricsContentType,
  registry: unifiedRegistry,

  // Pattern analysis
  getTopSlowQueries,
  getQueryPatternsByTable,
  getQueryFrequencyStats,
  resetPatternStats,

  // Events
  on: (event: string, listener: (...args: any[]) => void) => metricsEmitter.on(event, listener),
  off: (event: string, listener: (...args: any[]) => void) => metricsEmitter.off(event, listener),
  once: (event: string, listener: (...args: any[]) => void) => metricsEmitter.once(event, listener),

  // Performance monitoring instance
  performanceMonitoring: monitoring,
};

// Export individual components for compatibility
export { monitoring as performanceMonitoring, logger as unifiedLogger };
