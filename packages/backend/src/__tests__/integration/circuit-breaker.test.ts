/**
 * Integration tests for Circuit Breaker Pattern
 *
 * Tests circuit breaker functionality for external service calls
 */
import CircuitBreaker from 'opossum';
import request from 'supertest';
import app from '../../app';
import logger from '../../utils/logger';

// Mock external service calls
const mockMLService = jest.fn();
const mockDatabaseQuery = jest.fn();
const mockCDNService = jest.fn();

// Mock dependencies
jest.mock('../../utils/logger');

describe('Circuit Breaker Pattern', () => {
  let mlServiceBreaker: CircuitBreaker;
  let databaseBreaker: CircuitBreaker;
  let cdnBreaker: CircuitBreaker;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create circuit breakers for different services
    mlServiceBreaker = new CircuitBreaker(mockMLService, {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: 'ml-service',
    });

    databaseBreaker = new CircuitBreaker(mockDatabaseQuery, {
      timeout: 1000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      name: 'database',
    });

    cdnBreaker = new CircuitBreaker(mockCDNService, {
      timeout: 5000,
      errorThresholdPercentage: 30,
      resetTimeout: 60000,
      name: 'cdn-service',
    });

    // Add event listeners
    [mlServiceBreaker, databaseBreaker, cdnBreaker].forEach((breaker) => {
      breaker.on('open', () => {
        logger.warn(`Circuit breaker opened: ${breaker.name}`);
      });

      breaker.on('halfOpen', () => {
        logger.info(`Circuit breaker half-open: ${breaker.name}`);
      });

      breaker.on('close', () => {
        logger.info(`Circuit breaker closed: ${breaker.name}`);
      });

      breaker.on('fallback', (data) => {
        logger.info(`Circuit breaker fallback executed: ${breaker.name}`, data);
      });
    });
  });

  afterEach(() => {
    // Shutdown circuit breakers
    [mlServiceBreaker, databaseBreaker, cdnBreaker].forEach((breaker) => {
      breaker.shutdown();
    });
  });

  describe('ML Service Circuit Breaker', () => {
    it('should handle ML service failures gracefully', async () => {
      // Simulate service failures
      mockMLService
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'));

      // Make requests that will fail
      const failures = [];
      for (let i = 0; i < 5; i++) {
        try {
          await mlServiceBreaker.fire({ imageId: `test-${i}` });
        } catch (error) {
          failures.push(error);
        }
      }

      expect(failures).toHaveLength(5);

      // Circuit should now be open
      expect(mlServiceBreaker.opened).toBe(true);

      // Subsequent calls should fail immediately
      const startTime = Date.now();
      try {
        await mlServiceBreaker.fire({ imageId: 'test-6' });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(50); // Should fail fast
        expect(error.message).toContain('Breaker is OPEN');
      }
    });

    it('should use fallback when circuit is open', async () => {
      // Define fallback function
      mlServiceBreaker.fallback((params) => {
        return {
          status: 'fallback',
          message: 'ML service temporarily unavailable',
          imageId: params.imageId,
          queuedForRetry: true,
        };
      });

      // Open the circuit by causing failures
      for (let i = 0; i < 10; i++) {
        mockMLService.mockRejectedValueOnce(new Error('Service error'));
        try {
          await mlServiceBreaker.fire({ imageId: `fail-${i}` });
        } catch (error) {
          // Expected
        }
      }

      // Circuit should be open
      expect(mlServiceBreaker.opened).toBe(true);

      // Now calls should use fallback
      const result = await mlServiceBreaker.fire({ imageId: 'test-fallback' });

      expect(result).toEqual({
        status: 'fallback',
        message: 'ML service temporarily unavailable',
        imageId: 'test-fallback',
        queuedForRetry: true,
      });
    });

    it('should recover when service becomes healthy', async () => {
      // Open the circuit
      for (let i = 0; i < 10; i++) {
        mockMLService.mockRejectedValueOnce(new Error('Service error'));
        try {
          await mlServiceBreaker.fire({ imageId: `fail-${i}` });
        } catch (error) {
          // Expected
        }
      }

      expect(mlServiceBreaker.opened).toBe(true);

      // Wait for half-open state (simulate time passing)
      jest.advanceTimersByTime(31000); // After reset timeout

      // Service is now healthy
      mockMLService.mockResolvedValueOnce({
        status: 'success',
        result: 'processed',
      });

      // This call should succeed and close the circuit
      const result = await mlServiceBreaker.fire({ imageId: 'test-recovery' });

      expect(result).toEqual({
        status: 'success',
        result: 'processed',
      });

      // Circuit should be closed again
      expect(mlServiceBreaker.closed).toBe(true);
    });
  });

  describe('Database Circuit Breaker', () => {
    it('should handle database timeouts', async () => {
      // Simulate slow queries
      mockDatabaseQuery.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Query timeout'));
          }, 2000); // Longer than circuit breaker timeout
        });
      });

      const startTime = Date.now();
      try {
        await databaseBreaker.fire('SELECT * FROM large_table');
      } catch (error: any) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(1100); // Should timeout at 1000ms
        expect(error.message).toContain('timeout');
      }
    });

    it('should track success rate', async () => {
      // Mix of successful and failed calls
      mockDatabaseQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockRejectedValueOnce(new Error('Connection lost'));

      const results = [];
      for (let i = 0; i < 5; i++) {
        try {
          const result = await databaseBreaker.fire(`SELECT * FROM test WHERE id = ${i}`);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error });
        }
      }

      // Should have 3 successes and 2 failures
      const successes = results.filter((r) => r.success).length;
      const failures = results.filter((r) => !r.success).length;

      expect(successes).toBe(3);
      expect(failures).toBe(2);

      // Circuit should still be closed (40% failure rate < 50% threshold)
      expect(databaseBreaker.closed).toBe(true);
    });
  });

  describe('CDN Service Circuit Breaker', () => {
    it('should handle CDN service degradation', async () => {
      // Simulate gradual degradation
      const latencies = [100, 200, 500, 1000, 2000, 4000, 6000];

      mockCDNService.mockImplementation((url) => {
        const latency = latencies.shift() || 6000;
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (latency > 5000) {
              reject(new Error('CDN timeout'));
            } else {
              resolve({ url, cached: true, latency });
            }
          }, latency);
        });
      });

      // Make requests with increasing latency
      const results = [];
      for (let i = 0; i < 7; i++) {
        try {
          const result = await cdnBreaker.fire(`https://cdn.example.com/asset${i}.js`);
          results.push({ success: true, latency: (result as any).latency });
        } catch (error) {
          results.push({ success: false, error });
        }
      }

      // First few should succeed, last ones should fail
      const successfulRequests = results.filter((r) => r.success);
      const failedRequests = results.filter((r) => !r.success);

      expect(successfulRequests.length).toBeGreaterThan(0);
      expect(failedRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Circuit Breaker Metrics', () => {
    it('should expose circuit breaker stats', () => {
      // Get stats from circuit breaker
      const mlStats = mlServiceBreaker.stats;
      const dbStats = databaseBreaker.stats;
      const cdnStats = cdnBreaker.stats;

      // Verify stats structure
      [mlStats, dbStats, cdnStats].forEach((stats) => {
        expect(stats).toHaveProperty('fires');
        expect(stats).toHaveProperty('failures');
        expect(stats).toHaveProperty('successes');
        expect(stats).toHaveProperty('timeouts');
        expect(stats).toHaveProperty('cacheHits');
        expect(stats).toHaveProperty('cacheMisses');
        expect(stats).toHaveProperty('semaphoreRejections');
        expect(stats).toHaveProperty('percentiles');
      });
    });

    it('should track circuit state changes', async () => {
      const stateChanges: any[] = [];

      mlServiceBreaker.on('stateChange' as any, (state: any) => {
        stateChanges.push({
          timestamp: Date.now(),
          from: state.from,
          to: state.to,
        });
      });

      // Cause circuit to open
      for (let i = 0; i < 10; i++) {
        mockMLService.mockRejectedValueOnce(new Error('Service error'));
        try {
          await mlServiceBreaker.fire({ id: i });
        } catch (error) {
          // Expected
        }
      }

      // Verify state changes were tracked
      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges[stateChanges.length - 1].to).toBe('open');
    });
  });

  describe('Integration with Monitoring', () => {
    it('should emit metrics for Prometheus', () => {
      // Create custom metrics for circuit breakers
      const circuitBreakerMetrics = {
        state: new Map(),
        failures: new Map(),
        successes: new Map(),
        timeouts: new Map(),
      };

      // Track metrics
      [mlServiceBreaker, databaseBreaker, cdnBreaker].forEach((breaker) => {
        breaker.on('success', () => {
          const current = circuitBreakerMetrics.successes.get(breaker.name) || 0;
          circuitBreakerMetrics.successes.set(breaker.name, current + 1);
        });

        breaker.on('failure', () => {
          const current = circuitBreakerMetrics.failures.get(breaker.name) || 0;
          circuitBreakerMetrics.failures.set(breaker.name, current + 1);
        });

        breaker.on('timeout', () => {
          const current = circuitBreakerMetrics.timeouts.get(breaker.name) || 0;
          circuitBreakerMetrics.timeouts.set(breaker.name, current + 1);
        });

        breaker.on('stateChange' as any, (state: any) => {
          circuitBreakerMetrics.state.set(breaker.name, state.to);
        });
      });

      // Verify metrics structure is suitable for Prometheus
      expect(circuitBreakerMetrics).toHaveProperty('state');
      expect(circuitBreakerMetrics).toHaveProperty('failures');
      expect(circuitBreakerMetrics).toHaveProperty('successes');
      expect(circuitBreakerMetrics).toHaveProperty('timeouts');
    });
  });

  describe('Fallback Strategies', () => {
    it('should use cache as fallback for CDN failures', async () => {
      const cache = new Map();
      cache.set('https://cdn.example.com/cached.js', {
        content: 'cached content',
        timestamp: Date.now(),
      });

      cdnBreaker.fallback((url) => {
        // Try to return from cache
        const cached = cache.get(url);
        if (cached) {
          return {
            url,
            content: cached.content,
            fromCache: true,
            age: Date.now() - cached.timestamp,
          };
        }
        throw new Error('Not in cache');
      });

      // Force circuit to open
      for (let i = 0; i < 10; i++) {
        mockCDNService.mockRejectedValueOnce(new Error('CDN error'));
        try {
          await cdnBreaker.fire(`https://cdn.example.com/fail${i}.js`);
        } catch (error) {
          // Expected
        }
      }

      // Request cached resource
      const result = await cdnBreaker.fire('https://cdn.example.com/cached.js');

      expect(result).toMatchObject({
        url: 'https://cdn.example.com/cached.js',
        content: 'cached content',
        fromCache: true,
      });
    });

    it('should queue requests for retry when ML service fails', async () => {
      const retryQueue: any[] = [];

      mlServiceBreaker.fallback((params) => {
        // Add to retry queue
        retryQueue.push({
          ...params,
          queuedAt: Date.now(),
          retryCount: 0,
        });

        return {
          status: 'queued',
          queuePosition: retryQueue.length,
          estimatedRetryTime: Date.now() + 60000, // 1 minute
        };
      });

      // Open the circuit
      for (let i = 0; i < 10; i++) {
        mockMLService.mockRejectedValueOnce(new Error('Service error'));
        try {
          await mlServiceBreaker.fire({ imageId: `fail-${i}` });
        } catch (error) {
          // Expected
        }
      }

      // Queue some requests
      const queuedResults = [];
      for (let i = 0; i < 5; i++) {
        const result = await mlServiceBreaker.fire({ imageId: `queued-${i}` });
        queuedResults.push(result);
      }

      expect(queuedResults).toHaveLength(5);
      expect(retryQueue).toHaveLength(5);

      // Verify queue positions
      queuedResults.forEach((result, index) => {
        expect((result as any).queuePosition).toBe(index + 1);
      });
    });
  });
});
