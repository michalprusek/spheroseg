import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import apiClient from '@/services/api/client';
import { handleError, ErrorType, ErrorSeverity } from '@/utils/errorHandling';
import logger from '@/utils/logger';

// Mock dependencies
vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling', async () => {
  const actual = await vi.importActual('@/utils/errorHandling');
  return {
    ...actual,
    handleError: vi.fn().mockImplementation((error, options) => {
      // Default implementation to track calls
      return {
        type: options?.errorInfo?.type || ErrorType.UNKNOWN,
        severity: options?.errorInfo?.severity || ErrorSeverity.ERROR,
        message: options?.errorInfo?.message || 'Unknown error',
        originalError: error,
        handled: true,
      };
    }),
  };
});

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Setup MSW server for API mocking
const server = setupServer();

describe('Network Failure Handling', () => {
  beforeAll(() => {
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('API Client Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Setup MSW to simulate network error
      server.use(
        rest.get('/api/status', (req, res) => {
          return res.networkError('Network error');
        }),
      );

      // Perform request that will fail
      try {
        await apiClient.get('/status');
        fail('Should have thrown an error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            context: expect.stringContaining('API GET /status'),
            errorInfo: expect.objectContaining({
              type: ErrorType.NETWORK,
              severity: ErrorSeverity.ERROR,
            }),
          }),
        );
      }
    });

    it('should handle timeout errors correctly', async () => {
      // Setup MSW to simulate timeout
      server.use(
        rest.get('/api/slow-endpoint', (req, res) => {
          return res.delay(5000).status(200).json({ success: true });
        }),
      );

      // Override axios timeout for this test
      const originalTimeout = apiClient.defaults.timeout;
      apiClient.defaults.timeout = 50;

      try {
        await apiClient.get('/slow-endpoint');
        fail('Should have thrown a timeout error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.NETWORK,
              message: expect.stringContaining('timeout'),
            }),
          }),
        );
      } finally {
        // Restore original timeout
        apiClient.defaults.timeout = originalTimeout;
      }
    });

    it('should handle 5xx server errors', async () => {
      // Setup MSW to simulate 500 error
      server.use(
        rest.get('/api/server-error', (req, res) => {
          return res.status(500).json({ error: 'Internal server error' });
        }),
      );

      try {
        await apiClient.get('/server-error');
        fail('Should have thrown a server error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.SERVER,
              severity: ErrorSeverity.ERROR,
              message: 'Server error. Please try again later.',
            }),
          }),
        );
      }
    });

    it('should handle 429 rate limiting errors', async () => {
      // Setup MSW to simulate rate limiting
      server.use(
        rest.get('/api/rate-limited', (req, res) => {
          return res.status(429).json({ error: 'Too many requests' }).set('Retry-After', '10');
        }),
      );

      try {
        await apiClient.get('/rate-limited');
        fail('Should have thrown a rate limit error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.API,
              severity: ErrorSeverity.ERROR,
            }),
          }),
        );
        // We should log the Retry-After header
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Rate limited'),
          expect.objectContaining({ retryAfter: '10' }),
        );
      }
    });
  });
});
