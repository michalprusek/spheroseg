import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import { 
  getErrorType, 
  getErrorSeverity, 
  getErrorMessage, 
  createErrorInfo,
  ErrorType,
  ErrorSeverity,
  AppError,
  NetworkError,
  ValidationError
} from '@/utils/errorHandling';

// Mock dependencies
vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('Error Handling Utilities - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getErrorType', () => {
    it('should identify network errors', () => {
      // Create a network error with a message that includes 'network'
      const networkError = new Error('Network connection error');
      expect(getErrorType(networkError)).toBe(ErrorType.NETWORK);

      const axiosNetworkError = new AxiosError('Network Error');
      axiosNetworkError.code = 'ERR_NETWORK';
      expect(getErrorType(axiosNetworkError)).toBe(ErrorType.NETWORK);
    });

    it('should identify API errors based on status code', () => {
      const unauthorizedError = new AxiosError('Unauthorized');
      unauthorizedError.response = { status: 401 } as any;
      expect(getErrorType(unauthorizedError)).toBe(ErrorType.AUTHENTICATION);

      const notFoundError = new AxiosError('Not Found');
      notFoundError.response = { status: 404 } as any;
      expect(getErrorType(notFoundError)).toBe(ErrorType.NOT_FOUND);
    });
  });

  describe('getErrorSeverity', () => {
    it('should determine severity based on error type', () => {
      const unauthorizedError = new AxiosError('Unauthorized');
      unauthorizedError.response = { status: 401 } as any;
      expect(getErrorSeverity(unauthorizedError)).toBe(ErrorSeverity.WARNING);

      const serverError = new AxiosError('Server Error');
      serverError.response = { status: 500 } as any;
      expect(getErrorSeverity(serverError)).toBe(ErrorSeverity.ERROR);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error objects', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should extract message from AxiosError response data', () => {
      const axiosError = new AxiosError('Error message');
      axiosError.response = {
        data: { message: 'Response error message' },
        status: 400,
        statusText: 'Bad Request',
      } as any;
      expect(getErrorMessage(axiosError)).toBe('Response error message');
    });
  });

  describe('Custom Error Classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Generic app error');
      
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('AppError');
      expect(error.message).toBe('Generic app error');
      expect(error.type).toBe(ErrorType.UNKNOWN);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
    });

    it('should create NetworkError with correct properties', () => {
      const error = new NetworkError('Network connection failed');
      
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Network connection failed');
      expect(error.type).toBe(ErrorType.NETWORK);
    });

    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid input', {
        details: { field: 'email', message: 'Invalid email format' },
      });
      
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.details).toEqual({ field: 'email', message: 'Invalid email format' });
    });
  });
});