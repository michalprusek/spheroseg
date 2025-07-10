/**
 * Unit tests for performance monitoring
 */

import { PerformanceMonitor } from '../../middleware/performanceMonitoring';

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
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // Create a test instance (not the singleton)
    monitor = new (PerformanceMonitor as any)();
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('Memory Pressure Handling', () => {
    it('should detect high memory pressure at 90%', (done) => {
      monitor.once('highMemoryUsage', (data) => {
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

      monitor['handleHighMemoryPressure'](90, mockMemUsage as NodeJS.MemoryUsage);
    });

    it('should trigger emergency cleanup at 95% memory', () => {
      const spy = jest.spyOn(monitor as any, 'emergencyCleanup');

      const mockMemUsage = {
        heapUsed: 950 * 1024 * 1024,
        heapTotal: 1000 * 1024 * 1024,
        external: 0,
        rss: 1200 * 1024 * 1024,
      };

      monitor['handleCriticalMemoryPressure'](95, mockMemUsage as NodeJS.MemoryUsage);

      expect(spy).toHaveBeenCalled();
    });

    it('should reduce metrics under memory pressure', () => {
      // Add test data
      for (let i = 0; i < 1000; i++) {
        monitor['metrics'].dbQueries.push({
          query: `SELECT * FROM test_${i}`,
          duration: Math.random() * 100,
          timestamp: new Date(),
          rowCount: 10,
        });
      }

      // Trigger cleanup
      monitor['cleanupUnderMemoryPressure']();

      // Should reduce to 25% (250 queries)
      expect(monitor['metrics'].dbQueries.length).toBeLessThanOrEqual(250);
    });
  });

  describe('API Performance Tracking', () => {
    it('should track API metrics correctly', () => {
      monitor.trackApiCall('/api/test', 'GET', 150, 200);
      monitor.trackApiCall('/api/test', 'GET', 100, 200);
      monitor.trackApiCall('/api/test', 'POST', 200, 201);

      const metrics = monitor.getMetrics();
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
      monitor.once('slowApiCall', (data) => {
        expect(data.duration).toBeGreaterThan(1000);
        expect(data.endpoint).toBe('/api/slow');
        expect(data.method).toBe('GET');
        done();
      });

      monitor.trackApiCall('/api/slow', 'GET', 1500, 200);
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
        const sanitized = monitor['sanitizeQuery'](input);
        expect(sanitized).toBe(expected);
      });
    });

    it('should track slow queries', (done) => {
      monitor.once('slowQuery', (data) => {
        expect(data.duration).toBeGreaterThan(100);
        expect(data.query).toContain('SELECT');
        expect(data.rowCount).toBe(1000);
        done();
      });

      monitor.trackQuery('SELECT * FROM large_table', 150, 1000);
    });

    it('should handle query sanitization errors gracefully', () => {
      // Mock sanitization to throw error
      jest.spyOn(monitor as any, 'sanitizeQuery').mockImplementation(() => {
        throw new Error('Sanitization error');
      });

      // Should not throw
      expect(() => {
        monitor.trackQuery('INVALID QUERY', 50, 10);
      }).not.toThrow();

      // Should still track the query
      const metrics = monitor.getMetrics();
      expect(metrics.dbQueries.length).toBe(1);
      expect(metrics.dbQueries[0].query).toBe('QUERY_SANITIZATION_FAILED');
    });
  });

  describe('Metrics Summary', () => {
    it('should generate accurate summary', () => {
      // Add test data
      monitor.trackApiCall('/api/users', 'GET', 100, 200);
      monitor.trackApiCall('/api/users', 'GET', 200, 200);
      monitor.trackApiCall('/api/posts', 'POST', 300, 201);

      monitor.trackQuery('SELECT * FROM users', 50, 10);
      monitor.trackQuery('INSERT INTO logs', 150, 1);

      const summary = monitor.getSummary();

      expect(summary.api.totalEndpoints).toBe(2);
      expect(summary.api.totalCalls).toBe(3);
      expect(summary.api.avgResponseTime).toBe(200); // (100 + 200 + 300) / 3

      expect(summary.database.totalQueries).toBe(2);
      expect(summary.database.avgQueryTime).toBe(100); // (50 + 150) / 2
      expect(summary.database.slowQueries).toHaveLength(1); // Only the 150ms query
    });
  });

  describe('Cleanup and Lifecycle', () => {
    it('should clear all metrics', () => {
      // Add data
      monitor.trackApiCall('/api/test', 'GET', 100, 200);
      monitor.trackQuery('SELECT 1', 10, 1);

      // Clear
      monitor.clearMetrics();

      const metrics = monitor.getMetrics();
      expect(metrics.apiCalls.size).toBe(0);
      expect(metrics.dbQueries.length).toBe(0);
      expect(metrics.memoryUsage.length).toBe(0);
    });

    it('should stop monitoring properly', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      monitor.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(monitor['memoryCheckInterval']).toBeUndefined();
    });

    it('should execute destructor', () => {
      const stopSpy = jest.spyOn(monitor, 'stop');
      const clearSpy = jest.spyOn(monitor, 'clearMetrics');

      monitor.destructor();

      expect(stopSpy).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('Constants Usage', () => {
    it('should use constants instead of magic numbers', () => {
      // Check that constants are defined
      expect(PerformanceMonitor['MAX_QUERY_HISTORY']).toBe(1000);
      expect(PerformanceMonitor['MAX_MEMORY_HISTORY']).toBe(100);
      expect(PerformanceMonitor['MEMORY_CHECK_INTERVAL_MS']).toBe(30000);
      expect(PerformanceMonitor['HIGH_MEMORY_THRESHOLD_PERCENT']).toBe(90);
      expect(PerformanceMonitor['CRITICAL_MEMORY_THRESHOLD_PERCENT']).toBe(95);
    });
  });
});
