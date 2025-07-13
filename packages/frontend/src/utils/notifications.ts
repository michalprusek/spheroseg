/**
 * Notification utilities for service worker updates
 */

import { toastService } from '@/services/toastService';

/**
 * Show update notification when new version is available
 */
export function showUpdateNotification(onUpdate: () => void): void {
  // Use existing toast service
  toastService.info(
    'A new version is available! Click to update.',
    {
      duration: 0, // Keep visible until dismissed
      action: {
        label: 'Update',
        onClick: onUpdate,
      },
    }
  );
}