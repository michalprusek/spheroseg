import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showSuccess, showError, showInfo, showWarning } from '../toastUtils';
import { toast } from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    // Default toast function
    __esModule: true,
    default: vi.fn(),
  },
}));

describe('toastUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showSuccess', () => {
    it('should call toast.success with the correct parameters', () => {
      const message = 'Success message';
      showSuccess(message);

      expect(toast.success).toHaveBeenCalledWith(message, {
        duration: 3000,
        style: {
          padding: '16px',
          borderRadius: '8px',
          background: '#10B981',
          color: '#FFFFFF',
        },
      });
    });

    it('should allow custom duration', () => {
      const message = 'Success message';
      const customDuration = 5000;
      showSuccess(message, customDuration);

      expect(toast.success).toHaveBeenCalledWith(message, {
        duration: customDuration,
        style: expect.any(Object),
      });
    });
  });

  describe('showError', () => {
    it('should call toast.error with the correct parameters', () => {
      const message = 'Error message';
      showError(message);

      expect(toast.error).toHaveBeenCalledWith(message, {
        duration: 4000,
        style: {
          padding: '16px',
          borderRadius: '8px',
          background: '#EF4444',
          color: '#FFFFFF',
        },
      });
    });

    it('should allow custom duration', () => {
      const message = 'Error message';
      const customDuration = 6000;
      showError(message, customDuration);

      expect(toast.error).toHaveBeenCalledWith(message, {
        duration: customDuration,
        style: expect.any(Object),
      });
    });
  });

  describe('showInfo', () => {
    it('should call toast with the correct parameters', () => {
      const message = 'Info message';
      showInfo(message);

      expect(toast).toHaveBeenCalledWith(message, {
        duration: 3000,
        style: {
          padding: '16px',
          borderRadius: '8px',
          background: '#3B82F6',
          color: '#FFFFFF',
        },
      });
    });

    it('should allow custom duration', () => {
      const message = 'Info message';
      const customDuration = 7000;
      showInfo(message, customDuration);

      expect(toast).toHaveBeenCalledWith(message, {
        duration: customDuration,
        style: expect.any(Object),
      });
    });
  });

  describe('showWarning', () => {
    it('should call toast with the correct parameters', () => {
      const message = 'Warning message';
      showWarning(message);

      expect(toast).toHaveBeenCalledWith(message, {
        duration: 3500,
        style: {
          padding: '16px',
          borderRadius: '8px',
          background: '#F59E0B',
          color: '#FFFFFF',
        },
        icon: '⚠️',
      });
    });

    it('should allow custom duration', () => {
      const message = 'Warning message';
      const customDuration = 8000;
      showWarning(message, customDuration);

      expect(toast).toHaveBeenCalledWith(message, {
        duration: customDuration,
        style: expect.any(Object),
        icon: '⚠️',
      });
    });
  });
});
