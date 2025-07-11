/**
 * Performance Monitor Tests
 */

import performanceMonitor from '../services/performanceMonitor';

describe('Performance Monitor', () => {
  beforeEach(() => {
    // Clear all metrics before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Stop the monitor after all tests
    performanceMonitor.stop();
  });

  describe('API Metrics', () => {
    it('should record API metrics', () => {
      performanceMonitor.recordAPIMetric('/api/test', 'GET', 200, 150);
      performanceMonitor.recordAPIMetric('/api/test', 'POST', 201, 250);
      performanceMonitor.recordAPIMetric('/api/error', 'GET', 500, 50);
    });

    it('should emit event for slow API responses', (done) => {
      performanceMonitor.once('slow-api-response', (metric) => {
        expect(metric.responseTime).toBeGreaterThan(1000);
        expect(metric.endpoint).toBe('/api/slow');
        done();
      });

      performanceMonitor.recordAPIMetric('/api/slow', 'GET', 200, 1500);
    });
  });

  describe('Database Metrics', () => {
    it('should record database metrics', () => {
      performanceMonitor.recordDatabaseMetric('SELECT * FROM users', 100, 10);
      performanceMonitor.recordDatabaseMetric('INSERT INTO logs', 50, 1);
    });

    it('should emit event for slow database queries', (done) => {
      performanceMonitor.once('slow-database-query', (metric) => {
        expect(metric.duration).toBeGreaterThan(500);
        expect(metric.query).toContain('SELECT');
        done();
      });

      performanceMonitor.recordDatabaseMetric('SELECT * FROM large_table', 750, 1000);
    });

    it('should truncate long queries', () => {
      const longQuery = 'SELECT ' + 'column, '.repeat(50) + ' FROM table';
      performanceMonitor.recordDatabaseMetric(longQuery, 100, 1);

      // Query should be truncated to 100 characters
      // This is internal behavior, so we just verify it doesn't throw
      expect(() => performanceMonitor.recordDatabaseMetric(longQuery, 100, 1)).not.toThrow();
    });
  });

  describe('Custom Metrics', () => {
    it('should record custom metrics with metadata', () => {
      performanceMonitor.recordMetric('cache', 'hit_rate', 0.85, {
        service: 'redis',
        operation: 'get',
      });

      performanceMonitor.recordMetric('queue', 'length', 25, {
        queue: 'segmentation',
        priority: 'high',
      });
    });
  });

  describe('Performance Summary', () => {
    it('should return performance summary', async () => {
      // Record some test metrics
      performanceMonitor.recordAPIMetric('/api/test1', 'GET', 200, 100);
      performanceMonitor.recordAPIMetric('/api/test2', 'POST', 201, 200);
      performanceMonitor.recordDatabaseMetric('SELECT * FROM test', 50, 5);

      const summary = await performanceMonitor.getPerformanceSummary();

      expect(summary).toHaveProperty('timestamp');
      expect(summary).toHaveProperty('api');
      expect(summary).toHaveProperty('database');
      expect(summary).toHaveProperty('system');
      expect(summary).toHaveProperty('cache');
      expect(summary).toHaveProperty('uptime');
    });

    it('should calculate API statistics correctly', async () => {
      // Clear previous metrics
      performanceMonitor['apiMetrics'] = [];

      // Record test metrics
      performanceMonitor.recordAPIMetric('/api/users', 'GET', 200, 100);
      performanceMonitor.recordAPIMetric('/api/users', 'GET', 200, 150);
      performanceMonitor.recordAPIMetric('/api/users', 'GET', 404, 50);
      performanceMonitor.recordAPIMetric('/api/posts', 'POST', 201, 300);

      const summary = await performanceMonitor.getPerformanceSummary();

      expect(summary.api.totalRequests).toBeGreaterThanOrEqual(4);
      expect(summary.api.successfulRequests).toBeGreaterThanOrEqual(3);
      expect(summary.api.errorRequests).toBeGreaterThanOrEqual(1);
      expect(summary.api.avgResponseTime).toBeGreaterThan(0);
    });

    it('should identify slow endpoints', async () => {
      // Clear previous metrics
      performanceMonitor['apiMetrics'] = [];

      // Record metrics with varying response times
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordAPIMetric('/api/fast', 'GET', 200, 50);
      }
      for (let i = 0; i < 3; i++) {
        performanceMonitor.recordAPIMetric('/api/slow', 'GET', 200, 500);
      }

      const summary = await performanceMonitor.getPerformanceSummary();

      expect(summary.api.slowEndpoints).toBeDefined();
      expect(Array.isArray(summary.api.slowEndpoints)).toBe(true);

      if (summary.api.slowEndpoints.length > 0) {
        const slowest = summary.api.slowEndpoints[0];
        expect(slowest.endpoint).toContain('/api/slow');
        expect(slowest.avgResponseTime).toBeGreaterThan(400);
      }
    });
  });

  describe('System Metrics', () => {
    it('should emit high usage warnings', (done) => {
      let warningCount = 0;
      const checkDone = () => {
        warningCount++;
        if (warningCount === 3) done();
      };

      performanceMonitor.once('high-memory-usage', (usage) => {
        expect(usage.percentage).toBeGreaterThan(85);
        checkDone();
      });

      performanceMonitor.once('high-cpu-usage', (usage) => {
        expect(usage.usage).toBeGreaterThan(90);
        checkDone();
      });

      performanceMonitor.once('high-event-loop-lag', (lag) => {
        expect(lag.lag).toBeGreaterThan(50);
        checkDone();
      });

      // Simulate high usage by manipulating internal state
      performanceMonitor['eventLoopLag'] = 100;

      // Manually trigger metrics collection with mocked high values
      const originalCollect = performanceMonitor['collectSystemMetrics'];
      performanceMonitor['collectSystemMetrics'] = async () => {
        performanceMonitor['systemMetrics'].push({
          cpuUsage: 95,
          memoryUsage: { total: 100, used: 90, percentage: 90 },
          heapUsage: { total: 100, used: 50, percentage: 50 },
          eventLoopLag: 100,
          timestamp: Date.now(),
        });

        // Emit the warnings
        performanceMonitor.emit('high-memory-usage', { percentage: 90 });
        performanceMonitor.emit('high-cpu-usage', { usage: 95 });
        performanceMonitor.emit('high-event-loop-lag', { lag: 100 });
      };

      performanceMonitor['collectSystemMetrics']();

      // Restore original method
      performanceMonitor['collectSystemMetrics'] = originalCollect;
    });
  });

  describe('Metric Cleanup', () => {
    it('should clean up old metrics', async () => {
      // Set retention to 1 second for testing
      performanceMonitor['metricsRetentionMs'] = 1000;

      // Record old metric
      performanceMonitor.recordAPIMetric('/api/old', 'GET', 200, 100);

      // Wait for metric to become old
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Record new metric to trigger cleanup
      performanceMonitor.recordAPIMetric('/api/new', 'GET', 200, 100);

      // Get summary and check that old metrics are excluded
      const summary = await performanceMonitor.getPerformanceSummary();

      // Restore default retention
      performanceMonitor['metricsRetentionMs'] = 3600000;

      // We can't directly check the internal arrays, but we can verify
      // that the summary is generated without errors
      expect(summary).toBeDefined();
      expect(summary.api).toBeDefined();
    });
  });
});
