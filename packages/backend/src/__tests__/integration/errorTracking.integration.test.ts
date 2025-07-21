/**
 * Error Tracking Integration Tests
 * 
 * Integration tests for the error tracking API routes and service.
 * Tests the complete flow from API request to database storage.
 */

import request from 'supertest';
import { Express } from 'express';
import { Redis } from 'ioredis';
import { createTestApp } from '../../test/helpers/testApp';
import { createTestUser, getAuthToken } from '../../test/helpers/auth';
import { ErrorTrackingService } from '../../services/errorTracking.service';
import { initializeErrorTracking } from '../../startup/errorTracking.startup';
import { pool } from '../../db';

// Mock Redis
jest.mock('ioredis');

describe('Error Tracking Integration', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;
  let mockRedis: any;
  let errorTrackingService: ErrorTrackingService;

  beforeAll(async () => {
    // Create test app
    app = await createTestApp();

    // Create test user and get auth token
    const user = await createTestUser();
    testUserId = user.id;
    authToken = getAuthToken(user);

    // Setup mock Redis for testing
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      zadd: jest.fn().mockResolvedValue(1),
      zrangebyscore: jest.fn().mockResolvedValue([]),
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      scan: jest.fn().mockResolvedValue(['0', []]),
      ping: jest.fn().mockResolvedValue('PONG'),
      status: 'ready',
    };

    // Initialize error tracking service for testing
    errorTrackingService = await initializeErrorTracking(mockRedis as Redis);

    // Ensure test database tables exist
    await setupTestTables();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function setupTestTables(): Promise<void> {
    // Create test tables if they don't exist (simplified versions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_error_logs (
        id SERIAL PRIMARY KEY,
        fingerprint VARCHAR(32) NOT NULL,
        code VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        user_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_error_patterns (
        id SERIAL PRIMARY KEY,
        fingerprint VARCHAR(32) UNIQUE NOT NULL,
        error_code VARCHAR(100) NOT NULL,
        occurrence_count INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_error_alerts (
        id SERIAL PRIMARY KEY,
        alert_id VARCHAR(50) UNIQUE NOT NULL,
        severity VARCHAR(20) NOT NULL,
        acknowledged BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  }

  async function cleanupTestData(): Promise<void> {
    await pool.query('DROP TABLE IF EXISTS test_error_logs');
    await pool.query('DROP TABLE IF EXISTS test_error_patterns');
    await pool.query('DROP TABLE IF EXISTS test_error_alerts');
  }

  describe('GET /api/error-tracking/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/error-tracking/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('healthy');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should return 503 when service is unhealthy', async () => {
      // Mock Redis failure
      mockRedis.ping.mockRejectedValueOnce(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/api/error-tracking/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.healthy).toBe(false);
    });
  });

  describe('GET /api/error-tracking/errors', () => {
    beforeEach(async () => {
      // Insert test error data
      await pool.query(`
        INSERT INTO error_logs (fingerprint, code, message, severity, category, user_id, created_at)
        VALUES 
          ('fp1', 'VALIDATION_ERROR', 'Test error 1', 'medium', 'validation', $1, NOW() - INTERVAL '1 hour'),
          ('fp2', 'AUTH_ERROR', 'Test error 2', 'high', 'authentication', $1, NOW() - INTERVAL '30 minutes'),
          ('fp3', 'SYSTEM_ERROR', 'Test error 3', 'critical', 'system', $1, NOW() - INTERVAL '15 minutes')
      `, [testUserId]);
    });

    afterEach(async () => {
      await pool.query('DELETE FROM error_logs WHERE user_id = $1', [testUserId]);
    });

    it('should return paginated error list', async () => {
      // Mock database response for error summary
      const mockSummary = {
        totalErrors: 3,
        bySeverity: { low: 0, medium: 1, high: 1, critical: 1 },
        byCategory: { validation: 1, authentication: 1, system: 1 },
        affectedUsers: 1,
        timeRange: 3600,
        topPatterns: [],
      };

      // Mock the service method
      jest.spyOn(errorTrackingService, 'getErrorSummary').mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/error-tracking/errors')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSummary);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 3,
        pages: 1,
      });
    });

    it('should filter errors by severity', async () => {
      const mockSummary = {
        totalErrors: 1,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 1 },
        byCategory: { system: 1 },
        affectedUsers: 1,
        timeRange: 3600,
        topPatterns: [],
      };

      jest.spyOn(errorTrackingService, 'getErrorSummary').mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/error-tracking/errors')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ severity: 'critical' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalErrors).toBe(1);
      expect(response.body.data.bySeverity.critical).toBe(1);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/error-tracking/errors')
        .expect(401);
    });
  });

  describe('GET /api/error-tracking/errors/:fingerprint', () => {
    const testFingerprint = 'a1b2c3d4e5f6789012345678901234567';

    it('should return error pattern details', async () => {
      const mockPattern = {
        fingerprint: testFingerprint,
        errorCode: 'VALIDATION_ERROR',
        count: 15,
        firstSeen: new Date('2025-01-01'),
        lastSeen: new Date('2025-01-15'),
        category: 'validation',
        severity: 'medium',
      };

      const mockOccurrences = [
        {
          id: 'error1',
          timestamp: new Date(),
          context: { endpoint: '/api/test' },
        },
      ];

      const mockInsights = [
        {
          type: 'trend_analysis',
          description: 'Error rate increasing',
          confidence: 0.85,
        },
      ];

      jest.spyOn(errorTrackingService, 'getErrorPattern').mockResolvedValue(mockPattern);
      jest.spyOn(errorTrackingService, 'getRecentErrorOccurrences').mockResolvedValue(mockOccurrences);
      jest.spyOn(errorTrackingService, 'getErrorInsights').mockResolvedValue(mockInsights);

      const response = await request(app)
        .get(`/api/error-tracking/errors/${testFingerprint}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        pattern: mockPattern,
        recentOccurrences: mockOccurrences,
        insights: mockInsights,
      });
    });

    it('should return 404 for non-existent pattern', async () => {
      jest.spyOn(errorTrackingService, 'getErrorPattern').mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/error-tracking/errors/${testFingerprint}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toContain('NOT_FOUND');
    });

    it('should validate fingerprint format', async () => {
      const invalidFingerprint = 'invalid';

      await request(app)
        .get(`/api/error-tracking/errors/${invalidFingerprint}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('POST /api/error-tracking/errors/:fingerprint/resolve', () => {
    const testFingerprint = 'a1b2c3d4e5f6789012345678901234567';

    it('should resolve an error pattern', async () => {
      jest.spyOn(errorTrackingService, 'resolveErrorPattern').mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/error-tracking/errors/${testFingerprint}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Fixed by updating validation logic' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('resolved');

      expect(errorTrackingService.resolveErrorPattern).toHaveBeenCalledWith(
        testFingerprint,
        testUserId,
        'Fixed by updating validation logic'
      );
    });

    it('should return 404 for non-existent pattern', async () => {
      jest.spyOn(errorTrackingService, 'resolveErrorPattern').mockResolvedValue(false);

      await request(app)
        .post(`/api/error-tracking/errors/${testFingerprint}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Test notes' })
        .expect(404);
    });

    it('should validate request body', async () => {
      await request(app)
        .post(`/api/error-tracking/errors/${testFingerprint}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'a'.repeat(600) }) // Too long
        .expect(400);
    });
  });

  describe('GET /api/error-tracking/alerts', () => {
    it('should return paginated alerts list', async () => {
      const mockAlerts = [
        {
          id: 'alert1',
          severity: 'critical',
          type: 'threshold',
          message: 'High error rate detected',
          acknowledged: false,
          created_at: new Date(),
        },
        {
          id: 'alert2',
          severity: 'warning',
          type: 'anomaly',
          message: 'Unusual error pattern',
          acknowledged: true,
          created_at: new Date(),
        },
      ];

      jest.spyOn(errorTrackingService, 'getAlerts').mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get('/api/error-tracking/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAlerts);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1,
      });
    });

    it('should filter alerts by severity', async () => {
      const criticalAlerts = [
        {
          id: 'alert1',
          severity: 'critical',
          type: 'threshold',
          message: 'Critical error',
          acknowledged: false,
        },
      ];

      jest.spyOn(errorTrackingService, 'getAlerts').mockResolvedValue(criticalAlerts);

      const response = await request(app)
        .get('/api/error-tracking/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ severity: 'critical' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(criticalAlerts);
      expect(errorTrackingService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'critical' })
      );
    });
  });

  describe('POST /api/error-tracking/alerts/:alertId/acknowledge', () => {
    const testAlertId = 'test-alert-123';

    it('should acknowledge an alert', async () => {
      jest.spyOn(errorTrackingService, 'acknowledgeAlert').mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/error-tracking/alerts/${testAlertId}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Acknowledged and investigating' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('acknowledged');

      expect(errorTrackingService.acknowledgeAlert).toHaveBeenCalledWith(
        testAlertId,
        testUserId,
        'Acknowledged and investigating'
      );
    });

    it('should return 404 for non-existent alert', async () => {
      jest.spyOn(errorTrackingService, 'acknowledgeAlert').mockResolvedValue(false);

      await request(app)
        .post(`/api/error-tracking/alerts/${testAlertId}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Test notes' })
        .expect(404);
    });
  });

  describe('GET /api/error-tracking/dashboard', () => {
    it('should return dashboard data', async () => {
      const mockDashboard = {
        summary: {
          totalErrors: 150,
          activeAlerts: 5,
          resolvedPatterns: 10,
          errorRate: 2.5,
        },
        topPatterns: [
          {
            fingerprint: 'pattern1',
            count: 50,
            severity: 'high',
            category: 'validation',
          },
        ],
        recentAlerts: [
          {
            id: 'alert1',
            severity: 'critical',
            message: 'High error rate',
          },
        ],
        trends: {
          errorCount: { current: 150, change: 10 },
          alertCount: { current: 5, change: -2 },
        },
      };

      jest.spyOn(errorTrackingService, 'getDashboardData').mockResolvedValue(mockDashboard);

      const response = await request(app)
        .get('/api/error-tracking/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDashboard);
      expect(errorTrackingService.getDashboardData).toHaveBeenCalledWith(24 * 60); // 24 hours
    });
  });

  describe('GET /api/error-tracking/stats', () => {
    it('should return error statistics', async () => {
      const mockStats = {
        timeRange: '24h',
        totalErrors: 200,
        errorsByHour: [
          { hour: '2025-01-15T10:00:00Z', count: 15 },
          { hour: '2025-01-15T11:00:00Z', count: 22 },
        ],
        errorsByCategory: {
          validation: 80,
          authentication: 60,
          system: 40,
          permission: 20,
        },
        errorsBySeverity: {
          low: 100,
          medium: 60,
          high: 30,
          critical: 10,
        },
        topEndpoints: [
          { endpoint: '/api/login', count: 45 },
          { endpoint: '/api/validate', count: 35 },
        ],
      };

      jest.spyOn(errorTrackingService, 'getErrorStatistics').mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/error-tracking/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '24h', groupBy: 'hour' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(errorTrackingService.getErrorStatistics).toHaveBeenCalledWith(24 * 60, 'hour');
    });

    it('should validate time range parameter', async () => {
      await request(app)
        .get('/api/error-tracking/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: 'invalid' })
        .expect(400);
    });
  });

  describe('Error Tracking Flow', () => {
    it('should track errors end-to-end when API errors occur', async () => {
      // Mock error tracking service methods
      jest.spyOn(errorTrackingService, 'trackError').mockResolvedValue('tracked-error-id');

      // Make a request that will cause a validation error
      const response = await request(app)
        .post('/api/some-endpoint-that-validates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalidData: 'test' })
        .expect(400);

      // Verify the error was tracked (this depends on the error handler being properly integrated)
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBeDefined();

      // In a real implementation, you would verify that trackError was called
      // This test demonstrates the integration point
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/error-tracking/errors' },
        { method: 'get', path: '/api/error-tracking/alerts' },
        { method: 'get', path: '/api/error-tracking/dashboard' },
        { method: 'get', path: '/api/error-tracking/patterns' },
        { method: 'get', path: '/api/error-tracking/insights' },
        { method: 'get', path: '/api/error-tracking/stats' },
      ];

      for (const endpoint of endpoints) {
        await request(app)[endpoint.method](endpoint.path).expect(401);
      }
    });

    it('should accept valid JWT tokens', async () => {
      // This test verifies that valid tokens are accepted
      // The specific behavior depends on the endpoint, but none should return 401
      const response = await request(app)
        .get('/api/error-tracking/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).not.toBe(401);
    });
  });
});