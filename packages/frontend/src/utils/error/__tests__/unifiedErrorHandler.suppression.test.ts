/**
 * Tests for access denied notification suppression
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  handleError, 
  clearAccessDeniedSuppression,
  AuthorizationError,
  NotFoundError,
  ServerError,
} from '../unifiedErrorHandler';
import { toast } from 'sonner';
import logger from '@/utils/logger';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(() => 'toast-id'),
    warning: vi.fn(() => 'toast-id'),
    info: vi.fn(() => 'toast-id'),
  },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Access Denied Notification Suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccessDeniedSuppression();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show access denied notification', () => {
    const error = new ServerError('You do not have permission to delete images in this project');
    
    handleError(error, {
      context: { context: 'API DELETE /api/images/123' },
    });

    expect(toast.error).toHaveBeenCalledWith(
      'You do not have permission to delete images in this project',
      expect.any(Object)
    );
  });

  it('should suppress subsequent 404 errors after access denied', () => {
    // First, trigger an access denied error
    const accessDeniedError = new AuthorizationError('You do not have permission to resegment images in this project');
    
    handleError(accessDeniedError, {
      context: { context: 'API POST /api/images/123/resegment' },
    });

    expect(toast.error).toHaveBeenCalledTimes(1);
    
    // Check the debug logs to see what context key was extracted
    const accessDeniedLogs = (logger.debug as any).mock.calls.filter((call: any[]) => 
      call[0] === 'Tracked access denied error'
    );
    console.log('Access denied logs:', accessDeniedLogs);
    
    // Clear only toast mocks to see what happens with the second call
    (toast.error as any).mockClear();
    (toast.warning as any).mockClear();
    (toast.info as any).mockClear();
    
    // Now trigger a 404 error for a related operation
    const notFoundError = new NotFoundError('Image not found or access denied');
    
    handleError(notFoundError, {
      context: { context: 'API GET /api/segmentation-results/456' },
    });
    
    // Check the debug logs for suppression check
    const suppressionLogs = (logger.debug as any).mock.calls.filter((call: any[]) => 
      call[0] === 'Checking if secondary error should be suppressed'
    );
    console.log('Suppression check logs:', suppressionLogs);

    // The 404 error should be suppressed - no toasts at all after clearing
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('should show 404 errors when there is no recent access denied', () => {
    const notFoundError = new NotFoundError('Resource not found');
    
    handleError(notFoundError, {
      context: { context: 'API GET /api/projects/999' },
    });

    expect(toast.error).toHaveBeenCalledWith('Resource not found', expect.any(Object));
  });

  it('should stop suppressing after the suppression window expires', () => {
    vi.useFakeTimers();

    // Trigger an access denied error
    const accessDeniedError = new AuthorizationError('Access denied');
    
    handleError(accessDeniedError, {
      context: { context: 'API DELETE /api/images/123' },
    });

    expect(toast.error).toHaveBeenCalledTimes(1);

    // Advance time past the suppression window (30 seconds)
    vi.advanceTimersByTime(31000);

    // Now a 404 error should be shown
    const notFoundError = new NotFoundError('Not found');
    
    handleError(notFoundError, {
      context: { context: 'API GET /api/images/456' },
    });

    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it('should handle multiple access denied errors for different contexts', () => {
    // Access denied for images
    const imageAccessDenied = new AuthorizationError('No permission for images');
    
    handleError(imageAccessDenied, {
      context: { context: 'API DELETE /api/images/123' },
    });

    // Access denied for projects
    const projectAccessDenied = new AuthorizationError('No permission for projects');
    
    handleError(projectAccessDenied, {
      context: { context: 'API DELETE /api/projects/456' },
    });

    expect(toast.error).toHaveBeenCalledTimes(2);

    // 404 for image should be suppressed
    const imageNotFound = new NotFoundError('Image not found');
    
    handleError(imageNotFound, {
      context: { context: 'API GET /api/segmentation/image/123' },
    });

    expect(toast.error).toHaveBeenCalledTimes(2); // Still only the access denied errors
  });

  it('should clear suppression when clearAccessDeniedSuppression is called', () => {
    // Trigger an access denied error
    const accessDeniedError = new AuthorizationError('Access denied');
    
    handleError(accessDeniedError, {
      context: { context: 'API DELETE /api/images/123' },
    });

    expect(toast.error).toHaveBeenCalledTimes(1);

    // Clear suppression
    clearAccessDeniedSuppression();
    
    // Clear only toast mocks to see the effect of the next call
    (toast.error as any).mockClear();
    (toast.warning as any).mockClear();
    (toast.info as any).mockClear();

    // Now a 404 error should be shown
    const notFoundError = new NotFoundError('Not found');
    
    handleError(notFoundError, {
      context: { context: 'API GET /api/images/456' },
    });

    expect(toast.error).toHaveBeenCalledTimes(1); // Should show the 404 error
  });
});