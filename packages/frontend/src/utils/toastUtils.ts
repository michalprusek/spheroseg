import { toast } from 'react-hot-toast';

/**
 * Show a success toast notification
 * @param message Message to display
 * @param duration Duration in milliseconds (default: 3000)
 */
export const showSuccess = (message: string, duration: number = 3000) => {
  toast.success(message, {
    duration,
    style: {
      padding: '16px',
      borderRadius: '8px',
      background: '#10B981',
      color: '#FFFFFF',
    },
  });
};

/**
 * Show an error toast notification
 * @param message Message to display
 * @param duration Duration in milliseconds (default: 4000)
 */
export const showError = (message: string, duration: number = 4000) => {
  toast.error(message, {
    duration,
    style: {
      padding: '16px',
      borderRadius: '8px',
      background: '#EF4444',
      color: '#FFFFFF',
    },
  });
};

/**
 * Show an info toast notification
 * @param message Message to display
 * @param duration Duration in milliseconds (default: 3000)
 */
export const showInfo = (message: string, duration: number = 3000) => {
  toast(message, {
    duration,
    style: {
      padding: '16px',
      borderRadius: '8px',
      background: '#3B82F6',
      color: '#FFFFFF',
    },
  });
};

/**
 * Show a warning toast notification
 * @param message Message to display
 * @param duration Duration in milliseconds (default: 3500)
 */
export const showWarning = (message: string, duration: number = 3500) => {
  toast(message, {
    duration,
    style: {
      padding: '16px',
      borderRadius: '8px',
      background: '#F59E0B',
      color: '#FFFFFF',
    },
    icon: '⚠️',
  });
};

export default {
  showSuccess,
  showError,
  showInfo,
  showWarning,
};
