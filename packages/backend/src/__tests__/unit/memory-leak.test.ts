/**
 * Memory leak detection tests for performance monitoring
 */

import { performanceMonitor } from '../../middleware/performanceMonitoring';
import logger from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Memory Leak Detection Tests', () => {
  const originalGC = global.gc;
  const ITERATIONS = 1000;
  const MEMORY_THRESHOLD_MB = 50; // Alert if memory grows by more than 50MB

  beforeAll(() => {
    // Enable manual garbage collection for tests
    if (!global.gc) {
      // @ts-ignore
      global.gc = jest.fn();
    }
  });

  afterAll(() => {
    global.gc = originalGC;
    performanceMonitor.stop();
  });

  beforeEach(() => {
    performanceMonitor.clearMetrics();
    // Force garbage collection before each test
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    performanceMonitor.removeAllListeners();
  });

  describe('API Call Tracking Memory Leak', () => {
    it('should not leak memory when tracking many API calls', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate many API calls
      for (let i = 0; i < ITERATIONS; i++) {
        performanceMonitor.trackApiCall(
          `/api/endpoint${i % 10}`, // Rotate between 10 endpoints
          'GET',
          Math.random() * 100,
          200
        );
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

      expect(memoryGrowthMB).toBeLessThan(MEMORY_THRESHOLD_MB);
      
      // Verify metrics are properly bounded
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.apiCalls.size).toBeLessThanOrEqual(10); // Should only track 10 unique endpoints
    });

    it('should clean up old API metrics under memory pressure', () => {
      // Fill with many API calls
      for (let i = 0; i < 100; i++) {
        performanceMonitor.trackApiCall(`/api/endpoint${i}`, 'GET', 50, 200);
      }

      const initialSize = performanceMonitor.getMetrics().apiCalls.size;
      
      // Trigger cleanup
      (performanceMonitor as any).cleanupUnderMemoryPressure();
      
      const finalSize = performanceMonitor.getMetrics().apiCalls.size;
      expect(finalSize).toBeLessThan(initialSize);
    });
  });

  describe('Database Query Tracking Memory Leak', () => {
    it('should not leak memory when tracking many queries', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate many database queries
      for (let i = 0; i < ITERATIONS * 2; i++) {
        performanceMonitor.trackQuery(
          `SELECT * FROM table WHERE id = ${i}`,
          Math.random() * 50,
          Math.floor(Math.random() * 100)
        );
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

      expect(memoryGrowthMB).toBeLessThan(MEMORY_THRESHOLD_MB);
      
      // Verify query history is bounded
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.dbQueries.length).toBeLessThanOrEqual(1000); // MAX_QUERY_HISTORY
    });

    it('should maintain query history size limit', () => {
      // Add more queries than the limit
      for (let i = 0; i < 1500; i++) {
        performanceMonitor.trackQuery(`SELECT ${i}`, 10, 1);
      }

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.dbQueries.length).toBe(1000); // Should be capped at MAX_QUERY_HISTORY
    });
  });

  describe('Memory Usage Tracking Memory Leak', () => {
    it('should not leak memory from memory usage history', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate memory monitoring over time
      for (let i = 0; i < 200; i++) {
        // Access private method for testing
        const monitor = performanceMonitor as any;
        monitor.metrics.memoryUsage.push({
          timestamp: new Date(),
          heapUsed: Math.random() * 1000000000,
          heapTotal: 1000000000,
          external: 0,
          rss: 1200000000,
        });
        
        // Trigger cleanup if needed
        if (monitor.metrics.memoryUsage.length > monitor.maxMemoryHistory) {
          monitor.metrics.memoryUsage.shift();
        }
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

      expect(memoryGrowthMB).toBeLessThan(MEMORY_THRESHOLD_MB);
      
      // Verify memory history is bounded
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.memoryUsage.length).toBeLessThanOrEqual(100); // MAX_MEMORY_HISTORY
    });
  });

  describe('Event Listener Memory Leak', () => {
    it('should not leak memory from event listeners', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const listeners: Array<() => void> = [];

      // Add and remove many listeners
      for (let i = 0; i < ITERATIONS; i++) {
        const listener = () => {
          console.log(`Event ${i}`);
        };
        listeners.push(listener);
        performanceMonitor.on('highMemoryUsage', listener);
      }

      // Remove all listeners
      listeners.forEach(listener => {
        performanceMonitor.removeListener('highMemoryUsage', listener);
      });

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

      expect(memoryGrowthMB).toBeLessThan(MEMORY_THRESHOLD_MB);
      expect(performanceMonitor.listenerCount('highMemoryUsage')).toBe(0);
    });
  });

  describe('Emergency Cleanup Effectiveness', () => {
    it('should effectively reduce memory usage during emergency cleanup', () => {
      // Fill all metrics to maximum
      for (let i = 0; i < 1000; i++) {
        performanceMonitor.trackQuery(`SELECT ${i}`, 10, 1);
      }
      
      for (let i = 0; i < 100; i++) {
        performanceMonitor.trackApiCall(`/api/endpoint${i}`, 'GET', 50, 200);
      }

      const beforeCleanup = {
        queries: performanceMonitor.getMetrics().dbQueries.length,
        apiCalls: performanceMonitor.getMetrics().apiCalls.size,
        memory: performanceMonitor.getMetrics().memoryUsage.length,
      };

      // Trigger emergency cleanup
      (performanceMonitor as any).emergencyCleanup();

      const afterCleanup = {
        queries: performanceMonitor.getMetrics().dbQueries.length,
        apiCalls: performanceMonitor.getMetrics().apiCalls.size,
        memory: performanceMonitor.getMetrics().memoryUsage.length,
      };

      // Verify significant reduction
      expect(afterCleanup.queries).toBeLessThan(beforeCleanup.queries);
      expect(afterCleanup.queries).toBeLessThanOrEqual(100); // Emergency limit
      expect(afterCleanup.memory).toBeLessThanOrEqual(10); // Emergency limit
    });
  });

  describe('Concurrent Access Memory Safety', () => {
    it('should handle concurrent metric updates without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const promises: Promise<void>[] = [];

      // Simulate concurrent access
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              for (let j = 0; j < 100; j++) {
                performanceMonitor.trackApiCall(`/api/test${j % 5}`, 'GET', 10, 200);
                performanceMonitor.trackQuery(`SELECT ${j}`, 5, 1);
              }
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(promises);

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

      expect(memoryGrowthMB).toBeLessThan(MEMORY_THRESHOLD_MB);
    });
  });
});