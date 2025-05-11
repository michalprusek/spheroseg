import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import {
  ErrorType,
  ErrorSeverity,
  getErrorType,
  getErrorSeverity,
  getErrorMessage,
  getErrorCode,
  getErrorDetails,
  createErrorInfo,
  handleError,
  AppError,
  NetworkError,
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ServerError,
} from '../errorHandling';
import logger from '../logger';
import { AxiosError } from 'axios';

// Mock dependencies
vi.mock('../logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('axios', () => ({
  AxiosError: class AxiosError extends Error {
    config: any;
    code: string;
    response?: any;
    isAxiosError: boolean;

    constructor(message: string, code: string, config: any, response?: any) {
      super(message);
      this.name = 'AxiosError';
      this.code = code;
      this.config = config;
      this.response = response;
      this.isAxiosError = true;
    }
  },
}));

describe('errorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getErrorType', () => {
    it('should identify network errors from AxiosError', () => {
      const error = new AxiosError('Network Error', 'ECONNABORTED', {
        url: '/test',
      });
      expect(getErrorType(error)).toBe(ErrorType.NETWORK);
    });

    it('should identify error types from HTTP status codes', () => {
      const error401 = new AxiosError('Unauthorized', 'ERR_BAD_RESPONSE', { url: '/test' }, { status: 401 });
      expect(getErrorType(error401)).toBe(ErrorType.AUTHENTICATION);

      const error403 = new AxiosError('Forbidden', 'ERR_BAD_RESPONSE', { url: '/test' }, { status: 403 });
      expect(getErrorType(error403)).toBe(ErrorType.AUTHORIZATION);

      const error404 = new AxiosError('Not Found', 'ERR_BAD_RESPONSE', { url: '/test' }, { status: 404 });
      expect(getErrorType(error404)).toBe(ErrorType.NOT_FOUND);

      const error500 = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', { url: '/test' }, { status: 500 });
      expect(getErrorType(error500)).toBe(ErrorType.SERVER);
    });

    it('should identify client errors', () => {
      const typeError = new TypeError('Cannot read property of undefined');
      expect(getErrorType(typeError)).toBe(ErrorType.CLIENT);

      const syntaxError = new SyntaxError('Unexpected token');
      expect(getErrorType(syntaxError)).toBe(ErrorType.CLIENT);
    });

    it('should identify network errors from standard Error messages', () => {
      const networkError = new Error('Failed to connect to network');
      expect(getErrorType(networkError)).toBe(ErrorType.NETWORK);
    });

    it('should return UNKNOWN for unrecognized errors', () => {
      const unknownError = { message: 'Some error' };
      expect(getErrorType(unknownError)).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('getErrorSeverity', () => {
    it('should determine severity from HTTP status codes', () => {
      const error400 = new AxiosError('Bad Request', 'ERR_BAD_RESPONSE', { url: '/test' }, { status: 400 });
      expect(getErrorSeverity(error400)).toBe(ErrorSeverity.WARNING);

      const error500 = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', { url: '/test' }, { status: 500 });
      expect(getErrorSeverity(error500)).toBe(ErrorSeverity.ERROR);
    });

    it('should set client errors to ERROR severity', () => {
      const typeError = new TypeError('Cannot read property of undefined');
      expect(getErrorSeverity(typeError)).toBe(ErrorSeverity.ERROR);
    });

    it('should default to ERROR severity for unknown errors', () => {
      const unknownError = { message: 'Some error' };
      expect(getErrorSeverity(unknownError)).toBe(ErrorSeverity.ERROR);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from AxiosError response data string', () => {
      const error = new AxiosError('Error', 'ERR_BAD_RESPONSE', { url: '/test' }, { data: 'Server error message' });
      expect(getErrorMessage(error)).toBe('Server error message');
    });

    it('should extract message from AxiosError response data object', () => {
      const error = new AxiosError(
        'Error',
        'ERR_BAD_RESPONSE',
        { url: '/test' },
        { data: { message: 'API error message' } },
      );
      expect(getErrorMessage(error)).toBe('API error message');
    });

    it('should extract message from AxiosError response data error field', () => {
      const error = new AxiosError(
        'Error',
        'ERR_BAD_RESPONSE',
        { url: '/test' },
        { data: { error: 'Validation failed' } },
      );
      expect(getErrorMessage(error)).toBe('Validation failed');
    });

    it('should use status text if available', () => {
      const error = new AxiosError('Error', 'ERR_BAD_RESPONSE', { url: '/test' }, { statusText: 'Bad Request' });
      expect(getErrorMessage(error)).toBe('Bad Request');
    });

    it('should use error message if no other info available', () => {
      const error = new AxiosError('Custom error message', 'ERR_BAD_RESPONSE', {
        url: '/test',
      });
      expect(getErrorMessage(error)).toBe('Custom error message');
    });

    it('should use default message based on error type for network errors', () => {
      const error = new AxiosError('Network Error', 'ERR_NETWORK', {
        url: '/test',
      });
      expect(getErrorMessage(error)).toBe('Network error. Please check your connection.');
    });

    it('should extract message from standard Error', () => {
      const error = new Error('Standard error message');
      expect(getErrorMessage(error)).toBe('Standard error message');
    });

    it('should handle string errors', () => {
      expect(getErrorMessage('String error message')).toBe('String error message');
    });

    it('should use fallback message when provided', () => {
      const error = { notAMessage: 'This is not a standard message field' };
      expect(getErrorMessage(error, 'Fallback message')).toBe('Fallback message');
    });

    it('should default to unknown error message', () => {
      const error = { notAMessage: 'This is not a standard message field' };
      expect(getErrorMessage(error)).toBe('An unknown error occurred. Please try again.');
    });
  });

  describe('getErrorCode', () => {
    it('should extract HTTP status code from AxiosError', () => {
      const error = new AxiosError('Error', 'ERR_BAD_RESPONSE', { url: '/test' }, { status: 404 });
      expect(getErrorCode(error)).toBe(404);
    });

    it('should use error code if no status available', () => {
      const error = new AxiosError('Error', 'ERR_NETWORK', { url: '/test' });
      expect(getErrorCode(error)).toBe('ERR_NETWORK');
    });

    it('should extract code from Error with code property', () => {
      const error = new Error('Error with code');
      (error as any).code = 'CUSTOM_CODE';
      expect(getErrorCode(error)).toBe('CUSTOM_CODE');
    });

    it('should return undefined when no code available', () => {
      const error = new Error('No code');
      expect(getErrorCode(error)).toBeUndefined();
    });
  });

  describe('getErrorDetails', () => {
    it('should extract details from AxiosError response data', () => {
      const error = new AxiosError(
        'Error',
        'ERR_BAD_RESPONSE',
        { url: '/test' },
        {
          data: { details: { field: 'username', message: 'Required' } },
        },
      );
      expect(getErrorDetails(error)).toEqual({
        field: 'username',
        message: 'Required',
      });
    });

    it('should extract errors from AxiosError response data', () => {
      const error = new AxiosError(
        'Error',
        'ERR_BAD_RESPONSE',
        { url: '/test' },
        {
          data: { errors: [{ field: 'username', message: 'Required' }] },
        },
      );
      expect(getErrorDetails(error)).toEqual([{ field: 'username', message: 'Required' }]);
    });

    it('should extract rest of data from AxiosError response when no details or errors', () => {
      const error = new AxiosError(
        'Error',
        'ERR_BAD_RESPONSE',
        { url: '/test' },
        {
          data: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            timestamp: '2023-01-01',
          },
        },
      );
      expect(getErrorDetails(error)).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        timestamp: '2023-01-01',
      });
    });

    it('should include request metadata when no response data', () => {
      const error = new AxiosError('Error', 'ERR_BAD_RESPONSE', {
        url: '/test',
        method: 'GET',
      });
      expect(getErrorDetails(error)).toEqual({ url: '/test', method: 'GET' });
    });

    it('should return undefined for non-axios errors', () => {
      const error = new Error('Standard error');
      expect(getErrorDetails(error)).toBeUndefined();
    });
  });

  describe('createErrorInfo', () => {
    it('should create error info with complete info from error', () => {
      const error = new AxiosError(
        'Error',
        'ERR_BAD_RESPONSE',
        { url: '/test' },
        {
          status: 400,
          data: { message: 'Validation failed', details: { field: 'email' } },
        },
      );

      const info = createErrorInfo(error);

      expect(info).toEqual({
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'Validation failed',
        code: 400,
        details: { field: 'email' },
        originalError: error,
        handled: false,
      });
    });

    it('should override error properties with provided options', () => {
      const error = new AxiosError('Error', 'ERR_BAD_RESPONSE', { url: '/test' }, { status: 400 });

      const info = createErrorInfo(error, {
        type: ErrorType.CLIENT,
        severity: ErrorSeverity.ERROR,
        message: 'Custom message',
        code: 'CUSTOM_CODE',
        details: { custom: 'detail' },
        handled: true,
      });

      expect(info).toEqual({
        type: ErrorType.CLIENT,
        severity: ErrorSeverity.ERROR,
        message: 'Custom message',
        code: 'CUSTOM_CODE',
        details: { custom: 'detail' },
        originalError: error,
        handled: true,
      });
    });
  });

  describe('handleError', () => {
    it('should log critical errors', () => {
      const error = new Error('Critical error');

      handleError(error, {
        errorInfo: {
          severity: ErrorSeverity.CRITICAL,
          type: ErrorType.SERVER,
          message: 'Critical server error',
        },
        context: 'Test Context',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Critical error: Critical server error',
        expect.objectContaining({
          errorType: ErrorType.SERVER,
          context: 'Test Context',
        }),
      );

      expect(require('sonner').toast.error).toHaveBeenCalledWith('Critical server error');
    });

    it('should log errors', () => {
      const error = new Error('Regular error');

      handleError(error, {
        errorInfo: {
          severity: ErrorSeverity.ERROR,
          type: ErrorType.CLIENT,
          message: 'Client error',
        },
      });

      expect(logger.error).toHaveBeenCalledWith('Error: Client error', expect.any(Object));

      expect(require('sonner').toast.error).toHaveBeenCalledWith('Client error');
    });

    it('should log warnings', () => {
      const error = new Error('Warning');

      handleError(error, {
        errorInfo: {
          severity: ErrorSeverity.WARNING,
          type: ErrorType.VALIDATION,
          message: 'Validation warning',
        },
      });

      expect(logger.warn).toHaveBeenCalledWith('Warning: Validation warning', expect.any(Object));

      expect(require('sonner').toast.warning).toHaveBeenCalledWith('Validation warning');
    });

    it('should log info messages', () => {
      const error = new Error('Info');

      handleError(error, {
        errorInfo: {
          severity: ErrorSeverity.INFO,
          type: ErrorType.AUTHENTICATION,
          message: 'Authentication info',
        },
      });

      expect(logger.info).toHaveBeenCalledWith('Info: Authentication info', expect.any(Object));

      expect(require('sonner').toast.info).toHaveBeenCalledWith('Authentication info');
    });

    it('should not show toast when showToast is false', () => {
      const error = new Error('Error');

      handleError(error, {
        showToast: false,
      });

      expect(require('sonner').toast.error).not.toHaveBeenCalled();
      expect(require('sonner').toast.warning).not.toHaveBeenCalled();
      expect(require('sonner').toast.info).not.toHaveBeenCalled();
    });

    it('should not log error when logError is false', () => {
      const error = new Error('Error');

      handleError(error, {
        logError: false,
      });

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should return error info', () => {
      const error = new Error('Error');

      const result = handleError(error);

      expect(result).toEqual({
        type: expect.any(String),
        severity: expect.any(String),
        message: expect.any(String),
        originalError: error,
        handled: true,
      });
    });
  });

  describe('Error classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('App error', {
        type: ErrorType.CLIENT,
        severity: ErrorSeverity.ERROR,
        code: 'ERR_APP',
        details: { source: 'test' },
      });

      expect(error.name).toBe('AppError');
      expect(error.message).toBe('App error');
      expect(error.type).toBe(ErrorType.CLIENT);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.code).toBe('ERR_APP');
      expect(error.details).toEqual({ source: 'test' });
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create NetworkError with correct defaults', () => {
      const error = new NetworkError();

      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Network error. Please check your connection.');
      expect(error.type).toBe(ErrorType.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error instanceof NetworkError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create ApiError with correct defaults', () => {
      const error = new ApiError();

      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('API error. Please try again later.');
      expect(error.type).toBe(ErrorType.API);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error instanceof ApiError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create ValidationError with correct defaults', () => {
      const error = new ValidationError();

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation error. Please check your input.');
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create AuthenticationError with correct defaults', () => {
      const error = new AuthenticationError();

      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Authentication error. Please sign in again.');
      expect(error.type).toBe(ErrorType.AUTHENTICATION);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error instanceof AuthenticationError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create AuthorizationError with correct defaults', () => {
      const error = new AuthorizationError();

      expect(error.name).toBe('AuthorizationError');
      expect(error.message).toBe("You don't have permission to perform this action.");
      expect(error.type).toBe(ErrorType.AUTHORIZATION);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error instanceof AuthorizationError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create NotFoundError with correct defaults', () => {
      const error = new NotFoundError();

      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('The requested resource was not found.');
      expect(error.type).toBe(ErrorType.NOT_FOUND);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error instanceof NotFoundError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create ServerError with correct defaults', () => {
      const error = new ServerError();

      expect(error.name).toBe('ServerError');
      expect(error.message).toBe('Server error. Please try again later.');
      expect(error.type).toBe(ErrorType.SERVER);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error instanceof ServerError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should override defaults with custom message and options', () => {
      const error = new ServerError('Custom server error', {
        severity: ErrorSeverity.CRITICAL,
        code: 'FATAL',
      });

      expect(error.message).toBe('Custom server error');
      expect(error.type).toBe(ErrorType.SERVER);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.code).toBe('FATAL');
    });
  });
});
