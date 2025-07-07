import { useCallback } from 'react';
import { 
  notificationService, 
  type NotificationOptions, 
  type NotificationType,
  type NotificationChannel,
} from '@/services/notificationService';
import { useFeatureFlag } from '@/hooks/useConfig';

interface UseNotificationOptions {
  defaultChannel?: NotificationChannel[];
  defaultPriority?: NotificationOptions['priority'];
  defaultDuration?: number;
}

/**
 * Hook for simplified notification management
 */
export function useNotification(options: UseNotificationOptions = {}) {
  const pushEnabled = useFeatureFlag('enablePushNotifications');
  
  const notify = useCallback((notification: NotificationOptions) => {
    return notificationService.notify({
      channels: options.defaultChannel,
      priority: options.defaultPriority,
      duration: options.defaultDuration,
      ...notification,
    });
  }, [options]);

  const success = useCallback((title: string, message?: string, opts?: Partial<NotificationOptions>) => {
    return notify({
      type: 'success',
      title,
      message,
      ...opts,
    });
  }, [notify]);

  const error = useCallback((title: string, message?: string, opts?: Partial<NotificationOptions>) => {
    return notify({
      type: 'error',
      title,
      message,
      ...opts,
    });
  }, [notify]);

  const warning = useCallback((title: string, message?: string, opts?: Partial<NotificationOptions>) => {
    return notify({
      type: 'warning',
      title,
      message,
      ...opts,
    });
  }, [notify]);

  const info = useCallback((title: string, message?: string, opts?: Partial<NotificationOptions>) => {
    return notify({
      type: 'info',
      title,
      message,
      ...opts,
    });
  }, [notify]);

  const withAction = useCallback((
    type: NotificationType,
    title: string,
    message: string,
    actionLabel: string,
    actionCallback: () => void,
    opts?: Partial<NotificationOptions>
  ) => {
    return notify({
      type,
      title,
      message,
      action: {
        label: actionLabel,
        onClick: actionCallback,
      },
      ...opts,
    });
  }, [notify]);

  const persistent = useCallback((
    type: NotificationType,
    title: string,
    message?: string,
    opts?: Partial<NotificationOptions>
  ) => {
    return notify({
      type,
      title,
      message,
      persistent: true,
      channels: ['inApp'], // Persistent notifications only in-app
      ...opts,
    });
  }, [notify]);

  const urgent = useCallback((
    title: string,
    message: string,
    opts?: Partial<NotificationOptions>
  ) => {
    return notify({
      type: 'warning',
      title,
      message,
      priority: 'urgent',
      persistent: true,
      requireInteraction: true,
      channels: pushEnabled ? ['toast', 'inApp', 'push'] : ['toast', 'inApp'],
      ...opts,
    });
  }, [notify, pushEnabled]);

  const requestPermission = useCallback(async () => {
    return notificationService.requestPushPermission();
  }, []);

  const test = useCallback(async (channel?: NotificationChannel) => {
    return notificationService.test(channel);
  }, []);

  return {
    notify,
    success,
    error,
    warning,
    info,
    withAction,
    persistent,
    urgent,
    requestPermission,
    test,
  };
}

/**
 * Hook for notification preferences management
 */
export function useNotificationPreferences() {
  const preferences = notificationService.getPreferences();

  const updatePreferences = useCallback((updates: Partial<typeof preferences>) => {
    notificationService.updatePreferences(updates);
  }, []);

  const toggleChannel = useCallback((channel: NotificationChannel) => {
    updatePreferences({
      channels: {
        ...preferences.channels,
        [channel]: !preferences.channels[channel],
      },
    });
  }, [preferences, updatePreferences]);

  const togglePriority = useCallback((priority: keyof typeof preferences.priorities) => {
    updatePreferences({
      priorities: {
        ...preferences.priorities,
        [priority]: !preferences.priorities[priority],
      },
    });
  }, [preferences, updatePreferences]);

  const setQuietHours = useCallback((enabled: boolean, start?: string, end?: string) => {
    updatePreferences({
      quiet: {
        enabled,
        start: start || preferences.quiet.start,
        end: end || preferences.quiet.end,
      },
    });
  }, [preferences, updatePreferences]);

  const toggleSound = useCallback(() => {
    updatePreferences({ sound: !preferences.sound });
  }, [preferences, updatePreferences]);

  const toggleVibrate = useCallback(() => {
    updatePreferences({ vibrate: !preferences.vibrate });
  }, [preferences, updatePreferences]);

  return {
    preferences,
    updatePreferences,
    toggleChannel,
    togglePriority,
    setQuietHours,
    toggleSound,
    toggleVibrate,
  };
}

/**
 * Hook for notification history
 */
export function useNotificationHistory() {
  const getHistory = useCallback(async (filters?: Parameters<typeof notificationService.getHistory>[0]) => {
    return notificationService.getHistory(filters);
  }, []);

  const clearHistory = useCallback(() => {
    notificationService.clearAll();
  }, []);

  return {
    getHistory,
    clearHistory,
  };
}

/**
 * Hook for push notification subscription
 */
export function useNotificationSubscription() {
  const subscribe = useCallback(async (vapidPublicKey: string) => {
    return notificationService.subscribeToPush(vapidPublicKey);
  }, []);

  const unsubscribe = useCallback(async () => {
    return notificationService.unsubscribeFromPush();
  }, []);

  return {
    subscribe,
    unsubscribe,
  };
}