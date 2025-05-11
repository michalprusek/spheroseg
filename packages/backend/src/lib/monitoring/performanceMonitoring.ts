import os from 'os';
import {
  PerformanceMonitoring,
  PerformanceMonitoringOptions,
  MetricType,
  ApiResponseTimeMetric,
  DatabaseQueryMetric,
  FileOperationMetric,
  MLInferenceMetric,
  MemoryHeapMetric,
  CPUUsageMetric,
} from '@spheroseg/shared';
import { client as prometheusClient } from '../metrics/prometheusClient';

/**
 * Backend implementation of performance monitoring
 */
export class BackendPerformanceMonitoring extends PerformanceMonitoring {
  private static instance: BackendPerformanceMonitoring | null = null;
  private cpuUsageLastSample: {
    user: number;
    system: number;
    idle: number;
  } | null = null;

  /**
   * Get singleton instance
   */
  public static getInstance(options?: Partial<PerformanceMonitoringOptions>): BackendPerformanceMonitoring {
    if (!BackendPerformanceMonitoring.instance) {
      BackendPerformanceMonitoring.instance = new BackendPerformanceMonitoring(options);
    } else if (options) {
      // Update options if provided
      BackendPerformanceMonitoring.instance.options = {
        ...BackendPerformanceMonitoring.instance.options,
        ...options,
      };
    }
    return BackendPerformanceMonitoring.instance;
  }

  constructor(options: Partial<PerformanceMonitoringOptions> = {}) {
    super({
      ...options,
      globalLabels: {
        ...options.globalLabels,
        app: 'backend',
        environment: process.env.NODE_ENV || 'development',
      },
    });

    // Start system monitoring
    if (this.options.enabled) {
      this.startSystemMonitoring();
    }
  }

  /**
   * Start monitoring system metrics
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
   * Record API response time metric
   */
  public recordApiResponseTimeMetric(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
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

    // Also record to Prometheus if available
    if (prometheusClient) {
      const httpRequestDurationMicroseconds = prometheusClient.getMetric('http_request_duration_ms');
      if (httpRequestDurationMicroseconds) {
        httpRequestDurationMicroseconds
          .labels({
            method,
            route: endpoint,
            status_code: statusCode.toString(),
          })
          .observe(responseTime);
      }
    }
  }

  /**
   * Record database query metric
   */
  public recordDatabaseQueryMetric(operation: string, table: string, duration: number, rowCount?: number): void {
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

    // Also record to Prometheus if available
    if (prometheusClient) {
      const dbQueryDurationMs = prometheusClient.getMetric('db_query_duration_ms');
      if (dbQueryDurationMs) {
        dbQueryDurationMs
          .labels({
            operation,
            table,
          })
          .observe(duration);
      }
    }
  }

  /**
   * Record file operation metric
   */
  public recordFileOperationMetric(operation: string, filePath: string, duration: number, fileSize?: number): void {
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
  }

  /**
   * Record ML inference metric
   */
  public recordMLInferenceMetric(model: string, inputSize: number, duration: number, memoryUsage?: number): void {
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

    // Also record to Prometheus if available
    if (prometheusClient) {
      const mlInferenceDurationMs = prometheusClient.getMetric('ml_inference_duration_ms');
      if (mlInferenceDurationMs) {
        mlInferenceDurationMs
          .labels({
            model,
          })
          .observe(duration);
      }
    }
  }

  /**
   * Record memory heap metric
   */
  private recordMemoryHeapMetric(): void {
    if (!this.options.enabled) return;

    try {
      const memoryUsage = process.memoryUsage();
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

      // Also record to Prometheus if available
      if (prometheusClient) {
        const nodeMemoryHeapTotal = prometheusClient.getMetric('node_memory_heap_total_bytes');
        const nodeMemoryHeapUsed = prometheusClient.getMetric('node_memory_heap_used_bytes');
        const nodeMemoryRss = prometheusClient.getMetric('node_memory_rss_bytes');

        if (nodeMemoryHeapTotal) {
          nodeMemoryHeapTotal.set(memoryUsage.heapTotal);
        }
        if (nodeMemoryHeapUsed) {
          nodeMemoryHeapUsed.set(memoryUsage.heapUsed);
        }
        if (nodeMemoryRss) {
          nodeMemoryRss.set(memoryUsage.rss);
        }
      }
    } catch (e) {
      console.error('Error recording memory heap metrics:', e);
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

      if (this.cpuUsageLastSample) {
        const userDiff = totalUser - this.cpuUsageLastSample.user;
        const systemDiff = totalSystem - this.cpuUsageLastSample.system;
        const idleDiff = totalIdle - this.cpuUsageLastSample.idle;
        const totalDiff = userDiff + systemDiff + idleDiff;

        const userPercentage = (userDiff / totalDiff) * 100;
        const systemPercentage = (systemDiff / totalDiff) * 100;
        const totalPercentage = ((userDiff + systemDiff) / totalDiff) * 100;

        const metric: CPUUsageMetric = {
          type: MetricType.CPU_USAGE,
          timestamp: Date.now(),
          value: totalPercentage,
          user: userPercentage,
          system: systemPercentage,
          percentage: totalPercentage,
        };

        this.recordMetric(metric);

        // Also record to Prometheus if available
        if (prometheusClient) {
          const nodeCpuUsagePercent = prometheusClient.getMetric('node_cpu_usage_percent');
          if (nodeCpuUsagePercent) {
            nodeCpuUsagePercent.set(totalPercentage);
          }
        }
      }

      // Update last sample
      this.cpuUsageLastSample = {
        user: totalUser,
        system: totalSystem,
        idle: totalIdle,
      };
    } catch (e) {
      console.error('Error recording CPU usage metrics:', e);
    }
  }

  /**
   * Flush metrics to the database or other storage
   */
  protected async flushMetrics(): Promise<void> {
    if (!this.options.enabled || this.metricsQueue.length === 0) return;

    const metrics = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      // In a real implementation, you would store these metrics in a database
      // or send them to a monitoring service
      console.log(`Flushing ${metrics.length} metrics to storage`);

      // For now, we'll just log them if console logging is enabled
      if (this.options.consoleLogging) {
        console.log('Metrics:', metrics);
      }

      // TODO: Implement actual storage of metrics
      // This could be a database, a file, or a third-party service
    } catch (error) {
      console.error('Error flushing metrics:', error);
      // Put metrics back in the queue to try again later
      this.metricsQueue = [...metrics, ...this.metricsQueue];
    }
  }
}

/**
 * Create a backend performance monitoring instance
 */
export function createPerformanceMonitoring(
  options: Partial<PerformanceMonitoringOptions> = {},
): BackendPerformanceMonitoring {
  return BackendPerformanceMonitoring.getInstance(options);
}
