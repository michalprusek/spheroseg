/**
 * Error Tracking Service Unit Tests
 * 
 * Comprehensive tests for the error tracking and alerting system.
 * Tests error collection, pattern detection, alerting, and analytics.
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { Redis } from 'ioredis';
import { ErrorTrackingService } from '../../services/errorTracking.service';
import { ApiError } from '../../utils/ApiError.enhanced';
import logger from '../../utils/logger';

// Mock Redis
vi.mock('ioredis');
const MockRedis = vi.mocked(Redis);

// Mock pool for database operations
vi.mock('../../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ErrorTrackingService', () => {
  let mockRedis: any;
  let errorTrackingService: ErrorTrackingService;
  let mockPool: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock Redis instance
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      zadd: vi.fn(),
      zrangebyscore: vi.fn(),
      zremrangebyscore: vi.fn(),
      scan: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      status: 'ready',
    };

    // Mock pool
    mockPool = require('../../db').pool;
    mockPool.query.mockResolvedValue({ rows: [] });

    // Create service instance
    errorTrackingService = new ErrorTrackingService(mockRedis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Tracking', () => {
    it('should track a new error and generate fingerprint', async () => {
      const testError = new ApiError('VALIDATION_ERROR', 'Test validation error');
      const context = {
        userId: 'test-user-id',
        requestId: 'test-request-id',
        endpoint: '/api/test',
        method: 'POST',
      };

      // Mock Redis operations
      mockRedis.get.mockResolvedValue(null); // No existing pattern
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);

      const errorId = await errorTrackingService.trackError(testError, context);

      expect(errorId).toBeDefined();
      expect(typeof errorId).toBe('string');

      // Verify Redis calls for storing error
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockRedis.zadd).toHaveBeenCalled();

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith(
        'Error tracked',
        expect.objectContaining({
          id: errorId,
          fingerprint: expect.any(String),
          severity: expect.any(String),
        })
      );
    });

    it('should generate consistent fingerprints for similar errors', async () => {
      const error1 = new ApiError('VALIDATION_ERROR', 'Field required');
      const error2 = new ApiError('VALIDATION_ERROR', 'Field required');
      
      const context = { endpoint: '/api/test', method: 'POST' };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);

      const fingerprint1 = (errorTrackingService as any).generateErrorFingerprint(error1, context);
      const fingerprint2 = (errorTrackingService as any).generateErrorFingerprint(error2, context);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(32); // MD5 hash length
    });

    it('should handle tracking errors gracefully when Redis fails', async () => {
      const testError = new ApiError('SYSTEM_ERROR', 'Test system error');
      const context = { endpoint: '/api/test', method: 'POST' };

      // Mock Redis failure
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));

      const errorId = await errorTrackingService.trackError(testError, context);

      expect(errorId).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to store error in Redis',
        expect.objectContaining({
          error: 'Redis connection failed',
        })
      );
    });

    it('should categorize errors correctly', async () => {
      const testCases = [
        { error: new ApiError('AUTH_INVALID_CREDENTIALS'), expectedCategory: 'authentication' },
        { error: new ApiError('VALIDATION_REQUIRED_FIELD'), expectedCategory: 'validation' },
        { error: new ApiError('PERMISSION_DENIED'), expectedCategory: 'permission' },
        { error: new ApiError('BUSINESS_INVALID_STATE'), expectedCategory: 'business' },
        { error: new ApiError('EXTERNAL_ML_SERVICE_ERROR'), expectedCategory: 'external' },
        { error: new ApiError('SYSTEM_INTERNAL_ERROR'), expectedCategory: 'system' },
      ];

      for (const testCase of testCases) {
        const category = (errorTrackingService as any).categorizeError(testCase.error);
        expect(category).toBe(testCase.expectedCategory);
      }
    });

    it('should calculate severity scores correctly', async () => {
      const testCases = [
        { statusCode: 400, expectedSeverity: 'low' },
        { statusCode: 401, expectedSeverity: 'medium' },
        { statusCode: 403, expectedSeverity: 'medium' },
        { statusCode: 404, expectedSeverity: 'low' },
        { statusCode: 429, expectedSeverity: 'medium' },
        { statusCode: 500, expectedSeverity: 'high' },
        { statusCode: 503, expectedSeverity: 'critical' },
      ];

      for (const testCase of testCases) {
        const error = new ApiError('TEST_ERROR', 'Test error');
        (error as any).statusCode = testCase.statusCode;
        
        const severity = (errorTrackingService as any).calculateSeverity(error);
        expect(severity).toBe(testCase.expectedSeverity);
      }
    });
  });

  describe('Pattern Detection', () => {
    it('should detect and update error patterns', async () => {
      const testError = new ApiError('VALIDATION_ERROR', 'Test error');
      const context = { endpoint: '/api/test', method: 'POST' };

      // Mock existing pattern
      const existingPattern = {
        fingerprint: 'test-fingerprint',
        count: 5,
        firstSeen: new Date('2025-01-01'),
        lastSeen: new Date('2025-01-01'),
        affectedUsers: ['user1'],
        endpoints: ['/api/test'],
        trend: 'stable',
        anomalyScore: 0.1,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingPattern));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);

      const errorId = await errorTrackingService.trackError(testError, context);

      expect(errorId).toBeDefined();
      
      // Verify pattern was updated
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('pattern:'),
        expect.any(Number),
        expect.stringContaining('"count":6') // Should increment count
      );
    });

    it('should detect anomalies in error patterns', async () => {
      const historicalData = Array.from({ length: 20 }, (_, i) => ({
        value: 10 + Math.random() * 2, // Normal range: 10-12
        timestamp: new Date(Date.now() - (20 - i) * 60000),
      }));

      // Add an anomalous value
      const anomalyValue = 50; // Much higher than normal

      const isAnomaly = (errorTrackingService as any).detectAnomaly(anomalyValue, historicalData);
      expect(isAnomaly).toBe(true);

      // Test normal value
      const normalValue = 11;
      const isNormal = (errorTrackingService as any).detectAnomaly(normalValue, historicalData);
      expect(isNormal).toBe(false);
    });

    it('should calculate trend direction correctly', async () => {
      const testCases = [
        { recent: 20, historical: 10, expected: 'increasing' },
        { recent: 5, historical: 15, expected: 'decreasing' },
        { recent: 10, historical: 9, expected: 'stable' },
      ];

      for (const testCase of testCases) {
        const trend = (errorTrackingService as any).calculateTrend(
          testCase.recent,
          testCase.historical
        );
        expect(trend).toBe(testCase.expected);
      }
    });
  });

  describe('Alerting System', () => {
    it('should create alerts for threshold violations', async () => {
      const pattern = {
        fingerprint: 'test-fingerprint',
        count: 100, // High count
        category: 'system',
        trend: 'increasing',
        anomalyScore: 0.8,
      };

      mockRedis.setex.mockResolvedValue('OK');

      const _alertCreated = await (errorTrackingService as any).checkAlertConditions(pattern);

      // Should create alert for high error count
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('alert:'),
        expect.any(Number),
        expect.stringContaining('"severity":"critical"')
      );
    });

    it('should not create duplicate alerts for the same pattern', async () => {
      const pattern = {
        fingerprint: 'test-fingerprint',
        count: 100,
        category: 'system',
      };

      // Mock existing alert
      const existingAlert = {
        id: 'existing-alert',
        fingerprint: 'test-fingerprint',
        type: 'threshold',
        acknowledged: false,
        resolved: false,
      };

      mockRedis.scan.mockResolvedValue(['0', [`alert:test-fingerprint:${existingAlert.id}`]]);
      mockRedis.get.mockResolvedValue(JSON.stringify(existingAlert));

      const _alertCreated = await (errorTrackingService as any).checkAlertConditions(pattern);

      // Should not create duplicate alert
      expect(mockRedis.setex).not.toHaveBeenCalledWith(
        expect.stringContaining('alert:'),
        expect.any(Number),
        expect.stringContaining('"type":"threshold"')
      );
    });

    it('should handle alert acknowledgment', async () => {
      const alertId = 'test-alert-id';
      const userId = 'test-user-id';
      const notes = 'Alert acknowledged by user';

      // Mock existing alert
      const existingAlert = {
        id: alertId,
        fingerprint: 'test-fingerprint',
        acknowledged: false,
        resolved: false,
      };

      mockRedis.scan.mockResolvedValue(['0', [`alert:test-fingerprint:${alertId}`]]);
      mockRedis.get.mockResolvedValue(JSON.stringify(existingAlert));
      mockRedis.setex.mockResolvedValue('OK');

      const result = await errorTrackingService.acknowledgeAlert(alertId, userId, notes);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining(`alert:test-fingerprint:${alertId}`),
        expect.any(Number),
        expect.stringContaining('"acknowledged":true')
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Alert acknowledged',
        expect.objectContaining({
          alertId,
          userId,
          notes,
        })
      );
    });
  });

  describe('Analytics and Insights', () => {
    it('should generate error summary with correct statistics', async () => {
      // Mock database response for error summary
      mockPool.query
        .mockResolvedValueOnce({ 
          rows: [{ total_errors: 150 }] 
        })
        .mockResolvedValueOnce({ 
          rows: [
            { severity: 'low', count: 50 },
            { severity: 'medium', count: 60 },
            { severity: 'high', count: 30 },
            { severity: 'critical', count: 10 },
          ] 
        })
        .mockResolvedValueOnce({ 
          rows: [
            { category: 'validation', count: 80 },
            { category: 'authentication', count: 40 },
            { category: 'system', count: 30 },
          ] 
        })
        .mockResolvedValueOnce({ rows: [{ affected_users: 25 }] })
        .mockResolvedValueOnce({ rows: [{ top_patterns: [] }] });

      const summary = await errorTrackingService.getErrorSummary(60); // 1 hour

      expect(summary).toEqual(
        expect.objectContaining({
          totalErrors: 150,
          bySeverity: expect.objectContaining({
            low: 50,
            medium: 60,
            high: 30,
            critical: 10,
          }),
          byCategory: expect.objectContaining({
            validation: 80,
            authentication: 40,
            system: 30,
          }),
          affectedUsers: 25,
          timeRange: 60,
        })
      );
    });

    it('should generate insights for correlated errors', async () => {
      const patterns = [
        {
          fingerprint: 'pattern1',
          category: 'authentication',
          count: 50,
          endpoints: ['/api/login', '/api/refresh'],
        },
        {
          fingerprint: 'pattern2',
          category: 'authentication',
          count: 30,
          endpoints: ['/api/login'],
        },
      ];

      const insights = await (errorTrackingService as any).generateCorrelationInsights(patterns);

      expect(insights).toHaveLength(1);
      expect(insights[0]).toEqual(
        expect.objectContaining({
          type: 'correlation',
          confidence: expect.any(Number),
          description: expect.stringContaining('authentication'),
          relatedPatterns: ['pattern1', 'pattern2'],
        })
      );
    });

    it('should calculate impact scores correctly', async () => {
      const pattern = {
        count: 100,
        affectedUsers: 50,
        category: 'system',
        avgResponseTime: 5000, // 5 seconds
      };

      const impactScore = (errorTrackingService as any).calculateImpactScore(pattern);

      expect(impactScore).toBeGreaterThan(0);
      expect(impactScore).toBeLessThanOrEqual(100);
      
      // System errors should have higher impact
      expect(impactScore).toBeGreaterThan(50);
    });
  });

  describe('Dashboard Data', () => {
    it('should return comprehensive dashboard data', async () => {
      // Mock various data sources
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_errors: 200 }] })
        .mockResolvedValueOnce({ rows: [{ active_alerts: 5 }] })
        .mockResolvedValueOnce({ rows: [{ resolved_patterns: 15 }] })
        .mockResolvedValueOnce({ rows: [] }); // Top patterns

      mockRedis.scan.mockResolvedValue(['0', []]);

      const dashboardData = await errorTrackingService.getDashboardData(60);

      expect(dashboardData).toEqual(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalErrors: 200,
            activeAlerts: 5,
            resolvedPatterns: 15,
          }),
          topPatterns: expect.any(Array),
          recentAlerts: expect.any(Array),
          trends: expect.any(Object),
        })
      );
    });
  });

  describe('Health Checks', () => {
    it('should report healthy status when all systems are working', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      mockPool.query.mockResolvedValue({ rows: [{ count: 10 }] });

      const health = await (errorTrackingService as any).checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.status).toBe('All systems operational');
    });

    it('should report unhealthy status when Redis fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      const health = await (errorTrackingService as any).checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.status).toContain('Redis connection failed');
    });

    it('should report unhealthy status when database fails', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const health = await (errorTrackingService as any).checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.status).toContain('Database connection failed');
    });
  });

  describe('Event Emission', () => {
    it('should emit events for tracked errors', async () => {
      const testError = new ApiError('TEST_ERROR', 'Test error');
      const context = { endpoint: '/api/test', method: 'POST' };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);

      const eventPromise = new Promise((resolve) => {
        errorTrackingService.on('errorTracked', resolve);
      });

      await errorTrackingService.trackError(testError, context);

      const eventData = await eventPromise;
      expect(eventData).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          fingerprint: expect.any(String),
          severity: expect.any(String),
        })
      );
    });

    it('should emit events for pattern detection', async () => {
      const pattern = {
        fingerprint: 'test-fingerprint',
        count: 10,
        firstSeen: new Date(),
        lastSeen: new Date(),
        trend: 'increasing',
      };

      const eventPromise = new Promise((resolve) => {
        errorTrackingService.on('patternDetected', resolve);
      });

      errorTrackingService.emit('patternDetected', pattern);

      const eventData = await eventPromise;
      expect(eventData).toEqual(pattern);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration when provided', () => {
      const customConfig = {
        retention: {
          errorLogs: 7 * 24 * 60, // 7 days
          patterns: 30 * 24 * 60, // 30 days
          alerts: 14 * 24 * 60, // 14 days
        },
        thresholds: {
          errorCountCritical: 200,
          errorCountWarning: 50,
          anomalyThreshold: 3.0,
        },
      };

      const serviceWithConfig = new ErrorTrackingService(mockRedis, customConfig);

      expect((serviceWithConfig as any).config.retention.errorLogs).toBe(7 * 24 * 60);
      expect((serviceWithConfig as any).config.thresholds.errorCountCritical).toBe(200);
    });

    it('should use default configuration when none provided', () => {
      const defaultService = new ErrorTrackingService(mockRedis);

      expect((defaultService as any).config.retention.errorLogs).toBeDefined();
      expect((defaultService as any).config.thresholds.errorCountCritical).toBeDefined();
    });
  });
});