/**
 * Consolidated Performance Monitoring Middleware
 * 
 * Single source of truth for all performance monitoring functionality.
 * Combines features from all previous performance middleware files.
 */

import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { Counter, Histogram, Gauge, register } from 'prom-client';
import { unifiedRegistry } from '../monitoring/unified';
import { ApiMetric } from '../monitoring/performanceTracker';
import { recordApiMetric } from '../monitoring/performanceTracker';

// Performance monitoring options
export interface PerformanceMonitoringOptions {
  enabled?: boolean;
  enablePrometheus?: boolean;
  enableMemoryMonitoring?: boolean;
  enableDatabaseMonitoring?: boolean;
  enableResponseHeaders?: boolean;
  enableSlowRequestLogging?: boolean;
  skipInTest?: boolean;
  skipPaths?: string[];
  slowRequestThreshold?: number; // ms
  memoryCheckInterval?: number; // ms
  memoryWarningThreshold?: number; // percentage
  memoryErrorThreshold?: number; // percentage
  gcThreshold?: number; // percentage
}

// Default configuration
const DEFAULT_OPTIONS: PerformanceMonitoringOptions = {
  enabled: true,
  enablePrometheus: true,
  enableMemoryMonitoring: true,
  enableDatabaseMonitoring: true,
  enableResponseHeaders: true,
  enableSlowRequestLogging: true,
  skipInTest: true,
  skipPaths: ['/metrics', '/health', '/ready', '/favicon.ico'],
  slowRequestThreshold: 1000, // 1 second
  memoryCheckInterval: 30000, // 30 seconds
  memoryWarningThreshold: 70,
  memoryErrorThreshold: 85,
  gcThreshold: 80,
};

// Performance event emitter for memory pressure handling
class PerformanceMonitor extends EventEmitter {
  private memoryCheckTimer?: NodeJS.Timer;
  private lastMemoryCheck = Date.now();
  
  startMemoryMonitoring(options: PerformanceMonitoringOptions) {
    if (!options.enableMemoryMonitoring) return;
    
    this.memoryCheckTimer = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
      
      if (heapUsedPercent > options.memoryErrorThreshold!) {
        logger.error('Critical memory pressure detected', {
          heapUsedPercent: heapUsedPercent.toFixed(2),
          heapUsed: formatBytes(usage.heapUsed),
          heapTotal: formatBytes(usage.heapTotal),
        });
        this.emit('memoryPressure', { level: 'critical', usage });
        
        // Attempt garbage collection if available and threshold exceeded
        if (global.gc && heapUsedPercent > options.gcThreshold!) {
          logger.info('Triggering manual garbage collection');
          global.gc();
        }
      } else if (heapUsedPercent > options.memoryWarningThreshold!) {
        logger.warn('High memory usage detected', {
          heapUsedPercent: heapUsedPercent.toFixed(2),
          heapUsed: formatBytes(usage.heapUsed),
          heapTotal: formatBytes(usage.heapTotal),
        });
        this.emit('memoryPressure', { level: 'warning', usage });
      }
      
      this.lastMemoryCheck = Date.now();
    }, options.memoryCheckInterval);
  }
  
  stopMemoryMonitoring() {
    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      this.memoryCheckTimer = undefined;
    }
  }
}

// Singleton performance monitor instance
const performanceMonitor = new PerformanceMonitor();

// Prometheus metrics (lazy initialization)
let httpRequestDuration: Histogram<string> | undefined;
let httpRequestTotal: Counter<string> | undefined;
let httpActiveRequests: Gauge<string> | undefined;
let memoryUsageGauge: Gauge<string> | undefined;
let dbQueryDuration: Histogram<string> | undefined;
let dbQueryTotal: Counter<string> | undefined;
let dbActiveConnections: Gauge<string> | undefined;

