import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import logger from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * Performance Monitoring Middleware
 * Tracks query times, API response times, and system metrics
 */

interface PerformanceMetrics {
  apiCalls: Map<string, ApiMetric>;
  dbQueries: QueryMetric[];
  memoryUsage: MemoryMetric[];
  activeConnections: number;
}

interface ApiMetric {
  endpoint: string;
  method: string;
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  errors: number;
  statusCodes: Map<number, number>;
}

interface QueryMetric {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount: number;
  error?: string | undefined;
}

interface MemoryMetric {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics = {
    apiCalls: new Map(),
    dbQueries: [],
    memoryUsage: [],
    activeConnections: 0,
  };

  // Constants instead of magic numbers
  private static readonly MAX_QUERY_HISTORY = 1000;
  private static readonly MAX_MEMORY_HISTORY = 100;
  private static readonly MEMORY_CHECK_INTERVAL_MS = 30000; // 30 seconds
  private static readonly HIGH_MEMORY_THRESHOLD_PERCENT = 90;
  private static readonly CRITICAL_MEMORY_THRESHOLD_PERCENT = 95;

  private readonly maxQueryHistory = PerformanceMonitor.MAX_QUERY_HISTORY;
  private readonly maxMemoryHistory = PerformanceMonitor.MAX_MEMORY_HISTORY;
  private memoryCheckInterval?: NodeJS.Timeout | undefined;
  private isUnderMemoryPressure = false;

  constructor() {
    super();
    this.startMemoryMonitoring();
  }

