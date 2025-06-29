import { useCallback, useRef } from 'react';
import toastService, { ToastOptions, ToastType } from '@/services/toastService';
import { useTranslation } from 'react-i18next';

/**
 * Enhanced toast hook with i18n support and additional features
 */
export function useToast() {
  const { t } = useTranslation();
  const activeToastsRef = useRef<Map<string, string | number>>(new Map());

  // Helper to translate message if it's a translation key
  const translateMessage = useCallback((message: string) => {
    // Check if message looks like a translation key (contains dots)
    if (message.includes('.') && !message.includes(' ')) {
      try {
        const translated = t(message);
        // If translation is different from key, use it
        return translated !== message ? translated : message;
      } catch {
        return message;
      }
    }
    return message;
  }, [t]);

  // Success toast
  const success = useCallback((message: string, options?: ToastOptions) => {
    return toastService.success(translateMessage(message), options);
  }, [translateMessage]);

  // Error toast
  const error = useCallback((message: string, options?: ToastOptions) => {
    return toastService.error(translateMessage(message), options);
  }, [translateMessage]);

  // Info toast
  const info = useCallback((message: string, options?: ToastOptions) => {
    return toastService.info(translateMessage(message), options);
  }, [translateMessage]);

  // Warning toast
  const warning = useCallback((message: string, options?: ToastOptions) => {
    return toastService.warning(translateMessage(message), options);
  }, [translateMessage]);

  // Loading toast
  const loading = useCallback((message: string, options?: ToastOptions) => {
    const translatedMessage = translateMessage(message);
    const id = toastService.loading(translatedMessage, options);
    activeToastsRef.current.set(translatedMessage, id);
    return id;
  }, [translateMessage]);

  // Update loading toast to success
  const loadingSuccess = useCallback((
    idOrMessage: string | number,
    message: string,
    options?: ToastOptions
  ) => {
    let id = idOrMessage;
    
    // If idOrMessage is a string, check if it's a known loading message
    if (typeof idOrMessage === 'string' && activeToastsRef.current.has(idOrMessage)) {
      id = activeToastsRef.current.get(idOrMessage)!;
      activeToastsRef.current.delete(idOrMessage);
    }
    
    return toastService.loadingSuccess(id, translateMessage(message), options);
  }, [translateMessage]);

  // Update loading toast to error
  const loadingError = useCallback((
    idOrMessage: string | number,
    message: string,
    options?: ToastOptions
  ) => {
    let id = idOrMessage;
    
    // If idOrMessage is a string, check if it's a known loading message
    if (typeof idOrMessage === 'string' && activeToastsRef.current.has(idOrMessage)) {
      id = activeToastsRef.current.get(idOrMessage)!;
      activeToastsRef.current.delete(idOrMessage);
    }
    
    return toastService.loadingError(id, translateMessage(message), options);
  }, [translateMessage]);

  // Promise toast
  const promise = useCallback(<T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ToastOptions
  ) => {
    return toastService.promise(
      promise,
      {
        loading: translateMessage(messages.loading),
        success: typeof messages.success === 'string' 
          ? translateMessage(messages.success)
          : (data) => translateMessage(messages.success(data)),
        error: typeof messages.error === 'string'
          ? translateMessage(messages.error)
          : (err) => translateMessage(messages.error(err)),
      },
      options
    );
  }, [translateMessage]);

  // Custom toast
  const custom = useCallback((content: React.ReactNode, options?: ToastOptions) => {
    return toastService.custom(content, options);
  }, []);

  // Confirm toast
  const confirm = useCallback((
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    options?: ToastOptions
  ) => {
    return toastService.confirm(
      translateMessage(message),
      onConfirm,
      onCancel,
      options
    );
  }, [translateMessage]);

  // Multi-line toast
  const multiline = useCallback((
    title: string,
    description: string,
    type: ToastType = 'info',
    options?: ToastOptions
  ) => {
    return toastService.multiline(
      translateMessage(title),
      translateMessage(description),
      type,
      options
    );
  }, [translateMessage]);

  // Progress toast
  const progress = useCallback((
    message: string,
    progress: number,
    options?: ToastOptions
  ) => {
    return toastService.progress(translateMessage(message), progress, options);
  }, [translateMessage]);

  // Copy to clipboard
  const copyToClipboard = useCallback((
    text: string,
    successMessage?: string
  ) => {
    const message = successMessage || t('common.messages.copiedToClipboard', 'Copied to clipboard!');
    return toastService.copyToClipboard(text, message);
  }, [t]);

  // Network error
  const networkError = useCallback((message?: string) => {
    const errorMessage = message || t('errors.messages.network', 'Network error. Please check your connection.');
    return toastService.networkError(errorMessage);
  }, [t]);

  // Validation error
  const validationError = useCallback((errors: string[] | string) => {
    const translatedErrors = Array.isArray(errors)
      ? errors.map(e => translateMessage(e))
      : translateMessage(errors);
    return toastService.validationError(translatedErrors);
  }, [translateMessage]);

  // Dismiss toast
  const dismiss = useCallback((id?: string | number) => {
    if (id === undefined) {
      activeToastsRef.current.clear();
    }
    return toastService.dismiss(id);
  }, []);

  // Clear all toasts
  const clearAll = useCallback(() => {
    activeToastsRef.current.clear();
    return toastService.clearAll();
  }, []);

  return {
    // Basic toasts
    success,
    error,
    info,
    warning,
    
    // Loading toasts
    loading,
    loadingSuccess,
    loadingError,
    
    // Advanced toasts
    promise,
    custom,
    confirm,
    multiline,
    progress,
    
    // Utility functions
    copyToClipboard,
    networkError,
    validationError,
    dismiss,
    clearAll,
    
    // Direct access to service
    service: toastService,
  };
}

// Export for backward compatibility
export { toastService as toast };
export default useToast;