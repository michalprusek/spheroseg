/**
 * Tests for Business Metrics Service
 */

import { Redis } from 'ioredis';
import { BusinessMetricsService, initializeBusinessMetrics } from '../businessMetrics';
import { pool } from '../../db';

// Mock dependencies
jest.mock('ioredis');
jest.mock('../logger');
jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock('node-cron', () => ({
  schedule: jest.fn().mockImplementation((pattern, callback, options) => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe('BusinessMetricsService', () => {
  let redis: jest.Mocked<Redis>;
  let metricsService: BusinessMetricsService;
  
  beforeEach(() => {
    // Create mock Redis instance
    redis = new Redis() as jest.Mocked<Redis>;
    
    // Mock Redis methods
    redis.get = jest.fn().mockResolvedValue(null);
    redis.set = jest.fn().mockResolvedValue('OK');
    redis.setex = jest.fn().mockResolvedValue('OK');
    redis.del = jest.fn().mockResolvedValue(1);
    redis.scan = jest.fn().mockResolvedValue(['0', []]);
    redis.zadd = jest.fn().mockResolvedValue(1);
    redis.zrangebyscore = jest.fn().mockResolvedValue([]);
    redis.zremrangebyscore = jest.fn().mockResolvedValue(0);
    
    // Initialize metrics service
    metricsService = new BusinessMetricsService(redis);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    metricsService.stopAll();
  });
  
  describe('Metric Registration', () => {
    it('should register a metric configuration', () => {
      const config = {
        name: 'test-metric',
        description: 'Test metric',
        query: 'SELECT 1 as value',
        unit: 'count' as const,
        aggregation: 'sum' as const,
        interval: 5,
        thresholds: {
          warning: 10,
          critical: 20,
        },
      };
      
      expect(() => metricsService.registerMetric(config)).not.toThrow();
    });
    
    it('should register metric with custom calculator', () => {
      const config = {
        name: 'test-metric',
        description: 'Test metric',
        calculator: async () => 42,
        unit: 'count' as const,
        aggregation: 'sum' as const,
        interval: 5,
        thresholds: {
          warning: 10,
          critical: 20,
        },
      };
      
      expect(() => metricsService.registerMetric(config)).not.toThrow();
    });
  });
  
  describe('Metric Collection', () => {
    beforeEach(() => {
      metricsService.registerMetric({
        name: 'test-metric',
        description: 'Test metric',
        query: 'SELECT 5 as value',
        unit: 'count',
        aggregation: 'sum',
        interval: 5,
        thresholds: {
          warning: 10,
          critical: 20,
        },
      });
    });
    
    it('should collect metric value from SQL query', async () => {
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ value: 5 }],
      });
      
      const result = await metricsService.collectMetric('test-metric');
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(5);
      expect(result?.metric).toBe('test-metric');
      expect(pool.query).toHaveBeenCalledWith('SELECT 5 as value');
    });
    
    it('should collect metric value from calculator function', async () => {
      metricsService.registerMetric({
        name: 'calc-metric',
        description: 'Calculator metric',
        calculator: async () => 42,
        unit: 'count',
        aggregation: 'sum',
        interval: 5,
        thresholds: {},
      });
      
      const result = await metricsService.collectMetric('calc-metric');
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(42);
    });
    
    it('should handle collection errors gracefully', async () => {
      (pool.query as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const result = await metricsService.collectMetric('test-metric');
      
      expect(result).toBeNull();
    });
    
    it('should throw error for unregistered metric', async () => {
      await expect(metricsService.collectMetric('unknown')).rejects.toThrow(
        'Metric unknown not registered'
      );
    });
  });
  
  describe('Threshold Checking', () => {
    let alertHandler: jest.Mock;
    
    beforeEach(() => {
      alertHandler = jest.fn();
      metricsService.registerAlertHandler(alertHandler);
      
      metricsService.registerMetric({
        name: 'threshold-metric',
        description: 'Threshold test metric',
        query: 'SELECT value FROM test',
        unit: 'count',
        aggregation: 'sum',
        interval: 5,
        thresholds: {
          warning: 10,
          critical: 20,
        },
      });
    });
    
    it('should trigger warning alert when threshold exceeded', async () => {
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ value: 15 }], // Between warning and critical
      });
      
      await metricsService.collectMetric('threshold-metric');
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'threshold-metric',
          severity: 'warning',
          type: 'threshold',
          value: 15,
          threshold: 10,
        })
      );
    });
    
    it('should trigger critical alert when threshold exceeded', async () => {
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ value: 25 }], // Above critical
      });
      
      await metricsService.collectMetric('threshold-metric');
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'threshold-metric',
          severity: 'critical',
          type: 'threshold',
          value: 25,
          threshold: 20,
        })
      );
    });
    
    it('should not trigger alert when below thresholds', async () => {
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ value: 5 }], // Below warning
      });
      
      await metricsService.collectMetric('threshold-metric');
      
      expect(alertHandler).not.toHaveBeenCalled();
    });
  });
  
  describe('Trend Checking', () => {
    let alertHandler: jest.Mock;
    
    beforeEach(() => {
      alertHandler = jest.fn();
      metricsService.registerAlertHandler(alertHandler);
      
      metricsService.registerMetric({
        name: 'trend-metric',
        description: 'Trend test metric',
        query: 'SELECT value FROM test',
        unit: 'count',
        aggregation: 'sum',
        interval: 5,
        thresholds: {
          trend: {
            increase: 50, // 50% increase triggers alert
            decrease: 30, // 30% decrease triggers alert
            window: 60,
          },
        },
      });
    });
    
    it('should trigger alert on significant increase', async () => {
      // Mock historical data
      const history = [
        { metric: 'trend-metric', value: 100, timestamp: new Date(Date.now() - 30 * 60 * 1000), unit: 'count' },
        { metric: 'trend-metric', value: 120, timestamp: new Date(Date.now() - 20 * 60 * 1000), unit: 'count' },
      ];
      
      redis.zrangebyscore.mockResolvedValue(
        history.flatMap(h => [JSON.stringify(h), h.timestamp.getTime().toString()])
      );
      
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ value: 200 }], // 100% increase from 100 to 200
      });
      
      await metricsService.collectMetric('trend-metric');
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'trend-metric',
          type: 'trend',
          message: expect.stringContaining('increased by 100'),
        })
      );
    });
    
    it('should trigger alert on significant decrease', async () => {
      const history = [
        { metric: 'trend-metric', value: 100, timestamp: new Date(Date.now() - 30 * 60 * 1000), unit: 'count' },
      ];
      
      redis.zrangebyscore.mockResolvedValue(
        history.flatMap(h => [JSON.stringify(h), h.timestamp.getTime().toString()])
      );
      
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ value: 50 }], // 50% decrease from 100 to 50
      });
      
      await metricsService.collectMetric('trend-metric');
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'trend-metric',
          type: 'trend',
          message: expect.stringContaining('decreased by 50'),
        })
      );
    });
  });
  
  describe('Metric Retrieval', () => {
    it('should retrieve current metric value', async () => {
      const metricValue = {
        metric: 'test-metric',
        value: 42,
        timestamp: new Date(),
        unit: 'count',
      };
      
      redis.get.mockResolvedValue(JSON.stringify(metricValue));
      
      const result = await metricsService.getMetricValue('test-metric');
      
      expect(result).toEqual(expect.objectContaining({
        metric: 'test-metric',
        value: 42,
        unit: 'count',
      }));
    });
    
    it('should return null for non-existent metric', async () => {
      redis.get.mockResolvedValue(null);
      
      const result = await metricsService.getMetricValue('unknown');
      
      expect(result).toBeNull();
    });
  });
  
  describe('Alert Management', () => {
    it('should retrieve active alerts', async () => {
      const alert = {
        id: 'alert-123',
        metric: 'test-metric',
        severity: 'warning' as const,
        type: 'threshold' as const,
        message: 'Test alert',
        value: 15,
        threshold: 10,
        timestamp: new Date(),
        acknowledged: false,
      };
      
      redis.scan.mockResolvedValue(['0', ['alert:test-metric:alert-123']]);
      redis.get.mockResolvedValue(JSON.stringify(alert));
      
      const alerts = await metricsService.getActiveAlerts();
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toEqual(expect.objectContaining({
        id: 'alert-123',
        metric: 'test-metric',
        severity: 'warning',
      }));
    });
    
    it('should filter alerts by metric name', async () => {
      const alert = {
        id: 'alert-123',
        metric: 'test-metric',
        severity: 'warning' as const,
        type: 'threshold' as const,
        message: 'Test alert',
        value: 15,
        threshold: 10,
        timestamp: new Date(),
        acknowledged: false,
      };
      
      redis.scan.mockResolvedValue(['0', ['alert:test-metric:alert-123']]);
      redis.get.mockResolvedValue(JSON.stringify(alert));
      
      const alerts = await metricsService.getActiveAlerts('test-metric');
      
      expect(alerts).toHaveLength(1);
    });
    
    it('should acknowledge alerts', async () => {
      const alert = {
        id: 'alert-123',
        metric: 'test-metric',
        severity: 'warning' as const,
        type: 'threshold' as const,
        message: 'Test alert',
        value: 15,
        threshold: 10,
        timestamp: new Date(),
        acknowledged: false,
      };
      
      redis.scan.mockResolvedValue(['0', ['alert:test-metric:alert-123']]);
      redis.get.mockResolvedValue(JSON.stringify(alert));
      
      await metricsService.acknowledgeAlert('alert-123', 'user-123');
      
      expect(redis.setex).toHaveBeenCalledWith(
        'alert:test-metric:alert-123',
        86400,
        expect.stringContaining('"acknowledged":true')
      );
    });
  });
  
  describe('Dashboard Data', () => {
    it('should return dashboard data with metrics and alerts', async () => {
      metricsService.registerMetric({
        name: 'dash-metric',
        description: 'Dashboard metric',
        query: 'SELECT 1 as value',
        unit: 'count',
        aggregation: 'sum',
        interval: 5,
        thresholds: {},
      });
      
      const metricValue = {
        metric: 'dash-metric',
        value: 42,
        timestamp: new Date(),
        unit: 'count',
      };
      
      const stats = {
        metric: 'dash-metric',
        current: 42,
        average: 40,
        min: 30,
        max: 50,
        trend: 'stable' as const,
        trendPercentage: 0,
        lastUpdated: new Date(),
      };
      
      redis.get.mockImplementation(async (key: string) => {
        if (key.includes('current')) return JSON.stringify(metricValue);
        if (key.includes('stats')) return JSON.stringify(stats);
        return null;
      });
      
      redis.scan.mockResolvedValue(['0', []]);
      
      const dashboard = await metricsService.getDashboardData();
      
      expect(dashboard.metrics).toHaveLength(1);
      expect(dashboard.metrics[0]).toEqual({
        name: 'dash-metric',
        config: expect.objectContaining({
          name: 'dash-metric',
        }),
        current: expect.objectContaining({
          value: 42,
        }),
        stats: expect.objectContaining({
          current: 42,
        }),
      });
    });
  });
  
  describe('Initialization', () => {
    it('should initialize metrics service singleton', () => {
      const service = initializeBusinessMetrics(redis);
      expect(service).toBeInstanceOf(BusinessMetricsService);
      
      // Should return same instance
      const service2 = initializeBusinessMetrics(redis);
      expect(service2).toBe(service);
    });
  });
});