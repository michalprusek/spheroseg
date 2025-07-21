/**
 * Tests for PerformanceMonitor Service
 * 
 * Tests system metrics collection, API monitoring, database monitoring,
 * and performance alerts functionality
 */

import { PerformanceMonitor } from '../performanceMonitor';
import { EventEmitter } from 'events';
import os from 'os';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../db', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn()
  }))
}));

jest.mock('../cacheService', () => ({
  default: {
    get: jest.fn(),
    set: jest.fn(),
    generateKey: jest.fn((prefix: string, key: string) => `${prefix}${key}`)
  }
}));

jest.mock('../../utils/containerInfo', () => ({
  getContainerInfo: jest.fn(() => ({
    memoryLimit: 512 * 1024 * 1024, // 512MB
    cpuLimit: 2
  }))
}));

jest.mock('os', () => ({
  cpus: jest.fn(() => [
    { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } },
    { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } }
  ]),
  totalmem: jest.fn(() => 8 * 1024 * 1024 * 1024), // 8GB
  freemem: jest.fn(() => 4 * 1024 * 1024 * 1024)   // 4GB free
}));

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let mockLogger: any;

  beforeAll(() => {
    // Mock timers
    jest.useFakeTimers();
    mockLogger = require('../../utils/logger').default;
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    performanceMonitor.stop();
  });

  describe('System Metrics Collection', () => {
    it('should collect system metrics periodically', () => {
      const collectSpy = jest.spyOn(performanceMonitor as any, 'collectSystemMetrics');
      
      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);
      
      expect(collectSpy).toHaveBeenCalledTimes(1);
      
      // Fast-forward another 30 seconds
      jest.advanceTimersByTime(30000);
      
      expect(collectSpy).toHaveBeenCalledTimes(2);
    });

    it('should calculate CPU usage correctly', async () => {
      const metrics = await performanceMonitor.getSystemMetrics();
      
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should track memory usage', async () => {
      const metrics = await performanceMonitor.getSystemMetrics();
      
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics.memoryUsage).toMatchObject({
        total: expect.any(Number),
        used: expect.any(Number),
        percentage: expect.any(Number)
      });
      
      expect(metrics.memoryUsage.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage.percentage).toBeLessThanOrEqual(100);
    });

    it('should track heap usage', async () => {
      const metrics = await performanceMonitor.getSystemMetrics();
      
      expect(metrics).toHaveProperty('heapUsage');
      expect(metrics.heapUsage).toMatchObject({
        total: expect.any(Number),
        used: expect.any(Number),
        percentage: expect.any(Number)
      });
    });

    it('should monitor event loop lag', () => {
      // Fast-forward to trigger event loop monitoring
      jest.advanceTimersByTime(100);
      
      const metrics = performanceMonitor.getMetricsSummary();
      expect(metrics).toHaveProperty('eventLoopLag');
      expect(metrics.eventLoopLag).toHaveProperty('current');
    });
  });

  describe('API Metrics', () => {
    it('should track API endpoint metrics', () => {
      performanceMonitor.trackAPICall('/api/users', 'GET', 200, 150);
      performanceMonitor.trackAPICall('/api/users', 'GET', 200, 200);
      performanceMonitor.trackAPICall('/api/users', 'POST', 201, 300);
      
      const summary = performanceMonitor.getAPIMetricsSummary();
      
      expect(summary).toHaveLength(2); // Two unique endpoint+method combinations
      
      const getMetrics = summary.find(s => s.method === 'GET');
      expect(getMetrics).toMatchObject({
        endpoint: '/api/users',
        method: 'GET',
        count: 2,
        avgResponseTime: 175,
        minResponseTime: 150,
        maxResponseTime: 200
      });
    });

    it('should track error rates', () => {
      performanceMonitor.trackAPICall('/api/error', 'GET', 500, 100);
      performanceMonitor.trackAPICall('/api/error', 'GET', 200, 150);
      performanceMonitor.trackAPICall('/api/error', 'GET', 404, 80);
      
      const summary = performanceMonitor.getAPIMetricsSummary();
      const metrics = summary.find(s => s.endpoint === '/api/error');
      
      expect(metrics).toMatchObject({
        count: 3,
        errorRate: expect.closeTo(66.67, 1) // 2 errors out of 3
      });
    });

    it('should identify slow endpoints', () => {
      performanceMonitor.trackAPICall('/api/slow', 'GET', 200, 5000);
      performanceMonitor.trackAPICall('/api/fast', 'GET', 200, 50);
      
      const slowEndpoints = performanceMonitor.getSlowEndpoints(1000);
      
      expect(slowEndpoints).toHaveLength(1);
      expect(slowEndpoints[0]).toMatchObject({
        endpoint: '/api/slow',
        avgResponseTime: 5000
      });
    });
  });

  describe('Database Metrics', () => {
    it('should track database query metrics', () => {
      performanceMonitor.trackDatabaseQuery('SELECT * FROM users', 100, 10);
      performanceMonitor.trackDatabaseQuery('SELECT * FROM users', 150, 10);
      performanceMonitor.trackDatabaseQuery('INSERT INTO logs', 50, 1);
      
      const summary = performanceMonitor.getDatabaseMetricsSummary();
      
      expect(summary).toHaveLength(2); // Two unique queries
      
      const selectMetrics = summary.find(s => s.query.includes('SELECT'));
      expect(selectMetrics).toMatchObject({
        query: 'SELECT * FROM users',
        count: 2,
        avgDuration: 125,
        totalDuration: 250
      });
    });

    it('should identify slow queries', () => {
      performanceMonitor.trackDatabaseQuery('SELECT * FROM large_table', 5000, 1000);
      performanceMonitor.trackDatabaseQuery('SELECT * FROM small_table', 50, 10);
      
      const slowQueries = performanceMonitor.getSlowQueries(1000);
      
      expect(slowQueries).toHaveLength(1);
      expect(slowQueries[0]).toMatchObject({
        query: 'SELECT * FROM large_table',
        avgDuration: 5000
      });
    });
  });

  describe('Custom Metrics', () => {
    it('should track custom metrics', () => {
      performanceMonitor.trackMetric('custom.metric', 100);
      performanceMonitor.trackMetric('custom.metric', 200);
      performanceMonitor.trackMetric('custom.metric', 150);
      
      const summary = performanceMonitor.getMetricsSummary();
      
      expect(summary.customMetrics).toHaveProperty('custom.metric');
      expect(summary.customMetrics['custom.metric']).toMatchObject({
        count: 3,
        total: 450,
        average: 150,
        min: 100,
        max: 200
      });
    });

    it('should support metric metadata', () => {
      performanceMonitor.trackMetric('cache.hit', 1, { key: 'user:123' });
      performanceMonitor.trackMetric('cache.miss', 1, { key: 'user:456' });
      
      const metrics = (performanceMonitor as any).metrics;
      
      expect(metrics).toHaveLength(2);
      expect(metrics[0].metadata).toEqual({ key: 'user:123' });
    });
  });

  describe('Alerts', () => {
    it('should emit alerts for high CPU usage', () => {
      const alertSpy = jest.fn();
      performanceMonitor.on('alert', alertSpy);
      
      // Mock high CPU usage
      const osMock = require('os');
      osMock.cpus.mockReturnValueOnce([
        { times: { user: 900, nice: 0, sys: 50, idle: 50, irq: 0 } },
        { times: { user: 900, nice: 0, sys: 50, idle: 50, irq: 0 } }
      ]);
      
      // Trigger system metrics collection
      jest.advanceTimersByTime(30000);
      
      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cpu',
          severity: 'high'
        })
      );
    });

    it('should emit alerts for high memory usage', async () => {
      const alertSpy = jest.fn();
      performanceMonitor.on('alert', alertSpy);
      
      // Mock high memory usage
      const osMock = require('os');
      osMock.freemem.mockReturnValueOnce(0.5 * 1024 * 1024 * 1024); // Only 0.5GB free
      
      // Trigger system metrics collection
      jest.advanceTimersByTime(30000);
      
      // Wait for async operations
      await Promise.resolve();
      
      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory',
          severity: 'high'
        })
      );
    });

    it('should emit alerts for high event loop lag', () => {
      const alertSpy = jest.fn();
      performanceMonitor.on('alert', alertSpy);
      
      // Mock high event loop lag
      (performanceMonitor as any).eventLoopLag = 500; // 500ms lag
      
      // Trigger check
      performanceMonitor.checkPerformanceThresholds();
      
      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'eventLoop',
          severity: 'high'
        })
      );
    });
  });

  describe('Metrics Export', () => {
    it('should export metrics in JSON format', () => {
      // Add some metrics
      performanceMonitor.trackAPICall('/api/test', 'GET', 200, 100);
      performanceMonitor.trackDatabaseQuery('SELECT 1', 50, 1);
      performanceMonitor.trackMetric('test.metric', 42);
      
      const exported = performanceMonitor.exportMetrics('json');
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('apiMetrics');
      expect(parsed).toHaveProperty('databaseMetrics');
      expect(parsed).toHaveProperty('systemMetrics');
      expect(parsed).toHaveProperty('customMetrics');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('should export metrics in CSV format', () => {
      performanceMonitor.trackAPICall('/api/test', 'GET', 200, 100);
      performanceMonitor.trackAPICall('/api/test2', 'POST', 201, 150);
      
      const csv = performanceMonitor.exportMetrics('csv');
      
      expect(csv).toContain('endpoint,method,count,avgResponseTime');
      expect(csv).toContain('/api/test,GET,');
      expect(csv).toContain('/api/test2,POST,');
    });
  });

  describe('Metrics Cleanup', () => {
    it('should clean up old metrics', () => {
      // Add old metric
      const oldMetric = {
        timestamp: Date.now() - 7200000, // 2 hours old
        type: 'api',
        name: '/api/old',
        value: 100
      };
      (performanceMonitor as any).metrics.push(oldMetric);
      
      // Add recent metric
      performanceMonitor.trackMetric('recent.metric', 50);
      
      // Clean up
      performanceMonitor.cleanupOldMetrics();
      
      const metrics = (performanceMonitor as any).metrics;
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('recent.metric');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      // Add various metrics
      performanceMonitor.trackAPICall('/api/test', 'GET', 200, 100);
      performanceMonitor.trackDatabaseQuery('SELECT 1', 50, 1);
      performanceMonitor.trackMetric('test', 42);
      
      // Reset
      performanceMonitor.reset();
      
      const summary = performanceMonitor.getMetricsSummary();
      
      expect(summary.api.totalCalls).toBe(0);
      expect(summary.database.totalQueries).toBe(0);
      expect(Object.keys(summary.customMetrics)).toHaveLength(0);
    });
  });
});