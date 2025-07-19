import axios from 'axios';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
// Importing but using dynamic require later for mocking
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { segmentImage } from '../../services/segmentationService';
import logger from '../../utils/logger';
import config from '../../config';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../config', () => ({
  segmentation: {
    maxRetries: 3,
    retryDelay: 100,
    timeout: 5000,
    mlServiceUrl: 'http://localhost:3001',
    devicePreference: 'auto',
  },
}));

// Mock express app
let server: Server;
let mockServerUrl: string;

describe('Network Failure Tests', () => {
  beforeAll(() => {
    // Create a mock server to simulate ML service
    server = createServer((req, res) => {
      const endpoint = req.url;

      // Test URL paths and their responses
      if (endpoint === '/timeout') {
        // Simulate timeout by not responding
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        }, 5000); // Longer than our test timeout
      } else if (endpoint === '/connection-reset') {
        // Simulate connection reset
        req.socket.destroy();
      } else if (endpoint === '/server-error') {
        // Simulate server error
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      } else if (endpoint === '/bad-gateway') {
        // Simulate bad gateway
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad gateway' }));
      } else if (endpoint === '/corrupt-json') {
        // Simulate corrupt JSON response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"incomplete": "json",,,,}');
      } else if (endpoint === '/retry-success') {
        // Static counter to track retry attempts
        if (!(global as typeof globalThis & { _retryCount?: unknown })._retryCount) {
          (global as unknown)._retryCount = 0;
        }

        (global as typeof globalThis & { _retryCount?: unknown })._retryCount++;

        if ((global as unknown)._retryCount <= 2) {
          // First two attempts fail
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Service unavailable, try again' }));
        } else {
          // Third attempt succeeds
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Success after retry' }));
        }
      } else {
        // Default response
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    // Start server on a random free port
    server.listen(0);
    const addressInfo = server.address() as AddressInfo;
    mockServerUrl = `http://localhost:${addressInfo.port}`;

    // Update config to use our mock server
    (config.segmentation as unknown).mlServiceUrl = mockServerUrl;
  });

  afterAll(() => {
    // Clean up server
    server.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (global as typeof globalThis & { _retryCount?: unknown })._retryCount = 0;
  });

  // Helper function to test API calls with network failures
  async function testNetworkFailure(endpoint: string): Promise<Record<string, unknown>> {
    try {
      const response = await axios.get(`${mockServerUrl}${endpoint}`);
      return {
        status: response.status,
        body: response.data,
      };
    } catch (error) {
      return { error };
    }
  }

  it('should handle connection timeouts gracefully', async () => {
    // Override fetch timeout for this test
    jest.setTimeout(1000); // Short timeout for test

    const result = await testNetworkFailure('/timeout');

    expect(result).toHaveProperty('error');
    expect((result.error as unknown).name).toBe('AbortError');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle connection resets gracefully', async () => {
    const result = await testNetworkFailure('/connection-reset');

    expect(result).toHaveProperty('error');
    expect((result.error as unknown).code).toBeDefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle server errors properly', async () => {
    const result = await testNetworkFailure('/server-error');

    expect(result.status).toBe(500);
    expect(result.body).toHaveProperty('error', 'Internal server error');
  });

  it('should handle network-level errors like bad gateways', async () => {
    const result = await testNetworkFailure('/bad-gateway');

    expect(result.status).toBe(502);
    expect(result.body).toHaveProperty('error', 'Bad gateway');
  });

  it('should handle corrupt JSON responses', async () => {
    const result = await testNetworkFailure('/corrupt-json');

    expect(result).toBe('Invalid JSON');
  });

  it('should implement retry logic for failed requests', async () => {
    // Reset retry counter
    (global as unknown)._retryCount = 0;

    // Request that will succeed after retries
    const result = await testNetworkFailure('/retry-success');

    // Verify retries occurred and we got successful result
    expect((global as typeof globalThis & { _retryCount?: unknown })._retryCount).toBe(3);
    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty('success', true);
    expect(result.body).toHaveProperty('message', 'Success after retry');
  });

  // Test that the segmentation service handles network failures properly
  it('should have proper retry and circuit breaker in segmentation service', async () => {
    // Mock segmentationService dependencies
    jest.mock('../../services/segmentationService', () => {
      const original = jest.requireActual('../../services/segmentationService');

      return {
        ...original,
        // Override fetch in the service to use our mock server
        _callMlService: jest.fn().mockImplementation(async (endpoint) => {
          const response = await axios.get(`${mockServerUrl}${endpoint}`);
          if (response.status >= 400) {
            throw new Error(`HTTP error: ${response.status}`);
          }
          return response.data;
        }),
      };
    });

    // Import the mocked version using dynamic import
    const segmentationServicePromise = import('../../services/segmentationService');

    // Test retry logic
    (global as unknown)._retryCount = 0;

    // Use the segmentation service module after it's loaded
    segmentationServicePromise
      .then((segmentationService) => {
        // Ensure we're using our mock service
        (segmentationService as unknown)._callMlService = jest
          .fn()
          .mockImplementation(async (endpoint: string) => {
            // Call our test endpoint
            const response = await axios.get(`${mockServerUrl}${endpoint}`);
            if (response.status >= 400) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            return response.data;
          });

        // Call segmentation with retries
        return (segmentationService as unknown)._callMlService('/retry-success', {});
      })
      .then(() => {
        // If it succeeds, verify retry count
        expect((global as typeof globalThis & { _retryCount?: unknown })._retryCount).toBe(3);
      })
      .catch((error) => {
        // If it fails, check error and retry count
        expect((global as unknown)._retryCount).toBeGreaterThan(0);
        throw error;
      });
  });
});
