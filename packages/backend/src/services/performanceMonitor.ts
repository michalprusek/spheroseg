/**
 * Performance Monitoring Service
 *
 * Provides comprehensive performance monitoring and metrics collection
 * for the SpherosegV4 application.
 */

import { EventEmitter } from 'events';
import os from 'os';
import { performance } from 'perf_hooks';
import logger from '../utils/logger';
import { getPool } from '../db';
import cacheService from './cacheService';
import { getContainerInfo } from '../utils/containerInfo';

// Metric types
interface PerformanceMetric {
  timestamp: number;
  type: string;
  name: string;
  value: number;
  metadata?: Record<string, any>;
}

interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
}

interface DatabaseMetrics {
  query: string;
  duration: number;
  rowCount: number;
  timestamp: number;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    percentage: number;
  };
  heapUsage: {
    total: number;
    used: number;
    percentage: number;
  };
  eventLoopLag: number;
  timestamp: number;
}

class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private apiMetrics: APIMetrics[] = [];
  private dbMetrics: DatabaseMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private metricsRetentionMs = 3600000; // 1 hour
  private collectionInterval: NodeJS.Timeout | null = null;
  private eventLoopLag = 0;

  constructor() {
    super();
    this.startSystemMetricsCollection();
    this.startEventLoopMonitoring();
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Monitor event loop lag
   */
  private startEventLoopMonitoring(): void {
    let lastCheck = performance.now();

    setInterval(() => {
      const now = performance.now();
      const expectedDelay = 100; // We expect this to run every 100ms
      const actualDelay = now - lastCheck;
      this.eventLoopLag = Math.max(0, actualDelay - expectedDelay);
      lastCheck = now;
    }, 100);
  }

  /**
   * Collect current system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // CPU usage
      const cpus = os.cpus();
      const cpuUsage =
        cpus.reduce((acc, cpu) => {
          const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
          const idle = cpu.times.idle;
          return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

      // Memory usage
      const containerInfo = await getContainerInfo();
      const memoryUsage = containerInfo.isContainer
        ? {
            total: containerInfo.memoryLimit,
            used: containerInfo.memoryUsage,
            percentage: containerInfo.memoryUsagePercentage,
          }
        : {
            total: os.totalmem(),
            used: os.totalmem() - os.freemem(),
            percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
          };

      // Heap usage
      const heapUsed = process.memoryUsage().heapUsed;
      const heapTotal = process.memoryUsage().heapTotal;

      const metrics: SystemMetrics = {
        cpuUsage,
        memoryUsage,
        heapUsage: {
          total: heapTotal,
          used: heapUsed,
          percentage: (heapUsed / heapTotal) * 100,
        },
        eventLoopLag: this.eventLoopLag,
        timestamp: Date.now(),
      };

      this.systemMetrics.push(metrics);
      this.cleanupOldMetrics();

      // Emit high usage warnings - raised threshold to reduce noise
      if (memoryUsage.percentage > 85) {
        this.emit('high-memory-usage', memoryUsage);
        logger.warn('High memory usage detected', {
          usage: `${memoryUsage.percentage.toFixed(1)}%`,
          used: `${Math.round(memoryUsage.used / 1024 / 1024)}MB`,
          total: `${Math.round(memoryUsage.total / 1024 / 1024)}MB`,
        });
      }

      if (cpuUsage > 90) {
        this.emit('high-cpu-usage', { usage: cpuUsage });
        logger.warn('High CPU usage detected', { cpuUsage });
      }

      if (this.eventLoopLag > 50) {
        this.emit('high-event-loop-lag', { lag: this.eventLoopLag });
        logger.warn('High event loop lag detected', { lag: this.eventLoopLag });
      }
    } catch (error) {
      // Only log actual errors, not expected issues
      if (error instanceof Error && error.message) {
        logger.error('Error collecting system metrics', {
          error: error.message,
          stack: error.stack,
        });
      }
    }
  }

  /**
   * Record API endpoint performance
   */
  recordAPIMetric(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number
  ): void {
    const metric: APIMetrics = {
      endpoint,
      method,
      statusCode,
      responseTime,
      timestamp: Date.now(),
    };

    this.apiMetrics.push(metric);
    this.cleanupOldMetrics();

    // Emit slow response warning
    if (responseTime > 1000) {
      this.emit('slow-api-response', metric);
      logger.warn('Slow API response detected', metric);
    }
  }

  /**
   * Record database query performance
   */
  recordDatabaseMetric(query: string, duration: number, rowCount: number): void {
    const metric: DatabaseMetrics = {
      query: query.substring(0, 100), // Truncate long queries
      duration,
      rowCount,
      timestamp: Date.now(),
    };

    this.dbMetrics.push(metric);
    this.cleanupOldMetrics();

    // Emit slow query warning
    if (duration > 500) {
      this.emit('slow-database-query', metric);
      logger.warn('Slow database query detected', metric);
    }
  }

  /**
   * Record custom metric
   */
  recordMetric(type: string, name: string, value: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      type,
      name,
      value,
      metadata,
    };

    this.metrics.push(metric);
    this.cleanupOldMetrics();
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(): Promise<any> {
    const now = Date.now();
    const recentWindow = 300000; // Last 5 minutes

    // API metrics summary
    const recentApiMetrics = this.apiMetrics.filter((m) => now - m.timestamp < recentWindow);
    const apiSummary = this.calculateApiSummary(recentApiMetrics);

    // Database metrics summary
    const recentDbMetrics = this.dbMetrics.filter((m) => now - m.timestamp < recentWindow);
    const dbSummary = this.calculateDbSummary(recentDbMetrics);

    // System metrics summary
    const recentSystemMetrics = this.systemMetrics.filter((m) => now - m.timestamp < recentWindow);
    const systemSummary = this.calculateSystemSummary(recentSystemMetrics);

    // Cache statistics
    const cacheStats = await cacheService.getStats();

    // Database pool statistics
    const poolStats = await this.getDatabasePoolStats();

    return {
      timestamp: now,
      api: apiSummary,
      database: dbSummary,
      system: systemSummary,
      cache: cacheStats,
      databasePool: poolStats,
      uptime: process.uptime(),
    };
  }

  /**
   * Calculate API metrics summary
   */
  private calculateApiSummary(metrics: APIMetrics[]): any {
    if (metrics.length === 0) {
      return { totalRequests: 0 };
    }

    const responseTimes = metrics.map((m) => m.responseTime);
    const successfulRequests = metrics.filter((m) => m.statusCode < 400).length;
    const errorRequests = metrics.filter((m) => m.statusCode >= 400).length;

    // Group by endpoint
    const byEndpoint = metrics.reduce(
      (acc, m) => {
        const key = `${m.method} ${m.endpoint}`;
        if (!acc[key]) {
          acc[key] = { count: 0, totalTime: 0, errors: 0 };
        }
        acc[key].count++;
        acc[key].totalTime += m.responseTime;
        if (m.statusCode >= 400) acc[key].errors++;
        return acc;
      },
      {} as Record<string, any>
    );

    // Calculate top slow endpoints
    const slowEndpoints = Object.entries(byEndpoint)
      .map(([endpoint, stats]: [string, any]) => ({
        endpoint,
        avgResponseTime: stats.totalTime / stats.count,
        count: stats.count,
        errorRate: (stats.errors / stats.count) * 100,
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 5);

    return {
      totalRequests: metrics.length,
      successfulRequests,
      errorRequests,
      errorRate: (errorRequests / metrics.length) * 100,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p50ResponseTime: this.percentile(responseTimes, 50),
      p95ResponseTime: this.percentile(responseTimes, 95),
      p99ResponseTime: this.percentile(responseTimes, 99),
      slowEndpoints,
    };
  }

  /**
   * Calculate database metrics summary
   */
  private calculateDbSummary(metrics: DatabaseMetrics[]): any {
    if (metrics.length === 0) {
      return { totalQueries: 0 };
    }

    const durations = metrics.map((m) => m.duration);

    return {
      totalQueries: metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50Duration: this.percentile(durations, 50),
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      slowQueries: metrics
        .filter((m) => m.duration > 100)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map((m) => ({
          query: m.query,
          duration: m.duration,
          rowCount: m.rowCount,
        })),
    };
  }

  /**
   * Calculate system metrics summary
   */
  private calculateSystemSummary(metrics: SystemMetrics[]): any {
    if (metrics.length === 0) {
      return {};
    }

    const latest = metrics[metrics.length - 1];
    const cpuValues = metrics.map((m) => m.cpuUsage);
    const memoryValues = metrics.map((m) => m.memoryUsage.percentage);
    const heapValues = metrics.map((m) => m.heapUsage.percentage);
    const eventLoopLags = metrics.map((m) => m.eventLoopLag);

    return {
      current: {
        cpu: latest.cpuUsage,
        memory: latest.memoryUsage,
        heap: latest.heapUsage,
        eventLoopLag: latest.eventLoopLag,
      },
      averages: {
        cpu: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
        memory: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
        heap: heapValues.reduce((a, b) => a + b, 0) / heapValues.length,
        eventLoopLag: eventLoopLags.reduce((a, b) => a + b, 0) / eventLoopLags.length,
      },
      peaks: {
        cpu: Math.max(...cpuValues),
        memory: Math.max(...memoryValues),
        heap: Math.max(...heapValues),
        eventLoopLag: Math.max(...eventLoopLags),
      },
    };
  }

  /**
   * Get database pool statistics
   */
  private async getDatabasePoolStats(): Promise<any> {
    try {
      const pool = getPool();
      // @ts-expect-error - accessing private pool properties
      const poolStats = {
        totalCount: pool.totalCount || 0,
        idleCount: pool.idleCount || 0,
        waitingCount: pool.waitingCount || 0,
      };
      return poolStats;
    } catch (error) {
      logger.error('Error getting database pool stats', { error });
      return {};
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.metricsRetentionMs;

    this.metrics = this.metrics.filter((m) => m.timestamp > cutoffTime);
    this.apiMetrics = this.apiMetrics.filter((m) => m.timestamp > cutoffTime);
    this.dbMetrics = this.dbMetrics.filter((m) => m.timestamp > cutoffTime);
    this.systemMetrics = this.systemMetrics.filter((m) => m.timestamp > cutoffTime);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
