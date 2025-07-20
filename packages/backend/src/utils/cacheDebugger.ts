/**
 * Cache Debugging Tools
 * 
 * Utilities for debugging and inspecting cache behavior in development
 */

import AdvancedCacheService from '../services/advancedCacheService';
import { cacheMetrics } from '../monitoring/cacheMetrics';
import logger from './logger';
import chalk from 'chalk';

interface CacheInspectionResult {
  key: string;
  exists: boolean;
  level?: 'L1' | 'L2' | 'both';
  size?: number;
  ttl?: number;
  metadata?: any;
  value?: any;
}

interface CacheHealthReport {
  timestamp: Date;
  health: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  metrics: {
    hitRatio: number;
    memoryUsage: number;
    redisConnected: boolean;
    warmingQueueSize: number;
    totalOperations: number;
  };
  recommendations: string[];
}

export class CacheDebugger {
  private cacheService: AdvancedCacheService;
  private enabled: boolean;
  
  constructor(cacheService: AdvancedCacheService) {
    this.cacheService = cacheService;
    this.enabled = process.env.NODE_ENV === 'development' || process.env.CACHE_DEBUG === 'true';
  }
  
  /**
   * Inspect a cache key to see where it exists and its metadata
   */
  async inspect(key: string): Promise<CacheInspectionResult> {
    if (!this.enabled) {
      return { key, exists: false };
    }
    
    const result: CacheInspectionResult = {
      key,
      exists: false,
    };
    
    try {
      // Check L1 (memory) cache
      const l1Value = await this.cacheService.getFromMemory(key);
      const l1Exists = l1Value !== undefined;
      
      // Check L2 (Redis) cache
      const l2Value = await this.cacheService.getFromRedis(key);
      const l2Exists = l2Value !== null;
      
      result.exists = l1Exists || l2Exists;
      
      if (l1Exists && l2Exists) {
        result.level = 'both';
      } else if (l1Exists) {
        result.level = 'L1';
        result.value = l1Value;
      } else if (l2Exists) {
        result.level = 'L2';
        result.value = l2Value;
      }
      
      // Get size and TTL if available
      if (result.exists && result.value) {
        result.size = JSON.stringify(result.value).length;
        result.ttl = await this.cacheService.getTTL(key);
      }
      
      this.logInspection(result);
      
    } catch (error) {
      logger.error('Cache inspection failed', { key, error });
    }
    
    return result;
  }
  
  /**
   * Trace cache operations for a specific key
   */
  traceKey(key: string, duration: number = 60000): () => void {
    if (!this.enabled) {
      return () => {};
    }
    
    const traces: any[] = [];
    const startTime = Date.now();
    
    // Hook into cache operations
    const originalGet = this.cacheService.get;
    const originalSet = this.cacheService.set;
    const originalDelete = this.cacheService.delete;
    
    this.cacheService.get = async function(...args) {
      if (args[0] === key || args[0].includes(key)) {
        const start = Date.now();
        const result = await originalGet.apply(this, args);
        traces.push({
          operation: 'GET',
          timestamp: new Date(),
          duration: Date.now() - start,
          hit: result !== null,
          strategy: args[1],
        });
      }
      return originalGet.apply(this, args);
    };
    
    this.cacheService.set = async function(...args) {
      if (args[0] === key || args[0].includes(key)) {
        const start = Date.now();
        const result = await originalSet.apply(this, args);
        traces.push({
          operation: 'SET',
          timestamp: new Date(),
          duration: Date.now() - start,
          strategy: args[2],
          valueSize: JSON.stringify(args[1]).length,
        });
      }
      return originalSet.apply(this, args);
    };
    
    this.cacheService.delete = async function(...args) {
      if (args[0] === key || args[0].includes(key)) {
        traces.push({
          operation: 'DELETE',
          timestamp: new Date(),
        });
      }
      return originalDelete.apply(this, args);
    };
    
    // Restore original methods after duration
    const cleanup = setTimeout(() => {
      this.cacheService.get = originalGet;
      this.cacheService.set = originalSet;
      this.cacheService.delete = originalDelete;
      
      this.printTraceReport(key, traces);
    }, duration);
    
    // Return cleanup function
    return () => {
      clearTimeout(cleanup);
      this.cacheService.get = originalGet;
      this.cacheService.set = originalSet;
      this.cacheService.delete = originalDelete;
      this.printTraceReport(key, traces);
    };
  }
  
