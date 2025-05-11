import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useToastErrorHandler } from '../useErrorHandler';
import { toast } from 'sonner';
import logger from '@/utils/logger';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: (key: string) => {
      if (key === 'error.handler.title') return 'Error';
      if (key === 'error.handler.defaultMessage') return 'An unexpected error occurred';
      return key;
    },
  })),
}));

vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('useErrorHandler Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date.now to return consistent values for testing
    vi.spyOn(Date, 'now').mockReturnValue(123456789);
  });

  describe('handleError', () => {
    it('handles error with message property', () => {
      const { result } = renderHook(() => useToastErrorHandler());
      const error = new Error('Test error message');

      result.current.handleError(error);

      // Check if error was logged
      expect(logger.error).toHaveBeenCalledWith('Error handled by toast handler', { error });

      // Check if toast was shown with correct message
      expect(toast.error).toHaveBeenCalledWith('Test error message', {
        id: 'error-123456789',
        duration: 5000,
        important: true,
      });
    });

    it('handles error with custom title', () => {
      const { result } = renderHook(() => useToastErrorHandler());
      const error = new Error('Test error message');
      const customTitle = 'Custom Error Title';

      result.current.handleError(error, customTitle);

      // Check if toast was shown with correct message and title
      expect(toast.error).toHaveBeenCalledWith('Test error message', {
        id: 'error-123456789',
        duration: 5000,
        important: true,
        description: 'Custom Error Title',
      });
    });

    it('uses default message when error has no message', () => {
      const { result } = renderHook(() => useToastErrorHandler());
      const error = {}; // Error without message

      result.current.handleError(error);

      // Check if toast was shown with default message
      expect(toast.error).toHaveBeenCalledWith('An unexpected error occurred', {
        id: 'error-123456789',
        duration: 5000,
        important: true,
      });
    });

    it('uses custom default message when provided', () => {
      const { result } = renderHook(() => useToastErrorHandler());
      const error = {}; // Error without message
      const customDefault = 'Custom default message';

      result.current.handleError(error, undefined, customDefault);

      // Check if toast was shown with custom default message
      expect(toast.error).toHaveBeenCalledWith('Custom default message', {
        id: 'error-123456789',
        duration: 5000,
        important: true,
      });
    });
  });

  describe('createAsyncErrorHandler', () => {
    it('calls the wrapped function and returns its result on success', async () => {
      const { result } = renderHook(() => useToastErrorHandler());
      const mockFn = vi.fn().mockResolvedValue('success result');
      const onSuccess = vi.fn();

      const wrappedFn = result.current.createAsyncErrorHandler(mockFn, onSuccess);
      const response = await wrappedFn('arg1', 'arg2');

      // Check if original function was called with args
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');

      // Check if success callback was called with result
      expect(onSuccess).toHaveBeenCalledWith('success result');

      // Check if correct result was returned
      expect(response).toBe('success result');

      // Check that no error was shown
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('handles errors in the wrapped function', async () => {
      const { result } = renderHook(() => useToastErrorHandler());
      const error = new Error('Async function error');
      const mockFn = vi.fn().mockRejectedValue(error);
      const onSuccess = vi.fn();

      const wrappedFn = result.current.createAsyncErrorHandler(mockFn, onSuccess, 'Custom error message');
      const response = await wrappedFn('arg1', 'arg2');

      // Check if original function was called
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');

      // Check that success callback was NOT called
      expect(onSuccess).not.toHaveBeenCalled();

      // Check if correct error handling happened
      expect(toast.error).toHaveBeenCalledWith('Async function error', {
        id: 'error-123456789',
        duration: 5000,
        important: true,
        description: 'Error',
      });

      // Check if null was returned
      expect(response).toBeNull();
    });

    it('uses custom error message when original error has no message', async () => {
      const { result } = renderHook(() => useToastErrorHandler());
      const error = {}; // Error without message
      const mockFn = vi.fn().mockRejectedValue(error);

      const wrappedFn = result.current.createAsyncErrorHandler(mockFn, undefined, 'Custom error message');
      await wrappedFn();

      // Check if toast shows custom error message
      expect(toast.error).toHaveBeenCalledWith('Custom error message', {
        id: 'error-123456789',
        duration: 5000,
        important: true,
        description: 'Error',
      });
    });
  });
});
