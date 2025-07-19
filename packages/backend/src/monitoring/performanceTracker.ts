/**
 * Enhanced Performance Tracking System
 *
 * Provides comprehensive performance monitoring, analysis, and optimization recommendations
 */

import { Request, Response, NextFunction } from 'express';
import { Histogram, Counter, Gauge } from 'prom-client';
import { performance } from 'perf_hooks';
import logger from '../utils/logger';
import { unifiedRegistry } from './unified';

// Prevent duplicate metric registration during development restarts
const clearExistingMetrics = () => {
  try {
    // Clear only our specific metrics to prevent conflicts
    const metricNames = [
      'spheroseg_performance_duration_seconds',
      'spheroseg_memory_usage_bytes',
      'spheroseg_performance_cpu_usage_percent',
      'spheroseg_operations_total',
      'spheroseg_operation_duration_seconds',
      'spheroseg_response_time_seconds',
    ];

    metricNames.forEach((name) => {
      try {
        unifiedRegistry.removeSingleMetric(name);
      } catch (e) {
        // Metric doesn't exist, that's fine
      }
    });
  } catch (error) {
    // Registry operations may fail, that's ok during development
  }
};

// Clear metrics during development to prevent duplicate registration errors
if (process.env["NODE_ENV"] !== 'production') {
  clearExistingMetrics();
}

