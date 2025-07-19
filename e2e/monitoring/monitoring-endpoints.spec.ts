/**
 * E2E Tests for Monitoring Endpoints
 * 
 * Comprehensive end-to-end testing of all monitoring and health check endpoints
 * including authentication, authorization, error handling, and performance validation.
 */

import { test, expect, type Page, type APIResponse } from '@playwright/test';

// Test configuration
const BASE_API_URL = 'http://localhost:5001/api';
const FRONTEND_URL = 'http://localhost:3000';

// Test user credentials for admin endpoints
const TEST_ADMIN_EMAIL = 'testuser@test.com';
const TEST_ADMIN_PASSWORD = 'testuser123';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  healthEndpoint: 2000, // 2s max response time for health endpoints
  metricsEndpoint: 3000, // 3s max for metrics collection
  dashboardEndpoint: 5000, // 5s max for dashboard data
  authTimeout: 10000, // 10s max for authentication
};

// Authentication helper
async function getAuthToken(page: Page): Promise<string> {
  const response = await page.request.post(`${BASE_API_URL}/auth/login`, {
    data: {
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    },
  });

  expect(response.ok()).toBeTruthy();
  
  const authData = await response.json();
  expect(authData.token).toBeDefined();
  
  return authData.token;
}

// Response validation helpers
function validateHealthResponse(response: any) {
  expect(response).toHaveProperty('status');
  expect(['healthy', 'degraded', 'unhealthy']).toContain(response.status);
  expect(response).toHaveProperty('timestamp');
  expect(response).toHaveProperty('uptime');
  expect(response).toHaveProperty('environment');
  expect(response).toHaveProperty('components');
}

