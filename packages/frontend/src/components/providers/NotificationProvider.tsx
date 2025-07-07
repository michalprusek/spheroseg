import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { useNotifications } from '@/store';
import type { Notification } from '@/store/slices/notificationSlice';

const iconMap = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

const colorMap = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
};

interface NotificationItemProps {
  notification: Notification;
}

function NotificationItem({ notification }: NotificationItemProps) {
  const { removeNotification } = useNotifications();
  const Icon = iconMap[notification.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${
        colorMap[notification.type]
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      
      <div className="flex-1 min-w-0">
        <p className="font-medium">{notification.title}</p>
        {notification.message && (
          <p className="mt-1 text-sm opacity-90">{notification.message}</p>
        )}
        {notification.action && (
          <button
            onClick={notification.action.onClick}
            className="mt-2 text-sm font-medium hover:underline"
          >
            {notification.action.label}
          </button>
        )}
      </div>
      
      <button
        onClick={() => removeNotification(notification.id)}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Dismiss notification"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </motion.div>
  );
}

/**
 * NotificationProvider - Renders notifications from Zustand store
 * 
 * Features:
 * - Auto-positioning in top-right corner
 * - Smooth animations with Framer Motion
 * - Auto-dismiss after duration
 * - Action buttons support
 * - Accessible markup
 */
export function NotificationProvider() {
  const { notifications } = useNotifications();

  return (
    <div
      className="fixed top-4 right-4 z-50 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence mode="popLayout">
        <div className="space-y-2 pointer-events-auto max-w-sm">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}