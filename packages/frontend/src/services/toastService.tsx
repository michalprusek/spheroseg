import React from 'react';
import { toast as sonnerToast, ExternalToast } from 'sonner';
import { IconType } from 'react-icons';
import { FiCheckCircle, FiXCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';

/**
 * Enhanced Toast Service
 * Provides a unified interface for all toast notifications in the application
 */

// Toast types
export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'custom';

// Toast options with enhanced features
export interface ToastOptions extends ExternalToast {
  // Display options
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  
  // Action options
  action?: {
    label: string;
    onClick: () => void;
  };
  
  // Styling options
  icon?: IconType | React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  
  // Behavior options
  dismissible?: boolean;
  persistent?: boolean;
  important?: boolean;
  
  // Progress options (for loading toasts)
  progress?: number;
  
  // Rich content
  description?: string;
  
  // Callbacks
  onDismiss?: (toast: any) => void;
  onAutoClose?: (toast: any) => void;
}

// Default durations for different toast types
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  info: 4000,
  warning: 4500,
  loading: Infinity,
  custom: 4000,
};

// Default icons for toast types
const DEFAULT_ICONS: Record<ToastType, React.ReactNode> = {
  success: <FiCheckCircle className="w-5 h-5" />,
  error: <FiXCircle className="w-5 h-5" />,
  info: <FiInfo className="w-5 h-5" />,
  warning: <FiAlertTriangle className="w-5 h-5" />,
  loading: null,
  custom: null,
};

class ToastService {
  private activeToasts = new Map<string, any>();
  private defaultOptions: Partial<ToastOptions> = {
    position: 'bottom-right',
    dismissible: true,
  };

  /**
   * Configure default toast options
   */
  configure(options: Partial<ToastOptions>) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Show a success toast
   */
  success(message: string, options?: ToastOptions) {
    const mergedOptions = this.mergeOptions('success', options);
    return sonnerToast.success(message, mergedOptions);
  }

  /**
   * Show an error toast
   */
  error(message: string, options?: ToastOptions) {
    const mergedOptions = this.mergeOptions('error', options);
    return sonnerToast.error(message, mergedOptions);
  }

  /**
   * Show an info toast
   */
  info(message: string, options?: ToastOptions) {
    const mergedOptions = this.mergeOptions('info', options);
    return sonnerToast.info(message, mergedOptions);
  }

  /**
   * Show a warning toast
   */
  warning(message: string, options?: ToastOptions) {
    const mergedOptions = this.mergeOptions('warning', options);
    return sonnerToast.warning(message, mergedOptions);
  }

  /**
   * Show a loading toast
   */
  loading(message: string, options?: ToastOptions) {
    const mergedOptions = this.mergeOptions('loading', options);
    const id = sonnerToast.loading(message, mergedOptions);
    this.activeToasts.set(id, { type: 'loading', message });
    return id;
  }

  /**
   * Update a loading toast to success
   */
  loadingSuccess(id: string | number, message: string, options?: ToastOptions) {
    this.activeToasts.delete(String(id));
    const mergedOptions = this.mergeOptions('success', options);
    return sonnerToast.success(message, { ...mergedOptions, id });
  }

  /**
   * Update a loading toast to error
   */
  loadingError(id: string | number, message: string, options?: ToastOptions) {
    this.activeToasts.delete(String(id));
    const mergedOptions = this.mergeOptions('error', options);
    return sonnerToast.error(message, { ...mergedOptions, id });
  }

  /**
   * Show a custom toast
   */
  custom(content: React.ReactNode, options?: ToastOptions) {
    const mergedOptions = this.mergeOptions('custom', options);
    return sonnerToast.custom(content, mergedOptions);
  }

  /**
   * Show a promise-based toast
   */
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ToastOptions
  ) {
    return sonnerToast.promise(promise, messages, options);
  }

  /**
   * Dismiss a specific toast or all toasts
   */
  dismiss(id?: string | number) {
    if (id) {
      this.activeToasts.delete(String(id));
      sonnerToast.dismiss(id);
    } else {
      this.activeToasts.clear();
      sonnerToast.dismiss();
    }
  }

  /**
   * Show a confirmation toast with action buttons
   */
  confirm(
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    options?: ToastOptions
  ) {
    const id = this.custom(
      <div className="flex flex-col gap-3">
        <p>{message}</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              onConfirm();
              this.dismiss(id);
            }}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Confirm
          </button>
          <button
            onClick={() => {
              onCancel?.();
              this.dismiss(id);
            }}
            className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
          >
            Cancel
          </button>
        </div>
      </div>,
      {
        duration: Infinity,
        ...options,
      }
    );
    return id;
  }

  /**
   * Show a multi-line toast with title and description
   */
  multiline(
    title: string,
    description: string,
    type: ToastType = 'info',
    options?: ToastOptions
  ) {
    const typeMethod = this[type as keyof ToastService] as any;
    if (typeof typeMethod === 'function') {
      return typeMethod.call(this, title, {
        description,
        ...options,
      });
    }
    return this.info(title, { description, ...options });
  }

  /**
   * Show a progress toast
   */
  progress(
    message: string,
    progress: number,
    options?: ToastOptions
  ) {
    return this.custom(
      <div className="flex flex-col gap-2">
        <p>{message}</p>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
      </div>,
      {
        duration: Infinity,
        ...options,
      }
    );
  }

  /**
   * Show a toast for copy to clipboard
   */
  copyToClipboard(text: string, successMessage = 'Copied to clipboard!') {
    navigator.clipboard.writeText(text)
      .then(() => this.success(successMessage))
      .catch(() => this.error('Failed to copy to clipboard'));
  }

  /**
   * Show a toast for network errors
   */
  networkError(message = 'Network error. Please check your connection.') {
    return this.error(message, {
      duration: 6000,
      action: {
        label: 'Retry',
        onClick: () => window.location.reload(),
      },
    });
  }

  /**
   * Show a toast for form validation errors
   */
  validationError(errors: string[] | string) {
    const errorList = Array.isArray(errors) ? errors : [errors];
    
    if (errorList.length === 1) {
      return this.error(errorList[0]);
    }
    
    return this.custom(
      <div className="flex flex-col gap-2">
        <p className="font-semibold">Validation errors:</p>
        <ul className="list-disc list-inside text-sm">
          {errorList.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </div>,
      {
        duration: 6000,
        className: 'bg-destructive text-destructive-foreground',
      }
    );
  }

  /**
   * Get all active toasts
   */
  getActiveToasts() {
    return Array.from(this.activeToasts.entries()).map(([id, toast]) => ({
      id,
      ...toast,
    }));
  }

  /**
   * Clear all active toasts
   */
  clearAll() {
    this.dismiss();
  }

  /**
   * Merge options with defaults
   */
  private mergeOptions(type: ToastType, options?: ToastOptions): ToastOptions {
    const icon = options?.icon !== undefined ? options.icon : DEFAULT_ICONS[type];
    const duration = options?.duration !== undefined ? options.duration : DEFAULT_DURATIONS[type];
    
    return {
      ...this.defaultOptions,
      duration,
      icon,
      ...options,
    };
  }
}

// Create and export singleton instance
export const toastService = new ToastService();

// Export convenience functions for backward compatibility
export const showSuccess = (message: string, duration?: number) => 
  toastService.success(message, { duration });

export const showError = (message: string, duration?: number) => 
  toastService.error(message, { duration });

export const showInfo = (message: string, duration?: number) => 
  toastService.info(message, { duration });

export const showWarning = (message: string, duration?: number) => 
  toastService.warning(message, { duration });

// Re-export toast for direct access
export { sonnerToast as toast };

export default toastService;