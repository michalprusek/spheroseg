/**
 * Performance Optimizer
 * 
 * Advanced performance monitoring and optimization system that:
 * - Implements intelligent metric aggregation and batching
 * - Provides real-time performance insights and recommendations
 * - Automatically detects and mitigates performance bottlenecks
 * - Integrates with caching, compression, and resource optimization
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import logger from '../../utils/logger';
import { unifiedRegistry } from '../unified';
import { Histogram, Counter, Gauge } from 'prom-client';
import NodeCache from 'node-cache';

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage' | 'rate';
  category: 'api' | 'database' | 'cache' | 'ml' | 'system' | 'user';
  timestamp: number;
  source: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface PerformanceInsight {
  id: string;
  type: 'bottleneck' | 'optimization' | 'anomaly' | 'recommendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  metrics: string[];
  timestamp: number;
  confidence: number; // 0-1
}

export interface OptimizationRule {
  id: string;
  name: string;
  condition: (metrics: PerformanceMetric[]) => boolean;
  action: (metrics: PerformanceMetric[]) => Promise<void>;
  priority: number;
  enabled: boolean;
  cooldown: number; // minutes
  lastExecuted?: number;
}

export interface PerformanceReport {
  summary: {
    totalMetrics: number;
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  };
  insights: PerformanceInsight[];
  recommendations: string[];
  trends: {
    responseTime: 'improving' | 'stable' | 'degrading';
    errorRate: 'improving' | 'stable' | 'degrading';
    throughput: 'improving' | 'stable' | 'degrading';
  };
  timestamp: number;
}

class PerformanceOptimizer extends EventEmitter {
  private redis: Redis;
  private metricsBuffer: PerformanceMetric[] = [];
  private insightsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
  private optimizationRules: OptimizationRule[] = [];
  private isProcessing = false;
  private batchSize = 100;
  private flushInterval = 10000; // 10 seconds
  private analysisInterval = 60000; // 1 minute

  // Prometheus metrics
  private performanceMetricsCounter: Counter<string>;
  private responseTimeHistogram: Histogram<string>;
  private throughputGauge: Gauge<string>;
  private errorRateGauge: Gauge<string>;
  private systemHealthGauge: Gauge<string>;
  private insightsCounter: Counter<string>;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.initializeMetrics();
    this.initializeOptimizationRules();
    this.startPeriodicProcessing();
  }

  private initializeMetrics(): void {
    // Prometheus metrics for tracking performance optimization
    this.performanceMetricsCounter = new Counter({
      name: 'spheroseg_performance_metrics_total',
      help: 'Total number of performance metrics collected',
      labelNames: ['category', 'source'],
      registers: [unifiedRegistry],
    });

    this.responseTimeHistogram = new Histogram({
      name: 'spheroseg_optimized_response_time_seconds',
      help: 'Optimized response time histogram',
      labelNames: ['endpoint', 'method'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
      registers: [unifiedRegistry],
    });

    this.throughputGauge = new Gauge({
      name: 'spheroseg_throughput_requests_per_second',
      help: 'Current system throughput in requests per second',
      registers: [unifiedRegistry],
    });

    this.errorRateGauge = new Gauge({
      name: 'spheroseg_error_rate_percentage',
      help: 'Current system error rate percentage',
      registers: [unifiedRegistry],
    });

    this.systemHealthGauge = new Gauge({
      name: 'spheroseg_system_health_score',
      help: 'Overall system health score (0-100)',
      registers: [unifiedRegistry],
    });

    this.insightsCounter = new Counter({
      name: 'spheroseg_performance_insights_total',
      help: 'Total number of performance insights generated',
      labelNames: ['type', 'severity'],
      registers: [unifiedRegistry],
    });
  }

  private initializeOptimizationRules(): void {
    this.optimizationRules = [
      {
        id: 'high_response_time',
        name: 'High Response Time Optimizer',
        condition: (metrics) => {
          const responseTimeMetrics = metrics.filter(m => m.name === 'api_response_time');
          const avgResponseTime = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length;
          return avgResponseTime > 1000; // > 1 second
        },
        action: async (metrics) => {
          await this.optimizeResponseTime(metrics);
        },
        priority: 1,
        enabled: true,
        cooldown: 10,
      },
      {
        id: 'memory_pressure',
        name: 'Memory Pressure Optimizer',
        condition: (metrics) => {
          const memoryMetrics = metrics.filter(m => m.name === 'memory_usage');
          const latestMemory = memoryMetrics[memoryMetrics.length - 1];
          return latestMemory && latestMemory.value > 80; // > 80% memory usage
        },
        action: async (metrics) => {
          await this.optimizeMemoryUsage(metrics);
        },
        priority: 2,
        enabled: true,
        cooldown: 5,
      },
      {
        id: 'database_slow_queries',
        name: 'Database Query Optimizer',
        condition: (metrics) => {
          const dbMetrics = metrics.filter(m => m.category === 'database' && m.value > 500);
          return dbMetrics.length > 5; // More than 5 slow queries
        },
        action: async (metrics) => {
          await this.optimizeDatabaseQueries(metrics);
        },
        priority: 3,
        enabled: true,
        cooldown: 15,
      },
      {
        id: 'cache_hit_rate',
        name: 'Cache Optimization',
        condition: (metrics) => {
          const cacheMetrics = metrics.filter(m => m.name === 'cache_hit_rate');
          const latestHitRate = cacheMetrics[cacheMetrics.length - 1];
          return latestHitRate && latestHitRate.value < 50; // < 50% hit rate
        },
        action: async (metrics) => {
          await this.optimizeCacheStrategy(metrics);
        },
        priority: 4,
        enabled: true,
        cooldown: 20,
      },
    ];
  }

  public recordMetric(metric: PerformanceMetric): void {
    // Add to buffer for batched processing
    this.metricsBuffer.push({
      ...metric,
      timestamp: metric.timestamp || Date.now(),
      id: metric.id || `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

    // Update Prometheus metrics
    this.performanceMetricsCounter.inc({
      category: metric.category,
      source: metric.source,
    });

    // Auto-flush if buffer is full
    if (this.metricsBuffer.length >= this.batchSize) {
      this.flushMetrics();
    }

    this.emit('metricRecorded', metric);
  }

  public async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const metricsToProcess = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Store metrics in Redis with TTL
      const pipeline = this.redis.pipeline();
      const timestamp = Date.now();

      for (const metric of metricsToProcess) {
        const key = `performance_metrics:${metric.category}:${timestamp}`;
        pipeline.lpush(key, JSON.stringify(metric));
        pipeline.expire(key, 86400); // 24 hours TTL
      }

      await pipeline.exec();

      // Analyze metrics for insights
      await this.analyzeMetrics(metricsToProcess);

      logger.debug(`Flushed ${metricsToProcess.length} performance metrics`);
    } catch (error) {
      logger.error('Error flushing performance metrics:', error);
      // Put metrics back in buffer
      this.metricsBuffer.unshift(...metricsToProcess);
    } finally {
      this.isProcessing = false;
    }
  }

  private async analyzeMetrics(metrics: PerformanceMetric[]): Promise<void> {
    try {
      // Generate insights
      const insights = await this.generateInsights(metrics);
      
      for (const insight of insights) {
        this.insightsCounter.inc({
          type: insight.type,
          severity: insight.severity,
        });

        // Cache insights
        this.insightsCache.set(insight.id, insight);
        
        // Emit insight event
        this.emit('insightGenerated', insight);

        // Log critical insights
        if (insight.severity === 'critical') {
          logger.warn(`Critical performance insight: ${insight.title}`, {
            insight: insight.description,
            recommendation: insight.recommendation,
          });
        }
      }

      // Apply optimization rules
      await this.applyOptimizationRules(metrics);

    } catch (error) {
      logger.error('Error analyzing performance metrics:', error);
    }
  }

  private async generateInsights(metrics: PerformanceMetric[]): Promise<PerformanceInsight[]> {
    const insights: PerformanceInsight[] = [];
    const now = Date.now();

    // Response time analysis
    const responseTimeMetrics = metrics.filter(m => m.name === 'api_response_time');
    if (responseTimeMetrics.length > 0) {
      const avgResponseTime = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length;
      const maxResponseTime = Math.max(...responseTimeMetrics.map(m => m.value));

      if (avgResponseTime > 1000) {
        insights.push({
          id: `insight_response_time_${now}`,
          type: 'bottleneck',
          severity: avgResponseTime > 3000 ? 'critical' : 'high',
          title: 'High Average Response Time',
          description: `Average API response time is ${avgResponseTime.toFixed(0)}ms, which exceeds the 1000ms threshold.`,
          impact: `Users experience slow application performance, potential increased bounce rate.`,
          recommendation: `Implement caching, optimize database queries, consider request batching.`,
          metrics: ['api_response_time'],
          timestamp: now,
          confidence: 0.9,
        });
      }

      if (maxResponseTime > 5000) {
        insights.push({
          id: `insight_max_response_time_${now}`,
          type: 'anomaly',
          severity: 'critical',
          title: 'Extremely Slow Request Detected',
          description: `Maximum response time reached ${maxResponseTime.toFixed(0)}ms.`,
          impact: `Some requests are timing out or causing very poor user experience.`,
          recommendation: `Investigate specific slow endpoints, check for database locks, review ML processing times.`,
          metrics: ['api_response_time'],
          timestamp: now,
          confidence: 0.95,
        });
      }
    }

    // Error rate analysis
    const errorMetrics = metrics.filter(m => m.name === 'error_rate');
    if (errorMetrics.length > 0) {
      const latestErrorRate = errorMetrics[errorMetrics.length - 1];
      if (latestErrorRate.value > 5) {
        insights.push({
          id: `insight_error_rate_${now}`,
          type: 'bottleneck',
          severity: latestErrorRate.value > 15 ? 'critical' : 'high',
          title: 'High Error Rate',
          description: `Current error rate is ${latestErrorRate.value.toFixed(1)}%, exceeding the 5% threshold.`,
          impact: `Users experiencing frequent errors, potential data loss or failed operations.`,
          recommendation: `Review error logs, implement better error handling, check third-party service health.`,
          metrics: ['error_rate'],
          timestamp: now,
          confidence: 0.85,
        });
      }
    }

    // Memory usage analysis
    const memoryMetrics = metrics.filter(m => m.name === 'memory_usage');
    if (memoryMetrics.length > 0) {
      const latestMemory = memoryMetrics[memoryMetrics.length - 1];
      if (latestMemory.value > 85) {
        insights.push({
          id: `insight_memory_${now}`,
          type: 'bottleneck',
          severity: latestMemory.value > 95 ? 'critical' : 'high',
          title: 'High Memory Usage',
          description: `Memory usage is at ${latestMemory.value.toFixed(1)}%, approaching system limits.`,
          impact: `Risk of out-of-memory errors, potential service crashes, degraded performance.`,
          recommendation: `Implement garbage collection optimization, review memory leaks, scale resources.`,
          metrics: ['memory_usage'],
          timestamp: now,
          confidence: 0.9,
        });
      }
    }

    // Cache performance analysis
    const cacheMetrics = metrics.filter(m => m.name === 'cache_hit_rate');
    if (cacheMetrics.length > 0) {
      const latestHitRate = cacheMetrics[cacheMetrics.length - 1];
      if (latestHitRate.value < 60) {
        insights.push({
          id: `insight_cache_${now}`,
          type: 'optimization',
          severity: latestHitRate.value < 30 ? 'high' : 'medium',
          title: 'Low Cache Hit Rate',
          description: `Cache hit rate is ${latestHitRate.value.toFixed(1)}%, below optimal threshold.`,
          impact: `Increased database load, slower response times, higher resource consumption.`,
          recommendation: `Review cache TTL settings, implement cache warming, optimize cache keys.`,
          metrics: ['cache_hit_rate'],
          timestamp: now,
          confidence: 0.8,
        });
      }
    }

    return insights;
  }

  private async applyOptimizationRules(metrics: PerformanceMetric[]): Promise<void> {
    const now = Date.now();

    for (const rule of this.optimizationRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastExecuted && (now - rule.lastExecuted) < (rule.cooldown * 60 * 1000)) {
        continue;
      }

      // Check condition
      if (rule.condition(metrics)) {
        try {
          logger.info(`Applying optimization rule: ${rule.name}`);
          await rule.action(metrics);
          rule.lastExecuted = now;
          
          this.emit('optimizationApplied', {
            rule: rule.name,
            timestamp: now,
            metrics: metrics.length,
          });

        } catch (error) {
          logger.error(`Error applying optimization rule ${rule.name}:`, error);
        }
      }
    }
  }

  private async optimizeResponseTime(metrics: PerformanceMetric[]): Promise<void> {
    logger.info('Optimizing response time based on metrics');
    
    // Implement response time optimizations
    const responseTimeMetrics = metrics.filter(m => m.name === 'api_response_time');
    const slowEndpoints = new Map<string, number>();

    // Identify slow endpoints
    responseTimeMetrics.forEach(metric => {
      const endpoint = metric.metadata?.endpoint || 'unknown';
      const currentTime = slowEndpoints.get(endpoint) || 0;
      if (metric.value > currentTime) {
        slowEndpoints.set(endpoint, metric.value);
      }
    });

    // Store optimization recommendations
    for (const [endpoint, responseTime] of slowEndpoints) {
      if (responseTime > 1000) {
        await this.redis.setex(
          `optimization:response_time:${endpoint}`,
          3600, // 1 hour
          JSON.stringify({
            endpoint,
            responseTime,
            recommendation: 'Enable aggressive caching',
            timestamp: Date.now(),
          })
        );
      }
    }
  }

  private async optimizeMemoryUsage(metrics: PerformanceMetric[]): Promise<void> {
    logger.info('Optimizing memory usage based on metrics');
    
    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
      logger.info('Manual garbage collection triggered');
    }

    // Store memory optimization event
    await this.redis.setex(
      'optimization:memory_cleanup',
      300, // 5 minutes
      JSON.stringify({
        action: 'garbage_collection',
        timestamp: Date.now(),
        memoryBefore: process.memoryUsage(),
      })
    );
  }

  private async optimizeDatabaseQueries(metrics: PerformanceMetric[]): Promise<void> {
    logger.info('Optimizing database queries based on metrics');
    
    const dbMetrics = metrics.filter(m => m.category === 'database');
    const slowQueries = dbMetrics.filter(m => m.value > 500);

    // Store slow query analysis
    if (slowQueries.length > 0) {
      await this.redis.setex(
        'optimization:slow_queries',
        1800, // 30 minutes
        JSON.stringify({
          count: slowQueries.length,
          avgDuration: slowQueries.reduce((sum, m) => sum + m.value, 0) / slowQueries.length,
          recommendation: 'Review query execution plans, add indexes',
          timestamp: Date.now(),
        })
      );
    }
  }

  private async optimizeCacheStrategy(metrics: PerformanceMetric[]): Promise<void> {
    logger.info('Optimizing cache strategy based on metrics');
    
    const cacheMetrics = metrics.filter(m => m.name === 'cache_hit_rate');
    const latestHitRate = cacheMetrics[cacheMetrics.length - 1];

    if (latestHitRate && latestHitRate.value < 50) {
      await this.redis.setex(
        'optimization:cache_strategy',
        1800, // 30 minutes
        JSON.stringify({
          hitRate: latestHitRate.value,
          recommendation: 'Increase cache TTL, implement cache warming',
          timestamp: Date.now(),
        })
      );
    }
  }

  public async getPerformanceReport(timeRange: number = 3600): Promise<PerformanceReport> {
    const endTime = Date.now();
    const startTime = endTime - (timeRange * 1000);

    try {
      // Fetch recent metrics from Redis
      const categories = ['api', 'database', 'cache', 'ml', 'system'];
      const allMetrics: PerformanceMetric[] = [];

      for (const category of categories) {
        const keys = await this.redis.keys(`performance_metrics:${category}:*`);
        for (const key of keys) {
          const keyTime = parseInt(key.split(':')[2]);
          if (keyTime >= startTime) {
            const metricList = await this.redis.lrange(key, 0, -1);
            for (const metricData of metricList) {
              try {
                const metric = JSON.parse(metricData) as PerformanceMetric;
                if (metric.timestamp >= startTime) {
                  allMetrics.push(metric);
                }
              } catch (e) {
                // Skip invalid metrics
              }
            }
          }
        }
      }

      // Calculate summary statistics
      const responseTimeMetrics = allMetrics.filter(m => m.name === 'api_response_time');
      const errorMetrics = allMetrics.filter(m => m.name === 'error_rate');
      const throughputMetrics = allMetrics.filter(m => m.name === 'throughput');

      const avgResponseTime = responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
        : 0;

      const latestErrorRate = errorMetrics.length > 0
        ? errorMetrics[errorMetrics.length - 1].value
        : 0;

      const latestThroughput = throughputMetrics.length > 0
        ? throughputMetrics[throughputMetrics.length - 1].value
        : 0;

      // Update Prometheus metrics
      this.responseTimeHistogram.observe({ endpoint: 'average', method: 'all' }, avgResponseTime / 1000);
      this.errorRateGauge.set(latestErrorRate);
      this.throughputGauge.set(latestThroughput);

      // Calculate system health score
      let healthScore = 100;
      if (avgResponseTime > 1000) healthScore -= 20;
      if (avgResponseTime > 3000) healthScore -= 30;
      if (latestErrorRate > 5) healthScore -= 25;
      if (latestErrorRate > 15) healthScore -= 35;
      healthScore = Math.max(0, healthScore);

      this.systemHealthGauge.set(healthScore);

      const systemHealth = 
        healthScore >= 90 ? 'excellent' :
        healthScore >= 75 ? 'good' :
        healthScore >= 60 ? 'fair' :
        healthScore >= 40 ? 'poor' : 'critical';

      // Get cached insights
      const insights = this.insightsCache.keys()
        .map(key => this.insightsCache.get<PerformanceInsight>(key)!)
        .filter(insight => insight.timestamp >= startTime)
        .sort((a, b) => b.timestamp - a.timestamp);

      // Generate recommendations
      const recommendations: string[] = [];
      if (avgResponseTime > 1000) {
        recommendations.push('Implement response caching to reduce API response times');
      }
      if (latestErrorRate > 5) {
        recommendations.push('Review error handling and implement better error recovery');
      }
      if (latestThroughput < 10) {
        recommendations.push('Consider scaling resources to improve throughput');
      }

      // Calculate trends (simplified)
      const trends = {
        responseTime: avgResponseTime > 1500 ? 'degrading' as const : 'stable' as const,
        errorRate: latestErrorRate > 10 ? 'degrading' as const : 'stable' as const,
        throughput: latestThroughput < 5 ? 'degrading' as const : 'stable' as const,
      };

      return {
        summary: {
          totalMetrics: allMetrics.length,
          avgResponseTime,
          errorRate: latestErrorRate,
          throughput: latestThroughput,
          systemHealth,
        },
        insights,
        recommendations,
        trends,
        timestamp: endTime,
      };

    } catch (error) {
      logger.error('Error generating performance report:', error);
      throw error;
    }
  }

  private startPeriodicProcessing(): void {
    // Flush metrics periodically
    setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);

    // Generate periodic reports
    setInterval(async () => {
      try {
        const report = await this.getPerformanceReport();
        this.emit('performanceReport', report);
      } catch (error) {
        logger.error('Error generating periodic performance report:', error);
      }
    }, this.analysisInterval);
  }

  public addOptimizationRule(rule: OptimizationRule): void {
    this.optimizationRules.push(rule);
    logger.info(`Added optimization rule: ${rule.name}`);
  }

  public removeOptimizationRule(ruleId: string): boolean {
    const index = this.optimizationRules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      this.optimizationRules.splice(index, 1);
      logger.info(`Removed optimization rule: ${ruleId}`);
      return true;
    }
    return false;
  }

  public getInsights(severity?: string): PerformanceInsight[] {
    const allInsights = this.insightsCache.keys()
      .map(key => this.insightsCache.get<PerformanceInsight>(key)!)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (severity) {
      return allInsights.filter(insight => insight.severity === severity);
    }

    return allInsights;
  }

  public clearInsights(): void {
    this.insightsCache.flushAll();
    logger.info('Cleared all performance insights');
  }
}

export default PerformanceOptimizer;