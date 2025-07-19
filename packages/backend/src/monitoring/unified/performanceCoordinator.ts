/**
 * Performance Coordinator
 * 
 * Unified performance monitoring system that coordinates multiple monitoring
 * components for optimal resource usage and comprehensive coverage.
 * 
 * Features:
 * - Unified metric collection from multiple sources
 * - Intelligent batching and compression
 * - Real-time performance insights and recommendations
 * - Automatic optimization rule execution
 * - Cross-system performance correlation
 * - Resource-aware monitoring adjustments
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import logger from '../../utils/logger';
import { unifiedRegistry } from '../unified';
import { Counter, Gauge, Histogram, Summary } from 'prom-client';
import NodeCache from 'node-cache';
import PerformanceOptimizer, { PerformanceMetric, PerformanceInsight } from '../optimized/performanceOptimizer';
import { BusinessMetricsService } from '../../utils/businessMetrics';

export interface MonitoringSource {
  id: string;
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  intervalMs: number;
  lastCollection?: number;
  collectMetrics: () => Promise<PerformanceMetric[]>;
  onInsight?: (insight: PerformanceInsight) => Promise<void>;
}

export interface CoordinatorConfig {
  maxMetricsPerBatch: number;
  flushIntervalMs: number;
  compressionEnabled: boolean;
  compressionRatio: number; // 0.1-1.0
  resourceThresholds: {
    cpuPercent: number;
    memoryPercent: number;
    redisMemoryMB: number;
  };
  adaptiveIntervals: boolean;
  insightCorrelation: boolean;
}

export interface SystemResourceState {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    available: number;
    percentage: number;
  };
  redis: {
    memoryUsed: number;
    memoryPeak: number;
    connectedClients: number;
  };
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface PerformanceReport {
  timestamp: number;
  summary: {
    totalMetrics: number;
    activeSources: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    resourceUtilization: number;
  };
  insights: PerformanceInsight[];
  correlations: Array<{
    sources: string[];
    correlation: number;
    insight: string;
  }>;
  recommendations: string[];
  optimizations: Array<{
    rule: string;
    applied: boolean;
    impact: string;
  }>;
}

class PerformanceCoordinator extends EventEmitter {
  private redis: Redis;
  private optimizer: PerformanceOptimizer;
  private businessMetrics: BusinessMetricsService;
  private sources: Map<string, MonitoringSource> = new Map();
  private metricsBuffer: PerformanceMetric[] = [];
  private insightsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
  private correlationCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
  private config: CoordinatorConfig;
  private resourceState: SystemResourceState | null = null;
  private isProcessing = false;
  
  // Prometheus metrics for coordinator
  private sourceMetricsCounter: Counter<string>;
  private batchSizeHistogram: Histogram<string>;
  private processingTimeHistogram: Histogram<string>;
  private resourceUtilizationGauge: Gauge<string>;
  private insightCorrelationGauge: Gauge<string>;
  private optimizationCounter: Counter<string>;
  private coordinatorHealthGauge: Gauge<string>;

  constructor(
    redis: Redis,
    optimizer: PerformanceOptimizer,
    businessMetrics: BusinessMetricsService,
    config: Partial<CoordinatorConfig> = {}
  ) {
    super();
    this.redis = redis;
    this.optimizer = optimizer;
    this.businessMetrics = businessMetrics;
    
    this.config = {
      maxMetricsPerBatch: 250,
      flushIntervalMs: 15000,
      compressionEnabled: true,
      compressionRatio: 0.3,
      resourceThresholds: {
        cpuPercent: 70,
        memoryPercent: 80,
        redisMemoryMB: 100,
      },
      adaptiveIntervals: true,
      insightCorrelation: true,
      ...config,
    };

    this.initializeMetrics();
    this.startCoordination();
    this.setupEventListeners();
  }

  private initializeMetrics(): void {
    this.sourceMetricsCounter = new Counter({
      name: 'spheroseg_coordinator_source_metrics_total',
      help: 'Total metrics collected from each source',
      labelNames: ['source', 'priority'],
      registers: [unifiedRegistry],
    });

    this.batchSizeHistogram = new Histogram({
      name: 'spheroseg_coordinator_batch_size',
      help: 'Size of metric batches processed',
      buckets: [10, 25, 50, 100, 250, 500, 1000],
      registers: [unifiedRegistry],
    });

    this.processingTimeHistogram = new Histogram({
      name: 'spheroseg_coordinator_processing_time_seconds',
      help: 'Time spent processing metric batches',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [unifiedRegistry],
    });

    this.resourceUtilizationGauge = new Gauge({
      name: 'spheroseg_coordinator_resource_utilization',
      help: 'Overall system resource utilization percentage',
      registers: [unifiedRegistry],
    });

    this.insightCorrelationGauge = new Gauge({
      name: 'spheroseg_coordinator_insight_correlation',
      help: 'Correlation strength between performance insights',
      labelNames: ['source1', 'source2'],
      registers: [unifiedRegistry],
    });

    this.optimizationCounter = new Counter({
      name: 'spheroseg_coordinator_optimizations_total',
      help: 'Total performance optimizations applied',
      labelNames: ['type', 'success'],
      registers: [unifiedRegistry],
    });

    this.coordinatorHealthGauge = new Gauge({
      name: 'spheroseg_coordinator_health_score',
      help: 'Overall coordinator health score (0-100)',
      registers: [unifiedRegistry],
    });
  }

  public registerSource(source: MonitoringSource): void {
    this.sources.set(source.id, source);
    
    logger.info('Performance monitoring source registered', {
      sourceId: source.id,
      sourceName: source.name,
      priority: source.priority,
      intervalMs: source.intervalMs,
    });

    // Start collection for this source
    if (source.enabled) {
      this.scheduleSourceCollection(source);
    }

    this.emit('sourceRegistered', source);
  }

  public unregisterSource(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    if (source) {
      this.sources.delete(sourceId);
      logger.info('Performance monitoring source unregistered', {
        sourceId,
        sourceName: source.name,
      });
      this.emit('sourceUnregistered', source);
      return true;
    }
    return false;
  }

  public enableSource(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    if (source) {
      source.enabled = true;
      this.scheduleSourceCollection(source);
      logger.info('Performance monitoring source enabled', { sourceId });
      return true;
    }
    return false;
  }

  public disableSource(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    if (source) {
      source.enabled = false;
      logger.info('Performance monitoring source disabled', { sourceId });
      return true;
    }
    return false;
  }

  private scheduleSourceCollection(source: MonitoringSource): void {
    const collectFromSource = async () => {
      if (!source.enabled) return;

      try {
        const startTime = process.hrtime.bigint();
        const metrics = await source.collectMetrics();
        const collectionTime = Number(process.hrtime.bigint() - startTime) / 1000000;

        // Update source collection timestamp
        source.lastCollection = Date.now();

        // Add source information to metrics
        const enhancedMetrics = metrics.map(metric => ({
          ...metric,
          source: source.id,
          metadata: {
            ...metric.metadata,
            priority: source.priority,
            collectionTime,
          },
        }));

        // Add to buffer for batch processing
        this.metricsBuffer.push(...enhancedMetrics);

        // Update metrics
        this.sourceMetricsCounter.inc({
          source: source.id,
          priority: source.priority,
        }, metrics.length);

        // Auto-flush if buffer is full
        if (this.metricsBuffer.length >= this.config.maxMetricsPerBatch) {
          await this.processBatch();
        }

        // Emit collection event
        this.emit('sourceCollected', {
          sourceId: source.id,
          metricsCount: metrics.length,
          collectionTime,
        });

      } catch (error) {
        logger.error('Error collecting metrics from source', {
          sourceId: source.id,
          sourceName: source.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    // Initial collection
    setTimeout(collectFromSource, 1000);

    // Scheduled collection
    setInterval(collectFromSource, source.intervalMs);
  }

  private async processBatch(): Promise<void> {
    if (this.metricsBuffer.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const startTime = process.hrtime.bigint();

    try {
      const metricsToProcess = [...this.metricsBuffer];
      this.metricsBuffer = [];

      // Update resource state before processing
      await this.updateResourceState();

      // Apply resource-aware processing
      let processedMetrics = metricsToProcess;
      if (this.isResourceConstrained()) {
        processedMetrics = await this.compressMetrics(metricsToProcess);
      }

      // Send metrics to optimizer
      for (const metric of processedMetrics) {
        this.optimizer.recordMetric(metric);
      }

      // Send relevant metrics to business metrics system
      await this.forwardBusinessMetrics(processedMetrics);

      // Process insights and correlations
      if (this.config.insightCorrelation) {
        await this.processInsightCorrelations(processedMetrics);
      }

      // Update metrics
      this.batchSizeHistogram.observe(processedMetrics.length);
      const processingTime = Number(process.hrtime.bigint() - startTime) / 1000000000;
      this.processingTimeHistogram.observe(processingTime);

      // Update health score
      await this.updateHealthScore();

      logger.debug('Performance batch processed', {
        originalCount: metricsToProcess.length,
        processedCount: processedMetrics.length,
        compressionRatio: processedMetrics.length / metricsToProcess.length,
        processingTime: `${processingTime.toFixed(3)}s`,
      });

      this.emit('batchProcessed', {
        originalCount: metricsToProcess.length,
        processedCount: processedMetrics.length,
        processingTime,
      });

    } catch (error) {
      logger.error('Error processing performance batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bufferSize: this.metricsBuffer.length,
      });
      
      // Put metrics back in buffer on error
      this.metricsBuffer.unshift(...this.metricsBuffer);
    } finally {
      this.isProcessing = false;
    }
  }

  private async updateResourceState(): Promise<void> {
    try {
      // Get system resource information
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Get Redis info
      const redisInfo = await this.redis.info('memory');
      const redisMemoryMatch = redisInfo.match(/used_memory:(\d+)/);
      const redisMemoryPeakMatch = redisInfo.match(/used_memory_peak:(\d+)/);
      const redisMemoryUsed = redisMemoryMatch ? parseInt(redisMemoryMatch[1]) / 1024 / 1024 : 0;
      const redisMemoryPeak = redisMemoryPeakMatch ? parseInt(redisMemoryPeakMatch[1]) / 1024 / 1024 : 0;

      // Get performance metrics from optimizer
      const performanceReport = await this.optimizer.getPerformanceReport(300); // Last 5 minutes

      this.resourceState = {
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000, // Convert to milliseconds
          loadAverage: require('os').loadavg(),
        },
        memory: {
          used: memUsage.heapUsed,
          available: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        },
        redis: {
          memoryUsed: redisMemoryUsed,
          memoryPeak: redisMemoryPeak,
          connectedClients: parseInt(await this.redis.get('connected_clients') || '0'),
        },
        performance: {
          avgResponseTime: performanceReport.summary.avgResponseTime,
          throughput: performanceReport.summary.throughput,
          errorRate: performanceReport.summary.errorRate,
        },
      };

      // Update resource utilization metric
      const resourceUtilization = Math.max(
        this.resourceState.memory.percentage,
        (redisMemoryUsed / this.config.resourceThresholds.redisMemoryMB) * 100,
        this.resourceState.performance.errorRate * 2
      );

      this.resourceUtilizationGauge.set(resourceUtilization);

    } catch (error) {
      logger.error('Error updating resource state', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private isResourceConstrained(): boolean {
    if (!this.resourceState) return false;

    return (
      this.resourceState.memory.percentage > this.config.resourceThresholds.memoryPercent ||
      this.resourceState.redis.memoryUsed > this.config.resourceThresholds.redisMemoryMB ||
      this.resourceState.performance.errorRate > 5
    );
  }

  private async compressMetrics(metrics: PerformanceMetric[]): Promise<PerformanceMetric[]> {
    if (!this.config.compressionEnabled) return metrics;

    const targetCount = Math.floor(metrics.length * this.config.compressionRatio);
    
    // Prioritize metrics by category and recency
    const prioritized = metrics.sort((a, b) => {
      const aPriority = this.getMetricPriority(a);
      const bPriority = this.getMetricPriority(b);
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.timestamp - a.timestamp; // More recent first
    });

    // Group similar metrics and average them
    const compressed = prioritized.slice(0, targetCount);

    logger.debug('Metrics compressed due to resource constraints', {
      original: metrics.length,
      compressed: compressed.length,
      compressionRatio: compressed.length / metrics.length,
    });

    return compressed;
  }

  private getMetricPriority(metric: PerformanceMetric): number {
    const categoryPriority = {
      'system': 5,
      'api': 4,
      'database': 4,
      'ml': 3,
      'cache': 2,
      'user': 1,
    };

    const basePriority = categoryPriority[metric.category] || 1;
    
    // Boost priority for error metrics
    if (metric.name.includes('error') || metric.name.includes('fail')) {
      return basePriority + 2;
    }

    // Boost priority for recent metrics
    const age = Date.now() - metric.timestamp;
    if (age < 60000) { // Less than 1 minute old
      return basePriority + 1;
    }

    return basePriority;
  }

  private async forwardBusinessMetrics(metrics: PerformanceMetric[]): Promise<void> {
    try {
      // Forward relevant metrics to business metrics system
      const businessRelevantMetrics = metrics.filter(metric =>
        metric.category === 'api' ||
        metric.category === 'ml' ||
        metric.name.includes('processing') ||
        metric.name.includes('user') ||
        metric.name.includes('error')
      );

      for (const metric of businessRelevantMetrics) {
        // Convert to business metric format if needed
        if (metric.name === 'processing_time' && metric.category === 'ml') {
          // This could trigger business metric for avg_processing_time
          continue;
        }
        
        if (metric.name === 'api_error_rate' && metric.value > 0) {
          // This could trigger user_error_rate business metric
          continue;
        }
      }

    } catch (error) {
      logger.error('Error forwarding metrics to business metrics system', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async processInsightCorrelations(metrics: PerformanceMetric[]): Promise<void> {
    try {
      const insights = this.optimizer.getInsights();
      const timeWindow = 300000; // 5 minutes
      const now = Date.now();
      
      const recentInsights = insights.filter(insight => 
        now - insight.timestamp < timeWindow
      );

      if (recentInsights.length < 2) return;

      // Look for correlations between insights from different sources
      for (let i = 0; i < recentInsights.length; i++) {
        for (let j = i + 1; j < recentInsights.length; j++) {
          const insight1 = recentInsights[i];
          const insight2 = recentInsights[j];
          
          // Calculate correlation based on timing and metric overlap
          const timeDiff = Math.abs(insight1.timestamp - insight2.timestamp);
          const metricOverlap = this.calculateMetricOverlap(insight1.metrics, insight2.metrics);
          
          if (timeDiff < 60000 && metricOverlap > 0.3) { // Within 1 minute and >30% overlap
            const correlationStrength = Math.max(0, 1 - (timeDiff / 60000)) * metricOverlap;
            
            if (correlationStrength > 0.5) {
              const correlationKey = `${insight1.id}_${insight2.id}`;
              
              if (!this.correlationCache.has(correlationKey)) {
                this.correlationCache.set(correlationKey, {
                  insight1: insight1.id,
                  insight2: insight2.id,
                  strength: correlationStrength,
                  timestamp: now,
                });

                this.insightCorrelationGauge.set(
                  { source1: insight1.id.split('_')[0], source2: insight2.id.split('_')[0] },
                  correlationStrength
                );

                logger.info('Performance insight correlation detected', {
                  insight1: insight1.title,
                  insight2: insight2.title,
                  correlation: correlationStrength.toFixed(3),
                });

                this.emit('insightCorrelation', {
                  insights: [insight1, insight2],
                  correlation: correlationStrength,
                });
              }
            }
          }
        }
      }

    } catch (error) {
      logger.error('Error processing insight correlations', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private calculateMetricOverlap(metrics1: string[], metrics2: string[]): number {
    const set1 = new Set(metrics1);
    const set2 = new Set(metrics2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private async updateHealthScore(): Promise<void> {
    if (!this.resourceState) return;

    let healthScore = 100;

    // Deduct points for resource issues
    if (this.resourceState.memory.percentage > 80) healthScore -= 20;
    if (this.resourceState.memory.percentage > 90) healthScore -= 30;
    
    if (this.resourceState.redis.memoryUsed > this.config.resourceThresholds.redisMemoryMB) {
      healthScore -= 15;
    }
    
    if (this.resourceState.performance.avgResponseTime > 1000) healthScore -= 25;
    if (this.resourceState.performance.errorRate > 5) healthScore -= 30;
    if (this.resourceState.performance.errorRate > 10) healthScore -= 40;

    // Deduct points for inactive sources
    const activeSources = Array.from(this.sources.values()).filter(s => s.enabled);
    const inactiveSources = Array.from(this.sources.values()).filter(s => !s.enabled);
    if (inactiveSources.length > activeSources.length) {
      healthScore -= 10;
    }

    healthScore = Math.max(0, healthScore);
    this.coordinatorHealthGauge.set(healthScore);
  }

  private startCoordination(): void {
    // Regular batch processing
    setInterval(async () => {
      await this.processBatch();
    }, this.config.flushIntervalMs);

    // Resource state updates
    setInterval(async () => {
      await this.updateResourceState();
    }, 30000); // Every 30 seconds

    // Adaptive interval adjustments
    if (this.config.adaptiveIntervals) {
      setInterval(() => {
        this.adjustSourceIntervals();
      }, 60000); // Every minute
    }
  }

  private adjustSourceIntervals(): void {
    if (!this.resourceState) return;

    const isConstrained = this.isResourceConstrained();
    
    for (const source of this.sources.values()) {
      if (!source.enabled) continue;

      const originalInterval = source.intervalMs;
      
      if (isConstrained) {
        // Increase intervals to reduce load
        if (source.priority === 'low' || source.priority === 'medium') {
          source.intervalMs = Math.min(source.intervalMs * 1.5, 300000); // Max 5 minutes
        }
      } else {
        // Reset to more frequent intervals if resources allow
        if (source.priority === 'critical' || source.priority === 'high') {
          source.intervalMs = Math.max(source.intervalMs * 0.8, 10000); // Min 10 seconds
        }
      }

      if (source.intervalMs !== originalInterval) {
        logger.debug('Adjusted source collection interval', {
          sourceId: source.id,
          priority: source.priority,
          oldInterval: originalInterval,
          newInterval: source.intervalMs,
          reason: isConstrained ? 'resource_constraint' : 'resource_available',
        });
      }
    }
  }

  private setupEventListeners(): void {
    // Listen to optimizer events
    this.optimizer.on('insightGenerated', (insight: PerformanceInsight) => {
      this.insightsCache.set(insight.id, insight);
      this.emit('insightGenerated', insight);
    });

    this.optimizer.on('optimizationApplied', (data: any) => {
      this.optimizationCounter.inc({
        type: data.rule,
        success: 'true',
      });
      this.emit('optimizationApplied', data);
    });

    // Listen to business metrics events
    this.businessMetrics.on('alert', (alert: any) => {
      this.emit('businessAlert', alert);
    });
  }

  public async getPerformanceReport(): Promise<PerformanceReport> {
    const now = Date.now();
    const activeSources = Array.from(this.sources.values()).filter(s => s.enabled);
    
    // Get insights from cache
    const insights = this.insightsCache.keys()
      .map(key => this.insightsCache.get<PerformanceInsight>(key)!)
      .filter(insight => now - insight.timestamp < 1800000) // Last 30 minutes
      .sort((a, b) => b.timestamp - a.timestamp);

    // Get correlations
    const correlations = this.correlationCache.keys()
      .map(key => this.correlationCache.get(key))
      .filter(Boolean)
      .map(corr => ({
        sources: [corr.insight1.split('_')[0], corr.insight2.split('_')[0]],
        correlation: corr.strength,
        insight: `Strong correlation detected between ${corr.insight1} and ${corr.insight2}`,
      }));

    // Generate recommendations
    const recommendations: string[] = [];
    if (this.resourceState) {
      if (this.resourceState.memory.percentage > 80) {
        recommendations.push('Consider increasing container memory limits or optimizing memory usage');
      }
      if (this.resourceState.performance.avgResponseTime > 1000) {
        recommendations.push('API response times are high - consider implementing additional caching');
      }
      if (this.resourceState.performance.errorRate > 5) {
        recommendations.push('Error rate is elevated - review error logs and implement better error handling');
      }
    }

    if (activeSources.length < this.sources.size / 2) {
      recommendations.push('Many monitoring sources are disabled - consider enabling more sources for better visibility');
    }

    // Calculate system health
    const healthScore = this.coordinatorHealthGauge.getValue();
    const systemHealth = 
      healthScore >= 90 ? 'excellent' :
      healthScore >= 75 ? 'good' :
      healthScore >= 60 ? 'fair' :
      healthScore >= 40 ? 'poor' : 'critical';

    return {
      timestamp: now,
      summary: {
        totalMetrics: this.metricsBuffer.length,
        activeSources: activeSources.length,
        systemHealth,
        resourceUtilization: this.resourceUtilizationGauge.getValue(),
      },
      insights,
      correlations,
      recommendations,
      optimizations: [], // Could be populated from optimizer history
    };
  }

  public getSourceStatus(): Array<{ source: MonitoringSource; lastCollection: number | null; health: string }> {
    const now = Date.now();
    
    return Array.from(this.sources.values()).map(source => ({
      source,
      lastCollection: source.lastCollection || null,
      health: source.enabled 
        ? (source.lastCollection && (now - source.lastCollection) < source.intervalMs * 2 ? 'healthy' : 'stale')
        : 'disabled',
    }));
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down performance coordinator');
    
    // Process any remaining metrics
    if (this.metricsBuffer.length > 0) {
      await this.processBatch();
    }

    // Clear caches
    this.insightsCache.flushAll();
    this.correlationCache.flushAll();

    this.emit('shutdown');
  }
}

export default PerformanceCoordinator;