  /**
   * Start periodic memory monitoring
   */
  private startMemoryMonitoring(): void {
    // Check memory every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      try {
        const memUsage = process.memoryUsage();
        const metric: MemoryMetric = {
          timestamp: new Date(),
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
        };

        this.metrics.memoryUsage.push(metric);

        // Keep only recent history
        if (this.metrics.memoryUsage.length > this.maxMemoryHistory) {
          this.metrics.memoryUsage.shift();
        }

        // Calculate memory usage percentage
        const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

        // Handle critical memory pressure
        if (heapUsagePercent > PerformanceMonitor.CRITICAL_MEMORY_THRESHOLD_PERCENT) {
          this.handleCriticalMemoryPressure(heapUsagePercent, memUsage);
        } else if (heapUsagePercent > PerformanceMonitor.HIGH_MEMORY_THRESHOLD_PERCENT) {
          this.handleHighMemoryPressure(heapUsagePercent, memUsage);
        } else if (this.isUnderMemoryPressure && heapUsagePercent < 80) {
          // Memory pressure relieved
          this.isUnderMemoryPressure = false;
          this.emit('memoryPressureRelieved', {
            percentage: heapUsagePercent,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
          });
        }
      } catch (error) {
        logger.error('Error in memory monitoring', error as Record<string, unknown>);
      }
    }, PerformanceMonitor.MEMORY_CHECK_INTERVAL_MS);
  }

  /**
   * Handle high memory pressure (90-95%)
   */
  private handleHighMemoryPressure(percentage: number, memUsage: NodeJS.MemoryUsage): void {
    this.isUnderMemoryPressure = true;

    this.emit('highMemoryUsage', {
      percentage,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
    });

    // Reduce data retention under memory pressure
    this.cleanupUnderMemoryPressure();

    logger.warn('High memory usage detected', {
      percentage: percentage.toFixed(2),
      heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
      heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
    });
  }

  /**
   * Handle critical memory pressure (>95%)
   */
  private handleCriticalMemoryPressure(percentage: number, memUsage: NodeJS.MemoryUsage): void {
    this.isUnderMemoryPressure = true;

    this.emit('criticalMemoryUsage', {
      percentage,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
    });

    // Aggressive cleanup under critical memory pressure
    this.emergencyCleanup();

    logger.error('Critical memory usage detected', {
      percentage: percentage.toFixed(2),
      heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
      heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
    });

    // Optionally trigger garbage collection if enabled
    if (global.gc && process.env["ENABLE_MANUAL_GC"] === 'true') {
      global.gc();
      logger.info('Manual garbage collection triggered due to memory pressure');
    }
  }

  /**
   * Cleanup metrics under memory pressure
   */
  private cleanupUnderMemoryPressure(): void {
    // Reduce query history to 25%
    const targetQuerySize = Math.floor(this.maxQueryHistory * 0.25);
    if (this.metrics.dbQueries.length > targetQuerySize) {
      this.metrics.dbQueries = this.metrics.dbQueries.slice(-targetQuerySize);
    }

    // Reduce memory history to 50%
    const targetMemorySize = Math.floor(this.maxMemoryHistory * 0.5);
    if (this.metrics.memoryUsage.length > targetMemorySize) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-targetMemorySize);
    }

    // Clear old API metrics (keep only last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.metrics.apiCalls.forEach((metric, key) => {
      if (metric.count === 0 || metric.maxTime < oneHourAgo) {
        this.metrics.apiCalls.delete(key);
      }
    });
  }

  /**
   * Emergency cleanup under critical memory pressure
   */
  private emergencyCleanup(): void {
    // Keep only last 100 queries
    this.metrics.dbQueries = this.metrics.dbQueries.slice(-100);

    // Keep only last 10 memory readings
    this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-10);

    // Clear API metrics except active endpoints
    const activeEndpoints = new Set<string>();
    const fiveMinutesAgo = Date.now() - 300000;

    this.metrics.apiCalls.forEach((metric, key) => {
      if (metric.avgTime > fiveMinutesAgo) {
        activeEndpoints.add(key);
      }
    });

    this.metrics.apiCalls.clear();
    activeEndpoints.forEach((key) => {
      this.metrics.apiCalls.set(key, {
        endpoint: key.split(':')[1] || '',
        method: key.split(':')[0] || '',
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        statusCodes: new Map(),
      });
    });
  }

  /**
   * Track API call performance
   */
  trackApiCall(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    error?: Error
  ): void {
    const key = `${method}:${endpoint}`;
    let metric = this.metrics.apiCalls.get(key);

    if (!metric) {
      metric = {
        endpoint,
        method,
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        statusCodes: new Map(),
      };
      this.metrics.apiCalls.set(key, metric);
    }

    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);

    if (error || statusCode >= 400) {
      metric.errors++;
    }

    const currentCount = metric.statusCodes.get(statusCode) || 0;
    metric.statusCodes.set(statusCode, currentCount + 1);

    // Emit slow API warning
    if (duration > 1000) {
      this.emit('slowApiCall', {
        endpoint,
        method,
        duration,
        statusCode,
      });
    }
  }

  /**
   * Track database query performance
   */
  trackQuery(query: string, duration: number, rowCount: number, error?: string): void {
    const metric: QueryMetric = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      rowCount,
      error: error || undefined,
    };

    this.metrics.dbQueries.push(metric);

    // Keep only recent history
    if (this.metrics.dbQueries.length > this.maxQueryHistory) {
      this.metrics.dbQueries.shift();
    }

    // Emit slow query warning
    if (duration > 100) {
      this.emit('slowQuery', {
        query: metric.query,
        duration,
        rowCount,
      });
    }
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    try {
      // Remove string literals (handling escaped quotes)
      let sanitized = query.replace(/'(?:[^']|'')*'/g, "'?'");

      // Remove numeric literals
      sanitized = sanitized.replace(/\b\d+\.?\d*\b/g, '?');

      // Replace parameter placeholders
      sanitized = sanitized.replace(/\$\d+/g, '?');

      // Remove potential email addresses
      sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '?@?');

      // Normalize whitespace
      sanitized = sanitized.replace(/\s+/g, ' ').trim();

      // Truncate very long queries
      if (sanitized.length > 500) {
        sanitized = sanitized.substring(0, 497) + '...';
      }

      return sanitized;
    } catch (error) {
      // If sanitization fails, return a safe placeholder
      logger.error('Query sanitization failed', error as Record<string, unknown>);
      return 'QUERY_SANITIZATION_FAILED';
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      apiCalls: new Map(this.metrics.apiCalls),
    };
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    const apiSummary = Array.from(this.metrics.apiCalls.values())
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10); // Top 10 slowest endpoints

    const slowQueries = this.metrics.dbQueries
      .filter((q) => q.duration > 50)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10); // Top 10 slowest queries

    const currentMemory = process.memoryUsage();
    const memoryTrend = this.calculateMemoryTrend();

    return {
      api: {
        totalEndpoints: this.metrics.apiCalls.size,
        totalCalls: Array.from(this.metrics.apiCalls.values()).reduce((sum, m) => sum + m.count, 0),
        avgResponseTime: this.calculateAvgResponseTime(),
        slowestEndpoints: apiSummary,
      },
      database: {
        totalQueries: this.metrics.dbQueries.length,
        avgQueryTime: this.calculateAvgQueryTime(),
        slowQueries,
      },
      memory: {
        current: {
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          heapUsagePercent: (currentMemory.heapUsed / currentMemory.heapTotal) * 100,
          rss: currentMemory.rss,
        },
        trend: memoryTrend,
      },
      connections: {
        active: this.metrics.activeConnections,
      },
    };
  }

  /**
   * Calculate average response time across all endpoints
   */
  private calculateAvgResponseTime(): number {
    const metrics = Array.from(this.metrics.apiCalls.values());
    if (metrics.length === 0) return 0;

    const totalTime = metrics.reduce((sum, m) => sum + m.totalTime, 0);
    const totalCalls = metrics.reduce((sum, m) => sum + m.count, 0);

    return totalCalls > 0 ? totalTime / totalCalls : 0;
  }

  /**
   * Calculate average query time
   */
  private calculateAvgQueryTime(): number {
    if (this.metrics.dbQueries.length === 0) return 0;

    const totalTime = this.metrics.dbQueries.reduce((sum, q) => sum + q.duration, 0);
    return totalTime / this.metrics.dbQueries.length;
  }

  /**
   * Calculate memory usage trend
   */
  private calculateMemoryTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.metrics.memoryUsage.length < 5) return 'stable';

    const recent = this.metrics.memoryUsage.slice(-5);
    const avgRecent = recent.reduce((sum, m) => sum + m.heapUsed, 0) / recent.length;
    const avgOlder =
      this.metrics.memoryUsage.slice(-10, -5).reduce((sum, m) => sum + m.heapUsed, 0) / 5;

    if (avgRecent > avgOlder * 1.1) return 'increasing';
    if (avgRecent < avgOlder * 0.9) return 'decreasing';
    return 'stable';
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics.apiCalls.clear();
    this.metrics.dbQueries = [];
    this.metrics.memoryUsage = [];
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
    }
    this.removeAllListeners();
  }

  /**
   * Destructor - ensure cleanup
   */
  destructor(): void {
    this.stop();
    this.clearMetrics();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Ensure cleanup on process exit
process.on('exit', () => {
  performanceMonitor.destructor();
});

process.on('SIGINT', () => {
  performanceMonitor.destructor();
  process.exit(0);
});

process.on('SIGTERM', () => {
  performanceMonitor.destructor();
  process.exit(0);
});

/**
 * Express middleware for API performance monitoring
 */
export function apiPerformanceMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const endpoint = req.route?.path || req.path;
    const method = req.method;

    // Track response
    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - startTime;
      performanceMonitor.trackApiCall(endpoint, method, duration, res.statusCode);

      // Log slow requests
      if (duration > 1000) {
        logger.warn('Slow API request', {
          endpoint,
          method,
          duration,
          statusCode: res.statusCode,
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * PostgreSQL query monitoring
 */
export function createMonitoredPool(pool: Pool): Pool {
  const originalQuery = pool.query.bind(pool);

  // Override query method with proper typing
  (pool as any).query = async function (...args: any[]): Promise<any> {
    const startTime = Date.now();
    const query = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].text) || '';

    try {
      const result: any = await originalQuery(args[0], args[1], args[2]);
      const duration = Date.now() - startTime;

      performanceMonitor.trackQuery(query, duration, result?.rowCount || 0);

      // Log slow queries
      if (duration > 100) {
        logger.warn('Slow database query', {
          query: performanceMonitor['sanitizeQuery'](query),
          duration,
          rowCount: result?.rowCount || 0,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMonitor.trackQuery(
        query,
        duration,
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  };

  return pool;
}

/**
 * Performance monitoring endpoint handler
 * @deprecated Use the authenticated endpoints in routes/metrics.ts instead
 * Note: This function requires authentication middleware to be applied when used
 */
export function performanceEndpoint(_req: Request, res: Response) {
  const summary = performanceMonitor.getSummary();
  res.json(summary);
}

// Export utilities
export default {
  performanceMonitor,
  apiPerformanceMiddleware,
  createMonitoredPool,
  performanceEndpoint,
};
