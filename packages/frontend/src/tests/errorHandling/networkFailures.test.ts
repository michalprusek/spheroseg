import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import apiClient from '@/lib/apiClient';
import { handleError, NetworkError, ErrorType, ErrorSeverity } from '@/utils/errorHandling';
import { useSegmentationApi } from '@/hooks/useSegmentationApi';
import { useProjectApi } from '@/hooks/useProjectApi';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Wrapper for testing hooks with QueryClient
const wrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

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
        rest.get('/api/status', (req, res, ctx) => {
          return res.networkError('Network error');
        })
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
          })
        );
      }
    });

    it('should handle timeout errors correctly', async () => {
      // Setup MSW to simulate timeout
      server.use(
        rest.get('/api/slow-endpoint', (req, res, ctx) => {
          return res(ctx.delay(5000), ctx.status(200), ctx.json({ success: true }));
        })
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
          })
        );
      } finally {
        // Restore original timeout
        apiClient.defaults.timeout = originalTimeout;
      }
    });

    it('should handle 5xx server errors', async () => {
      // Setup MSW to simulate 500 error
      server.use(
        rest.get('/api/server-error', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
        })
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
          })
        );
      }
    });

    it('should handle 429 rate limiting errors', async () => {
      // Setup MSW to simulate rate limiting
      server.use(
        rest.get('/api/rate-limited', (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({ error: 'Too many requests' }),
            ctx.set('Retry-After', '10')
          );
        })
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
          })
        );
        // We should log the Retry-After header
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Rate limited'),
          expect.objectContaining({
            retryAfter: expect.anything(),
          })
        );
      }
    });

    it('should handle authentication errors and redirect', async () => {
      // Setup MSW to simulate 401 error
      server.use(
        rest.get('/api/authenticated', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
        })
      );

      // Mock location.href for redirect
      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });

      // Setup localStorage with a token to be cleared
      localStorage.setItem('authToken', 'test-token');

      try {
        await apiClient.get('/authenticated');
        fail('Should have thrown an authentication error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.AUTHENTICATION,
              severity: ErrorSeverity.WARNING,
              message: 'Your session has expired. Please sign in again.',
            }),
          })
        );

        // Verify token was removed
        expect(localStorage.getItem('authToken')).toBeNull();

        // Allow time for redirect
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify redirect
        expect(window.location.href).toBe('/sign-in');
      } finally {
        // Restore original location
        Object.defineProperty(window, 'location', {
          value: { href: originalHref },
          writable: true,
        });
      }
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with specific status codes', async () => {
      // Setup counter to track retry attempts
      let requestCount = 0;

      // Setup MSW to fail twice then succeed
      server.use(
        rest.get('/api/retry-test', (req, res, ctx) => {
          requestCount++;
          
          if (requestCount <= 2) {
            // First two requests fail with 503
            return res(
              ctx.status(503),
              ctx.json({ error: 'Service unavailable, try again' })
            );
          } else {
            // Third request succeeds
            return res(ctx.status(200), ctx.json({ success: true }));
          }
        })
      );

      // Create a wrapped version of apiClient.get with retry logic
      const getWithRetry = async (url: string, maxRetries = 3, retryDelay = 10) => {
        let retries = 0;
        
        while (retries < maxRetries) {
          try {
            return await apiClient.get(url);
          } catch (error) {
            // Only retry certain status codes
            const status = error.response?.status;
            const isRetryable = status === 503 || status === 502 || status === 500;
            
            if (retries >= maxRetries - 1 || !isRetryable) {
              throw error;
            }
            
            // Increase retries and wait before trying again
            retries++;
            logger.warn(`Retrying request (${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
        
        throw new Error('Max retries reached');
      };

      // Test the retry logic
      const result = await getWithRetry('/retry-test');
      
      // Verify retry behavior
      expect(requestCount).toBe(3);
      expect(result.data).toEqual({ success: true });
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should implement circuit breaker to prevent cascading failures', async () => {
      // Simple circuit breaker implementation for testing
      class CircuitBreaker {
        private failures = 0;
        private lastFailureTime = 0;
        private open = false;
        private readonly threshold = 3;
        private readonly resetTimeout = 1000; // 1 second

        async execute(fn: () => Promise<any>) {
          // Check if circuit is open
          if (this.open) {
            const now = Date.now();
            if (now - this.lastFailureTime > this.resetTimeout) {
              // Half-open state: allow one request through
              this.open = false;
              logger.info('Circuit half-open, allowing request');
            } else {
              // Circuit still open, fast fail
              logger.warn('Circuit open, fast-failing request');
              throw new Error('Circuit breaker open');
            }
          }

          try {
            const result = await fn();
            // Success resets the failure counter
            this.failures = 0;
            return result;
          } catch (error) {
            this.failures++;
            this.lastFailureTime = Date.now();
            
            if (this.failures >= this.threshold) {
              // Open the circuit
              this.open = true;
              logger.error(`Circuit opened after ${this.failures} failures`);
            }
            
            throw error;
          }
        }
      }

      // Create a circuit breaker
      const breaker = new CircuitBreaker();

      // Setup MSW to always fail
      server.use(
        rest.get('/api/unstable-service', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Service unstable' }));
        })
      );

      // Function to make requests through the circuit breaker
      const callService = async () => {
        try {
          return await breaker.execute(() => apiClient.get('/unstable-service'));
        } catch (error) {
          // Pass through circuit breaker errors
          if (error.message === 'Circuit breaker open') {
            return { circuitOpen: true };
          }
          throw error;
        }
      };

      // Make 4 requests: 3 to trigger circuit open, 1 to test fast fail
      const results = [];
      
      // First 3 should try and fail
      for (let i = 0; i < 3; i++) {
        results.push(await callService());
      }
      
      // 4th should fast fail due to open circuit
      results.push(await callService());
      
      // Wait for circuit reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // 5th should try again (half-open state)
      results.push(await callService());

      // Check results
      expect(results[3]).toEqual({ circuitOpen: true });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Circuit opened after 3 failures'));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Circuit open, fast-failing request'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Circuit half-open, allowing request'));
    });
  });

  describe('API Hook Error Handling', () => {
    it('should handle network errors in useSegmentationApi hook', async () => {
      // Setup MSW to simulate network error
      server.use(
        rest.get('/api/segmentation/status', (req, res, ctx) => {
          return res.networkError('Network error');
        })
      );

      // Render the hook
      const { result } = renderHook(() => useSegmentationApi(), { wrapper });

      // Wait for query to fail
      await waitFor(() => {
        expect(result.current.getSegmentationStatus.isError).toBe(true);
      });

      // Verify error handling
      expect(handleError).toHaveBeenCalled();
      expect(handleError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          errorInfo: expect.objectContaining({
            type: ErrorType.NETWORK,
          }),
        })
      );
    });

    it('should handle network errors in useProjectApi hook', async () => {
      // Setup MSW to simulate network error
      server.use(
        rest.get('/api/projects', (req, res, ctx) => {
          return res.networkError('Network error');
        })
      );

      // Render the hook
      const { result } = renderHook(() => useProjectApi(), { wrapper });

      // Wait for query to fail
      await waitFor(() => {
        expect(result.current.getProjects.isError).toBe(true);
      });

      // Verify error handling
      expect(handleError).toHaveBeenCalled();
      expect(handleError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          errorInfo: expect.objectContaining({
            type: ErrorType.NETWORK,
          }),
        })
      );
    });
  });

  describe('Network Error Edge Cases', () => {
    it('should handle malformed JSON responses', async () => {
      // Setup MSW to simulate malformed JSON
      server.use(
        rest.get('/api/malformed-json', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.body('{not valid json}'),
            ctx.set('Content-Type', 'application/json')
          );
        })
      );

      try {
        await apiClient.get('/malformed-json');
        fail('Should have thrown a parse error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(error.message).toContain('JSON');
      }
    });

    it('should handle CORS errors', async () => {
      // Setup MSW to simulate CORS error
      server.use(
        rest.get('/api/cors-error', (req, res, ctx) => {
          return res(
            ctx.status(0),
            ctx.set('Access-Control-Allow-Origin', 'http://other-domain.com')
          );
        })
      );

      try {
        await apiClient.get('/cors-error');
        fail('Should have thrown a CORS error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.NETWORK,
            }),
          })
        );
      }
    });

    it('should handle aborted requests', async () => {
      // Create AbortController
      const controller = new AbortController();
      
      // Setup request that will be aborted
      const request = apiClient.get('/api/long-request', {
        signal: controller.signal
      });
      
      // Abort immediately
      controller.abort();
      
      try {
        await request;
        fail('Should have thrown an abort error');
      } catch (error) {
        // Verify error handling
        expect(error.message).toContain('aborted');
        expect(handleError).toHaveBeenCalled();
      }
    });
  });

  describe('Service Unavailability Handling', () => {
    it('should handle backend service unavailability gracefully', async () => {
      // Setup MSW to simulate backend service being down
      server.use(
        rest.get('/api/segmentation/:id', (req, res, ctx) => {
          return res(ctx.status(503), ctx.json({ error: 'Service unavailable' }));
        })
      );

      try {
        await apiClient.get('/segmentation/123');
        fail('Should have thrown a service unavailable error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.SERVER,
              severity: ErrorSeverity.ERROR,
              message: expect.stringContaining('unavailable'),
            }),
          })
        );
      }
    });

    it('should handle database connection errors appropriately', async () => {
      // Setup MSW to simulate database connection error
      server.use(
        rest.get('/api/projects', (req, res, ctx) => {
          return res(
            ctx.status(500), 
            ctx.json({ 
              error: 'Database error',
              code: 'ECONNREFUSED',
              details: 'Could not connect to database'
            })
          );
        })
      );

      try {
        await apiClient.get('/projects');
        fail('Should have thrown a database error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.SERVER,
              severity: ErrorSeverity.ERROR,
            }),
          })
        );
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Database connection error'),
          expect.objectContaining({
            endpoint: expect.stringContaining('/projects'),
          })
        );
      }
    });
  });

  describe('Batch Request Error Handling', () => {
    it('should handle partial failures in batch requests', async () => {
      // Mock implementation of batch request handler
      const processBatchResults = (results) => {
        const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        const failures = results.filter(r => r.status === 'rejected').map(r => r.reason);
        
        if (failures.length > 0) {
          // Log failures but continue processing successful requests
          failures.forEach(error => {
            handleError(error, {
              context: 'Batch request partial failure',
              errorInfo: {
                type: ErrorType.API,
                severity: ErrorSeverity.WARNING,
                message: 'Some batch operations failed'
              }
            });
          });
        }
        
        return {
          successes,
          failures: failures.length,
          allSucceeded: failures.length === 0
        };
      };

      // Setup MSW to simulate mixed success/failure batch
      server.use(
        rest.get('/api/polygons/1', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json({ id: 1, points: [[0,0], [1,1], [0,1]] }));
        }),
        rest.get('/api/polygons/2', (req, res, ctx) => {
          return res(ctx.status(404), ctx.json({ error: 'Not found' }));
        }),
        rest.get('/api/polygons/3', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json({ id: 3, points: [[5,5], [6,6], [5,6]] }));
        })
      );

      // Simulate batch request
      const requests = [
        apiClient.get('/polygons/1').catch(error => error),
        apiClient.get('/polygons/2').catch(error => error),
        apiClient.get('/polygons/3').catch(error => error)
      ];
      
      const results = await Promise.allSettled(requests);
      const processed = processBatchResults(results);
      
      // Verify batch processing
      expect(processed.successes.length).toBe(2);
      expect(processed.failures).toBe(1);
      expect(processed.allSucceeded).toBe(false);
      expect(handleError).toHaveBeenCalledTimes(1);
    });
  });

  describe('File Upload Error Handling', () => {
    it('should handle file upload errors gracefully', async () => {
      // Setup MSW to simulate file upload error
      server.use(
        rest.post('/api/images/upload', (req, res, ctx) => {
          return res(ctx.status(413), ctx.json({ error: 'File too large' }));
        })
      );

      // Mock FormData
      const formData = new FormData();
      formData.append('file', new Blob(['test file content'], { type: 'image/png' }), 'test.png');

      try {
        await apiClient.post('/images/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        fail('Should have thrown a file upload error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.API,
              severity: ErrorSeverity.ERROR,
              message: expect.stringContaining('upload'),
            }),
          })
        );
      }
    });

    it('should handle corrupt file upload errors', async () => {
      // Setup MSW to simulate corrupt file error
      server.use(
        rest.post('/api/images/upload', (req, res, ctx) => {
          return res(
            ctx.status(400), 
            ctx.json({ 
              error: 'Invalid file format',
              details: 'Could not process image file, it may be corrupted'
            })
          );
        })
      );

      // Mock FormData
      const formData = new FormData();
      formData.append('file', new Blob(['corrupt content'], { type: 'image/png' }), 'corrupt.png');

      try {
        await apiClient.post('/images/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        fail('Should have thrown a file validation error');
      } catch (error) {
        // Verify error handling
        expect(handleError).toHaveBeenCalled();
        expect(handleError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.VALIDATION,
              severity: ErrorSeverity.WARNING,
              message: expect.stringContaining('Invalid file'),
            }),
          })
        );
      }
    });
  });

  describe('WebSocket Error Handling', () => {
    // Mock WebSocket
    let mockSocket;
    
    beforeEach(() => {
      // Create a mock WebSocket implementation
      global.WebSocket = class WebSocketMock extends EventTarget {
        constructor(url) {
          super();
          this.url = url;
          this.readyState = 0; // CONNECTING
          this.CONNECTING = 0;
          this.OPEN = 1;
          this.CLOSING = 2;
          this.CLOSED = 3;
          
          // Auto-connect after creation
          setTimeout(() => {
            this.readyState = 1; // OPEN
            this.dispatchEvent(new Event('open'));
          }, 10);
        }
        
        send(data) {
          // Mock send functionality
          if (this.readyState !== 1) {
            throw new Error('WebSocket is not open');
          }
        }
        
        close() {
          this.readyState = 3; // CLOSED
          this.dispatchEvent(new Event('close'));
        }
      };
      
      mockSocket = null;
    });
    
    afterEach(() => {
      // Clean up
      if (mockSocket) {
        mockSocket.close();
      }
      delete global.WebSocket;
    });
    
    it('should handle WebSocket connection failures', async () => {
      // Mock WebSocket connection failure
      global.WebSocket = class WebSocketMock extends EventTarget {
        constructor(url) {
          super();
          this.url = url;
          this.readyState = 0; // CONNECTING
          
          // Simulate connection failure
          setTimeout(() => {
            this.dispatchEvent(new ErrorEvent('error', { message: 'Connection failed' }));
            this.dispatchEvent(new Event('close'));
          }, 20);
        }
        
        send() {
          throw new Error('WebSocket is not open');
        }
        
        close() {
          // No-op for this test
        }
      };
      
      // Create connection handler with retry
      const createWebSocketConnection = (url, maxRetries = 3) => {
        return new Promise((resolve, reject) => {
          let retries = 0;
          let socket;
          
          const connect = () => {
            socket = new WebSocket(url);
            
            socket.addEventListener('open', () => {
              resolve(socket);
            });
            
            socket.addEventListener('error', (event) => {
              logger.error('WebSocket connection error', { url, attempt: retries + 1 });
              
              if (retries < maxRetries) {
                retries++;
                logger.warn(`Retrying WebSocket connection (${retries}/${maxRetries})`, { url });
                setTimeout(connect, 50); // Wait before retrying
              } else {
                const error = new NetworkError('WebSocket connection failed after maximum retries');
                handleError(error, {
                  context: 'WebSocket connection',
                  errorInfo: {
                    type: ErrorType.WEBSOCKET,
                    severity: ErrorSeverity.ERROR,
                    message: 'Could not establish real-time connection to server',
                  }
                });
                reject(error);
              }
            });
          };
          
          connect();
        });
      };
      
      // Test connection with retries
      try {
        await createWebSocketConnection('wss://api.example.com/ws');
        fail('Should have thrown a WebSocket connection error');
      } catch (error) {
        // Verify error handling
        expect(error.message).toContain('WebSocket connection failed');
        expect(logger.error).toHaveBeenCalledWith(
          'WebSocket connection error',
          expect.any(Object)
        );
        expect(logger.warn).toHaveBeenCalledTimes(3); // 3 retry attempts
        expect(handleError).toHaveBeenCalledWith(
          expect.any(NetworkError),
          expect.objectContaining({
            errorInfo: expect.objectContaining({
              type: ErrorType.WEBSOCKET,
              severity: ErrorSeverity.ERROR,
            }),
          })
        );
      }
    });
    
    it('should handle WebSocket message errors', async () => {
      // Setup a working WebSocket mock that allows us to trigger errors
      let socket;
      
      // Promise that resolves when socket is open
      const socketOpen = new Promise((resolve) => {
        socket = new WebSocket('wss://api.example.com/ws');
        socket.addEventListener('open', () => resolve(socket));
      });
      
      // Wait for socket to open
      await socketOpen;
      
      // Set up message handler with error handling
      const setupMessageHandler = (socket) => {
        socket.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            return data;
          } catch (error) {
            handleError(error, {
              context: 'WebSocket message parsing',
              errorInfo: {
                type: ErrorType.DATA,
                severity: ErrorSeverity.WARNING,
                message: 'Received invalid message format',
              }
            });
          }
        });
      };
      
      // Set up handler
      setupMessageHandler(socket);
      
      // Simulate receiving invalid JSON
      const messageEvent = new MessageEvent('message', {
        data: '{invalid json]',
      });
      socket.dispatchEvent(messageEvent);
      
      // Verify error handling
      expect(handleError).toHaveBeenCalled();
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorInfo: expect.objectContaining({
            type: ErrorType.DATA,
            severity: ErrorSeverity.WARNING,
            message: 'Received invalid message format',
          }),
        })
      );
    });
  });
});