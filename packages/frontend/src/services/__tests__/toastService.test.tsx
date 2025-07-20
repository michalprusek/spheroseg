/**
 * Tests for toast service
 */

import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { toastService } from '../toastService';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  CheckCircle: ({ className }: { className?: string }) => (
    <div data-testid="check-circle-icon" className={className} />
  ),
  XCircle: ({ className }: { className?: string }) => (
    <div data-testid="x-circle-icon" className={className} />
  ),
  Info: ({ className }: { className?: string }) => (
    <div data-testid="info-icon" className={className} />
  ),
  AlertTriangle: ({ className }: { className?: string }) => (
    <div data-testid="alert-triangle-icon" className={className} />
  ),
  Loader2: ({ className }: { className?: string }) => (
    <div data-testid="loader2-icon" className={className} />
  ),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn().mockReturnValue('mock-toast-id'),
    dismiss: vi.fn(),
    promise: vi.fn(),
    custom: vi.fn(),
  },
}));

describe('Toast Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('success', () => {
    it('should show success toast with message', () => {
      const message = 'Operation completed successfully';
      
      toastService.success(message);
      
      expect(toast.success).toHaveBeenCalledWith(message, expect.any(Object));
    });

    it('should show success toast with custom options', () => {
      const message = 'Custom success';
      const options = { duration: 5000 };
      
      toastService.success(message, options);
      
      expect(toast.success).toHaveBeenCalledWith(message, expect.objectContaining(options));
    });
  });

  describe('error', () => {
    it('should show error toast with message', () => {
      const message = 'Something went wrong';
      
      toastService.error(message);
      
      expect(toast.error).toHaveBeenCalledWith(message, expect.any(Object));
    });

    it('should show error toast with Error object', () => {
      const error = new Error('Test error');
      
      toastService.error(error.message);
      
      expect(toast.error).toHaveBeenCalledWith(error.message, expect.any(Object));
    });

    it('should handle error with custom message', () => {
      const error = new Error('Test error');
      const customMessage = 'Custom error message';
      
      toastService.error(customMessage, { originalError: error });
      
      expect(toast.error).toHaveBeenCalledWith(customMessage, expect.any(Object));
    });
  });

  describe('warning', () => {
    it('should show warning toast with message', () => {
      const message = 'This is a warning';
      
      toastService.warning(message);
      
      expect(toast.warning).toHaveBeenCalledWith(message, expect.any(Object));
    });

    it('should show warning toast with custom duration', () => {
      const message = 'Warning with custom duration';
      const options = { duration: 8000 };
      
      toastService.warning(message, options);
      
      expect(toast.warning).toHaveBeenCalledWith(message, expect.objectContaining(options));
    });
  });

  describe('info', () => {
    it('should show info toast with message', () => {
      const message = 'Information message';
      
      toastService.info(message);
      
      expect(toast.info).toHaveBeenCalledWith(message, expect.any(Object));
    });

    it('should show info toast with action button', () => {
      const message = 'Info with action';
      const action = {
        label: 'Click me',
        onClick: vi.fn(),
      };
      
      toastService.info(message, { action });
      
      expect(toast.info).toHaveBeenCalledWith(message, expect.objectContaining({ action }));
    });
  });

  describe('loading', () => {
    it('should show loading toast with message', () => {
      const message = 'Loading...';
      
      const toastId = toastService.loading(message);
      
      expect(toast.loading).toHaveBeenCalledWith(message, expect.any(Object));
      expect(toastId).toBeDefined();
    });

    it('should return toast ID for dismissal', () => {
      const mockToastId = 'toast-123';
      vi.mocked(toast.loading).mockReturnValue(mockToastId);
      
      const toastId = toastService.loading('Loading...');
      
      expect(toastId).toBe(mockToastId);
    });
  });

  describe('dismiss', () => {
    it('should dismiss specific toast by ID', () => {
      const toastId = 'toast-123';
      
      toastService.dismiss(toastId);
      
      expect(toast.dismiss).toHaveBeenCalledWith(toastId);
    });

    it('should dismiss all toasts when no ID provided', () => {
      toastService.dismiss();
      
      expect(toast.dismiss).toHaveBeenCalledWith();
    });
  });

  describe('promise operations', () => {
    it('should handle promise-based toasts', () => {
      const promise = Promise.resolve('success');
      const messages = {
        loading: 'Processing...',
        success: 'Operation completed!',
        error: 'Operation failed!',
      };

      toastService.promise(promise, messages);

      expect(toast.promise).toHaveBeenCalledWith(promise, messages, undefined);
    });

    it('should handle promise with options', () => {
      const promise = Promise.resolve('success');
      const messages = {
        loading: 'Processing...',
        success: 'Operation completed!',
        error: 'Operation failed!',
      };
      const options = { duration: 5000 };

      toastService.promise(promise, messages, options);

      expect(toast.promise).toHaveBeenCalledWith(promise, messages, options);
    });
  });

  describe('custom toasts', () => {
    it('should show custom toast', () => {
      const content = <div>Custom content</div>;
      const options = { duration: 3000 };

      toastService.custom(content, options);

      expect(toast.custom).toHaveBeenCalledWith(content, expect.objectContaining(options));
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      toastService.success('Test');

      expect(toast.success).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          position: 'bottom-right',
          duration: 3000,
          dismissible: true,
        })
      );
    });

    it('should allow overriding default configuration', () => {
      const customOptions = {
        position: 'bottom-center' as const,
        duration: 6000,
      };

      toastService.success('Test', customOptions);

      expect(toast.success).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining(customOptions)
      );
    });
  });

  describe('internationalization', () => {
    it('should support translated messages', () => {
      const translatedMessage = 'Operazione completata con successo';
      
      toastService.success(translatedMessage);
      
      expect(toast.success).toHaveBeenCalledWith(translatedMessage, expect.any(Object));
    });

    it('should handle message formatting', () => {
      const template = 'Uploaded {count} files successfully';
      const formatted = template.replace('{count}', '5');
      
      toastService.success(formatted);
      
      expect(toast.success).toHaveBeenCalledWith(formatted, expect.any(Object));
    });
  });

  describe('accessibility', () => {
    it('should include accessibility options', () => {
      toastService.success('Accessible toast', {
        important: true,
        closeButton: true,
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Accessible toast',
        expect.objectContaining({
          important: true,
          closeButton: true,
        })
      );
    });
  });
});