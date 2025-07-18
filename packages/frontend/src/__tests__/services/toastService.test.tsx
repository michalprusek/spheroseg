import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toastService } from '@/services/toastService';
import { toast as sonnerToast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => {
  const mockToast = vi.fn((message: any, options?: any) => 'mock-toast-id');
  mockToast.success = vi.fn((message: any, options?: any) => 'mock-toast-id');
  mockToast.error = vi.fn((message: any, options?: any) => 'mock-toast-id');
  mockToast.info = vi.fn((message: any, options?: any) => 'mock-toast-id');
  mockToast.warning = vi.fn((message: any, options?: any) => 'mock-toast-id');
  mockToast.loading = vi.fn((message: any, options?: any) => 'mock-toast-id');
  mockToast.custom = vi.fn((message: any, options?: any) => 'mock-toast-id');
  mockToast.dismiss = vi.fn();

  return {
    toast: mockToast,
  };
});

describe('toastService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export toastService singleton', () => {
    expect(toastService).toBeDefined();
    expect(typeof toastService.success).toBe('function');
    expect(typeof toastService.error).toBe('function');
    expect(typeof toastService.info).toBe('function');
    expect(typeof toastService.warning).toBe('function');
  });

  it('should call success method', () => {
    const message = 'Success message';
    toastService.success(message);

    expect(sonnerToast.success).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        duration: 3000,
      }),
    );
  });

  it('should call error method', () => {
    const message = 'Error message';
    toastService.error(message);

    expect(sonnerToast.error).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        duration: 5000,
      }),
    );
  });

  it('should call info method with action', () => {
    const message = 'Info message';
    const action = {
      label: 'Click me',
      onClick: vi.fn(),
    };

    toastService.info(message, { action });

    expect(sonnerToast.info).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        duration: 4000,
        action: expect.objectContaining({
          label: 'Click me',
          onClick: expect.any(Function),
        }),
      }),
    );
  });

  it('should call warning method', () => {
    const message = 'Warning message';
    toastService.warning(message);

    expect(sonnerToast.warning).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        duration: 4500,
      }),
    );
  });

  it('should handle persistent toasts', () => {
    const message = 'Persistent message';
    toastService.info(message, { duration: 0 });

    expect(sonnerToast.info).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        duration: 0,
      }),
    );
  });
});