  /**
   * Generate a health report for the cache system
   */
  async healthCheck(): Promise<CacheHealthReport> {
    const report: CacheHealthReport = {
      timestamp: new Date(),
      health: 'healthy',
      issues: [],
      metrics: {
        hitRatio: 0,
        memoryUsage: 0,
        redisConnected: false,
        warmingQueueSize: 0,
        totalOperations: 0,
      },
      recommendations: [],
    };
    
    try {
      // Get metrics summary
      const metricsSummary = cacheMetrics.getMetricsSummary();
      
      // Check Redis connection
      report.metrics.redisConnected = await this.cacheService.isRedisConnected();
      
      // Calculate overall hit ratio
      let totalHits = 0;
      let totalMisses = 0;
      
      for (const strategy of Object.values(metricsSummary.strategies)) {
        totalHits += strategy.totalHits;
        totalMisses += strategy.totalMisses;
      }
      
      report.metrics.hitRatio = totalHits + totalMisses > 0 
        ? totalHits / (totalHits + totalMisses) 
        : 0;
      
      report.metrics.totalOperations = metricsSummary.totalOperations;
      report.metrics.warmingQueueSize = await this.cacheService.getWarmingQueueSize();
      
      // Memory usage
      const memoryStats = await this.cacheService.getMemoryStats();
      report.metrics.memoryUsage = memoryStats.usagePercentage;
      
      // Determine health status
      if (!report.metrics.redisConnected) {
        report.health = 'unhealthy';
        report.issues.push('Redis connection lost');
        report.recommendations.push('Check Redis server status and connection settings');
      }
      
      if (report.metrics.hitRatio < 0.5) {
        report.health = report.health === 'unhealthy' ? 'unhealthy' : 'degraded';
        report.issues.push(`Low hit ratio: ${(report.metrics.hitRatio * 100).toFixed(1)}%`);
        report.recommendations.push('Consider cache warming strategies or adjusting TTL values');
      }
      
      if (report.metrics.memoryUsage > 80) {
        report.health = report.health === 'unhealthy' ? 'unhealthy' : 'degraded';
        report.issues.push(`High memory usage: ${report.metrics.memoryUsage}%`);
        report.recommendations.push('Increase memory limits or reduce cache size');
      }
      
      if (report.metrics.warmingQueueSize > 100) {
        report.issues.push(`Large warming queue: ${report.metrics.warmingQueueSize} items`);
        report.recommendations.push('Monitor cache warming performance');
      }
      
      this.printHealthReport(report);
      
    } catch (error) {
      logger.error('Cache health check failed', { error });
      report.health = 'unhealthy';
      report.issues.push('Health check error: ' + error.message);
    }
    
    return report;
  }
  
  /**
   * Clear all caches with optional pattern matching
   */
  async clearCache(pattern?: string): Promise<number> {
    if (!this.enabled && process.env.NODE_ENV === 'production') {
      throw new Error('Cache clearing disabled in production without debug mode');
    }
    
    let cleared = 0;
    
    try {
      if (pattern) {
        cleared = await this.cacheService.invalidatePattern(pattern);
        logger.info(`Cleared ${cleared} cache entries matching pattern: ${pattern}`);
      } else {
        // Clear L1 cache
        const l1Cleared = await this.cacheService.clearMemoryCache();
        
        // Clear L2 cache
        const l2Cleared = await this.cacheService.clearRedisCache();
        
        cleared = l1Cleared + l2Cleared;
        logger.info(`Cleared all cache entries: L1=${l1Cleared}, L2=${l2Cleared}`);
      }
      
      // Reset metrics
      cacheMetrics.reset();
      
    } catch (error) {
      logger.error('Cache clearing failed', { pattern, error });
      throw error;
    }
    
    return cleared;
  }
  
  /**
   * Simulate cache operations for testing
   */
  async simulate(options: {
    operations: number;
    hitRate: number;
    keyPrefix: string;
    valueSize: number;
  }): Promise<void> {
    if (!this.enabled) {
      return;
    }
    
    const { operations, hitRate, keyPrefix, valueSize } = options;
    const keys = Array.from({ length: Math.ceil(operations * (1 - hitRate)) }, 
      (_, i) => `${keyPrefix}:${i}`);
    
    // Pre-populate some keys
    const valueDummy = 'x'.repeat(valueSize);
    for (const key of keys.slice(0, Math.floor(keys.length / 2))) {
      await this.cacheService.set(key, valueDummy, 'WARM');
    }
    
    // Simulate operations
    for (let i = 0; i < operations; i++) {
      const shouldHit = Math.random() < hitRate;
      const keyIndex = shouldHit 
        ? Math.floor(Math.random() * keys.length / 2)
        : Math.floor(Math.random() * keys.length);
      
      const key = keys[keyIndex];
      const result = await this.cacheService.get(key, 'WARM');
      
      if (!result && Math.random() < 0.5) {
        await this.cacheService.set(key, valueDummy, 'WARM');
      }
    }
    
    logger.info('Cache simulation completed', {
      operations,
      hitRate,
      keyPrefix,
      valueSize,
    });
  }
  
