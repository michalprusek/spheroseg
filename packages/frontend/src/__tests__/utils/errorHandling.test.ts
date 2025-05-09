import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import { 
  getErrorType, 
  getErrorSeverity, 
  getErrorMessage, 
  getErrorCode, 
  getErrorDetails,
  createErrorInfo,
  handleError,
  ErrorType,
  ErrorSeverity,
  AppError,
  NetworkError,
  ValidationError
} from '@/utils/errorHandling';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}));

// Create mock for logger
vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('Error Handling Utilities', () => {
  let logger: any;
  
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

      const serverError = new AxiosError('Server Error');
      serverError.response = { status: 500 } as any;
      expect(getErrorType(serverError)).toBe(ErrorType.SERVER);
    });

    it('should identify client errors', () => {
      const typeError = new TypeError('Invalid type');
      expect(getErrorType(typeError)).toBe(ErrorType.CLIENT);

      const syntaxError = new SyntaxError('Invalid syntax');
      expect(getErrorType(syntaxError)).toBe(ErrorType.CLIENT);
    });

    it('should return UNKNOWN for unrecognized errors', () => {
      expect(getErrorType({})).toBe(ErrorType.UNKNOWN);
      expect(getErrorType(null)).toBe(ErrorType.UNKNOWN);
      expect(getErrorType(undefined)).toBe(ErrorType.UNKNOWN);
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

    it('should default to ERROR for unrecognized errors', () => {
      expect(getErrorSeverity({})).toBe(ErrorSeverity.ERROR);
      expect(getErrorSeverity(null)).toBe(ErrorSeverity.ERROR);
      expect(getErrorSeverity(undefined)).toBe(ErrorSeverity.ERROR);
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

    it('should use statusText if no message in response data', () => {
      const axiosError = new AxiosError('Error message');
      axiosError.response = {
        data: {},
        status: 400,
        statusText: 'Bad Request',
      } as any;
      expect(getErrorMessage(axiosError)).toBe('Bad Request');
    });

    it('should use default message based on error type if no other message available', () => {
      const axiosError = new AxiosError('Network Error');
      axiosError.code = 'ERR_NETWORK';
      expect(getErrorMessage(axiosError)).toContain('Network error');
    });

    it('should use fallback message if provided and no other message available', () => {
      expect(getErrorMessage({}, 'Fallback message')).toBe('Fallback message');
    });
  });

  describe('createErrorInfo', () => {
    it('should create a structured error info object', () => {
      const error = new Error('Test error');
      const info = createErrorInfo(error);
      
      expect(info).toEqual(expect.objectContaining({
        type: expect.any(String),
        severity: expect.any(String),
        message: 'Test error',
        originalError: error,
        handled: false,
      }));
    });

    it('should override defaults with provided options', () => {
      const error = new Error('Test error');
      const info = createErrorInfo(error, {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'Custom message',
        code: 'CUSTOM_CODE',
        details: { field: 'test' },
        handled: true,
      });
      
      expect(info).toEqual({
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'Custom message',
        code: 'CUSTOM_CODE',
        details: { field: 'test' },
        originalError: error,
        handled: true,
      });
    });
  });

  describe('handleError', () => {
    beforeEach(async () => {
      // Get the mocked logger
      const loggerModule = await import('@/utils/logger');
      logger = loggerModule.default;
    });
    
    it('should log the error and show toast based on severity', () => {
      const error = new Error('Test error');
      handleError(error);
      
      expect(logger.error).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Test error');
    });

    it('should not show toast if showToast is false', () => {
      const error = new Error('Test error');
      handleError(error, { showToast: false });
      
      expect(logger.error).toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should not log if logError is false', () => {
      const error = new Error('Test error');
      handleError(error, { logError: false });
      
      expect(logger.error).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('should use warning toast for warnings', () => {
      const error = new Error('Warning');
      handleError(error, {
        errorInfo: {
          severity: ErrorSeverity.WARNING,
        },
      });
      
      expect(toast.warning).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should use info toast for info severity', () => {
      const error = new Error('Info');
      handleError(error, {
        errorInfo: {
          severity: ErrorSeverity.INFO,
        },
      });
      
      expect(toast.info).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
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