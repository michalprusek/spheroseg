import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showSuccess, showError, showInfo, showWarning } from '../toastUtils';
import { toast } from 'sonner';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
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
      });
    });

    it('should allow custom duration', () => {
      const message = 'Success message';
      const customDuration = 5000;
      showSuccess(message, customDuration);

      expect(toast.success).toHaveBeenCalledWith(message, {
        duration: customDuration,
      });
    });
  });

  describe('showError', () => {
    it('should call toast.error with the correct parameters', () => {
      const message = 'Error message';
      showError(message);

      expect(toast.error).toHaveBeenCalledWith(message, {
        duration: 4000,
      });
    });

    it('should allow custom duration', () => {
      const message = 'Error message';
      const customDuration = 6000;
      showError(message, customDuration);

      expect(toast.error).toHaveBeenCalledWith(message, {
        duration: customDuration,
      });
    });
  });

  describe('showInfo', () => {
    it('should call toast.info with the correct parameters', () => {
      const message = 'Info message';
      showInfo(message);

      expect(toast.info).toHaveBeenCalledWith(message, {
        duration: 3000,
      });
    });

    it('should allow custom duration', () => {
      const message = 'Info message';
      const customDuration = 7000;
      showInfo(message, customDuration);

      expect(toast.info).toHaveBeenCalledWith(message, {
        duration: customDuration,
      });
    });
  });

  describe('showWarning', () => {
    it('should call toast.warning with the correct parameters', () => {
      const message = 'Warning message';
      showWarning(message);

      expect(toast.warning).toHaveBeenCalledWith(message, {
        duration: 3500,
      });
    });

    it('should allow custom duration', () => {
      const message = 'Warning message';
      const customDuration = 8000;
      showWarning(message, customDuration);

      expect(toast.warning).toHaveBeenCalledWith(message, {
        duration: customDuration,
      });
    });
  });
});
