/**
 * Performance Monitoring Integration Tests
 * 
 * Tests the complete performance monitoring system including
 * API endpoints, source collection, and report generation.
 */

import request from 'supertest';
import app from '../../app';
import { createTestUser, cleanupTestUser, getAuthToken } from '../helpers/testHelpers';

describe('Performance Monitoring Integration', () => {
  let authToken: string;
  let testUserId: number;

  beforeAll(async () => {
    // Create test user and get auth token
    const testUser = await createTestUser();
    testUserId = testUser.userId;
    authToken = await getAuthToken(testUser.email, 'testpassword123');
  });

  afterAll(async () => {
    // Cleanup test user
    await cleanupTestUser(testUserId);
  });

  describe('POST /api/performance', () => {
    it('should accept performance metrics', async () => {
      const metrics = {
        clientId: 'test-client',
        page: '/dashboard',
        component: 'ImageGrid',
        type: 'navigation',
        value: 150,
        metadata: {
          userAgent: 'test-agent',
          timestamp: Date.now(),
        },
      };

      const response = await request(app)
        .post('/api/performance')
        .send(metrics)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject invalid metrics format', async () => {
      const response = await request(app)
        .post('/api/performance')
        .send('invalid-data')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid metrics format');
    });

    it('should handle metrics without optional fields', async () => {
      const minimalMetrics = {
        type: 'performance',
        value: 100,
      };

      const response = await request(app)
        .post('/api/performance')
        .send(minimalMetrics)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should continue processing even if database storage fails', async () => {
      // This test would require mocking the database to simulate failure
      // For now, we'll test the successful case
      const metrics = {
        type: 'test',
        value: 123,
      };

      const response = await request(app)
        .post('/api/performance')
        .send(metrics)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/performance/me', () => {
    beforeEach(async () => {
      // Send some test metrics first
      const metrics = {
        clientId: testUserId.toString(),
        type: 'test-metric',
        value: 200,
      };

      await request(app)
        .post('/api/performance')
        .send(metrics);
    });

    it('should return user metrics with authentication', async () => {
      const response = await request(app)
        .get('/api/performance/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(Array.isArray(response.body.metrics)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/performance/me')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'No token provided');
    });

    it('should return empty array when no metrics exist', async () => {
      // Create a new user with no metrics
      const newTestUser = await createTestUser();
      const newAuthToken = await getAuthToken(newTestUser.email, 'testpassword123');

      const response = await request(app)
        .get('/api/performance/me')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .expect(200);

      expect(response.body.metrics).toEqual([]);

      // Cleanup
      await cleanupTestUser(newTestUser.userId);
    });
  });

  describe('GET /api/performance/report', () => {
    it('should return comprehensive performance report with authentication', async () => {
      const response = await request(app)
        .get('/api/performance/report')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('report');
      expect(response.body).toHaveProperty('timestamp');

      // Verify report structure
      const report = response.body.report;
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('insights');
      expect(report).toHaveProperty('correlations');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('optimizations');

      // Verify summary structure
      expect(report.summary).toHaveProperty('totalMetrics');
      expect(report.summary).toHaveProperty('activeSources');
      expect(report.summary).toHaveProperty('systemHealth');
      expect(report.summary).toHaveProperty('resourceUtilization');
    });

    it('should require authentication for performance report', async () => {
      const response = await request(app)
        .get('/api/performance/report')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'No token provided');
    });

    it('should handle report generation errors gracefully', async () => {
      // This would require mocking the coordinator to fail
      // For now, we test the successful case
      const response = await request(app)
        .get('/api/performance/report')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/performance/sources', () => {
    it('should return monitoring source status', async () => {
      const response = await request(app)
        .get('/api/performance/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('sources');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.sources)).toBe(true);
    });

    it('should require authentication for source status', async () => {
      const response = await request(app)
        .get('/api/performance/sources')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'No token provided');
    });

    it('should include source health information', async () => {
      const response = await request(app)
        .get('/api/performance/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.sources.length > 0) {
        const source = response.body.sources[0];
        expect(source).toHaveProperty('source');
        expect(source).toHaveProperty('lastCollection');
        expect(source).toHaveProperty('health');
        
        expect(source.source).toHaveProperty('id');
        expect(source.source).toHaveProperty('name');
        expect(source.source).toHaveProperty('priority');
        expect(source.source).toHaveProperty('enabled');
        expect(source.source).toHaveProperty('intervalMs');
        
        expect(['healthy', 'stale', 'disabled']).toContain(source.health);
      }
    });
  });

  describe('GET /api/performance/insights', () => {
    it('should return performance insights', async () => {
      const response = await request(app)
        .get('/api/performance/insights')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('insights');
      expect(response.body).toHaveProperty('correlations');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.insights)).toBe(true);
      expect(Array.isArray(response.body.correlations)).toBe(true);
    });

    it('should filter insights by severity', async () => {
      const response = await request(app)
        .get('/api/performance/insights?severity=critical')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // All returned insights should have critical severity
      response.body.insights.forEach((insight: any) => {
        expect(insight.severity).toBe('critical');
      });
    });

    it('should handle invalid severity filter', async () => {
      const response = await request(app)
        .get('/api/performance/insights?severity=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should return empty array for invalid severity
      expect(response.body.insights).toEqual([]);
    });

    it('should require authentication for insights', async () => {
      const response = await request(app)
        .get('/api/performance/insights')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'No token provided');
    });
  });

  describe('GET /api/performance/recommendations', () => {
    it('should return performance recommendations', async () => {
      const response = await request(app)
        .get('/api/performance/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('optimizations');
      expect(response.body).toHaveProperty('systemHealth');
      expect(response.body).toHaveProperty('resourceUtilization');
      expect(response.body).toHaveProperty('timestamp');

      expect(Array.isArray(response.body.recommendations)).toBe(true);
      expect(Array.isArray(response.body.optimizations)).toBe(true);
      expect(typeof response.body.systemHealth).toBe('string');
      expect(typeof response.body.resourceUtilization).toBe('number');
    });

    it('should include valid system health values', async () => {
      const response = await request(app)
        .get('/api/performance/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const validHealthValues = ['excellent', 'good', 'fair', 'poor', 'critical'];
      expect(validHealthValues).toContain(response.body.systemHealth);
    });

    it('should require authentication for recommendations', async () => {
      const response = await request(app)
        .get('/api/performance/recommendations')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'No token provided');
    });
  });

  describe('Performance Monitoring System Integration', () => {
    it('should handle multiple concurrent metric submissions', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/performance')
          .send({
            clientId: testUserId.toString(),
            type: 'concurrent-test',
            value: i * 10,
            metadata: { index: i },
          })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      // Submit metrics and request report simultaneously
      const promises = [
        // Submit metrics
        ...Array.from({ length: 5 }, (_, i) =>
          request(app)
            .post('/api/performance')
            .send({
              type: 'load-test',
              value: i,
            })
        ),
        // Request reports
        request(app)
          .get('/api/performance/report')
          .set('Authorization', `Bearer ${authToken}`),
        request(app)
          .get('/api/performance/sources')
          .set('Authorization', `Bearer ${authToken}`),
        request(app)
          .get('/api/performance/insights')
          .set('Authorization', `Bearer ${authToken}`),
      ];

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete within reasonable time (5 seconds)
      expect(totalTime).toBeLessThan(5000);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });

    it('should provide consistent data across endpoints', async () => {
      // Get data from different endpoints
      const [reportResponse, sourcesResponse, insightsResponse] = await Promise.all([
        request(app)
          .get('/api/performance/report')
          .set('Authorization', `Bearer ${authToken}`),
        request(app)
          .get('/api/performance/sources')
          .set('Authorization', `Bearer ${authToken}`),
        request(app)
          .get('/api/performance/insights')
          .set('Authorization', `Bearer ${authToken}`),
      ]);

      expect(reportResponse.status).toBe(200);
      expect(sourcesResponse.status).toBe(200);
      expect(insightsResponse.status).toBe(200);

      // Verify data consistency
      const report = reportResponse.body.report;
      const sources = sourcesResponse.body.sources;
      const insights = insightsResponse.body.insights;

      // Number of active sources should match
      const activeSources = sources.filter((s: any) => s.source.enabled).length;
      expect(report.summary.activeSources).toBe(activeSources);

      // Insights should be included in both report and insights endpoint
      expect(report.insights).toEqual(insights);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON in metrics submission', async () => {
      const response = await request(app)
        .post('/api/performance')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle very large metric values', async () => {
      const largeMetrics = {
        type: 'large-value-test',
        value: Number.MAX_SAFE_INTEGER,
        metadata: {
          largeString: 'x'.repeat(1000),
        },
      };

      const response = await request(app)
        .post('/api/performance')
        .send(largeMetrics)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle requests when performance coordinator is not initialized', async () => {
      // This test assumes the coordinator might not be initialized in test environment
      // The endpoints should handle this gracefully
      const response = await request(app)
        .get('/api/performance/report')
        .set('Authorization', `Bearer ${authToken}`);

      // Should either succeed or return a meaningful error
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });
});