import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showUpdateNotification } from '@/utils/notifications';
import { toastService } from '@/services/toastService';

// Mock toastService
vi.mock('@/services/toastService', () => ({
  toastService: {
    info: vi.fn(),
  },
}));

describe('notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show update notification with correct message and options', () => {
    const onUpdate = vi.fn();
    
    showUpdateNotification(onUpdate);
    
    expect(toastService.info).toHaveBeenCalledWith(
      'A new version is available! Click to update.',
      {
        duration: 0,
        action: {
          label: 'Update',
          onClick: onUpdate,
        },
      }
    );
  });

  it('should pass the onUpdate callback to the action', () => {
    const onUpdate = vi.fn();
    
    showUpdateNotification(onUpdate);
    
    const callArgs = vi.mocked(toastService.info).mock.calls[0];
    const options = callArgs[1];
    
    expect(options.action).toBeDefined();
    expect(options.action.onClick).toBe(onUpdate);
  });

  it('should set duration to 0 for persistent notification', () => {
    const onUpdate = vi.fn();
    
    showUpdateNotification(onUpdate);
    
    const callArgs = vi.mocked(toastService.info).mock.calls[0];
    const options = callArgs[1];
    
    expect(options.duration).toBe(0);
  });
});