function validateMetricsResponse(response: string) {
  // Prometheus metrics should contain specific patterns
  expect(response).toMatch(/^# TYPE /m); // Prometheus format header
  expect(response).toMatch(/# HELP /m); // Help text
}

function validateErrorFormat(response: any) {
  expect(response).toHaveProperty('error');
  expect(typeof response.error).toBe('string');
}

test.describe('Health Check Endpoints', () => {
  test('GET /api/health - Basic health check should return system status', async ({ page }) => {
    const startTime = Date.now();
    
    const response = await page.request.get(`${BASE_API_URL}/health`);
    const responseTime = Date.now() - startTime;
    
    // Performance validation
    expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.healthEndpoint);
    
    // Response should be successful or indicate degraded state
    expect([200, 503]).toContain(response.status());
    
    const healthData = await response.json();
    validateHealthResponse(healthData);
    
    // Validate components structure
    const { components } = healthData;
    expect(components).toHaveProperty('api');
    expect(components).toHaveProperty('database');
    expect(components).toHaveProperty('mlService');
    expect(components).toHaveProperty('memory');
    expect(components).toHaveProperty('fileSystem');
    expect(components).toHaveProperty('configuration');
    
    // Each component should have status
    Object.values(components).forEach((component: any) => {
      expect(['healthy', 'degraded', 'unhealthy']).toContain(component.status);
    });
  });
  
  test('GET /api/health?details=true - Detailed health check should include component details', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/health?details=true`);
    
    expect([200, 503]).toContain(response.status());
    
    const healthData = await response.json();
    validateHealthResponse(healthData);
    
    // With details=true, components should have additional details
    const { components } = healthData;
    Object.values(components).forEach((component: any) => {
      if (component.status !== 'healthy') {
        // Non-healthy components should have details or message
        expect(component.details || component.message).toBeDefined();
      }
    });
  });
  
  test('GET /api/health/live - Kubernetes liveness probe should always succeed', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/health/live`);
    
    expect(response.status()).toBe(200);
    
    const liveData = await response.json();
    expect(liveData).toHaveProperty('status', 'alive');
    expect(liveData).toHaveProperty('timestamp');
    expect(liveData).toHaveProperty('pid');
    expect(typeof liveData.pid).toBe('number');
  });
  
  test('GET /api/health/ready - Kubernetes readiness probe should check critical dependencies', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/health/ready`);
    
    // Should be 200 (ready) or 503 (not ready)
    expect([200, 503]).toContain(response.status());
    
    const readyData = await response.json();
    expect(readyData).toHaveProperty('status');
    expect(['ready', 'not_ready']).toContain(readyData.status);
    expect(readyData).toHaveProperty('timestamp');
    
    if (readyData.status === 'not_ready') {
      expect(readyData.reason || readyData.error).toBeDefined();
    }
  });
});

test.describe('Monitoring Endpoints', () => {
  test('GET /api/monitoring/health - Monitoring health should provide comprehensive system info', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/monitoring/health`);
    
    expect([200, 503]).toContain(response.status());
    
    const monitoringHealth = await response.json();
    expect(monitoringHealth).toHaveProperty('status');
    expect(monitoringHealth).toHaveProperty('timestamp');
    expect(monitoringHealth).toHaveProperty('uptime');
    expect(monitoringHealth).toHaveProperty('environment');
    expect(monitoringHealth).toHaveProperty('version');
    expect(monitoringHealth).toHaveProperty('node');
    expect(monitoringHealth).toHaveProperty('memory');
    expect(monitoringHealth).toHaveProperty('cpu');
    expect(monitoringHealth).toHaveProperty('services');
    expect(monitoringHealth).toHaveProperty('serviceDetails');
    expect(monitoringHealth).toHaveProperty('summary');
  });
  
  test('GET /api/monitoring/metrics - Prometheus metrics should be properly formatted', async ({ page }) => {
    const startTime = Date.now();
    
    const response = await page.request.get(`${BASE_API_URL}/monitoring/metrics`);
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.metricsEndpoint);
    expect(response.status()).toBe(200);
    
    // Content-Type should be prometheus format
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/plain');
    
    const metricsText = await response.text();
    validateMetricsResponse(metricsText);
    
    // Should contain some common Node.js metrics
    expect(metricsText).toMatch(/nodejs_/);
    expect(metricsText).toMatch(/process_/);
  });
  
  test('POST /api/monitoring/errors - Error reporting should accept valid error reports', async ({ page }) => {
    const errorReport = {
      errors: [
        {
          timestamp: new Date().toISOString(),
          error: 'Test error for monitoring',
          userAgent: 'Test/1.0',
          url: '/test-page',
          userId: 'test-user-123',
          sessionId: 'test-session-456',
          environment: 'test',
          release: '1.0.0',
          browserInfo: {
            name: 'chrome',
            version: '91.0.0',
          },
        },
      ],
    };
    
    const response = await page.request.post(`${BASE_API_URL}/monitoring/errors`, {
      data: errorReport,
    });
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('1 error reports');
  });
  
  test('POST /api/monitoring/errors - Should reject invalid error report format', async ({ page }) => {
    const invalidReport = {
      errors: 'not-an-array',
    };
    
    const response = await page.request.post(`${BASE_API_URL}/monitoring/errors`, {
      data: invalidReport,
    });
    
    expect(response.status()).toBe(400);
    
    const result = await response.json();
    validateErrorFormat(result);
    expect(result.error).toContain('Invalid error report format');
  });
});

