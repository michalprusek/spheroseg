/**
 * Performance Coordinator Startup Module
 * 
 * Initializes the unified performance monitoring system with all sources
 * and integrates with existing monitoring infrastructure.
 */

import { Redis } from 'ioredis';
import logger from '../utils/logger';
import PerformanceCoordinator from '../monitoring/unified/performanceCoordinator';
import PerformanceOptimizer from '../monitoring/optimized/performanceOptimizer';
import { getBusinessMetrics } from '../utils/businessMetrics';

// Import monitoring sources
import SystemResourceSource from '../monitoring/sources/systemResource.source';
import DatabaseSource from '../monitoring/sources/database.source';

let performanceCoordinator: PerformanceCoordinator | null = null;

export async function initializePerformanceCoordinatorOnStartup(redisClient: Redis): Promise<void> {
  try {
    logger.info('Initializing performance coordinator system...');

    // Get existing business metrics instance
    const businessMetrics = getBusinessMetrics();
    
    // Create performance optimizer
    const performanceOptimizer = new PerformanceOptimizer(redisClient);
    
    // Create performance coordinator with optimized configuration
    const coordinatorConfig = {
      maxMetricsPerBatch: 200,
      flushIntervalMs: 20000, // 20 seconds
      compressionEnabled: true,
      compressionRatio: 0.4,
      resourceThresholds: {
        cpuPercent: 75,
        memoryPercent: 85,
        redisMemoryMB: 150,
      },
      adaptiveIntervals: true,
      insightCorrelation: true,
    };

    performanceCoordinator = new PerformanceCoordinator(
      redisClient,
      performanceOptimizer,
      businessMetrics,
      coordinatorConfig
    );

    // Register monitoring sources with optimized intervals
    const systemResourceSource = new SystemResourceSource({
      includeDetailedCpuStats: true,
      includeNetworkStats: true,
      includeDiskStats: false, // Disable to reduce overhead
      includeContainerStats: true,
    });
    systemResourceSource.intervalMs = 30000; // 30 seconds
    performanceCoordinator.registerSource(systemResourceSource);

    const databaseSource = new DatabaseSource({
      includeSlowQueries: true,
      slowQueryThresholdMs: 1000,
      includeLockAnalysis: true,
      includeConnectionStats: true,
      includeTableStats: true,
      includeIndexStats: false, // Resource intensive, disable for now
    });
    databaseSource.intervalMs = 60000; // 1 minute
    performanceCoordinator.registerSource(databaseSource);

    // Setup event listeners for critical events
    performanceCoordinator.on('insightGenerated', (insight) => {
      if (insight.severity === 'critical') {
        logger.warn('Critical performance insight generated', {
          title: insight.title,
          description: insight.description,
          recommendation: insight.recommendation,
        });
      }
    });

    performanceCoordinator.on('insightCorrelation', (data) => {
      logger.info('Performance insight correlation detected', {
        insights: data.insights.map(i => i.title),
        correlation: data.correlation,
      });
    });

    performanceCoordinator.on('optimizationApplied', (data) => {
      logger.info('Performance optimization applied', {
        rule: data.rule,
        timestamp: new Date(data.timestamp).toISOString(),
      });
    });

    // Setup graceful shutdown
    const originalHandler = process.listeners('SIGTERM')[0];
    process.removeAllListeners('SIGTERM');
    process.on('SIGTERM', async () => {
      if (performanceCoordinator) {
        await performanceCoordinator.shutdown();
      }
      if (typeof originalHandler === 'function') {
        originalHandler();
      }
    });

    logger.info('Performance coordinator initialized successfully', {
      sources: performanceCoordinator.getSourceStatus().length,
      config: coordinatorConfig,
    });

  } catch (error) {
    logger.error('Failed to initialize performance coordinator', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function getPerformanceCoordinator(): PerformanceCoordinator | null {
  return performanceCoordinator;
}

export async function getPerformanceCoordinatorReport(): Promise<any> {
  if (!performanceCoordinator) {
    throw new Error('Performance coordinator not initialized');
  }
  return await performanceCoordinator.getPerformanceReport();
}

export function getPerformanceCoordinatorSourceStatus(): any[] {
  if (!performanceCoordinator) {
    return [];
  }
  return performanceCoordinator.getSourceStatus();
}

export default {
  initializePerformanceCoordinatorOnStartup,
  getPerformanceCoordinator,
  getPerformanceCoordinatorReport,
  getPerformanceCoordinatorSourceStatus,
};