  // Private helper methods
  
  private logInspection(result: CacheInspectionResult): void {
    if (!this.enabled) return;
    
    const levelColor = result.level === 'L1' ? chalk.green : 
                      result.level === 'L2' ? chalk.yellow : 
                      result.level === 'both' ? chalk.blue : chalk.red;
    
    console.log('\n' + chalk.bold('Cache Inspection Result:'));
    console.log(chalk.gray('Key:'), result.key);
    console.log(chalk.gray('Exists:'), result.exists ? chalk.green('Yes') : chalk.red('No'));
    
    if (result.exists) {
      console.log(chalk.gray('Level:'), levelColor(result.level));
      console.log(chalk.gray('Size:'), result.size ? `${result.size} bytes` : 'Unknown');
      console.log(chalk.gray('TTL:'), result.ttl ? `${result.ttl}s` : 'No expiry');
    }
    console.log('');
  }
  
  private printTraceReport(key: string, traces: any[]): void {
    if (!this.enabled) return;
    
    console.log('\n' + chalk.bold(`Cache Trace Report for: ${key}`));
    console.log(chalk.gray('Total operations:'), traces.length);
    
    const gets = traces.filter(t => t.operation === 'GET');
    const hits = gets.filter(t => t.hit).length;
    const hitRate = gets.length > 0 ? (hits / gets.length * 100).toFixed(1) : 0;
    
    console.log(chalk.gray('GET operations:'), gets.length);
    console.log(chalk.gray('Hit rate:'), `${hitRate}%`);
    
    console.log('\n' + chalk.bold('Operation Timeline:'));
    traces.forEach(trace => {
      const opColor = trace.operation === 'GET' ? chalk.blue :
                     trace.operation === 'SET' ? chalk.green :
                     chalk.red;
      
      console.log(
        chalk.gray(trace.timestamp.toISOString()),
        opColor(trace.operation),
        trace.duration ? `${trace.duration}ms` : '',
        trace.hit !== undefined ? (trace.hit ? chalk.green('HIT') : chalk.red('MISS')) : '',
        trace.valueSize ? `${trace.valueSize} bytes` : ''
      );
    });
    console.log('');
  }
  
  private printHealthReport(report: CacheHealthReport): void {
    if (!this.enabled) return;
    
    const healthColor = report.health === 'healthy' ? chalk.green :
                       report.health === 'degraded' ? chalk.yellow :
                       chalk.red;
    
    console.log('\n' + chalk.bold('Cache Health Report'));
    console.log(chalk.gray('Timestamp:'), report.timestamp.toISOString());
    console.log(chalk.gray('Status:'), healthColor(report.health.toUpperCase()));
    
    console.log('\n' + chalk.bold('Metrics:'));
    console.log(chalk.gray('Hit Ratio:'), `${(report.metrics.hitRatio * 100).toFixed(1)}%`);
    console.log(chalk.gray('Memory Usage:'), `${report.metrics.memoryUsage}%`);
    console.log(chalk.gray('Redis Connected:'), report.metrics.redisConnected ? chalk.green('Yes') : chalk.red('No'));
    console.log(chalk.gray('Total Operations:'), report.metrics.totalOperations);
    console.log(chalk.gray('Warming Queue:'), report.metrics.warmingQueueSize);
    
    if (report.issues.length > 0) {
      console.log('\n' + chalk.bold('Issues:'));
      report.issues.forEach(issue => console.log(chalk.red('- ' + issue)));
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n' + chalk.bold('Recommendations:'));
      report.recommendations.forEach(rec => console.log(chalk.yellow('- ' + rec)));
    }
    
    console.log('');
  }
}

// Singleton instance helper
let debuggerInstance: CacheDebugger | null = null;

export function getCacheDebugger(cacheService: AdvancedCacheService): CacheDebugger {
  if (!debuggerInstance) {
    debuggerInstance = new CacheDebugger(cacheService);
  }
  return debuggerInstance;
}

// Export debugging utilities for REPL or debugging sessions
export const cacheDebugUtils = {
  inspect: async (key: string) => {
    const debugger = getCacheDebugger(null as any);
    return debugger.inspect(key);
  },
  
  trace: (key: string, duration?: number) => {
    const debugger = getCacheDebugger(null as any);
    return debugger.traceKey(key, duration);
  },
  
  health: async () => {
    const debugger = getCacheDebugger(null as any);
    return debugger.healthCheck();
  },
  
  clear: async (pattern?: string) => {
    const debugger = getCacheDebugger(null as any);
    return debugger.clearCache(pattern);
  },
  
  simulate: async (options: any) => {
    const debugger = getCacheDebugger(null as any);
    return debugger.simulate(options);
  },
};