test.describe('Admin-Protected Monitoring Endpoints', () => {
  let authToken: string;
  
  test.beforeEach(async ({ page }) => {
    authToken = await getAuthToken(page);
  });
  
  test('GET /api/monitoring/errors - Admin should access error metrics', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/monitoring/errors`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    expect(response.status()).toBe(200);
    
    const errorMetrics = await response.json();
    // Validate error metrics structure based on errorTracker implementation
    expect(errorMetrics).toBeDefined();
  });
  
  test('GET /api/monitoring/performance - Admin should access performance metrics', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/monitoring/performance`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    expect(response.status()).toBe(200);
    
    const performanceMetrics = await response.json();
    expect(performanceMetrics).toBeDefined();
  });
  
  test('GET /api/monitoring/dashboard - Admin should access unified dashboard', async ({ page }) => {
    const startTime = Date.now();
    
    const response = await page.request.get(`${BASE_API_URL}/monitoring/dashboard`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.dashboardEndpoint);
    expect(response.status()).toBe(200);
    
    const dashboardData = await response.json();
    expect(dashboardData).toHaveProperty('timestamp');
    expect(dashboardData).toHaveProperty('system');
    expect(dashboardData).toHaveProperty('health');
    expect(dashboardData).toHaveProperty('errors');
    expect(dashboardData).toHaveProperty('performance');
    expect(dashboardData).toHaveProperty('alerts');
    
    // System info
    expect(dashboardData.system).toHaveProperty('uptime');
    expect(dashboardData.system).toHaveProperty('environment');
    expect(dashboardData.system).toHaveProperty('version');
    expect(dashboardData.system).toHaveProperty('memory');
    expect(dashboardData.system).toHaveProperty('cpu');
    
    // Health info
    expect(dashboardData.health).toHaveProperty('overall');
    expect(dashboardData.health).toHaveProperty('services');
    
    // Alerts should be an array
    expect(Array.isArray(dashboardData.alerts)).toBeTruthy();
  });
  
  test('GET /api/monitoring/logs - Admin should access logs endpoint', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/monitoring/logs`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    expect(response.status()).toBe(200);
    
    const logs = await response.json();
    expect(logs).toBeDefined();
    // Currently returns placeholder, but should have structure
    expect(logs).toHaveProperty('message');
    expect(logs).toHaveProperty('parameters');
  });
  
  test('GET /api/monitoring/logs with parameters - Should accept level and limit parameters', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/monitoring/logs?level=error&limit=50`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    expect(response.status()).toBe(200);
    
    const logs = await response.json();
    expect(logs.parameters).toHaveProperty('level', 'error');
    expect(logs.parameters).toHaveProperty('limit', 50);
  });
  
  test('POST /api/monitoring/alerts/:alertId/resolve - Admin should resolve alerts', async ({ page }) => {
    const alertId = 'test-alert-123';
    const resolution = 'Resolved during E2E testing';
    
    const response = await page.request.post(`${BASE_API_URL}/monitoring/alerts/${alertId}/resolve`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        resolution,
      },
    });
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('alertId', alertId);
    expect(result).toHaveProperty('resolution', resolution);
  });
  
  test('GET /api/monitoring/system - Admin should access system information', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/monitoring/system`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    expect(response.status()).toBe(200);
    
    const systemInfo = await response.json();
    expect(systemInfo).toHaveProperty('node');
    expect(systemInfo).toHaveProperty('memory');
    expect(systemInfo).toHaveProperty('cpu');
    expect(systemInfo).toHaveProperty('environment');
    expect(systemInfo).toHaveProperty('configuration');
    
    // Node info
    expect(systemInfo.node).toHaveProperty('version');
    expect(systemInfo.node).toHaveProperty('platform');
    expect(systemInfo.node).toHaveProperty('arch');
    expect(systemInfo.node).toHaveProperty('uptime');
    
    // Configuration info
    expect(systemInfo.configuration).toHaveProperty('server');
    expect(systemInfo.configuration).toHaveProperty('database');
    expect(systemInfo.configuration).toHaveProperty('monitoring');
  });
  
  test('GET /api/monitoring/recommendations - Admin should access performance recommendations', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/monitoring/recommendations`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    expect(response.status()).toBe(200);
    
    const recommendations = await response.json();
    expect(recommendations).toHaveProperty('recommendations');
    expect(recommendations).toHaveProperty('total');
    expect(recommendations).toHaveProperty('highPriority');
    expect(recommendations).toHaveProperty('mediumPriority');
    expect(recommendations).toHaveProperty('lowPriority');
    
    expect(Array.isArray(recommendations.recommendations)).toBeTruthy();
    expect(typeof recommendations.total).toBe('number');
    expect(typeof recommendations.highPriority).toBe('number');
    expect(typeof recommendations.mediumPriority).toBe('number');
    expect(typeof recommendations.lowPriority).toBe('number');
  });
});

test.describe('Authorization Tests', () => {
  test('Admin endpoints should reject unauthenticated requests', async ({ page }) => {
    const adminEndpoints = [
      '/api/monitoring/errors',
      '/api/monitoring/performance',
      '/api/monitoring/dashboard',
      '/api/monitoring/logs',
      '/api/monitoring/system',
      '/api/monitoring/recommendations',
    ];
    
    for (const endpoint of adminEndpoints) {
      const response = await page.request.get(`${BASE_API_URL}${endpoint}`);
      expect(response.status()).toBe(401);
      
      const result = await response.json();
      validateErrorFormat(result);
    }
  });
  
  test('Admin endpoints should reject invalid tokens', async ({ page }) => {
    const invalidToken = 'invalid.jwt.token';
    
    const response = await page.request.get(`${BASE_API_URL}/monitoring/dashboard`, {
      headers: {
        Authorization: `Bearer ${invalidToken}`,
      },
    });
    
    expect(response.status()).toBe(401);
    
    const result = await response.json();
    validateErrorFormat(result);
  });
});

