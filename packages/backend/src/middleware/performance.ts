/**
 * Consolidated Performance Monitoring Middleware
 *
 * This module consolidates all performance-related middleware:
 * - Request duration tracking
 * - Memory usage monitoring
 * - Prometheus metrics collection
 * - Database monitoring
 * - Performance alerts and logging
 */

import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
import logger from '../utils/logger';
import config from '../config';
import pool from '../db';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

export interface PerformanceOptions {
  /** Enable Prometheus metrics collection */
  enableMetrics?: boolean;
  /** Enable performance logging */
  enableLogging?: boolean;
  /** Enable memory monitoring */
  enableMemoryMonitoring?: boolean;
  /** Enable database monitoring */
  enableDatabaseMonitoring?: boolean;
  /** Custom performance thresholds */
  thresholds?: PerformanceThresholds;
}

export interface PerformanceThresholds {
  duration?: {
    warn?: number;
    error?: number;
  };
  memory?: {
    warn?: number;
    error?: number;
  };
}

export interface PerformanceRequest extends Request {
  startTime?: number;
  memoryUsageStart?: ReturnType<typeof process.memoryUsage>;
}

// =============================================================================
// PROMETHEUS METRICS SETUP
// =============================================================================

// Initialize the Prometheus registry
const register = new promClient.Registry();

// Add default metrics (GC, memory usage, etc.)
promClient.collectDefaultMetrics({ register });

// HTTP Metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const httpRequestsActive = new promClient.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['method', 'path'],
  registers: [register],
});

// Application-specific metrics
const segmentationTasksActive = new promClient.Gauge({
  name: 'segmentation_tasks_active',
  help: 'Number of active segmentation tasks',
  registers: [register],
});

const segmentationTasksTotal = new promClient.Counter({
  name: 'segmentation_tasks_total',
  help: 'Total number of segmentation tasks',
  labelNames: ['status'],
  registers: [register],
});

const databaseConnectionsActive = new promClient.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

const databaseQueryDurationSeconds = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Memory metrics
const memoryUsageBytes = new promClient.Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
});

// =============================================================================
// PERFORMANCE THRESHOLDS
// =============================================================================

