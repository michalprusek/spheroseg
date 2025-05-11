import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import apiClient from '../apiClient';
import { handleError, ErrorType, ErrorSeverity } from '@/utils/errorHandling';
import logger from '@/utils/logger';

// Mock dependencies
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxiosInstance),
    defaults: {
      headers: {
        common: {},
      },
    },
    isAxiosError: vi.fn((error) => error instanceof Error && error.name === 'AxiosError'),
  };

  const mockAxiosInstance = {
    interceptors: {
      request: {
        use: vi.fn((onFulfilled, onRejected) => {
          mockAxiosInstance._requestInterceptor = { onFulfilled, onRejected };
          return 1;
        }),
        eject: vi.fn(),
      },
      response: {
        use: vi.fn((onFulfilled, onRejected) => {
          mockAxiosInstance._responseInterceptor = { onFulfilled, onRejected };
          return 1;
        }),
        eject: vi.fn(),
      },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    _requestInterceptor: null as any,
    _responseInterceptor: null as any,
  };

  return mockAxios;
});

vi.mock('@/utils/errorHandling', () => ({
  handleError: vi.fn(),
  ErrorType: {
    NETWORK: 'network',
    API: 'api',
    VALIDATION: 'validation',
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    NOT_FOUND: 'not_found',
    SERVER: 'server',
    CLIENT: 'client',
    UNKNOWN: 'unknown',
  },
  ErrorSeverity: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
  },
}));

vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('apiClient', () => {
  // Mock localStorage
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock = {};

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => localStorageMock[key] || null),
        setItem: vi.fn((key, value) => {
          localStorageMock[key] = value.toString();
        }),
        removeItem: vi.fn((key) => delete localStorageMock[key]),
        clear: vi.fn(() => (localStorageMock = {})),
      },
      writable: true,
    });

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: '',
      },
      writable: true,
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Axios instance creation', () => {
    it('should create an axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: '/api',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      });
    });
  });

  describe('Request interceptor', () => {
    it('should add authorization header if token exists', () => {
      // Setup
      const mockConfig: InternalAxiosRequestConfig = {
        headers: {},
        method: 'get',
        url: '/test',
      } as any;

      // Add token to localStorage
      localStorageMock['authToken'] = 'test-token';

      // Get the request interceptor
      const { onFulfilled } = (apiClient as any)._requestInterceptor;

      // Execute the interceptor
      const result = onFulfilled(mockConfig);

      // Verify
      expect(result.headers.Authorization).toBe('Bearer test-token');
      expect(result.headers['X-Request-ID']).toBeDefined();
      expect(typeof result.headers['X-Request-ID']).toBe('string');
    });

    it('should not add authorization header if token does not exist', () => {
      // Setup
      const mockConfig: InternalAxiosRequestConfig = {
        headers: {},
        method: 'get',
        url: '/test',
      } as any;

      // Get the request interceptor
      const { onFulfilled } = (apiClient as any)._requestInterceptor;

      // Execute the interceptor
      const result = onFulfilled(mockConfig);

      // Verify
      expect(result.headers.Authorization).toBeUndefined();
      expect(result.headers['X-Request-ID']).toBeDefined();
    });

    it('should add request ID header', () => {
      // Setup
      const mockConfig: InternalAxiosRequestConfig = {
        headers: {},
        method: 'get',
        url: '/test',
      } as any;

      // Get the request interceptor
      const { onFulfilled } = (apiClient as any)._requestInterceptor;

      // Execute the interceptor
      const result = onFulfilled(mockConfig);

      // Verify
      expect(result.headers['X-Request-ID']).toBeDefined();
      expect(typeof result.headers['X-Request-ID']).toBe('string');
      expect(result.headers['X-Request-ID']).toMatch(/^req-\d+-[a-z0-9]+$/);
    });

    it('should log debug information in non-production environment', () => {
      // Setup
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockConfig: InternalAxiosRequestConfig = {
        headers: {},
        method: 'get',
        url: '/test',
        params: { id: '123' },
      } as any;

      // Get the request interceptor
      const { onFulfilled } = (apiClient as any)._requestInterceptor;

      // Execute the interceptor
      onFulfilled(mockConfig);

      // Verify
      expect(logger.debug).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('API Request: GET /test'),
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          params: { id: '123' },
        }),
      );

      // Restore environment
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle request setup errors', () => {
      // Setup
      const mockError = new Error('Request setup error');

      // Get the request interceptor
      const { onRejected } = (apiClient as any)._requestInterceptor;

      // Execute the interceptor
      let caughtError;
      try {
        onRejected(mockError);
      } catch (error) {
        caughtError = error;
      }

      // Verify
      expect(handleError).toHaveBeenCalledWith(mockError, {
        context: 'API Request Setup',
        errorInfo: {
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.ERROR,
          message: 'Failed to set up API request',
        },
        showToast: false,
      });

      expect(caughtError).toBe(mockError);
    });
  });

  describe('Response interceptor', () => {
    it('should return response directly for successful requests', () => {
      // Setup
      const mockResponse: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
        config: {
          headers: { 'X-Request-ID': 'req-123' },
          method: 'get',
          url: '/test',
        } as any,
      } as any;

      // Get the response interceptor
      const { onFulfilled } = (apiClient as any)._responseInterceptor;

      // Execute the interceptor
      const result = onFulfilled(mockResponse);

      // Verify
      expect(result).toBe(mockResponse);
    });

    it('should log debug information for successful responses in development', () => {
      // Setup
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockResponse: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
        config: {
          headers: { 'X-Request-ID': 'req-123' },
          method: 'get',
          url: '/test',
        } as any,
      } as any;

      // Get the response interceptor
      const { onFulfilled } = (apiClient as any)._responseInterceptor;

      // Execute the interceptor
      onFulfilled(mockResponse);

      // Verify
      expect(logger.debug).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('API Response: 200 GET /test'),
        expect.objectContaining({
          requestId: 'req-123',
          status: 200,
          method: 'GET',
          url: '/test',
        }),
      );

      // Restore environment
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle authentication errors (401)', async () => {
      // Setup
      const mockAxiosError = {
        message: 'Request failed with status code 401',
        name: 'AxiosError',
        code: 'ERR_BAD_REQUEST',
        config: {
          headers: { 'X-Request-ID': 'req-123' },
          method: 'get',
          url: '/test',
        } as any,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Unauthorized' },
        },
      } as any;

      // Get the response interceptor
      const { onRejected } = (apiClient as any)._responseInterceptor;

      // Execute the interceptor
      try {
        await onRejected(mockAxiosError);
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to throw
        expect(error).toBe(mockAxiosError);
      }

      // Verify
      expect(localStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(handleError).toHaveBeenCalledWith(mockAxiosError, {
        context: 'API GET /test',
        errorInfo: {
          type: ErrorType.AUTHENTICATION,
          severity: ErrorSeverity.WARNING,
          message: 'Your session has expired. Please sign in again.',
        },
        showToast: true,
      });

      // Fast-forward timers
      vi.advanceTimersByTime(2000);

      // Verify redirect
      expect(window.location.href).toBe('/sign-in');
    });

    it('should handle forbidden errors (403)', async () => {
      // Setup
      const mockAxiosError = {
        message: 'Request failed with status code 403',
        name: 'AxiosError',
        code: 'ERR_BAD_REQUEST',
        config: {
          headers: { 'X-Request-ID': 'req-123' },
          method: 'get',
          url: '/test',
        } as any,
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: { message: 'Forbidden' },
        },
      } as any;

      // Get the response interceptor
      const { onRejected } = (apiClient as any)._responseInterceptor;

      // Execute the interceptor
      try {
        await onRejected(mockAxiosError);
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to throw
        expect(error).toBe(mockAxiosError);
      }

      // Verify
      expect(handleError).toHaveBeenCalledWith(mockAxiosError, {
        context: 'API GET /test',
        errorInfo: {
          type: ErrorType.AUTHORIZATION,
          severity: ErrorSeverity.WARNING,
          message: 'You do not have permission to perform this action.',
        },
        showToast: true,
      });
    });

    it('should handle not found errors (404)', async () => {
      // Setup
      const mockAxiosError = {
        message: 'Request failed with status code 404',
        name: 'AxiosError',
        code: 'ERR_BAD_REQUEST',
        config: {
          headers: { 'X-Request-ID': 'req-123' },
          method: 'get',
          url: '/test',
        } as any,
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: 'Not Found' },
        },
      } as any;

      // Get the response interceptor
      const { onRejected } = (apiClient as any)._responseInterceptor;

      // Execute the interceptor
      try {
        await onRejected(mockAxiosError);
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to throw
        expect(error).toBe(mockAxiosError);
      }

      // Verify
      expect(handleError).toHaveBeenCalledWith(mockAxiosError, {
        context: 'API GET /test',
        errorInfo: {
          type: ErrorType.NOT_FOUND,
          severity: ErrorSeverity.WARNING,
          message: 'The requested resource was not found.',
        },
        showToast: false,
      });
    });

    it('should handle server errors (5xx)', async () => {
      // Setup
      const mockAxiosError = {
        message: 'Request failed with status code 500',
        name: 'AxiosError',
        code: 'ERR_BAD_REQUEST',
        config: {
          headers: { 'X-Request-ID': 'req-123' },
          method: 'get',
          url: '/test',
        } as any,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { message: 'Internal Server Error' },
        },
      } as any;

      // Get the response interceptor
      const { onRejected } = (apiClient as any)._responseInterceptor;

      // Execute the interceptor
      try {
        await onRejected(mockAxiosError);
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to throw
        expect(error).toBe(mockAxiosError);
      }

      // Verify
      expect(handleError).toHaveBeenCalledWith(mockAxiosError, {
        context: 'API GET /test',
        errorInfo: {
          type: ErrorType.SERVER,
          severity: ErrorSeverity.ERROR,
          message: 'Server error. Please try again later.',
        },
        showToast: true,
      });
    });

    it('should handle network errors', async () => {
      // Setup
      const mockAxiosError = {
        message: 'Network Error',
        name: 'AxiosError',
        code: 'ERR_NETWORK',
        config: {
          headers: { 'X-Request-ID': 'req-123' },
          method: 'get',
          url: '/test',
        } as any,
        response: undefined,
      } as any;

      // Get the response interceptor
      const { onRejected } = (apiClient as any)._responseInterceptor;

      // Execute the interceptor
      try {
        await onRejected(mockAxiosError);
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to throw
        expect(error).toBe(mockAxiosError);
      }

      // Verify
      expect(handleError).toHaveBeenCalledWith(mockAxiosError, {
        context: 'API GET /test',
        errorInfo: {
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.ERROR,
          message: 'Network error. Please check your connection.',
        },
        showToast: true,
      });
    });

    it('should handle other errors', async () => {
      // Setup
      const mockAxiosError = {
        message: 'Bad Request',
        name: 'AxiosError',
        code: 'ERR_BAD_REQUEST',
        config: {
          headers: { 'X-Request-ID': 'req-123' },
          method: 'get',
          url: '/test',
        } as any,
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Bad Request' },
        },
      } as any;

      // Get the response interceptor
      const { onRejected } = (apiClient as any)._responseInterceptor;

      // Execute the interceptor
      try {
        await onRejected(mockAxiosError);
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to throw
        expect(error).toBe(mockAxiosError);
      }

      // Verify
      expect(handleError).toHaveBeenCalledWith(mockAxiosError, {
        context: 'API GET /test',
        errorInfo: {
          type: ErrorType.API,
          severity: ErrorSeverity.ERROR,
        },
        showToast: false,
      });
    });
  });

  describe('API methods', () => {
    it('should expose HTTP methods', () => {
      expect(apiClient.get).toBeDefined();
      expect(apiClient.post).toBeDefined();
      expect(apiClient.put).toBeDefined();
      expect(apiClient.delete).toBeDefined();
      expect(apiClient.patch).toBeDefined();
    });
  });
});
