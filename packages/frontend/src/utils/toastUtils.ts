import { toast } from 'sonner';

/**
 * Show a success toast notification
 * @param message Message to display
 * @param duration Duration in milliseconds (default: 3000)
 */
export const showSuccess = (message: string, duration: number = 3000) => {
  toast.success(message, {
    duration,
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
  });
};

/**
 * Show an info toast notification
 * @param message Message to display
 * @param duration Duration in milliseconds (default: 3000)
 */
export const showInfo = (message: string, duration: number = 3000) => {
  toast.info(message, {
    duration,
  });
};

/**
 * Show a warning toast notification
 * @param message Message to display
 * @param duration Duration in milliseconds (default: 3500)
 */
export const showWarning = (message: string, duration: number = 3500) => {
  toast.warning(message, {
    duration,
  });
};

export default {
  showSuccess,
  showError,
  showInfo,
  showWarning,
};
