import { toast } from 'sonner';
import { useStore } from '@/store';
import { getConfigValue } from '@/config';
import type { Notification } from '@/store/slices/notificationSlice';

/**
 * Enhanced Notification Service
 * Unified service for all notification types: toast, in-app, push, and email
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationChannel = 'toast' | 'inApp' | 'push' | 'email' | 'all';

export interface NotificationOptions {
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  channels?: NotificationChannel[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tag?: string;
  data?: Record<string, any>;
  sound?: boolean;
  vibrate?: boolean | number[];
  image?: string;
  badge?: string;
  icon?: string;
  requireInteraction?: boolean;
}

export interface NotificationPreferences {
  channels: {
    toast: boolean;
    inApp: boolean;
    push: boolean;
    email: boolean;
  };
  priorities: {
    low: boolean;
    medium: boolean;
    high: boolean;
    urgent: boolean;
  };
  quiet: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
  sound: boolean;
  vibrate: boolean;
}

class NotificationService {
  private pushPermission: NotificationPermission = 'default';
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private preferences: NotificationPreferences = this.loadPreferences();
  private notificationQueue: NotificationOptions[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.initializePushNotifications();
    this.setupVisibilityHandlers();
  }

  /**
   * Initialize push notifications
   */
  private async initializePushNotifications() {
    if (!('Notification' in window)) {
      console.warn('Push notifications not supported');
      return;
    }

    this.pushPermission = Notification.permission;

    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    }
  }

  /**
   * Setup visibility change handlers
   */
  private setupVisibilityHandlers() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.notificationQueue.length > 0) {
        this.processNotificationQueue();
      }
    });
  }

  /**
   * Send notification through specified channels
   */
  async notify(options: NotificationOptions): Promise<void> {
    // Apply quiet hours
    if (this.isQuietHours()) {
      this.notificationQueue.push(options);
      return;
    }

    // Apply priority filtering
    if (!this.preferences.priorities[options.priority || 'medium']) {
      return;
    }

    const channels = options.channels || ['toast', 'inApp'];
    const promises: Promise<void>[] = [];

    for (const channel of channels) {
      if (this.preferences.channels[channel]) {
        promises.push(this.sendToChannel(channel, options));
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send notification to specific channel
   */
  private async sendToChannel(channel: NotificationChannel, options: NotificationOptions): Promise<void> {
    switch (channel) {
      case 'toast':
        this.showToast(options);
        break;
      case 'inApp':
        this.showInApp(options);
        break;
      case 'push':
        await this.showPush(options);
        break;
      case 'email':
        await this.sendEmail(options);
        break;
    }
  }

  /**
   * Show toast notification
   */
  private showToast(options: NotificationOptions) {
    const toastOptions = {
      duration: options.duration || getConfigValue('ui.notifications.defaultDuration'),
      position: getConfigValue('ui.notifications.position') as any,
      className: `notification-${options.type}`,
      dismissible: true,
    };

    const message = options.message ? `${options.title}: ${options.message}` : options.title;

    switch (options.type) {
      case 'success':
        toast.success(message, toastOptions);
        break;
      case 'error':
        toast.error(message, toastOptions);
        break;
      case 'warning':
        toast.warning(message, toastOptions);
        break;
      case 'info':
      default:
        toast.info(message, toastOptions);
        break;
    }

    // Play sound if enabled
    if (options.sound && this.preferences.sound) {
      this.playNotificationSound(options.type);
    }
  }

  /**
   * Show in-app notification
   */
  private showInApp(options: NotificationOptions) {
    const { addNotification } = useStore.getState();
    
    addNotification({
      type: options.type,
      title: options.title,
      message: options.message,
      duration: options.persistent ? 0 : options.duration,
      persistent: options.persistent,
      action: options.action,
    });
  }

  /**
   * Show push notification
   */
  private async showPush(options: NotificationOptions): Promise<void> {
    if (!('Notification' in window)) {
      return;
    }

    // Request permission if needed
    if (this.pushPermission === 'default') {
      this.pushPermission = await Notification.requestPermission();
      this.savePreferences();
    }

    if (this.pushPermission !== 'granted') {
      // Fallback to in-app notification
      this.showInApp(options);
      return;
    }

    // Don't show push if page is visible
    if (!document.hidden) {
      return;
    }

    const notificationOptions: NotificationOptions & NotificationOptions = {
      body: options.message,
      icon: options.icon || '/icon-192.png',
      badge: options.badge || '/badge-72.png',
      image: options.image,
      tag: options.tag || options.type,
      requireInteraction: options.requireInteraction || options.priority === 'urgent',
      silent: !this.preferences.sound,
      vibrate: this.preferences.vibrate ? options.vibrate || [200, 100, 200] : undefined,
      data: {
        ...options.data,
        url: window.location.href,
        timestamp: Date.now(),
      },
    };

    try {
      if (this.serviceWorkerRegistration) {
        // Use service worker for better control
        await this.serviceWorkerRegistration.showNotification(
          options.title,
          notificationOptions as any
        );
      } else {
        // Fallback to Notification API
        const notification = new Notification(options.title, notificationOptions as any);
        
        if (options.action) {
          notification.onclick = () => {
            window.focus();
            options.action!.onClick();
            notification.close();
          };
        }
      }
    } catch (error) {
      console.error('Failed to show push notification:', error);
      // Fallback to in-app
      this.showInApp(options);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(options: NotificationOptions): Promise<void> {
    // This would typically call a backend API
    try {
      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useStore.getState().tokens?.accessToken}`,
        },
        body: JSON.stringify({
          type: options.type,
          title: options.title,
          message: options.message,
          priority: options.priority,
          data: options.data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email notification');
      }
    } catch (error) {
      console.error('Email notification failed:', error);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: NotificationType) {
    const sounds = {
      success: '/sounds/success.mp3',
      error: '/sounds/error.mp3',
      warning: '/sounds/warning.mp3',
      info: '/sounds/info.mp3',
    };

    const audio = new Audio(sounds[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore errors (e.g., autoplay blocked)
    });
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(): boolean {
    if (!this.preferences.quiet.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = this.preferences.quiet.start.split(':').map(Number);
    const [endHour, endMin] = this.preferences.quiet.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Process queued notifications
   */
  private async processNotificationQueue() {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.notificationQueue.length > 0 && !this.isQuietHours()) {
      const notification = this.notificationQueue.shift()!;
      await this.notify(notification);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between notifications
    }

    this.isProcessingQueue = false;
  }

  /**
   * Request push notification permission
   */
  async requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    this.pushPermission = await Notification.requestPermission();
    this.savePreferences();
    
    return this.pushPermission === 'granted';
  }

  /**
   * Get notification preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Update notification preferences
   */
  updatePreferences(updates: Partial<NotificationPreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...updates,
      channels: {
        ...this.preferences.channels,
        ...updates.channels,
      },
      priorities: {
        ...this.preferences.priorities,
        ...updates.priorities,
      },
      quiet: {
        ...this.preferences.quiet,
        ...updates.quiet,
      },
    };
    
    this.savePreferences();
  }

  /**
   * Load preferences from storage
   */
  private loadPreferences(): NotificationPreferences {
    const stored = localStorage.getItem('notification-preferences');
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Invalid stored preferences
      }
    }

    // Default preferences
    return {
      channels: {
        toast: true,
        inApp: true,
        push: false,
        email: false,
      },
      priorities: {
        low: true,
        medium: true,
        high: true,
        urgent: true,
      },
      quiet: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
      sound: true,
      vibrate: true,
    };
  }

  /**
   * Save preferences to storage
   */
  private savePreferences(): void {
    localStorage.setItem('notification-preferences', JSON.stringify(this.preferences));
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.serviceWorkerRegistration || this.pushPermission !== 'granted') {
      return null;
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlB64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to backend
      await this.sendSubscriptionToBackend(subscription);

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.serviceWorkerRegistration) {
      return false;
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await this.removeSubscriptionFromBackend(subscription);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Send subscription to backend
   */
  private async sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${useStore.getState().tokens?.accessToken}`,
      },
      body: JSON.stringify(subscription),
    });
  }

  /**
   * Remove subscription from backend
   */
  private async removeSubscriptionFromBackend(subscription: PushSubscription): Promise<void> {
    await fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${useStore.getState().tokens?.accessToken}`,
      },
      body: JSON.stringify(subscription),
    });
  }

  /**
   * Convert VAPID key
   */
  private urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  /**
   * Get notification history
   */
  async getHistory(filters?: {
    type?: NotificationType;
    channel?: NotificationChannel;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Notification[]> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value.toString());
          }
        });
      }

      const response = await fetch(`/api/notifications/history?${params}`, {
        headers: {
          'Authorization': `Bearer ${useStore.getState().tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notification history');
      }

      return response.json();
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    // Clear toasts
    toast.dismiss();
    
    // Clear in-app notifications
    useStore.getState().clearNotifications();
    
    // Clear notification queue
    this.notificationQueue = [];
  }

  /**
   * Test notification system
   */
  async test(channel?: NotificationChannel): Promise<void> {
    const testNotification: NotificationOptions = {
      type: 'info',
      title: 'Test Notification',
      message: `This is a test ${channel || 'all channels'} notification`,
      channels: channel ? [channel] : ['toast', 'inApp', 'push'],
      priority: 'medium',
      action: {
        label: 'Dismiss',
        onClick: () => console.log('Test notification dismissed'),
      },
    };

    await this.notify(testNotification);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Convenience functions
export const notify = (options: NotificationOptions) => notificationService.notify(options);
export const notifySuccess = (title: string, message?: string) => 
  notificationService.notify({ type: 'success', title, message });
export const notifyError = (title: string, message?: string) => 
  notificationService.notify({ type: 'error', title, message });
export const notifyWarning = (title: string, message?: string) => 
  notificationService.notify({ type: 'warning', title, message });
export const notifyInfo = (title: string, message?: string) => 
  notificationService.notify({ type: 'info', title, message });