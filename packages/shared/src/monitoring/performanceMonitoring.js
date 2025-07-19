"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitoring = exports.DEFAULT_MONITORING_OPTIONS = void 0;
exports.createPerformanceMonitoring = createPerformanceMonitoring;
/**
 * Default options for performance monitoring
 */
exports.DEFAULT_MONITORING_OPTIONS = {
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
class PerformanceMonitoring {
    constructor(options = {}) {
        this.metricsQueue = [];
        this.flushIntervalId = null;
        this.options = { ...exports.DEFAULT_MONITORING_OPTIONS, ...options };
        if (this.options.enabled) {
            this.startMonitoring();
        }
    }
    /**
     * Start monitoring and set up flush interval
     */
    startMonitoring() {
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
    stopMonitoring() {
        if (this.flushIntervalId) {
            clearInterval(this.flushIntervalId);
            this.flushIntervalId = null;
        }
    }
    /**
     * Record a metric
     */
    recordMetric(metric) {
        if (!this.options.enabled)
            return;
        // Add global labels
        const enrichedMetric = {
            ...metric,
            labels: { ...this.options.globalLabels, ...metric.labels },
            timestamp: metric.timestamp || Date.now(),
        };
        // Add to queue
        this.metricsQueue.push(enrichedMetric);
        // Log to console if enabled
        // Logging is disabled in production to comply with linting rules
        // if (this.options.consoleLogging) {
        //   console.log(`[Metrics] ${metric.type}:`, enrichedMetric);
        // }
        // Flush if queue is full
        if (this.metricsQueue.length >= (this.options.maxBatchSize || 100)) {
            this.flushMetrics();
        }
    }
    /**
     * Create a base metric with common fields
     */
    createBaseMetric(type, value, labels) {
        const metric = {
            type,
            timestamp: Date.now(),
            value,
        };
        if (labels !== undefined) {
            metric.labels = labels;
        }
        return metric;
    }
}
exports.PerformanceMonitoring = PerformanceMonitoring;
/**
 * Create a performance monitoring instance
 * This is a placeholder that should be implemented differently in frontend and backend
 */
function createPerformanceMonitoring(
// Options parameter is unused in base implementation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_options = {}) {
    throw new Error('createPerformanceMonitoring must be implemented by the frontend or backend');
}
//# sourceMappingURL=performanceMonitoring.js.map