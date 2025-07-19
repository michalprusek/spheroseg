/**
 * Performance Coordinator Unit Tests
 * 
 * Tests the unified performance monitoring system including
 * source coordination, metric processing, and insight generation.
 */

import { Redis } from 'ioredis';
import PerformanceCoordinator from '../../monitoring/unified/performanceCoordinator';
import PerformanceOptimizer from '../../monitoring/optimized/performanceOptimizer';
import { BusinessMetricsService } from '../../utils/businessMetrics';
import { MonitoringSource } from '../../monitoring/unified/performanceCoordinator';
import { PerformanceMetric } from '../../monitoring/optimized/performanceOptimizer';

// Mock Redis
const mockRedis = {
  pipeline: jest.fn(() => ({
    lpush: jest.fn(),
    expire: jest.fn(),
    exec: jest.fn(() => Promise.resolve([])),
  })),
  keys: jest.fn(() => Promise.resolve([])),
  lrange: jest.fn(() => Promise.resolve([])),
  setex: jest.fn(() => Promise.resolve('OK')),
  get: jest.fn(() => Promise.resolve(null)),
  scan: jest.fn(() => Promise.resolve(['0', []])),
  info: jest.fn(() => Promise.resolve('used_memory:1000000\nused_memory_peak:2000000')),
} as unknown as Redis;

// Mock PerformanceOptimizer
const mockOptimizer = {
  recordMetric: jest.fn(),
  getPerformanceReport: jest.fn(() => Promise.resolve({
    summary: {
      totalMetrics: 0,
      avgResponseTime: 100,
      errorRate: 0,
      throughput: 10,
      systemHealth: 'good',
    },
    insights: [],
    recommendations: [],
    trends: {
      responseTime: 'stable',
      errorRate: 'stable',
      throughput: 'stable',
    },
    timestamp: Date.now(),
  })),
  getInsights: jest.fn(() => []),
  on: jest.fn(),
} as unknown as PerformanceOptimizer;

// Mock BusinessMetricsService
const mockBusinessMetrics = {
  on: jest.fn(),
} as unknown as BusinessMetricsService;

// Mock monitoring source
class MockMonitoringSource implements MonitoringSource {
  public readonly id = 'test_source';
  public readonly name = 'Test Source';
  public readonly priority = 'medium' as const;
  public enabled = true;
  public intervalMs = 10000;
  public lastCollection?: number;

  private metricsToReturn: PerformanceMetric[] = [];

  public setMetricsToReturn(metrics: PerformanceMetric[]): void {
    this.metricsToReturn = metrics;
  }

  public async collectMetrics(): Promise<PerformanceMetric[]> {
    this.lastCollection = Date.now();
    return [...this.metricsToReturn];
  }
}

