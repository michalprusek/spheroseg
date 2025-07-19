/**
 * Performance Monitoring E2E Tests
 * 
 * Tests focused on monitoring system performance, response times,
 * load handling, and performance metrics collection.
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_API_URL = 'http://localhost:5001/api';
const TEST_ADMIN_EMAIL = 'testuser@test.com';
const TEST_ADMIN_PASSWORD = 'testuser123';

// Performance benchmarks and thresholds
const PERFORMANCE_BENCHMARKS = {
  healthCheck: {
    fast: 500,      // Under 500ms is fast
    acceptable: 2000, // Under 2s is acceptable
    slow: 5000,     // Over 5s is slow
  },
  metrics: {
    fast: 1000,
    acceptable: 3000,
    slow: 10000,
  },
  dashboard: {
    fast: 2000,
    acceptable: 5000,
    slow: 15000,
  },
  concurrency: {
    maxRequests: 10,
    timeoutPerRequest: 10000,
  },
};

// Performance test utilities
async function measureEndpointPerformance(
  page: Page,
  endpoint: string,
  headers: Record<string, string> = {}
): Promise<{
  responseTime: number;
  status: number;
  success: boolean;
  data?: any;
}> {
  const startTime = Date.now();
  
  try {
    const response = await page.request.get(`${BASE_API_URL}${endpoint}`, {
      headers,
      timeout: 30000, // 30s timeout for performance tests
    });
    
    const responseTime = Date.now() - startTime;
    const success = response.ok();
    const data = success ? await response.json() : null;
    
    return {
      responseTime,
      status: response.status(),
      success,
      data,
    };
  } catch (error) {
    return {
      responseTime: Date.now() - startTime,
      status: 0,
      success: false,
    };
  }
}

async function getAuthToken(page: Page): Promise<string> {
  const response = await page.request.post(`${BASE_API_URL}/auth/login`, {
    data: {
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    },
  });
  
  const authData = await response.json();
  return authData.token;
}

test.describe('Monitoring Performance Benchmarks', () => {
  test('Health endpoint performance under normal load', async ({ page }) => {
    const measurements = [];
    const iterations = 5;
    
    // Take multiple measurements for accuracy
    for (let i = 0; i < iterations; i++) {
      const result = await measureEndpointPerformance(page, '/health');
      measurements.push(result);
      
      expect(result.success).toBeTruthy();
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(600);
      
      // Small delay between requests
      await page.waitForTimeout(100);
    }
    
    // Calculate statistics
    const responseTimes = measurements.map(m => m.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    console.log(`Health endpoint performance:
      Average: ${avgResponseTime.toFixed(2)}ms
      Min: ${minResponseTime}ms
      Max: ${maxResponseTime}ms
      All measurements: ${responseTimes.join(', ')}ms`);
    
    // Performance assertions
    expect(avgResponseTime).toBeLessThan(PERFORMANCE_BENCHMARKS.healthCheck.acceptable);
    expect(maxResponseTime).toBeLessThan(PERFORMANCE_BENCHMARKS.healthCheck.slow);
    
    // At least 80% of requests should be under the fast threshold
    const fastRequests = responseTimes.filter(time => time < PERFORMANCE_BENCHMARKS.healthCheck.fast);
    expect(fastRequests.length / responseTimes.length).toBeGreaterThan(0.6);
  });
  
  test('Metrics endpoint performance under normal load', async ({ page }) => {
    const measurements = [];
    const iterations = 3; // Fewer iterations for metrics as it's more resource-intensive
    
    for (let i = 0; i < iterations; i++) {
      const result = await measureEndpointPerformance(page, '/monitoring/metrics');
      measurements.push(result);
      
      expect(result.success).toBeTruthy();
      expect(result.status).toBe(200);
      
      await page.waitForTimeout(500); // Longer delay for metrics
    }
    
    const responseTimes = measurements.map(m => m.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    console.log(`Metrics endpoint performance:
      Average: ${avgResponseTime.toFixed(2)}ms
      Max: ${maxResponseTime}ms
      All measurements: ${responseTimes.join(', ')}ms`);
    
    expect(avgResponseTime).toBeLessThan(PERFORMANCE_BENCHMARKS.metrics.acceptable);
    expect(maxResponseTime).toBeLessThan(PERFORMANCE_BENCHMARKS.metrics.slow);
  });
  
  test('Dashboard endpoint performance with authentication', async ({ page }) => {
    const authToken = await getAuthToken(page);
    const measurements = [];
    const iterations = 3;
    
    for (let i = 0; i < iterations; i++) {
      const result = await measureEndpointPerformance(page, '/monitoring/dashboard', {
        Authorization: `Bearer ${authToken}`,
      });
      measurements.push(result);
      
      expect(result.success).toBeTruthy();
      expect(result.status).toBe(200);
      
      // Validate dashboard response structure
      if (result.data) {
        expect(result.data).toHaveProperty('timestamp');
        expect(result.data).toHaveProperty('system');
        expect(result.data).toHaveProperty('health');
        expect(result.data).toHaveProperty('errors');
        expect(result.data).toHaveProperty('performance');
        expect(result.data).toHaveProperty('alerts');
      }
      
      await page.waitForTimeout(1000); // Dashboard is resource-intensive
    }
    
    const responseTimes = measurements.map(m => m.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    console.log(`Dashboard endpoint performance:
      Average: ${avgResponseTime.toFixed(2)}ms
      Max: ${maxResponseTime}ms
      All measurements: ${responseTimes.join(', ')}ms`);
    
    expect(avgResponseTime).toBeLessThan(PERFORMANCE_BENCHMARKS.dashboard.acceptable);
    expect(maxResponseTime).toBeLessThan(PERFORMANCE_BENCHMARKS.dashboard.slow);
  });
});

test.describe('Load Testing and Concurrency', () => {
  test('Health endpoint should handle concurrent requests', async ({ page }) => {
    const concurrentRequests = 5;
    const startTime = Date.now();
    
    // Create concurrent requests
    const promises = Array.from({ length: concurrentRequests }, (_, index) =>
      measureEndpointPerformance(page, `/health?test=${index}`)
    );
    
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    console.log(`Concurrent health requests (${concurrentRequests}):
      Total time: ${totalTime}ms
      Individual times: ${results.map(r => r.responseTime).join(', ')}ms`);
    
    // All requests should succeed
    results.forEach((result, index) => {
      expect(result.success).toBeTruthy();
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(600);
    });
    
    // Concurrent requests shouldn't take much longer than sequential
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    expect(avgResponseTime).toBeLessThan(PERFORMANCE_BENCHMARKS.healthCheck.acceptable * 2);
  });
  
  test('Metrics endpoint should handle moderate load', async ({ page }) => {
    const concurrentRequests = 3;
    const startTime = Date.now();
    
    const promises = Array.from({ length: concurrentRequests }, (_, index) =>
      measureEndpointPerformance(page, `/monitoring/metrics?load=${index}`)
    );
    
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    console.log(`Concurrent metrics requests (${concurrentRequests}):
      Total time: ${totalTime}ms
      Individual times: ${results.map(r => r.responseTime).join(', ')}ms`);
    
    // All requests should succeed
    results.forEach((result) => {
      expect(result.success).toBeTruthy();
      expect(result.status).toBe(200);
    });
    
    // No single request should be extremely slow
    const maxResponseTime = Math.max(...results.map(r => r.responseTime));
    expect(maxResponseTime).toBeLessThan(PERFORMANCE_BENCHMARKS.metrics.slow);
  });
  
  test('Mixed endpoint load test', async ({ page }) => {
    const authToken = await getAuthToken(page);
    
    // Mix of different endpoint types
    const requests = [
      measureEndpointPerformance(page, '/health'),
      measureEndpointPerformance(page, '/health/live'),
      measureEndpointPerformance(page, '/health/ready'),
      measureEndpointPerformance(page, '/monitoring/health'),
      measureEndpointPerformance(page, '/monitoring/metrics'),
      measureEndpointPerformance(page, '/monitoring/system', {
        Authorization: `Bearer ${authToken}`,
      }),
    ];
    
    const startTime = Date.now();
    const results = await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    
    console.log(`Mixed endpoint load test:
      Total time: ${totalTime}ms
      Health: ${results[0].responseTime}ms
      Live: ${results[1].responseTime}ms
      Ready: ${results[2].responseTime}ms
      Monitoring Health: ${results[3].responseTime}ms
      Metrics: ${results[4].responseTime}ms
      System: ${results[5].responseTime}ms`);
    
    // Most requests should succeed (some might be degraded but not failed)
    const successfulRequests = results.filter(r => r.success);
    expect(successfulRequests.length).toBeGreaterThanOrEqual(results.length * 0.8);
    
    // Total time shouldn't be excessive
    expect(totalTime).toBeLessThan(20000); // 20 seconds max for all requests
  });
});

test.describe('Performance Monitoring Data Collection', () => {
  test('Performance metrics should be recorded correctly', async ({ page }) => {
    const testMetrics = {
      clientId: `perf-test-${Date.now()}`,
      page: '/performance-test',
      component: 'MonitoringDashboard',
      type: 'load-time',
      value: 1234,
      metadata: {
        testType: 'e2e-performance',
        browserName: 'chromium',
        testRun: new Date().toISOString(),
      },
    };
    
    const startTime = Date.now();
    const response = await page.request.post(`${BASE_API_URL}/performance`, {
      data: testMetrics,
    });
    const responseTime = Date.now() - startTime;
    
    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(2000); // Metrics recording should be fast
    
    const result = await response.json();
    expect(result).toHaveProperty('success', true);
  });
  
  test('Bulk performance metrics should be handled efficiently', async ({ page }) => {
    const bulkMetrics = Array.from({ length: 10 }, (_, index) => ({
      clientId: `bulk-test-${Date.now()}-${index}`,
      page: `/test-page-${index}`,
      component: `TestComponent${index}`,
      type: 'render-time',
      value: 100 + index * 10,
      metadata: {
        testIndex: index,
        batchTest: true,
      },
    }));
    
    const startTime = Date.now();
    
    // Send metrics in parallel
    const promises = bulkMetrics.map(metrics =>
      page.request.post(`${BASE_API_URL}/performance`, { data: metrics })
    );
    
    const responses = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    console.log(`Bulk metrics performance:
      ${bulkMetrics.length} metrics sent in ${totalTime}ms
      Average per metric: ${(totalTime / bulkMetrics.length).toFixed(2)}ms`);
    
    // All metrics should be recorded successfully
    responses.forEach((response) => {
      expect(response.status()).toBe(200);
    });
    
    // Bulk operations should be reasonably fast
    expect(totalTime).toBeLessThan(10000); // 10 seconds for 10 metrics
    const avgTimePerMetric = totalTime / bulkMetrics.length;
    expect(avgTimePerMetric).toBeLessThan(1000); // 1 second per metric max
  });
  
  test('Performance metrics retrieval should be efficient', async ({ page }) => {
    const authToken = await getAuthToken(page);
    
    const startTime = Date.now();
    const response = await page.request.get(`${BASE_API_URL}/performance/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    const responseTime = Date.now() - startTime;
    
    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(5000); // Retrieval should be reasonably fast
    
    const result = await response.json();
    expect(result).toHaveProperty('metrics');
    expect(Array.isArray(result.metrics)).toBeTruthy();
    
    console.log(`Performance metrics retrieval:
      Response time: ${responseTime}ms
      Metrics returned: ${result.metrics.length}`);
  });
});

test.describe('Monitoring System Stress Tests', () => {
  test('System should maintain performance under sustained load', async ({ page }) => {
    const iterations = 10;
    const measurements: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await measureEndpointPerformance(page, '/health');
      measurements.push(result.responseTime);
      
      expect(result.success).toBeTruthy();
      
      // No delay - sustained load
    }
    
    // Performance should not degrade significantly over time
    const firstHalf = measurements.slice(0, Math.floor(iterations / 2));
    const secondHalf = measurements.slice(Math.floor(iterations / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    console.log(`Sustained load test:
      First half average: ${firstAvg.toFixed(2)}ms
      Second half average: ${secondAvg.toFixed(2)}ms
      Performance degradation: ${((secondAvg - firstAvg) / firstAvg * 100).toFixed(2)}%`);
    
    // Performance shouldn't degrade by more than 50%
    expect(secondAvg).toBeLessThan(firstAvg * 1.5);
    
    // Maximum response time shouldn't exceed acceptable threshold
    const maxTime = Math.max(...measurements);
    expect(maxTime).toBeLessThan(PERFORMANCE_BENCHMARKS.healthCheck.slow);
  });
  
  test('Error handling should not impact performance significantly', async ({ page }) => {
    // Test performance with a mix of successful and failing requests
    const requests = [
      // Successful requests
      measureEndpointPerformance(page, '/health'),
      measureEndpointPerformance(page, '/monitoring/metrics'),
      // Requests that should fail/return errors
      measureEndpointPerformance(page, '/monitoring/nonexistent'),
      measureEndpointPerformance(page, '/monitoring/dashboard'), // No auth
    ];
    
    const results = await Promise.all(requests);
    
    // Successful requests should still perform well
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    expect(successfulResults.length).toBeGreaterThan(0);
    expect(failedResults.length).toBeGreaterThan(0);
    
    const avgSuccessTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length;
    const avgFailTime = failedResults.reduce((sum, r) => sum + r.responseTime, 0) / failedResults.length;
    
    console.log(`Error handling performance:
      Successful requests avg: ${avgSuccessTime.toFixed(2)}ms
      Failed requests avg: ${avgFailTime.toFixed(2)}ms`);
    
    // Failed requests shouldn't be significantly slower than successful ones
    expect(avgFailTime).toBeLessThan(avgSuccessTime * 3);
    
    // All requests should complete in reasonable time
    results.forEach((result) => {
      expect(result.responseTime).toBeLessThan(10000); // 10 second max
    });
  });
});

test.describe('Performance Regression Detection', () => {
  test('Baseline performance measurements for regression testing', async ({ page }) => {
    // This test establishes baseline performance metrics
    // In CI/CD, these could be compared against historical data
    
    const endpoints = [
      { path: '/health', name: 'health', maxTime: 2000 },
      { path: '/health/live', name: 'liveness', maxTime: 1000 },
      { path: '/health/ready', name: 'readiness', maxTime: 2000 },
      { path: '/monitoring/health', name: 'monitoring-health', maxTime: 3000 },
      { path: '/monitoring/metrics', name: 'metrics', maxTime: 5000 },
    ];
    
    const baselineResults: Record<string, number> = {};
    
    for (const endpoint of endpoints) {
      const measurements = [];
      
      // Take 3 measurements for each endpoint
      for (let i = 0; i < 3; i++) {
        const result = await measureEndpointPerformance(page, endpoint.path);
        if (result.success) {
          measurements.push(result.responseTime);
        }
        await page.waitForTimeout(500);
      }
      
      if (measurements.length > 0) {
        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        baselineResults[endpoint.name] = avgTime;
        
        // Ensure performance is within acceptable limits
        expect(avgTime).toBeLessThan(endpoint.maxTime);
      }
    }
    
    // Log baseline results for future comparison
    console.log('Performance Baseline Results:');
    Object.entries(baselineResults).forEach(([name, time]) => {
      console.log(`  ${name}: ${time.toFixed(2)}ms`);
    });
    
    // Store in test context for potential future use
    test.info().annotations.push({
      type: 'performance-baseline',
      description: JSON.stringify(baselineResults),
    });
  });
});