/**
 * Unit tests for performance monitoring
 */

import { performanceMonitor } from '../../middleware/performanceMonitoring';

// Mock logger
jest.mock('../../utils/logger', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PerformanceMonitor Unit Tests', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics();
  });

  afterEach(() => {
    // Clear any listeners to prevent test interference
    performanceMonitor.removeAllListeners();
  });

  describe('Memory Pressure Handling', () => {
    it('should detect high memory pressure at 90%', (done) => {
      performanceMonitor.once('highMemoryUsage', (data: any) => {
        expect(data.percentage).toBeGreaterThan(90);
        expect(data.heapUsed).toBeDefined();
        expect(data.heapTotal).toBeDefined();
        done();
      });

      // Simulate high memory usage
      const mockMemUsage = {
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024, // 1GB
        external: 0,
        rss: 1200 * 1024 * 1024,
      };

      // Trigger high memory pressure by calling internal method
      (performanceMonitor as unknown).handleHighMemoryPressure(90, mockMemUsage as NodeJS.MemoryUsage);
    });

    it('should trigger emergency cleanup at 95% memory', () => {
      const spy = jest.spyOn(performanceMonitor as unknown, 'emergencyCleanup');

      const mockMemUsage = {
        heapUsed: 950 * 1024 * 1024,
        heapTotal: 1000 * 1024 * 1024,
        external: 0,
        rss: 1200 * 1024 * 1024,
      };

      (performanceMonitor as unknown).handleCriticalMemoryPressure(
        95,
        mockMemUsage as NodeJS.MemoryUsage
      );

      expect(spy).toHaveBeenCalled();
    });

    it('should reduce metrics under memory pressure', () => {
      // Add test data
      const metrics = (performanceMonitor as unknown).metrics;
      for (let i = 0; i < 1000; i++) {
        metrics.dbQueries.push({
          query: `SELECT * FROM test_${i}`,
          duration: Math.random() * 100,
          timestamp: new Date(),
          rowCount: 10,
        });
      }

      // Trigger cleanup
      (performanceMonitor as unknown).cleanupUnderMemoryPressure();

      // Should reduce to 25% (250 queries)
      expect(metrics.dbQueries.length).toBeLessThanOrEqual(250);
    });
  });

  describe('API Performance Tracking', () => {
    it('should track API metrics correctly', () => {
      performanceMonitor.trackApiCall('/api/test', 'GET', 150, 200);
      performanceMonitor.trackApiCall('/api/test', 'GET', 100, 200);
      performanceMonitor.trackApiCall('/api/test', 'POST', 200, 201);

      const metrics = performanceMonitor.getMetrics();
      const getMetric = metrics.apiCalls.get('GET:/api/test');
      const postMetric = metrics.apiCalls.get('POST:/api/test');

      expect(getMetric).toBeDefined();
      expect(getMetric!.count).toBe(2);
      expect(getMetric!.avgTime).toBe(125); // (150 + 100) / 2
      expect(getMetric!.minTime).toBe(100);
      expect(getMetric!.maxTime).toBe(150);

      expect(postMetric).toBeDefined();
      expect(postMetric!.count).toBe(1);
    });

    it('should emit slow API warning for requests > 1000ms', (done) => {
      performanceMonitor.once('slowApiCall', (data: any) => {
        expect(data.duration).toBeGreaterThan(1000);
        expect(data.endpoint).toBe('/api/slow');
        expect(data.method).toBe('GET');
        done();
      });

      performanceMonitor.trackApiCall('/api/slow', 'GET', 1500, 200);
    });
  });

  describe('Database Query Tracking', () => {
    it('should sanitize queries properly', () => {
      const testCases = [
        {
          input: "SELECT * FROM users WHERE email = 'test@example.com'",
          expected: "SELECT * FROM users WHERE email = '?'",
        },
        {
          input: "INSERT INTO logs VALUES (123, 'message', 456.78)",
          expected: "INSERT INTO logs VALUES (?, '?', ?)",
        },
        {
          input: 'SELECT * FROM users WHERE id = $1 AND status = $2',
          expected: 'SELECT * FROM users WHERE id = ? AND status = ?',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const sanitized = (performanceMonitor as unknown).sanitizeQuery(input);
        expect(sanitized).toBe(expected);
      });
    });

    it('should track slow queries', (done) => {
      performanceMonitor.once('slowQuery', (data: any) => {
        expect(data.duration).toBeGreaterThan(100);
        expect(data.query).toContain('SELECT');
        expect(data.rowCount).toBe(1000);
        done();
      });

      performanceMonitor.trackQuery('SELECT * FROM large_table', 150, 1000);
    });

    it('should handle query sanitization errors gracefully', () => {
      // Mock sanitization to throw error
      jest.spyOn(performanceMonitor as unknown, 'sanitizeQuery').mockImplementation(() => {
        throw new Error('Sanitization error');
      });

      // Should not throw
      expect(() => {
        performanceMonitor.trackQuery('INVALID QUERY', 50, 10);
      }).not.toThrow();

      // Should still track the query
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.dbQueries.length).toBeGreaterThan(0);
      expect(metrics.dbQueries[metrics.dbQueries.length - 1].query).toBe(
        'QUERY_SANITIZATION_FAILED'
      );
    });
  });

  describe('Metrics Summary', () => {
    it('should generate accurate summary', () => {
      // Add test data
      performanceMonitor.trackApiCall('/api/users', 'GET', 100, 200);
      performanceMonitor.trackApiCall('/api/users', 'GET', 200, 200);
      performanceMonitor.trackApiCall('/api/posts', 'POST', 300, 201);

      performanceMonitor.trackQuery('SELECT * FROM users', 50, 10);
      performanceMonitor.trackQuery('INSERT INTO logs', 150, 1);

      const summary = performanceMonitor.getSummary();

      expect(summary.api.totalEndpoints).toBe(2);
      expect(summary.api.totalCalls).toBe(3);
      expect(summary.api.avgResponseTime).toBe(200); // (100 + 200 + 300) / 3

      expect(summary.database.totalQueries).toBeGreaterThanOrEqual(2);
      expect(summary.database.avgQueryTime).toBeGreaterThan(0);
      expect(summary.database.slowQueries).toHaveLength(1); // Only the 150ms query
    });
  });

  describe('Cleanup and Lifecycle', () => {
    it('should clear all metrics', () => {
      // Add data
      performanceMonitor.trackApiCall('/api/test', 'GET', 100, 200);
      performanceMonitor.trackQuery('SELECT 1', 10, 1);

      // Clear
      performanceMonitor.clearMetrics();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.apiCalls.size).toBe(0);
      expect(metrics.dbQueries.length).toBe(0);
      expect(metrics.memoryUsage.length).toBe(0);
    });

    it('should stop monitoring properly', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      performanceMonitor.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect((performanceMonitor as unknown).memoryCheckInterval).toBeUndefined();
    });

    it('should execute destructor', () => {
      const stopSpy = jest.spyOn(performanceMonitor, 'stop');
      const clearSpy = jest.spyOn(performanceMonitor, 'clearMetrics');

      performanceMonitor.destructor();

      expect(stopSpy).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('Constants Usage', () => {
    it('should use constants instead of magic numbers', () => {
      // Check that constants are defined on the constructor
      const PerformanceMonitorClass = (performanceMonitor as unknown).constructor;
      expect(PerformanceMonitorClass.MAX_QUERY_HISTORY).toBe(1000);
      expect(PerformanceMonitorClass.MAX_MEMORY_HISTORY).toBe(100);
      expect(PerformanceMonitorClass.MEMORY_CHECK_INTERVAL_MS).toBe(30000);
      expect(PerformanceMonitorClass.HIGH_MEMORY_THRESHOLD_PERCENT).toBe(90);
      expect(PerformanceMonitorClass.CRITICAL_MEMORY_THRESHOLD_PERCENT).toBe(95);
    });
  });
});