// Initialize Prometheus metrics
function initializeMetrics(options: PerformanceMonitoringOptions) {
  if (!options.enablePrometheus) return;
  
  httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [unifiedRegistry],
  });
  
  httpRequestTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [unifiedRegistry],
  });
  
  httpActiveRequests = new Gauge({
    name: 'http_active_requests',
    help: 'Number of active HTTP requests',
    registers: [unifiedRegistry],
  });
  
  if (options.enableMemoryMonitoring) {
    memoryUsageGauge = new Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Node.js memory usage',
      labelNames: ['type'],
      registers: [unifiedRegistry],
    });
  }
  
  if (options.enableDatabaseMonitoring) {
    dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [unifiedRegistry],
    });
    
    dbQueryTotal = new Counter({
      name: 'db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'status'],
      registers: [unifiedRegistry],
    });
    
    dbActiveConnections = new Gauge({
      name: 'db_active_connections',
      help: 'Number of active database connections',
      registers: [unifiedRegistry],
    });
  }
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Main middleware factory
export function createPerformanceMiddleware(options: Partial<PerformanceMonitoringOptions> = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Skip in test environment if configured
  if (config.skipInTest && process.env.NODE_ENV === 'test') {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  
  // Initialize metrics on first use
  if (config.enablePrometheus && !httpRequestDuration) {
    initializeMetrics(config);
  }
  
  // Start memory monitoring
  if (config.enableMemoryMonitoring) {
    performanceMonitor.startMemoryMonitoring(config);
  }
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip configured paths
    if (config.skipPaths?.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    // Track active requests
    if (httpActiveRequests) {
      httpActiveRequests.inc();
    }
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to capture metrics
    res.end = function(...args: any[]) {
      // Calculate duration
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;
      const durationSeconds = durationMs / 1000;
      
      // Get route pattern (Express specific)
      const route = req.route?.path || req.path || 'unknown';
      const method = req.method;
      const statusCode = res.statusCode.toString();
      
      // Update Prometheus metrics
      if (config.enablePrometheus) {
        httpRequestDuration?.observe(
          { method, route, status_code: statusCode },
          durationSeconds
        );
        httpRequestTotal?.inc({ method, route, status_code: statusCode });
        httpActiveRequests?.dec();
        
        // Update memory metrics
        if (config.enableMemoryMonitoring && memoryUsageGauge) {
          const memUsage = process.memoryUsage();
          memoryUsageGauge.set({ type: 'heapUsed' }, memUsage.heapUsed);
          memoryUsageGauge.set({ type: 'heapTotal' }, memUsage.heapTotal);
          memoryUsageGauge.set({ type: 'rss' }, memUsage.rss);
          memoryUsageGauge.set({ type: 'external' }, memUsage.external);
        }
      }
      
      // Record API metric for performance tracking
      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      const metric: ApiMetric = {
        endpoint: req.path,
        method: req.method as any,
        statusCode: res.statusCode,
        responseTime: durationMs,
        timestamp: new Date(),
        userId: (req as any).user?.id,
        memoryUsed: memoryDelta > 0 ? memoryDelta : undefined,
      };
      
      recordApiMetric(metric);
      
      // Add response headers if enabled
      if (config.enableResponseHeaders) {
        res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
        if (config.enableMemoryMonitoring && memoryDelta > 0) {
          res.setHeader('X-Memory-Usage', formatBytes(memoryDelta));
        }
      }
      
      // Log slow requests
      if (config.enableSlowRequestLogging && durationMs > config.slowRequestThreshold!) {
        logger.warn('Slow request detected', {
          method,
          path: req.path,
          route,
          statusCode,
          duration: `${durationMs.toFixed(2)}ms`,
          threshold: `${config.slowRequestThreshold}ms`,
          userId: (req as any).user?.id,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      
      // Call original end function
      return originalEnd.apply(res, args);
    };
    
    next();
  };
}

// Export singleton middleware instance with default options
export const performanceMiddleware = createPerformanceMiddleware();

// Export additional utilities
export {
  performanceMonitor,
  formatBytes,
  PerformanceMonitor,
};

// Cleanup on process exit
process.on('exit', () => {
  performanceMonitor.stopMemoryMonitoring();
});

process.on('SIGINT', () => {
  performanceMonitor.stopMemoryMonitoring();
  process.exit(0);
});

process.on('SIGTERM', () => {
  performanceMonitor.stopMemoryMonitoring();
  process.exit(0);
});