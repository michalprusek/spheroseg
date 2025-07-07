import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: number;
}

export interface NotificationSlice {
  // State
  notifications: Notification[];
  maxNotifications: number;
  defaultDuration: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  clearOldNotifications: () => void;
}

let notificationIdCounter = 0;

export const createNotificationSlice: StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  NotificationSlice
> = (set, get) => ({
  // Initial state
  notifications: [],
  maxNotifications: 5,
  defaultDuration: 5000,
  
  // Actions
  addNotification: (notificationData) => {
    const id = `notification-${++notificationIdCounter}`;
    const notification: Notification = {
      ...notificationData,
      id,
      duration: notificationData.duration ?? get().defaultDuration,
      createdAt: Date.now(),
    };
    
    set((state) => {
      state.notifications.unshift(notification);
      
      // Remove oldest notifications if exceeding max
      if (state.notifications.length > state.maxNotifications) {
        const toRemove = state.notifications.length - state.maxNotifications;
        state.notifications.splice(-toRemove, toRemove);
      }
    });
    
    // Auto-remove after duration unless persistent
    if (!notification.persistent && notification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, notification.duration);
    }
    
    return id;
  },
  
  removeNotification: (id) => {
    set((state) => {
      state.notifications = state.notifications.filter((n) => n.id !== id);
    });
  },
  
  clearNotifications: () => {
    set((state) => {
      state.notifications = [];
    });
  },
  
  clearOldNotifications: () => {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
    set((state) => {
      state.notifications = state.notifications.filter(
        (n) => n.persistent || now - n.createdAt < maxAge
      );
    });
  },
});

// Periodically clear old notifications
if (typeof window !== 'undefined') {
  setInterval(() => {
    useStore.getState().clearOldNotifications();
  }, 30000); // Every 30 seconds
}