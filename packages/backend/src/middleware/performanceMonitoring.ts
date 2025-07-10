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
  error?: string;
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

  private readonly maxQueryHistory = 1000;
  private readonly maxMemoryHistory = 100;
  private memoryCheckInterval?: NodeJS.Timer;

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

      // Emit warning if memory usage is high
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      if (heapUsagePercent > 90) {
        this.emit('highMemoryUsage', {
          percentage: heapUsagePercent,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
        });
      }
    }, 30000);
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
      error,
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
    // Remove string literals
    return query.replace(/'[^']*'/g, "'?'")
                .replace(/\$\d+/g, '?') // Replace parameter placeholders
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
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
      .filter(q => q.duration > 50)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10); // Top 10 slowest queries

    const currentMemory = process.memoryUsage();
    const memoryTrend = this.calculateMemoryTrend();

    return {
      api: {
        totalEndpoints: this.metrics.apiCalls.size,
        totalCalls: Array.from(this.metrics.apiCalls.values())
          .reduce((sum, m) => sum + m.count, 0),
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
    const avgOlder = this.metrics.memoryUsage
      .slice(-10, -5)
      .reduce((sum, m) => sum + m.heapUsed, 0) / 5;

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
    }
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

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
    res.send = function(data: any) {
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

  // Override query method
  pool.query = async function(...args: any[]): Promise<any> {
    const startTime = Date.now();
    const query = typeof args[0] === 'string' ? args[0] : args[0].text;

    try {
      const result = await originalQuery(...args);
      const duration = Date.now() - startTime;
      
      performanceMonitor.trackQuery(query, duration, result.rowCount || 0);
      
      // Log slow queries
      if (duration > 100) {
        logger.warn('Slow database query', {
          query: performanceMonitor['sanitizeQuery'](query),
          duration,
          rowCount: result.rowCount,
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