/**
 * Cache Metrics Collection and Monitoring
 * 
 * Tracks cache performance metrics including hit/miss ratios,
 * memory usage, and operation timings.
 */

import { Counter, Histogram, Gauge } from 'prom-client';
import { unifiedRegistry } from './unified';
import logger from '../utils/logger';

// Cache operation types
export type CacheOperation = 'get' | 'set' | 'delete' | 'invalidate' | 'warm';
export type CacheResult = 'hit' | 'miss' | 'error' | 'bypass';

// Prometheus metrics for cache monitoring
const cacheOperationCounter = new Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result', 'strategy'],
  registers: [unifiedRegistry],
});

const cacheHitRatioGauge = new Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio (0-1)',
  labelNames: ['strategy', 'timeWindow'],
  registers: [unifiedRegistry],
});

const cacheOperationDuration = new Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Duration of cache operations',
  labelNames: ['operation', 'strategy'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [unifiedRegistry],
});

const cacheSizeGauge = new Gauge({
  name: 'cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['level', 'strategy'],
  registers: [unifiedRegistry],
});

const cacheEvictionCounter = new Counter({
  name: 'cache_evictions_total',
  help: 'Total number of cache evictions',
  labelNames: ['reason', 'strategy'],
  registers: [unifiedRegistry],
});

const cacheWarmingGauge = new Gauge({
  name: 'cache_warming_queue_size',
  help: 'Number of items in cache warming queue',
  registers: [unifiedRegistry],
});

// In-memory metrics tracking for hit ratio calculation
interface MetricsWindow {
  hits: number;
  misses: number;
  timestamp: number;
}

class CacheMetrics {
  private windows: Map<string, MetricsWindow[]> = new Map();
  private readonly windowDuration = 60000; // 1 minute windows
  private readonly maxWindows = 60; // Keep 1 hour of data
  
  /**
   * Record a cache operation
   */
  recordOperation(
    operation: CacheOperation,
    result: CacheResult,
    strategy: string = 'default',
    duration?: number
  ): void {
    // Increment counter
    cacheOperationCounter.inc({ operation, result, strategy });
    
    // Record duration if provided
    if (duration !== undefined) {
      cacheOperationDuration.observe({ operation, strategy }, duration / 1000);
    }
    
    // Track hits and misses for ratio calculation
    if (operation === 'get') {
      this.updateHitRatio(strategy, result === 'hit');
    }
    
    // Log slow operations
    if (duration && duration > 100) {
      logger.warn('Slow cache operation', {
        operation,
        result,
        strategy,
        duration: `${duration}ms`,
      });
    }
  }
  
  /**
   * Update hit ratio metrics
   */
  private updateHitRatio(strategy: string, isHit: boolean): void {
    const now = Date.now();
    const windowKey = `${strategy}:${Math.floor(now / this.windowDuration)}`;
    
    // Get or create windows for this strategy
    if (!this.windows.has(strategy)) {
      this.windows.set(strategy, []);
    }
    
    const strategyWindows = this.windows.get(strategy)!;
    
    // Find or create current window
    let currentWindow = strategyWindows.find(w => 
      Math.floor(w.timestamp / this.windowDuration) === Math.floor(now / this.windowDuration)
    );
    
    if (!currentWindow) {
      currentWindow = { hits: 0, misses: 0, timestamp: now };
      strategyWindows.push(currentWindow);
    }
    
    // Update counts
    if (isHit) {
      currentWindow.hits++;
    } else {
      currentWindow.misses++;
    }
    
    // Clean old windows
    const cutoff = now - (this.maxWindows * this.windowDuration);
    const filtered = strategyWindows.filter(w => w.timestamp > cutoff);
    this.windows.set(strategy, filtered);
    
    // Calculate and update hit ratios
    this.calculateHitRatios(strategy);
  }
  
  /**
   * Calculate hit ratios for different time windows
   */
  private calculateHitRatios(strategy: string): void {
    const windows = this.windows.get(strategy) || [];
    const now = Date.now();
    
    // Calculate for different time windows
    const timeWindows = [
      { name: '1m', duration: 60000 },
      { name: '5m', duration: 300000 },
      { name: '15m', duration: 900000 },
      { name: '1h', duration: 3600000 },
    ];
    
    for (const { name, duration } of timeWindows) {
      const cutoff = now - duration;
      const relevantWindows = windows.filter(w => w.timestamp > cutoff);
      
      const totalHits = relevantWindows.reduce((sum, w) => sum + w.hits, 0);
      const totalMisses = relevantWindows.reduce((sum, w) => sum + w.misses, 0);
      const total = totalHits + totalMisses;
      
      const ratio = total > 0 ? totalHits / total : 0;
      cacheHitRatioGauge.set({ strategy, timeWindow: name }, ratio);
    }
  }
  
  /**
   * Update cache size metrics
   */
  updateCacheSize(level: 'memory' | 'redis', strategy: string, sizeBytes: number): void {
    cacheSizeGauge.set({ level, strategy }, sizeBytes);
  }
  
  /**
   * Record cache eviction
   */
  recordEviction(reason: 'ttl' | 'lru' | 'memory' | 'manual', strategy: string = 'default'): void {
    cacheEvictionCounter.inc({ reason, strategy });
  }
  
  /**
   * Update cache warming queue size
   */
  updateWarmingQueueSize(size: number): void {
    cacheWarmingGauge.set(size);
  }
  
  /**
   * Get current metrics summary
   */
  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {
      strategies: {},
      totalOperations: 0,
      warmingQueueSize: 0,
    };
    
    // Collect metrics for each strategy
    for (const [strategy, windows] of this.windows.entries()) {
      const recentWindows = windows.filter(w => 
        w.timestamp > Date.now() - 300000 // Last 5 minutes
      );
      
      const totalHits = recentWindows.reduce((sum, w) => sum + w.hits, 0);
      const totalMisses = recentWindows.reduce((sum, w) => sum + w.misses, 0);
      const total = totalHits + totalMisses;
      
      summary.strategies[strategy] = {
        hitRatio: total > 0 ? totalHits / total : 0,
        totalHits,
        totalMisses,
        totalOperations: total,
      };
      
      summary.totalOperations += total;
    }
    
    return summary;
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.windows.clear();
    cacheHitRatioGauge.reset();
    cacheOperationCounter.reset();
    cacheOperationDuration.reset();
    cacheSizeGauge.reset();
    cacheEvictionCounter.reset();
    cacheWarmingGauge.reset();
  }
}

// Export singleton instance
export const cacheMetrics = new CacheMetrics();

// Helper function to time cache operations
export async function timedCacheOperation<T>(
  operation: CacheOperation,
  strategy: string,
  fn: () => Promise<{ result: T; hit: boolean }>
): Promise<T> {
  const start = Date.now();
  
  try {
    const { result, hit } = await fn();
    const duration = Date.now() - start;
    
    cacheMetrics.recordOperation(
      operation,
      hit ? 'hit' : 'miss',
      strategy,
      duration
    );
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    cacheMetrics.recordOperation(operation, 'error', strategy, duration);
    throw error;
  }
}

// Export types and metrics
export {
  CacheMetrics,
  MetricsWindow,
};