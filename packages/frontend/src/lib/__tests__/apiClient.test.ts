import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import type { AxiosResponse, InternalAxiosRequestConfig, AxiosError } from 'axios';

// Mock all dependencies before imports
vi.mock('@/utils/error/unifiedErrorHandler', () => ({
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

vi.mock('@/utils/error/permissionErrorHandler', () => ({
  handlePermissionError: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/authService', () => ({
  getAccessToken: vi.fn(),
  removeTokens: vi.fn(),
  isValidToken: vi.fn(),
}));

vi.mock('@/config', () => ({
  default: {
    apiUrl: 'http://localhost:5001',
    apiBaseUrl: '/api',
  },
}));

// Create mock axios instance
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

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn((error: any) => error && error.isAxiosError === true),
  },
}));

// Import modules after mocks
import { handleError, ErrorType, ErrorSeverity } from '@/utils/error/unifiedErrorHandler';
import { handlePermissionError } from '@/utils/error/permissionErrorHandler';
import logger from '@/utils/logger';
import { getAccessToken, removeTokens } from '@/services/authService';
import axios from 'axios';
import apiClient from '../apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Axios instance creation', () => {
    it('should create an axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.any(String),
          timeout: expect.any(Number),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('Request interceptor', () => {
    let requestInterceptor: any;

    beforeEach(() => {
      requestInterceptor = mockAxiosInstance._requestInterceptor;
    });

    it('should add authorization header if token exists', async () => {
      const mockToken = 'test-token';
      const mockConfig: InternalAxiosRequestConfig = {
        headers: {} as any,
        url: '/test',
        method: 'get',
      };

      vi.mocked(getAccessToken).mockReturnValue(mockToken);

      const result = await requestInterceptor.onFulfilled(mockConfig);

      expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should not add authorization header if token does not exist', async () => {
      const mockConfig: InternalAxiosRequestConfig = {
        headers: {} as any,
        url: '/test',
        method: 'get',
      };

      vi.mocked(getAccessToken).mockReturnValue(null);

      const result = await requestInterceptor.onFulfilled(mockConfig);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should add request ID header', async () => {
      const mockConfig: InternalAxiosRequestConfig = {
        headers: {} as any,
        url: '/test',
        method: 'get',
      };

      const result = await requestInterceptor.onFulfilled(mockConfig);

      expect(result.headers['X-Request-ID']).toBeDefined();
      expect(typeof result.headers['X-Request-ID']).toBe('string');
    });

    it('should log debug information in non-production environment', async () => {
      const mockConfig: InternalAxiosRequestConfig = {
        headers: {} as any,
        url: '/test',
        method: 'get',
      };

      await requestInterceptor.onFulfilled(mockConfig);

      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle request setup errors', async () => {
      const mockError = new Error('Request setup error');

      await expect(requestInterceptor.onRejected(mockError)).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith('[apiClient] Request error:', mockError);
    });
  });

  describe('Response interceptor', () => {
    let responseInterceptor: any;

    beforeEach(() => {
      responseInterceptor = mockAxiosInstance._responseInterceptor;
    });

    it('should return response directly for successful requests', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      };

      const result = await responseInterceptor.onFulfilled(mockResponse);

      expect(result).toBe(mockResponse);
    });

    it('should log debug information for successful responses in development', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { 
          url: '/test',
          headers: { 'X-Request-ID': 'test-id' } as any,
        } as InternalAxiosRequestConfig,
      };

      await responseInterceptor.onFulfilled(mockResponse);

      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle authentication errors (401)', async () => {
      const mockError: Partial<AxiosError> = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
          statusText: 'Unauthorized',
          headers: {},
          config: {} as InternalAxiosRequestConfig,
        },
        config: {} as InternalAxiosRequestConfig,
        isAxiosError: true,
      };

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(responseInterceptor.onRejected(mockError)).rejects.toThrow();
      
      expect(removeTokens).toHaveBeenCalled();
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.AUTHENTICATION,
          severity: ErrorSeverity.WARNING,
        })
      );
    });

    it('should handle forbidden errors (403)', async () => {
      const mockError: Partial<AxiosError> = {
        response: {
          status: 403,
          data: { message: 'Forbidden' },
          statusText: 'Forbidden',
          headers: {},
          config: {} as InternalAxiosRequestConfig,
        },
        config: {} as InternalAxiosRequestConfig,
        isAxiosError: true,
      };

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(responseInterceptor.onRejected(mockError)).rejects.toThrow();
      
      expect(handlePermissionError).toHaveBeenCalledWith(mockError);
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.AUTHORIZATION,
          severity: ErrorSeverity.WARNING,
        })
      );
    });

    it('should handle not found errors (404)', async () => {
      const mockError: Partial<AxiosError> = {
        response: {
          status: 404,
          data: { message: 'Not found' },
          statusText: 'Not Found',
          headers: {},
          config: {} as InternalAxiosRequestConfig,
        },
        config: {} as InternalAxiosRequestConfig,
        isAxiosError: true,
      };

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(responseInterceptor.onRejected(mockError)).rejects.toThrow();
      
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NOT_FOUND,
          severity: ErrorSeverity.WARNING,
        })
      );
    });

    it('should handle server errors (5xx)', async () => {
      const mockError: Partial<AxiosError> = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as InternalAxiosRequestConfig,
        },
        config: {} as InternalAxiosRequestConfig,
        isAxiosError: true,
      };

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(responseInterceptor.onRejected(mockError)).rejects.toThrow();
      
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.SERVER,
          severity: ErrorSeverity.ERROR,
        })
      );
    });

    it('should handle network errors', async () => {
      const mockError: Partial<AxiosError> = {
        message: 'Network Error',
        config: {} as InternalAxiosRequestConfig,
        isAxiosError: true,
      };

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(responseInterceptor.onRejected(mockError)).rejects.toThrow();
      
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.ERROR,
        })
      );
    });

    it('should handle other errors', async () => {
      const mockError = new Error('Unknown error');

      vi.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(responseInterceptor.onRejected(mockError)).rejects.toThrow();
      
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.UNKNOWN,
          severity: ErrorSeverity.ERROR,
        })
      );
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