// Performance metrics
const performanceHistogram = new Histogram({
  name: 'spheroseg_performance_duration_seconds',
  help: 'Performance duration by operation type',
  labelNames: ['operation', 'component', 'status'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [unifiedRegistry],
});

const memoryUsageGauge = new Gauge({
  name: 'spheroseg_memory_usage_bytes',
  help: 'Memory usage by type',
  labelNames: ['type'],
  registers: [unifiedRegistry],
});

const cpuUsageGauge = new Gauge({
  name: 'spheroseg_performance_cpu_usage_percent',
  help: 'Performance tracking CPU usage percentage',
  labelNames: ['type'],
  registers: [unifiedRegistry],
});

const throughputCounter = new Counter({
  name: 'spheroseg_operations_total',
  help: 'Total operations processed',
  labelNames: ['operation', 'status'],
  registers: [unifiedRegistry],
});

const performanceAnomalyCounter = new Counter({
  name: 'spheroseg_performance_anomalies_total',
  help: 'Performance anomalies detected',
  labelNames: ['anomaly_type', 'component'],
  registers: [unifiedRegistry],
});

// Performance tracking interfaces
export interface PerformanceMetric {
  operation: string;
  component: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'success' | 'error' | 'timeout';
  metadata?: Record<string, any>;
}

export interface PerformanceBaseline {
  operation: string;
  component: string;
  avgDuration: number;
  p50: number;
  p95: number;
  p99: number;
  samples: number;
  lastUpdated: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'slow_operation' | 'high_cpu' | 'memory_leak' | 'throughput_drop';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  metadata: Record<string, any>;
  resolved?: boolean;
}

export interface PerformanceRecommendation {
  id: string;
  type: 'optimization' | 'scaling' | 'caching' | 'refactoring';
  component: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  priority: number;
  details: Record<string, any>;
}

// Performance tracker class
class PerformanceTracker {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private alerts: PerformanceAlert[] = [];
  private recommendations: PerformanceRecommendation[] = [];
  private readonly maxMetricsPerOperation = 1000;
  private readonly baselineUpdateInterval = 60000; // 1 minute
  private lastBaselineUpdate = 0;

  /**
   * Start tracking a performance operation
   */
  public startTracking(
    operation: string,
    component: string,
    metadata?: Record<string, any>
  ): string {
    const trackingId = this.generateTrackingId();
    const metric: PerformanceMetric = {
      operation,
      component,
      startTime: performance.now(),
      status: 'success',
      metadata,
    };

    const key = `${operation}:${component}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metrics = this.metrics.get(key)!;
    metrics.push(metric);

    // Keep only recent metrics
    if (metrics.length > this.maxMetricsPerOperation) {
      metrics.shift();
    }

    return trackingId;
  }

  /**
   * Stop tracking a performance operation
   */
  public stopTracking(
    trackingId: string,
    operation: string,
    component: string,
    status: 'success' | 'error' | 'timeout' = 'success'
  ): void {
    const key = `${operation}:${component}`;
    const metrics = this.metrics.get(key);

    if (metrics) {
      const metric = metrics[metrics.length - 1];
      if (metric) {
        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;
        metric.status = status;

        // Update Prometheus metrics
        performanceHistogram.labels(operation, component, status).observe(metric.duration / 1000);

        throughputCounter.labels(operation, status).inc();

        // Check for performance anomalies
        this.checkPerformanceAnomalies(metric);

        // Update baselines periodically
        if (Date.now() - this.lastBaselineUpdate > this.baselineUpdateInterval) {
          this.updateBaselines();
          this.lastBaselineUpdate = Date.now();
        }
      }
    }
  }

  /**
   * Track memory usage
   */
  public trackMemoryUsage(): void {
    const memUsage = process.memoryUsage();

    memoryUsageGauge.labels('heap_used').set(memUsage.heapUsed);
    memoryUsageGauge.labels('heap_total').set(memUsage.heapTotal);
    memoryUsageGauge.labels('external').set(memUsage.external);
    memoryUsageGauge.labels('rss').set(memUsage.rss);

    // Check for memory leaks
    if (memUsage.heapUsed > memUsage.heapTotal * 0.9) {
      this.createAlert({
        type: 'memory_leak',
        message: 'High memory usage detected',
        severity: 'high',
        metadata: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          utilizationPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        },
      });
    }
  }

  /**
   * Track CPU usage
   */
  public trackCPUUsage(): void {
    const cpuUsage = process.cpuUsage();
    const totalCPU = cpuUsage.user + cpuUsage.system;

    cpuUsageGauge.labels('user').set(cpuUsage.user);
    cpuUsageGauge.labels('system').set(cpuUsage.system);
    cpuUsageGauge.labels('total').set(totalCPU);

    // Check for high CPU usage
    if (totalCPU > 80) {
      this.createAlert({
        type: 'high_cpu',
        message: 'High CPU usage detected',
        severity: 'medium',
        metadata: {
          userCPU: cpuUsage.user,
          systemCPU: cpuUsage.system,
          totalCPU,
        },
      });
    }
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    baselines: PerformanceBaseline[];
    alerts: PerformanceAlert[];
    recommendations: PerformanceRecommendation[];
    systemMetrics: {
      memory: NodeJS.MemoryUsage;
      cpu: NodeJS.CpuUsage;
    };
  } {
    return {
      baselines: Array.from(this.baselines.values()),
      alerts: this.alerts.slice(-20),
      recommendations: this.recommendations.slice(-10),
      systemMetrics: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };
  }

  /**
   * Generate performance report
   */
  public generatePerformanceReport(): {
    summary: {
      totalOperations: number;
      avgResponseTime: number;
      slowOperations: number;
      errorRate: number;
    };
    topSlowOperations: Array<{
      operation: string;
      component: string;
      avgDuration: number;
      p95: number;
    }>;
    recommendations: PerformanceRecommendation[];
    healthScore: number;
  } {
    const allMetrics = Array.from(this.metrics.values()).flat();
    const recentMetrics = allMetrics.filter(
      (metric) => Date.now() - metric.startTime < 60000 // Last minute
    );

    const totalOperations = recentMetrics.length;
    const avgResponseTime =
      recentMetrics.reduce((sum, metric) => sum + (metric.duration || 0), 0) / totalOperations || 0;

    const slowOperations = recentMetrics.filter(
      (metric) => (metric.duration || 0) > 1000 // > 1 second
    ).length;

    const errorRate =
      recentMetrics.filter((metric) => metric.status === 'error').length / totalOperations || 0;

    const topSlowOperations = Array.from(this.baselines.values())
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 5)
      .map((baseline) => ({
        operation: baseline.operation,
        component: baseline.component,
        avgDuration: baseline.avgDuration,
        p95: baseline.p95,
      }));

    // Calculate health score
    let healthScore = 100;
    if (errorRate > 0.1) healthScore -= 30;
    if (avgResponseTime > 1000) healthScore -= 20;
    if (slowOperations > totalOperations * 0.2) healthScore -= 25;
    if (this.alerts.filter((a) => !a.resolved).length > 5) healthScore -= 25;

    return {
      summary: {
        totalOperations,
        avgResponseTime,
        slowOperations,
        errorRate,
      },
      topSlowOperations,
      recommendations: this.recommendations.slice(-10),
      healthScore: Math.max(0, healthScore),
    };
  }

  /**
   * Generate optimization recommendations
   */
  public generateRecommendations(): void {
    const recommendations: PerformanceRecommendation[] = [];

    // Analyze slow operations
    for (const baseline of this.baselines.values()) {
      if (baseline.p95 > 2000) {
        // > 2 seconds
        recommendations.push({
          id: this.generateRecommendationId(),
          type: 'optimization',
          component: baseline.component,
          description: `Optimize slow operation: ${baseline.operation}`,
          impact: 'high',
          effort: 'medium',
          priority: 90,
          details: {
            operation: baseline.operation,
            p95Duration: baseline.p95,
            avgDuration: baseline.avgDuration,
            suggestions: [
              'Add caching layer',
              'Optimize database queries',
              'Implement pagination',
              'Add background processing',
            ],
          },
        });
      }
    }

    // Memory optimization recommendations
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > memUsage.heapTotal * 0.8) {
      recommendations.push({
        id: this.generateRecommendationId(),
        type: 'optimization',
        component: 'memory',
        description: 'Optimize memory usage',
        impact: 'high',
        effort: 'medium',
        priority: 85,
        details: {
          currentUsage: memUsage.heapUsed,
          totalHeap: memUsage.heapTotal,
          utilizationPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
          suggestions: [
            'Implement object pooling',
            'Review and fix memory leaks',
            'Optimize data structures',
            'Implement garbage collection tuning',
          ],
        },
      });
    }

    // Update recommendations
    this.recommendations = recommendations.sort((a, b) => b.priority - a.priority);
  }

  private updateBaselines(): void {
    for (const [key, metrics] of this.metrics.entries()) {
      const [operation, component] = key.split(':');
      const validMetrics = metrics.filter((m) => m.duration !== undefined);

      if (validMetrics.length === 0) continue;

      const durations = validMetrics.map((m) => m.duration!).sort((a, b) => a - b);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

      const p50Index = Math.floor(durations.length * 0.5);
      const p95Index = Math.floor(durations.length * 0.95);
      const p99Index = Math.floor(durations.length * 0.99);

      const baseline: PerformanceBaseline = {
        operation,
        component,
        avgDuration,
        p50: durations[p50Index] || 0,
        p95: durations[p95Index] || 0,
        p99: durations[p99Index] || 0,
        samples: validMetrics.length,
        lastUpdated: Date.now(),
      };

      this.baselines.set(key, baseline);
    }
  }

  private checkPerformanceAnomalies(metric: PerformanceMetric): void {
    const key = `${metric.operation}:${metric.component}`;
    const baseline = this.baselines.get(key);

    if (baseline && metric.duration) {
      // Check for slow operations (> 3x baseline P95)
      if (metric.duration > baseline.p95 * 3) {
        performanceAnomalyCounter.labels('slow_operation', metric.component).inc();

        this.createAlert({
          type: 'slow_operation',
          message: `Slow operation detected: ${metric.operation}`,
          severity: 'medium',
          metadata: {
            operation: metric.operation,
            component: metric.component,
            duration: metric.duration,
            baselineP95: baseline.p95,
            slowdownFactor: metric.duration / baseline.p95,
          },
        });
      }
    }
  }

  private createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const newAlert: PerformanceAlert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      ...alert,
    };

    this.alerts.push(newAlert);

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    logger.warn('Performance alert created', newAlert);
  }

  private generateTrackingId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateRecommendationId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Create singleton instance
export const performanceTracker = new PerformanceTracker();

// System monitoring intervals
setInterval(() => {
  performanceTracker.trackMemoryUsage();
  performanceTracker.trackCPUUsage();
}, 5000); // Every 5 seconds

setInterval(() => {
  performanceTracker.generateRecommendations();
}, 300000); // Every 5 minutes

/**
 * Performance tracking middleware
 */
export const performanceTrackingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = performance.now();
  const trackingId = performanceTracker.startTracking(req.route?.path || req.path, 'http', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
  });

  // Override res.end to capture completion time
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const duration = performance.now() - startTime;
    const status = res.statusCode < 400 ? 'success' : 'error';

    performanceTracker.stopTracking(trackingId, req.route?.path || req.path, 'http', status);

    // Add performance headers
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Performance metrics endpoint
 */
export const getPerformanceMetrics = () => {
  return {
    stats: performanceTracker.getPerformanceStats(),
    report: performanceTracker.generatePerformanceReport(),
  };
};