const DEFAULT_THRESHOLDS: Required<PerformanceThresholds> = {
  duration: {
    warn: 1000, // 1 second
    error: 3000, // 3 seconds
  },
  memory: {
    warn: 100 * 1024 * 1024, // 100 MB
    error: 500 * 1024 * 1024, // 500 MB
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get current memory usage
 */
const getMemoryUsage = (): ReturnType<typeof process.memoryUsage> => {
  return process.memoryUsage();
};

/**
 * Format memory size for logging
 */
const formatMemorySize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
};

/**
 * Get normalized path for metrics (remove IDs and params)
 */
const getNormalizedPath = (originalUrl: string): string => {
  return originalUrl
    .replace(/\/\d+/g, '/:id') // Replace numeric IDs
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs
    .replace(/\?.*$/, ''); // Remove query parameters
};

/**
 * Update memory metrics
 */
const updateMemoryMetrics = (): void => {
  const memUsage = getMemoryUsage();

  memoryUsageBytes.set({ type: 'rss' }, memUsage.rss);
  memoryUsageBytes.set({ type: 'heap_total' }, memUsage.heapTotal);
  memoryUsageBytes.set({ type: 'heap_used' }, memUsage.heapUsed);
  memoryUsageBytes.set({ type: 'external' }, memUsage.external);
};

// =============================================================================
// MAIN PERFORMANCE MIDDLEWARE
// =============================================================================

/**
 * Create performance monitoring middleware
 */
export const createPerformanceMiddleware = (options: PerformanceOptions = {}) => {
  const {
    enableMetrics = true,
    enableLogging = true,
    enableMemoryMonitoring = true,
    enableDatabaseMonitoring = true,
    thresholds = {},
  } = options;

  const mergedThresholds = {
    duration: { ...DEFAULT_THRESHOLDS.duration, ...thresholds.duration },
    memory: { ...DEFAULT_THRESHOLDS.memory, ...thresholds.memory },
  };

  return (req: PerformanceRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const startHrTime = process.hrtime();
    const memoryStart = enableMemoryMonitoring ? getMemoryUsage() : undefined;

    req.startTime = startTime;
    req.memoryUsageStart = memoryStart;

    const method = req.method;
    const normalizedPath = getNormalizedPath(req.originalUrl);

    // Update active requests metric
    if (enableMetrics) {
      httpRequestsActive.inc({ method, path: normalizedPath });
    }

    // Response finish handler
    const onFinish = () => {
      const duration = Date.now() - startTime;
      const [seconds, nanoseconds] = process.hrtime(startHrTime);
      const durationSeconds = seconds + nanoseconds / 1e9;
      const status = res.statusCode.toString();

      // Update metrics
      if (enableMetrics) {
        httpRequestsTotal.inc({ method, path: normalizedPath, status });
        httpRequestDurationSeconds.observe(
          { method, path: normalizedPath, status },
          durationSeconds
        );
        httpRequestsActive.dec({ method, path: normalizedPath });

        // Update memory metrics periodically
        if (enableMemoryMonitoring) {
          updateMemoryMetrics();
        }
      }

      // Performance logging
      if (enableLogging) {
        const logData: any = {
          method,
          url: req.originalUrl,
          status: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        };

        // Add memory info if monitoring is enabled
        if (enableMemoryMonitoring && memoryStart) {
          const memoryEnd = getMemoryUsage();
          const memoryDelta = {
            rss: memoryEnd.rss - memoryStart.rss,
            heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
            heapTotal: memoryEnd.heapTotal - memoryStart.heapTotal,
            external: memoryEnd.external - memoryStart.external,
          };

          logData.memory = {
            start: {
              rss: formatMemorySize(memoryStart.rss),
              heapUsed: formatMemorySize(memoryStart.heapUsed),
            },
            end: {
              rss: formatMemorySize(memoryEnd.rss),
              heapUsed: formatMemorySize(memoryEnd.heapUsed),
            },
            delta: {
              rss: formatMemorySize(memoryDelta.rss),
              heapUsed: formatMemorySize(memoryDelta.heapUsed),
            },
          };

          // Check memory thresholds
          if (memoryEnd.heapUsed > mergedThresholds.memory.error) {
            logger.error('High memory usage detected', logData);
          } else if (memoryEnd.heapUsed > mergedThresholds.memory.warn) {
            logger.warn('Elevated memory usage detected', logData);
          }
        }

        // Check duration thresholds
        if (duration > mergedThresholds.duration.error) {
          logger.error('Slow request detected', logData);
        } else if (duration > mergedThresholds.duration.warn) {
          logger.warn('Slow request detected', logData);
        } else {
          logger.debug('Request completed', logData);
        }
      }
    };

    // Attach event listeners
    res.on('finish', onFinish);
    res.on('close', onFinish);

    next();
  };
};

// =============================================================================
// DATABASE MONITORING MIDDLEWARE
// =============================================================================

/**
 * Monitor database connection pool
 */
export const createDatabaseMonitoringMiddleware = () => {
  // Update database metrics periodically
  const updateDatabaseMetrics = () => {
    try {
      const poolStats = (pool as any).totalCount || 0; // Get pool statistics if available
      databaseConnectionsActive.set(poolStats);
    } catch (error) {
      logger.warn('Failed to get database pool statistics', { error });
    }
  };

  // Update metrics every 30 seconds
  setInterval(updateDatabaseMetrics, 30000);

  return (req: Request, res: Response, next: NextFunction) => {
    // This middleware doesn't need to do anything per request
    // The actual monitoring happens in the interval
    next();
  };
};

// =============================================================================
// METRICS ENDPOINT
// =============================================================================

/**
 * Create metrics endpoint handler
 */
export const createMetricsHandler = () => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (error) {
      logger.error('Failed to generate metrics', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to generate metrics',
        error: 'METRICS_ERROR',
      });
    }
  };
};

// =============================================================================
// SEGMENTATION METRICS HELPERS
// =============================================================================

/**
 * Track segmentation task start
 */
export const trackSegmentationTaskStart = (): void => {
  segmentationTasksActive.inc();
  segmentationTasksTotal.inc({ status: 'started' });
};

/**
 * Track segmentation task completion
 */
export const trackSegmentationTaskComplete = (success: boolean): void => {
  segmentationTasksActive.dec();
  segmentationTasksTotal.inc({ status: success ? 'completed' : 'failed' });
};

/**
 * Track database query duration
 */
export const trackDatabaseQuery = (queryType: string, durationMs: number): void => {
  databaseQueryDurationSeconds.observe({ query_type: queryType }, durationMs / 1000);
};

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  createPerformanceMiddleware,
  createDatabaseMonitoringMiddleware,
  createMetricsHandler,
  trackSegmentationTaskStart,
  trackSegmentationTaskComplete,
  trackDatabaseQuery,
  register,
};

// Export metrics for external use
export {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestsActive,
  segmentationTasksActive,
  segmentationTasksTotal,
  databaseConnectionsActive,
  databaseQueryDurationSeconds,
  memoryUsageBytes,
  register,
};
