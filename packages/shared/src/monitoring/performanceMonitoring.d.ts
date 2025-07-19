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
    /** Maximum number of metrics to keep in queue */
    maxMetricsInQueue?: number;
    /** Whether to log metrics to console */
    consoleLogging?: boolean;
    /** Additional global labels to add to all metrics */
    globalLabels?: Record<string, string>;
}
/**
 * Default options for performance monitoring
 */
export declare const DEFAULT_MONITORING_OPTIONS: PerformanceMonitoringOptions;
/**
 * Base class for performance monitoring
 * Can be extended for specific frontend/backend implementations
 */
export declare abstract class PerformanceMonitoring {
    protected options: PerformanceMonitoringOptions;
    protected metricsQueue: Metric[];
    protected flushIntervalId: NodeJS.Timeout | null;
    constructor(options?: Partial<PerformanceMonitoringOptions>);
    /**
     * Start monitoring and set up flush interval
     */
    startMonitoring(): void;
    /**
     * Stop monitoring and clear flush interval
     */
    stopMonitoring(): void;
    /**
     * Record a metric
     */
    recordMetric(metric: Metric): void;
    /**
     * Create a base metric with common fields
     */
    protected createBaseMetric(type: MetricType, value: number, labels?: Record<string, string>): BaseMetric;
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
export declare function createPerformanceMonitoring(_options?: Partial<PerformanceMonitoringOptions>): PerformanceMonitoring;
//# sourceMappingURL=performanceMonitoring.d.ts.map