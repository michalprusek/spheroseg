/**
 * Business Metrics and Alerting System
 * 
 * Tracks key business metrics and triggers alerts for anomalies,
 * processing failures, and user errors.
 */

import { EventEmitter } from 'events';
import { pool } from '../db';
import logger from '../utils/logger';
import { Redis } from 'ioredis';
import * as cron from 'node-cron';

export interface MetricConfig {
  name: string;
  description: string;
  query?: string; // SQL query to fetch metric
  calculator?: () => Promise<number>; // Custom calculator function
  unit: 'count' | 'percentage' | 'duration' | 'bytes' | 'currency';
  aggregation: 'sum' | 'avg' | 'max' | 'min' | 'count';
  interval: number; // Collection interval in minutes
  thresholds: {
    warning?: number;
    critical?: number;
    trend?: {
      increase?: number; // % increase that triggers alert
      decrease?: number; // % decrease that triggers alert
      window?: number; // Time window in minutes
    };
  };
  tags?: string[];
}

export interface MetricValue {
  metric: string;
  value: number;
  timestamp: Date;
  unit: string;
  tags?: string[];
}

export interface Alert {
  id: string;
  metric: string;
  severity: 'warning' | 'critical';
  type: 'threshold' | 'trend' | 'anomaly';
  message: string;
  value: number;
  threshold?: number;
  timestamp: Date;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface MetricStats {
  metric: string;
  current: number;
  average: number;
  min: number;
  max: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  lastUpdated: Date;
}

type AlertHandler = (alert: Alert) => Promise<void>;

export class BusinessMetricsService extends EventEmitter {
  private redis: Redis;
  private metrics: Map<string, MetricConfig> = new Map();
  private collectionJobs: Map<string, cron.ScheduledTask> = new Map();
  private alertHandlers: AlertHandler[] = [];
  private anomalyDetection: boolean = true;
  
  private readonly METRIC_PREFIX = 'metric:';
  private readonly ALERT_PREFIX = 'alert:';
  private readonly STATS_PREFIX = 'stats:metric:';
  private readonly HISTORY_PREFIX = 'history:metric:';
  
  constructor(redisClient: Redis) {
    super();
    this.redis = redisClient;
    this.setupDefaultMetrics();
  }

  /**
   * Register a business metric
   */
  public registerMetric(config: MetricConfig): void {
    this.metrics.set(config.name, config);
    
    // Schedule collection job
    const cronPattern = `*/${config.interval} * * * *`;
    const job = cron.schedule(cronPattern, async () => {
      await this.collectMetric(config.name);
    }, { scheduled: false });
    
    this.collectionJobs.set(config.name, job);
    job.start();
    
    logger.info('Business metric registered', {
      metric: config.name,
      interval: config.interval,
    });
  }

