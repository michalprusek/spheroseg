/**
 * Performance monitoring utilities shared between frontend and backend
 */
import { BaseMetric, Metric, MetricType } from './metricsTypes';

/**
 * Options for the performance monitoring
 */
export interface PerformanceMonitoringOptions {
  /** Whether to enable monitoring */
  enabled: boolean;
  /** Endpoint to send metrics to */
  endpoint?: string;
  /** How often to send batched metrics (in ms) */
  flushInterval?: number;
  /** Maximum number of metrics to batch before sending */
  maxBatchSize?: number;
  /** Whether to log metrics to console */
  consoleLogging?: boolean;
  /** Additional global labels to add to all metrics */
  globalLabels?: Record<string, string>;
}

/**
 * Default options for performance monitoring
 */
export const DEFAULT_MONITORING_OPTIONS: PerformanceMonitoringOptions = {
  enabled: false,
  endpoint: '/api/metrics',
  flushInterval: 10000, // 10 seconds
  maxBatchSize: 100,
  consoleLogging: false,
  globalLabels: {},
};

/**
 * Base class for performance monitoring
 * Can be extended for specific frontend/backend implementations
 */
export abstract class PerformanceMonitoring {
  protected options: PerformanceMonitoringOptions;
  protected metricsQueue: Metric[] = [];
  protected flushIntervalId: NodeJS.Timeout | null = null;

  constructor(options: Partial<PerformanceMonitoringOptions> = {}) {
    this.options = { ...DEFAULT_MONITORING_OPTIONS, ...options };
    
    if (this.options.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start monitoring and set up flush interval
   */
  public startMonitoring(): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
    }
    
    if (this.options.enabled && this.options.flushInterval) {
      this.flushIntervalId = setInterval(() => {
        this.flushMetrics();
      }, this.options.flushInterval);
    }
  }

  /**
   * Stop monitoring and clear flush interval
   */
  public stopMonitoring(): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  /**
   * Record a metric
   */
  public recordMetric(metric: Metric): void {
    if (!this.options.enabled) return;
    
    // Add global labels
    const enrichedMetric = {
      ...metric,
      labels: { ...this.options.globalLabels, ...metric.labels },
      timestamp: metric.timestamp || Date.now(),
    };
    
    // Add to queue
    this.metricsQueue.push(enrichedMetric);
    
    // Log to console if enabled
    if (this.options.consoleLogging) {
      console.log(`[Metrics] ${metric.type}:`, enrichedMetric);
    }
    
    // Flush if queue is full
    if (this.metricsQueue.length >= (this.options.maxBatchSize || 100)) {
      this.flushMetrics();
    }
  }

  /**
   * Create a base metric with common fields
   */
  protected createBaseMetric(type: MetricType, value: number, labels?: Record<string, string>): BaseMetric {
    return {
      type,
      timestamp: Date.now(),
      value,
      labels,
    };
  }

  /**
   * Flush metrics to the server
   * This method should be implemented by subclasses
   */
  protected abstract flushMetrics(): Promise<void>;
}

/**
 * Create a performance monitoring instance
 * This is a placeholder that should be implemented differently in frontend and backend
 */
export function createPerformanceMonitoring(
  options: Partial<PerformanceMonitoringOptions> = {}
): PerformanceMonitoring {
  throw new Error('createPerformanceMonitoring must be implemented by the frontend or backend');
}
