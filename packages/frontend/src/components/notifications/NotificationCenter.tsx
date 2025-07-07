import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  FunnelIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid';
import { notificationService, type NotificationType } from '@/services/notificationService';
import { useNotifications } from '@/store';
import { cn } from '@/utils/cn';

interface NotificationCenterProps {
  className?: string;
}

/**
 * NotificationCenter - Centralized notification management UI
 */
export function NotificationCenter({ className }: NotificationCenterProps) {
  const { notifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Calculate unread count
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  useEffect(() => {
    if (isOpen && history.length === 0) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const historicalNotifications = await notificationService.getHistory({
        limit: 50,
      });
      setHistory(historicalNotifications);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const iconMap = {
    success: CheckCircleIcon,
    error: ExclamationCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon,
  };

  const colorMap = {
    success: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
    error: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
    warning: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20',
    info: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
  };

  const filteredNotifications = [
    ...notifications,
    ...history,
  ].filter(n => filter === 'all' || n.type === filter);

  const filterOptions: Array<{ value: NotificationType | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'info', label: 'Info' },
    { value: 'success', label: 'Success' },
    { value: 'warning', label: 'Warning' },
    { value: 'error', label: 'Error' },
  ];

  const renderNotification = (notification: any) => {
    const Icon = iconMap[notification.type];
    const isRecent = Date.now() - notification.createdAt < 5 * 60 * 1000; // 5 minutes

    return (
      <div
        key={notification.id}
        className={cn(
          'p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
          isRecent && 'bg-blue-50/10 dark:bg-blue-900/10'
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', colorMap[notification.type])}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium">{notification.title}</p>
                {notification.message && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {notification.message}
                  </p>
                )}
              </div>
              <time className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {format(notification.createdAt, 'MMM d, h:mm a')}
              </time>
            </div>
            
            {notification.action && (
              <button
                onClick={notification.action.onClick}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {notification.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('relative', className)}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellSolidIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        ) : (
          <BellIcon className="h-6 w-6" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full">
            <span className="sr-only">{unreadCount} unread notifications</span>
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 max-h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label="Settings"
                  >
                    <Cog6ToothIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Filter Tabs */}
              {!showSettings && (
                <div className="flex items-center gap-1 mt-3 -mb-4">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFilter(option.value)}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors',
                        filter === option.value
                          ? 'bg-gray-100 dark:bg-gray-700'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {showSettings ? (
                <NotificationSettings onClose={() => setShowSettings(false)} />
              ) : (
                <>
                  {filteredNotifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <BellIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    <div>
                      {filteredNotifications.map(renderNotification)}
                    </div>
                  )}
                  
                  {isLoadingHistory && (
                    <div className="p-4 text-center text-gray-500">
                      Loading history...
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!showSettings && (
              <div className="p-3 border-t dark:border-gray-700">
                <button
                  onClick={() => {
                    notificationService.clearAll();
                    setHistory([]);
                  }}
                  className="w-full px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Clear All Notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface NotificationSettingsProps {
  onClose: () => void;
}

function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState(notificationService.getPreferences());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    notificationService.updatePreferences(preferences);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 500);
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await notificationService.requestPushPermission();
      if (granted) {
        setPreferences({
          ...preferences,
          channels: { ...preferences.channels, push: true },
        });
      }
    } else {
      setPreferences({
        ...preferences,
        channels: { ...preferences.channels, push: false },
      });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h4 className="font-medium mb-3">Notification Settings</h4>
      
      {/* Channels */}
      <div>
        <h5 className="text-sm font-medium mb-2">Notification Channels</h5>
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-sm">Toast Notifications</span>
            <input
              type="checkbox"
              checked={preferences.channels.toast}
              onChange={(e) => setPreferences({
                ...preferences,
                channels: { ...preferences.channels, toast: e.target.checked },
              })}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">In-App Notifications</span>
            <input
              type="checkbox"
              checked={preferences.channels.inApp}
              onChange={(e) => setPreferences({
                ...preferences,
                channels: { ...preferences.channels, inApp: e.target.checked },
              })}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">Push Notifications</span>
            <input
              type="checkbox"
              checked={preferences.channels.push}
              onChange={(e) => handlePushToggle(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">Email Notifications</span>
            <input
              type="checkbox"
              checked={preferences.channels.email}
              onChange={(e) => setPreferences({
                ...preferences,
                channels: { ...preferences.channels, email: e.target.checked },
              })}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {/* Priorities */}
      <div>
        <h5 className="text-sm font-medium mb-2">Notification Priorities</h5>
        <div className="space-y-2">
          {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => (
            <label key={priority} className="flex items-center justify-between">
              <span className="text-sm capitalize">{priority} Priority</span>
              <input
                type="checkbox"
                checked={preferences.priorities[priority]}
                onChange={(e) => setPreferences({
                  ...preferences,
                  priorities: { ...preferences.priorities, [priority]: e.target.checked },
                })}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div>
        <h5 className="text-sm font-medium mb-2">Quiet Hours</h5>
        <label className="flex items-center justify-between mb-2">
          <span className="text-sm">Enable Quiet Hours</span>
          <input
            type="checkbox"
            checked={preferences.quiet.enabled}
            onChange={(e) => setPreferences({
              ...preferences,
              quiet: { ...preferences.quiet, enabled: e.target.checked },
            })}
            className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
        
        {preferences.quiet.enabled && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="time"
              value={preferences.quiet.start}
              onChange={(e) => setPreferences({
                ...preferences,
                quiet: { ...preferences.quiet, start: e.target.value },
              })}
              className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <span>to</span>
            <input
              type="time"
              value={preferences.quiet.end}
              onChange={(e) => setPreferences({
                ...preferences,
                quiet: { ...preferences.quiet, end: e.target.value },
              })}
              className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        )}
      </div>

      {/* Sound & Vibration */}
      <div>
        <h5 className="text-sm font-medium mb-2">Sound & Vibration</h5>
        <label className="flex items-center justify-between mb-2">
          <span className="text-sm">Notification Sounds</span>
          <input
            type="checkbox"
            checked={preferences.sound}
            onChange={(e) => setPreferences({
              ...preferences,
              sound: e.target.checked,
            })}
            className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
        
        <label className="flex items-center justify-between">
          <span className="text-sm">Vibration</span>
          <input
            type="checkbox"
            checked={preferences.vibrate}
            onChange={(e) => setPreferences({
              ...preferences,
              vibrate: e.target.checked,
            })}
            className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => notificationService.test()}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Test Notifications
        </button>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}