  /**
   * Register an alert handler
   */
  public registerAlertHandler(handler: AlertHandler): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Collect metric value
   */
  public async collectMetric(metricName: string): Promise<MetricValue | null> {
    const config = this.metrics.get(metricName);
    if (!config) {
      throw new Error(`Metric ${metricName} not registered`);
    }
    
    try {
      let value: number;
      
      if (config.query) {
        // Execute SQL query
        const result = await pool.query(config.query);
        value = result.rows[0]?.value || 0;
      } else if (config.calculator) {
        // Use custom calculator
        value = await config.calculator();
      } else {
        throw new Error(`Metric ${metricName} has no query or calculator`);
      }
      
      const metricValue: MetricValue = {
        metric: metricName,
        value,
        timestamp: new Date(),
        unit: config.unit,
        tags: config.tags,
      };
      
      // Store current value
      await this.storeMetricValue(metricValue);
      
      // Update statistics
      await this.updateMetricStats(metricName, value);
      
      // Check thresholds
      await this.checkThresholds(config, value);
      
      // Check trends
      await this.checkTrends(config, value);
      
      // Check for anomalies
      if (this.anomalyDetection) {
        await this.checkAnomalies(config, value);
      }
      
      this.emit('metricCollected', metricValue);
      
      return metricValue;
    } catch (error) {
      logger.error('Failed to collect metric', {
        metric: metricName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Alert on collection failure
      await this.createAlert({
        metric: metricName,
        severity: 'warning',
        type: 'threshold',
        message: `Failed to collect metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
        value: 0,
      });
      
      return null;
    }
  }

  /**
   * Get current metric value
   */
  public async getMetricValue(metricName: string): Promise<MetricValue | null> {
    const key = `${this.METRIC_PREFIX}${metricName}:current`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    return JSON.parse(data);
  }

  /**
   * Get metric statistics
   */
  public async getMetricStats(metricName: string): Promise<MetricStats | null> {
    const key = `${this.STATS_PREFIX}${metricName}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    return JSON.parse(data);
  }

  /**
   * Get metric history
   */
  public async getMetricHistory(
    metricName: string,
    startTime: Date,
    endTime: Date
  ): Promise<MetricValue[]> {
    const key = `${this.HISTORY_PREFIX}${metricName}`;
    const start = startTime.getTime();
    const end = endTime.getTime();
    
    const values = await this.redis.zrangebyscore(key, start, end, 'WITHSCORES');
    
    const history: MetricValue[] = [];
    for (let i = 0; i < values.length; i += 2) {
      const data = JSON.parse(values[i]);
      history.push(data);
    }
    
    return history;
  }

  /**
   * Get active alerts
   */
  public async getActiveAlerts(
    metricName?: string,
    severity?: 'warning' | 'critical'
  ): Promise<Alert[]> {
    const pattern = metricName 
      ? `${this.ALERT_PREFIX}${metricName}:*`
      : `${this.ALERT_PREFIX}*`;
    
    const keys = await this.scanKeys(pattern);
    const alerts: Alert[] = [];
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const alert: Alert = JSON.parse(data);
        if (!alert.acknowledged && (!severity || alert.severity === severity)) {
          alerts.push(alert);
        }
      }
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const keys = await this.scanKeys(`${this.ALERT_PREFIX}*:${alertId}`);
    
    if (keys.length === 0) {
      throw new Error(`Alert ${alertId} not found`);
    }
    
    const key = keys[0];
    const data = await this.redis.get(key);
    
    if (!data) {
      throw new Error(`Alert ${alertId} not found`);
    }
    
    const alert: Alert = JSON.parse(data);
    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    
    await this.redis.setex(key, 86400, JSON.stringify(alert)); // Keep for 24 hours
    
    this.emit('alertAcknowledged', alert);
  }

  /**
   * Get metric dashboard data
   */
  public async getDashboardData(): Promise<{
    metrics: Array<{
      name: string;
      config: MetricConfig;
      current: MetricValue | null;
      stats: MetricStats | null;
    }>;
    alerts: Alert[];
  }> {
    const metrics = [];
    
    for (const [name, config] of this.metrics) {
      const current = await this.getMetricValue(name);
      const stats = await this.getMetricStats(name);
      
      metrics.push({
        name,
        config,
        current,
        stats,
      });
    }
    
    const alerts = await this.getActiveAlerts();
    
    return { metrics, alerts };
  }

  /**
   * Setup default business metrics
   */
  private setupDefaultMetrics(): void {
    // Processing failure rate
    this.registerMetric({
      name: 'processing_failure_rate',
      description: 'Percentage of failed image processing jobs',
      query: `
        SELECT 
          ROUND(
            COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / 
            NULLIF(COUNT(*), 0),
            2
          ) as value
        FROM segmentation_tasks
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `,
      unit: 'percentage',
      aggregation: 'avg',
      interval: 5, // Every 5 minutes
      thresholds: {
        warning: 5, // 5% failure rate
        critical: 10, // 10% failure rate
        trend: {
          increase: 50, // 50% increase
          window: 30, // 30 minute window
        },
      },
      tags: ['processing', 'quality'],
    });

    // User error rate
    this.registerMetric({
      name: 'user_error_rate',
      description: 'Number of user errors per hour',
      query: `
        SELECT COUNT(*) as value
        FROM error_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
        AND error_type IN ('validation', 'user_input', 'permission_denied')
      `,
      unit: 'count',
      aggregation: 'sum',
      interval: 5,
      thresholds: {
        warning: 50, // 50 errors per hour
        critical: 100, // 100 errors per hour
        trend: {
          increase: 100, // 100% increase
          window: 60,
        },
      },
      tags: ['users', 'errors'],
    });

    // Average processing time
    this.registerMetric({
      name: 'avg_processing_time',
      description: 'Average time to process an image',
      query: `
        SELECT 
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (completed_at - started_at))
            ),
            2
          ) as value
        FROM segmentation_results
        WHERE completed_at > NOW() - INTERVAL '1 hour'
        AND status = 'completed'
      `,
      unit: 'duration',
      aggregation: 'avg',
      interval: 10,
      thresholds: {
        warning: 300, // 5 minutes
        critical: 600, // 10 minutes
        trend: {
          increase: 50,
          window: 60,
        },
      },
      tags: ['processing', 'performance'],
    });

    // Active users
    this.registerMetric({
      name: 'active_users',
      description: 'Number of active users in the last hour',
      query: `
        SELECT COUNT(DISTINCT user_id) as value
        FROM user_activity_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `,
      unit: 'count',
      aggregation: 'count',
      interval: 15,
      thresholds: {
        trend: {
          decrease: 50, // 50% decrease might indicate issues
          window: 120,
        },
      },
      tags: ['users', 'engagement'],
    });

    // Queue backlog
    this.registerMetric({
      name: 'queue_backlog',
      description: 'Number of items waiting in processing queue',
      query: `
        SELECT COUNT(*) as value
        FROM segmentation_queue
        WHERE status IN ('queued', 'processing')
      `,
      unit: 'count',
      aggregation: 'count',
      interval: 5,
      thresholds: {
        warning: 100,
        critical: 500,
        trend: {
          increase: 100,
          window: 30,
        },
      },
      tags: ['processing', 'capacity'],
    });

    // Storage usage
    this.registerMetric({
      name: 'storage_usage',
      description: 'Total storage used by images',
      query: `
        SELECT COALESCE(SUM(file_size), 0) / 1073741824.0 as value
        FROM images
      `,
      unit: 'bytes',
      aggregation: 'sum',
      interval: 60, // Every hour
      thresholds: {
        warning: 1000, // 1TB
        critical: 2000, // 2TB
      },
      tags: ['infrastructure', 'storage'],
    });

    // API response time
    this.registerMetric({
      name: 'api_response_time_p95',
      description: '95th percentile API response time',
      calculator: async () => {
        // This would typically come from APM or logs
        const result = await pool.query(`
          SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as value
          FROM api_request_logs
          WHERE created_at > NOW() - INTERVAL '5 minutes'
        `);
        return result.rows[0]?.value || 0;
      },
      unit: 'duration',
      aggregation: 'max',
      interval: 5,
      thresholds: {
        warning: 1000, // 1 second
        critical: 3000, // 3 seconds
      },
      tags: ['api', 'performance'],
    });

    // Segmentation accuracy
    this.registerMetric({
      name: 'segmentation_accuracy',
      description: 'Average segmentation accuracy score',
      query: `
        SELECT 
          ROUND(AVG(accuracy_score) * 100, 2) as value
        FROM segmentation_results
        WHERE completed_at > NOW() - INTERVAL '1 hour'
        AND accuracy_score IS NOT NULL
      `,
      unit: 'percentage',
      aggregation: 'avg',
      interval: 30,
      thresholds: {
        warning: 85, // Below 85% accuracy
        trend: {
          decrease: 10, // 10% decrease
          window: 180,
        },
      },
      tags: ['ml', 'quality'],
    });
  }

  /**
   * Store metric value
   */
  private async storeMetricValue(metricValue: MetricValue): Promise<void> {
    // Store current value
    const currentKey = `${this.METRIC_PREFIX}${metricValue.metric}:current`;
    await this.redis.setex(currentKey, 3600, JSON.stringify(metricValue));
    
    // Store in history (sorted set by timestamp)
    const historyKey = `${this.HISTORY_PREFIX}${metricValue.metric}`;
    await this.redis.zadd(
      historyKey,
      metricValue.timestamp.getTime(),
      JSON.stringify(metricValue)
    );
    
    // Expire old history (keep 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await this.redis.zremrangebyscore(historyKey, '-inf', cutoff);
  }

  /**
   * Update metric statistics
   */
  private async updateMetricStats(metricName: string, value: number): Promise<void> {
    const statsKey = `${this.STATS_PREFIX}${metricName}`;
    const existing = await this.redis.get(statsKey);
    
    let stats: MetricStats;
    
    if (existing) {
      stats = JSON.parse(existing);
      
      // Update stats
      stats.current = value;
      stats.min = Math.min(stats.min, value);
      stats.max = Math.max(stats.max, value);
      
      // Calculate new average (simple moving average)
      const alpha = 0.1; // Smoothing factor
      stats.average = alpha * value + (1 - alpha) * stats.average;
      
      // Calculate trend
      const change = ((value - stats.average) / stats.average) * 100;
      if (change > 5) {
        stats.trend = 'increasing';
        stats.trendPercentage = change;
      } else if (change < -5) {
        stats.trend = 'decreasing';
        stats.trendPercentage = Math.abs(change);
      } else {
        stats.trend = 'stable';
        stats.trendPercentage = 0;
      }
    } else {
      stats = {
        metric: metricName,
        current: value,
        average: value,
        min: value,
        max: value,
        trend: 'stable',
        trendPercentage: 0,
        lastUpdated: new Date(),
      };
    }
    
    stats.lastUpdated = new Date();
    await this.redis.setex(statsKey, 86400, JSON.stringify(stats));
  }

  /**
   * Check threshold violations
   */
  private async checkThresholds(config: MetricConfig, value: number): Promise<void> {
    const { thresholds } = config;
    
    if (thresholds.critical && value >= thresholds.critical) {
      await this.createAlert({
        metric: config.name,
        severity: 'critical',
        type: 'threshold',
        message: `${config.description} exceeded critical threshold`,
        value,
        threshold: thresholds.critical,
      });
    } else if (thresholds.warning && value >= thresholds.warning) {
      await this.createAlert({
        metric: config.name,
        severity: 'warning',
        type: 'threshold',
        message: `${config.description} exceeded warning threshold`,
        value,
        threshold: thresholds.warning,
      });
    }
  }

  /**
   * Check trend violations
   */
  private async checkTrends(config: MetricConfig, currentValue: number): Promise<void> {
    const { trend } = config.thresholds;
    if (!trend) return;
    
    const window = trend.window || 60;
    const history = await this.getMetricHistory(
      config.name,
      new Date(Date.now() - window * 60 * 1000),
      new Date()
    );
    
    if (history.length < 2) return;
    
    const oldValue = history[0].value;
    const percentChange = ((currentValue - oldValue) / oldValue) * 100;
    
    if (trend.increase && percentChange >= trend.increase) {
      await this.createAlert({
        metric: config.name,
        severity: 'warning',
        type: 'trend',
        message: `${config.description} increased by ${percentChange.toFixed(1)}% in ${window} minutes`,
        value: currentValue,
      });
    } else if (trend.decrease && percentChange <= -trend.decrease) {
      await this.createAlert({
        metric: config.name,
        severity: 'warning',
        type: 'trend',
        message: `${config.description} decreased by ${Math.abs(percentChange).toFixed(1)}% in ${window} minutes`,
        value: currentValue,
      });
    }
  }

  /**
   * Check for anomalies using simple statistical method
   */
  private async checkAnomalies(config: MetricConfig, value: number): Promise<void> {
    const stats = await this.getMetricStats(config.name);
    if (!stats || stats.average === 0) return;
    
    // Simple z-score anomaly detection
    const history = await this.getMetricHistory(
      config.name,
      new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      new Date()
    );
    
    if (history.length < 10) return;
    
    // Calculate standard deviation
    const values = history.map(h => h.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const zScore = Math.abs((value - mean) / stdDev);
    
    // Alert if z-score > 3 (99.7% confidence)
    if (zScore > 3) {
      await this.createAlert({
        metric: config.name,
        severity: 'warning',
        type: 'anomaly',
        message: `${config.description} shows anomalous value (z-score: ${zScore.toFixed(2)})`,
        value,
      });
    }
  }

  /**
   * Create and dispatch alert
   */
  private async createAlert(alertData: Omit<Alert, 'id' | 'timestamp'>): Promise<void> {
    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      acknowledged: false,
      ...alertData,
    };
    
    // Store alert
    const key = `${this.ALERT_PREFIX}${alert.metric}:${alert.id}`;
    await this.redis.setex(key, 86400 * 7, JSON.stringify(alert)); // Keep for 7 days
    
    // Dispatch to handlers
    for (const handler of this.alertHandlers) {
      try {
        await handler(alert);
      } catch (error) {
        logger.error('Alert handler failed', { alert, error });
      }
    }
    
    // Emit event
    this.emit('alert', alert);
    
    logger.warn('Business metric alert', {
      metric: alert.metric,
      severity: alert.severity,
      type: alert.type,
      value: alert.value,
      message: alert.message,
    });
  }

  /**
   * Scan Redis keys by pattern
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const [newCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      keys.push(...batch);
      cursor = newCursor;
    } while (cursor !== '0');
    
    return keys;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop all metric collection
   */
  public stopAll(): void {
    for (const job of this.collectionJobs.values()) {
      job.stop();
    }
    this.collectionJobs.clear();
  }
}

// Export singleton instance
let metricsService: BusinessMetricsService | null = null;

export function initializeBusinessMetrics(redisClient: Redis): BusinessMetricsService {
  if (!metricsService) {
    metricsService = new BusinessMetricsService(redisClient);
  }
  return metricsService;
}

export function getBusinessMetrics(): BusinessMetricsService {
  if (!metricsService) {
    throw new Error('Business metrics service not initialized');
  }
  return metricsService;
}

export default {
  initializeBusinessMetrics,
  getBusinessMetrics,
};