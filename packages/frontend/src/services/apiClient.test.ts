import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './apiClient';
import { server } from '@/test-utils/mocks';
import { rest } from 'msw';
import { testApiResponses } from '@/test-utils/fixtures';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('request methods', () => {
    it('makes GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          return res(ctx.json(testApiResponses.success(mockData)));
        })
      );

      const response = await apiClient.get('/test');
      
      expect(response.data).toEqual(mockData);
      expect(response.success).toBe(true);
    });

    it('makes POST request with data', async () => {
      const requestData = { name: 'New Item' };
      const responseData = { id: 1, ...requestData };
      
      server.use(
        rest.post('/api/test', async (req, res, ctx) => {
          const body = await req.json();
          expect(body).toEqual(requestData);
          return res(ctx.json(testApiResponses.success(responseData)));
        })
      );

      const response = await apiClient.post('/test', requestData);
      
      expect(response.data).toEqual(responseData);
    });

    it('makes PUT request', async () => {
      const updateData = { name: 'Updated' };
      
      server.use(
        rest.put('/api/test/1', async (req, res, ctx) => {
          const body = await req.json();
          expect(body).toEqual(updateData);
          return res(ctx.json(testApiResponses.success({ id: 1, ...updateData })));
        })
      );

      const response = await apiClient.put('/test/1', updateData);
      
      expect(response.data.name).toBe('Updated');
    });

    it('makes PATCH request', async () => {
      const patchData = { status: 'active' };
      
      server.use(
        rest.patch('/api/test/1', async (req, res, ctx) => {
          const body = await req.json();
          expect(body).toEqual(patchData);
          return res(ctx.json(testApiResponses.success({ id: 1, ...patchData })));
        })
      );

      const response = await apiClient.patch('/test/1', patchData);
      
      expect(response.data.status).toBe('active');
    });

    it('makes DELETE request', async () => {
      server.use(
        rest.delete('/api/test/1', (req, res, ctx) => {
          return res(ctx.json(testApiResponses.success({ message: 'Deleted' })));
        })
      );

      const response = await apiClient.delete('/test/1');
      
      expect(response.data.message).toBe('Deleted');
    });
  });

  describe('authentication', () => {
    it('includes auth token in requests', async () => {
      const token = 'test-token-123';
      localStorage.setItem('token', token);

      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          expect(req.headers.get('Authorization')).toBe(`Bearer ${token}`);
          return res(ctx.json(testApiResponses.success({})));
        })
      );

      await apiClient.get('/test');
    });

    it('does not include auth header when no token', async () => {
      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          expect(req.headers.get('Authorization')).toBeNull();
          return res(ctx.json(testApiResponses.success({})));
        })
      );

      await apiClient.get('/test');
    });

    it('refreshes token on 401 response', async () => {
      let requestCount = 0;
      const oldToken = 'old-token';
      const newToken = 'new-token';
      
      localStorage.setItem('token', oldToken);
      localStorage.setItem('refreshToken', 'refresh-token');

      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          requestCount++;
          if (requestCount === 1) {
            // First request returns 401
            return res(ctx.status(401));
          }
          // Retry with new token
          expect(req.headers.get('Authorization')).toBe(`Bearer ${newToken}`);
          return res(ctx.json(testApiResponses.success({ data: 'success' })));
        }),
        rest.post('/api/auth/refresh', (req, res, ctx) => {
          return res(ctx.json({
            token: newToken,
            refreshToken: 'new-refresh-token',
          }));
        })
      );

      const response = await apiClient.get('/test');
      
      expect(response.data.data).toBe('success');
      expect(localStorage.getItem('token')).toBe(newToken);
      expect(requestCount).toBe(2); // Original + retry
    });

    it('clears auth on refresh failure', async () => {
      localStorage.setItem('token', 'expired-token');
      localStorage.setItem('refreshToken', 'invalid-refresh-token');

      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          return res(ctx.status(401));
        }),
        rest.post('/api/auth/refresh', (req, res, ctx) => {
          return res(ctx.status(401));
        })
      );

      await expect(apiClient.get('/test')).rejects.toThrow('Unauthorized');
      
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('throws on 4xx errors', async () => {
      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              error: 'Bad Request',
              message: 'Invalid parameters',
            })
          );
        })
      );

      await expect(apiClient.get('/test')).rejects.toThrow('Invalid parameters');
    });

    it('throws on 5xx errors', async () => {
      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              error: 'Internal Server Error',
            })
          );
        })
      );

      await expect(apiClient.get('/test')).rejects.toThrow('Internal Server Error');
    });

    it('handles network errors', async () => {
      server.use(
        rest.get('/api/test', (req, res) => {
          return res.networkError('Network failure');
        })
      );

      await expect(apiClient.get('/test')).rejects.toThrow(/network/i);
    });

    it('handles timeout', async () => {
      vi.useFakeTimers();

      server.use(
        rest.get('/api/test', async (req, res, ctx) => {
          await new Promise(() => {}); // Never resolves
        })
      );

      const promise = apiClient.get('/test', { timeout: 1000 });
      
      vi.advanceTimersByTime(1100);
      
      await expect(promise).rejects.toThrow(/timeout/i);
      
      vi.useRealTimers();
    });
  });

  describe('request configuration', () => {
    it('adds custom headers', async () => {
      const customHeaders = {
        'X-Custom-Header': 'custom-value',
        'X-Another-Header': 'another-value',
      };

      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          Object.entries(customHeaders).forEach(([key, value]) => {
            expect(req.headers.get(key)).toBe(value);
          });
          return res(ctx.json(testApiResponses.success({})));
        })
      );

      await apiClient.get('/test', { headers: customHeaders });
    });

    it('handles query parameters', async () => {
      const params = {
        page: 2,
        limit: 20,
        search: 'test query',
      };

      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          expect(req.url.searchParams.get('page')).toBe('2');
          expect(req.url.searchParams.get('limit')).toBe('20');
          expect(req.url.searchParams.get('search')).toBe('test query');
          return res(ctx.json(testApiResponses.success({})));
        })
      );

      await apiClient.get('/test', { params });
    });

    it('handles FormData for file uploads', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', 'Test File');

      server.use(
        rest.post('/api/upload', async (req, res, ctx) => {
          const body = await req.body;
          expect(body).toBeInstanceOf(FormData);
          return res(ctx.json(testApiResponses.success({ uploaded: true })));
        })
      );

      const response = await apiClient.post('/upload', formData);
      
      expect(response.data.uploaded).toBe(true);
    });
  });

  describe('interceptors', () => {
    it('applies request interceptor', async () => {
      const requestInterceptor = vi.fn((config) => {
        config.headers['X-Intercepted'] = 'true';
        return config;
      });

      apiClient.interceptors.request.use(requestInterceptor);

      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          expect(req.headers.get('X-Intercepted')).toBe('true');
          return res(ctx.json(testApiResponses.success({})));
        })
      );

      await apiClient.get('/test');
      
      expect(requestInterceptor).toHaveBeenCalled();
    });

    it('applies response interceptor', async () => {
      const responseInterceptor = vi.fn((response) => {
        response.intercepted = true;
        return response;
      });

      apiClient.interceptors.response.use(responseInterceptor);

      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          return res(ctx.json(testApiResponses.success({ data: 'test' })));
        })
      );

      const response = await apiClient.get('/test');
      
      expect(responseInterceptor).toHaveBeenCalled();
      expect(response.intercepted).toBe(true);
    });

    it('handles errors in interceptors', async () => {
      const errorInterceptor = vi.fn((error) => {
        error.intercepted = true;
        throw error;
      });

      apiClient.interceptors.response.use(null, errorInterceptor);

      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          return res(ctx.status(500));
        })
      );

      try {
        await apiClient.get('/test');
      } catch (error: any) {
        expect(errorInterceptor).toHaveBeenCalled();
        expect(error.intercepted).toBe(true);
      }
    });
  });

  describe('retry logic', () => {
    it('retries failed requests', async () => {
      let attemptCount = 0;
      
      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          attemptCount++;
          if (attemptCount < 3) {
            return res(ctx.status(503)); // Service unavailable
          }
          return res(ctx.json(testApiResponses.success({ attempts: attemptCount })));
        })
      );

      const response = await apiClient.get('/test', { retry: 3 });
      
      expect(response.data.attempts).toBe(3);
    });

    it('fails after max retries', async () => {
      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          return res(ctx.status(503));
        })
      );

      await expect(apiClient.get('/test', { retry: 2 })).rejects.toThrow();
    });
  });

  describe('caching', () => {
    it('caches GET requests', async () => {
      let callCount = 0;
      
      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          callCount++;
          return res(ctx.json(testApiResponses.success({ callCount })));
        })
      );

      const response1 = await apiClient.get('/test', { cache: true });
      const response2 = await apiClient.get('/test', { cache: true });
      
      expect(response1.data.callCount).toBe(1);
      expect(response2.data.callCount).toBe(1); // Cached
      expect(callCount).toBe(1);
    });

    it('bypasses cache with force flag', async () => {
      let callCount = 0;
      
      server.use(
        rest.get('/api/test', (req, res, ctx) => {
          callCount++;
          return res(ctx.json(testApiResponses.success({ callCount })));
        })
      );

      await apiClient.get('/test', { cache: true });
      const response2 = await apiClient.get('/test', { cache: false });
      
      expect(response2.data.callCount).toBe(2);
      expect(callCount).toBe(2);
    });
  });
});