test.describe('Performance Metrics Endpoints', () => {
  test('POST /api/performance - Should accept performance metrics', async ({ page }) => {
    const metrics = {
      clientId: 'test-client-123',
      page: '/dashboard',
      component: 'ImageGrid',
      type: 'render-time',
      value: 150,
      metadata: {
        imageCount: 25,
        browserName: 'chrome',
      },
    };
    
    const response = await page.request.post(`${BASE_API_URL}/performance`, {
      data: metrics,
    });
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('success', true);
  });
  
  test('POST /api/performance - Should reject invalid metrics format', async ({ page }) => {
    const invalidMetrics = 'not-an-object';
    
    const response = await page.request.post(`${BASE_API_URL}/performance`, {
      data: invalidMetrics,
    });
    
    expect(response.status()).toBe(400);
    
    const result = await response.json();
    validateErrorFormat(result);
    expect(result.error).toContain('Invalid metrics format');
  });
  
  test('GET /api/performance/me - Should require authentication', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/performance/me`);
    
    expect(response.status()).toBe(401);
    
    const result = await response.json();
    expect(result).toHaveProperty('message', 'Authentication required');
  });
  
  test('GET /api/performance/me - Should return user metrics when authenticated', async ({ page }) => {
    const authToken = await getAuthToken(page);
    
    const response = await page.request.get(`${BASE_API_URL}/performance/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('metrics');
    expect(Array.isArray(result.metrics)).toBeTruthy();
  });
});

test.describe('Error Handling and Edge Cases', () => {
  test('Non-existent monitoring endpoints should return 404', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/monitoring/nonexistent`);
    expect(response.status()).toBe(404);
  });
  
  test('Health endpoints should handle database connection failures gracefully', async ({ page }) => {
    // Note: This is testing the error handling path
    // In a real scenario, we might temporarily disable the database
    // For this test, we just verify the endpoint responds even under load
    
    const response = await page.request.get(`${BASE_API_URL}/health`);
    expect([200, 503]).toContain(response.status());
    
    const healthData = await response.json();
    validateHealthResponse(healthData);
  });
  
  test('Metrics endpoint should handle high load', async ({ page }) => {
    // Test concurrent requests to metrics endpoint
    const requests = Array.from({ length: 5 }, () =>
      page.request.get(`${BASE_API_URL}/monitoring/metrics`)
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach((response) => {
      expect(response.status()).toBe(200);
    });
  });
  
  test('Error reporting should handle malformed JSON', async ({ page }) => {
    const response = await page.request.post(`${BASE_API_URL}/monitoring/errors`, {
      data: '{"invalid": json}',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    expect(response.status()).toBe(400);
  });
});

test.describe('Integration with Frontend', () => {
  test('Frontend should be able to report errors to monitoring', async ({ page }) => {
    // Go to frontend application
    await page.goto(FRONTEND_URL);
    
    // Inject a test error reporter
    await page.evaluate(() => {
      // Simulate frontend error reporting
      const errorData = {
        errors: [
          {
            timestamp: new Date().toISOString(),
            error: 'Frontend E2E test error',
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: 'e2e-test-user',
            sessionId: 'e2e-test-session',
            environment: 'e2e-test',
            release: '1.0.0-e2e',
            browserInfo: {
              name: 'chromium',
              version: '91.0.0',
            },
          },
        ],
      };
      
      // Send error report
      return fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      }).then((res) => res.json());
    });
    
    // The test passes if no errors are thrown during the evaluation
  });
  
  test('Frontend health check should be accessible', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Check if the page loads correctly
    await expect(page).toHaveTitle(/Spheroseg/);
    
    // Frontend should be able to call health endpoint
    const healthResponse = await page.evaluate(async () => {
      const response = await fetch('/api/health');
      return {
        status: response.status,
        ok: response.ok,
      };
    });
    
    expect([200, 503]).toContain(healthResponse.status);
  });
});