describe('PerformanceCoordinator', () => {
  let coordinator: PerformanceCoordinator;
  let mockSource: MockMonitoringSource;

  beforeEach(() => {
    jest.clearAllMocks();
    
    coordinator = new PerformanceCoordinator(
      mockRedis,
      mockOptimizer,
      mockBusinessMetrics,
      {
        maxMetricsPerBatch: 10,
        flushIntervalMs: 1000,
        compressionEnabled: false,
        adaptiveIntervals: false,
        insightCorrelation: false,
      }
    );

    mockSource = new MockMonitoringSource();
  });

  afterEach(async () => {
    await coordinator.shutdown();
  });

  describe('Source Management', () => {
    it('should register monitoring sources', () => {
      coordinator.registerSource(mockSource);
      
      const sourceStatus = coordinator.getSourceStatus();
      expect(sourceStatus).toHaveLength(1);
      expect(sourceStatus[0].source.id).toBe('test_source');
      expect(sourceStatus[0].source.enabled).toBe(true);
    });

    it('should unregister monitoring sources', () => {
      coordinator.registerSource(mockSource);
      expect(coordinator.getSourceStatus()).toHaveLength(1);
      
      const result = coordinator.unregisterSource('test_source');
      expect(result).toBe(true);
      expect(coordinator.getSourceStatus()).toHaveLength(0);
    });

    it('should enable and disable sources', () => {
      coordinator.registerSource(mockSource);
      
      coordinator.disableSource('test_source');
      expect(coordinator.getSourceStatus()[0].source.enabled).toBe(false);
      
      coordinator.enableSource('test_source');
      expect(coordinator.getSourceStatus()[0].source.enabled).toBe(true);
    });

    it('should return false when trying to unregister non-existent source', () => {
      const result = coordinator.unregisterSource('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('Metric Processing', () => {
    it('should process metrics from sources', async () => {
      const testMetrics: PerformanceMetric[] = [
        {
          id: 'test_metric_1',
          name: 'test_metric',
          value: 100,
          unit: 'ms',
          category: 'api',
          timestamp: Date.now(),
          source: 'test_source',
        },
        {
          id: 'test_metric_2',
          name: 'test_metric',
          value: 200,
          unit: 'ms',
          category: 'database',
          timestamp: Date.now(),
          source: 'test_source',
        },
      ];

      mockSource.setMetricsToReturn(testMetrics);
      coordinator.registerSource(mockSource);

      // Wait for metrics to be collected and processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify optimizer received metrics
      expect(mockOptimizer.recordMetric).toHaveBeenCalledTimes(2);
    });

    it('should handle metric collection errors gracefully', async () => {
      const errorSource = {
        ...mockSource,
        collectMetrics: jest.fn(() => Promise.reject(new Error('Collection failed'))),
      };

      coordinator.registerSource(errorSource);

      // Wait for collection attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not crash the coordinator
      const report = await coordinator.getPerformanceReport();
      expect(report).toBeDefined();
    });
  });

  describe('Metric Compression', () => {
    it('should compress metrics when resource constrained', async () => {
      const compressionCoordinator = new PerformanceCoordinator(
        mockRedis,
        mockOptimizer,
        mockBusinessMetrics,
        {
          maxMetricsPerBatch: 5,
          compressionEnabled: true,
          compressionRatio: 0.5,
          resourceThresholds: {
            cpuPercent: 50,
            memoryPercent: 50,
            redisMemoryMB: 50,
          },
        }
      );

      const manyMetrics: PerformanceMetric[] = Array.from({ length: 10 }, (_, i) => ({
        id: `metric_${i}`,
        name: 'test_metric',
        value: i * 10,
        unit: 'ms',
        category: 'api',
        timestamp: Date.now(),
        source: 'test_source',
      }));

      mockSource.setMetricsToReturn(manyMetrics);
      compressionCoordinator.registerSource(mockSource);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      await compressionCoordinator.shutdown();
    });
  });

  describe('Performance Reporting', () => {
    it('should generate comprehensive performance reports', async () => {
      coordinator.registerSource(mockSource);

      const report = await coordinator.getPerformanceReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('insights');
      expect(report).toHaveProperty('correlations');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('optimizations');

      expect(report.summary).toHaveProperty('totalMetrics');
      expect(report.summary).toHaveProperty('activeSources');
      expect(report.summary).toHaveProperty('systemHealth');
      expect(report.summary).toHaveProperty('resourceUtilization');
    });

    it('should include active sources in report', async () => {
      coordinator.registerSource(mockSource);

      const report = await coordinator.getPerformanceReport();
      expect(report.summary.activeSources).toBe(1);

      coordinator.disableSource('test_source');

      const reportAfterDisable = await coordinator.getPerformanceReport();
      expect(reportAfterDisable.summary.activeSources).toBe(0);
    });
  });

  describe('Source Status Tracking', () => {
    it('should track source health status', () => {
      coordinator.registerSource(mockSource);

      const sourceStatus = coordinator.getSourceStatus();
      expect(sourceStatus[0].health).toBe('disabled'); // No collection yet

      // Simulate collection
      mockSource.lastCollection = Date.now();
      const updatedStatus = coordinator.getSourceStatus();
      expect(updatedStatus[0].health).toBe('healthy');
    });

    it('should detect stale sources', () => {
      coordinator.registerSource(mockSource);
      
      // Simulate old collection
      mockSource.lastCollection = Date.now() - 120000; // 2 minutes ago
      
      const sourceStatus = coordinator.getSourceStatus();
      expect(sourceStatus[0].health).toBe('stale');
    });
  });

  describe('Event Handling', () => {
    it('should emit events for source registration', (done) => {
      coordinator.on('sourceRegistered', (source) => {
        expect(source.id).toBe('test_source');
        done();
      });

      coordinator.registerSource(mockSource);
    });

    it('should emit events for source unregistration', (done) => {
      coordinator.registerSource(mockSource);

      coordinator.on('sourceUnregistered', (source) => {
        expect(source.id).toBe('test_source');
        done();
      });

      coordinator.unregisterSource('test_source');
    });

    it('should emit events for batch processing', (done) => {
      const testMetrics: PerformanceMetric[] = [
        {
          id: 'test_metric_1',
          name: 'test_metric',
          value: 100,
          unit: 'ms',
          category: 'api',
          timestamp: Date.now(),
          source: 'test_source',
        },
      ];

      coordinator.on('batchProcessed', (data) => {
        expect(data.processedCount).toBeGreaterThan(0);
        done();
      });

      mockSource.setMetricsToReturn(testMetrics);
      coordinator.registerSource(mockSource);
    });
  });

  describe('Configuration Validation', () => {
    it('should use default configuration when not provided', () => {
      const defaultCoordinator = new PerformanceCoordinator(
        mockRedis,
        mockOptimizer,
        mockBusinessMetrics
      );

      expect(defaultCoordinator).toBeDefined();
      defaultCoordinator.shutdown();
    });

    it('should merge provided configuration with defaults', () => {
      const customConfig = {
        maxMetricsPerBatch: 500,
        compressionEnabled: false,
      };

      const customCoordinator = new PerformanceCoordinator(
        mockRedis,
        mockOptimizer,
        mockBusinessMetrics,
        customConfig
      );

      expect(customCoordinator).toBeDefined();
      customCoordinator.shutdown();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const testMetrics: PerformanceMetric[] = [
        {
          id: 'test_metric_1',
          name: 'test_metric',
          value: 100,
          unit: 'ms',
          category: 'api',
          timestamp: Date.now(),
          source: 'test_source',
        },
      ];

      mockSource.setMetricsToReturn(testMetrics);
      coordinator.registerSource(mockSource);

      // Add some metrics to buffer
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should shutdown without errors
      await expect(coordinator.shutdown()).resolves.toBeUndefined();
    });

    it('should emit shutdown event', (done) => {
      coordinator.on('shutdown', () => {
        done();
      });

      coordinator.shutdown();
    });
  });
});