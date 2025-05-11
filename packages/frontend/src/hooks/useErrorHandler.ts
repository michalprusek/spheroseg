import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import logger from '@/utils/logger';

/**
 * Hook for handling errors with toast notifications
 * @returns Error handling functions
 */
export const useToastErrorHandler = () => {
  const { t } = useLanguage();

  /**
   * Handle an error by showing a toast and logging it
   * @param error The error object
   * @param title Optional custom title
   * @param defaultMessage Optional default message if error doesn't have one
   */
  const handleError = (error: any, title?: string, defaultMessage?: string) => {
    // Log the error
    logger.error('Error handled by toast handler', { error });

    // Determine the error message
    const errorMessage = error?.message || error?.toString?.() || defaultMessage || t('error.handler.defaultMessage');

    // Show toast notification
    toast.error(errorMessage, {
      id: `error-${Date.now()}`,
      duration: 5000,
      important: true,
      ...(title ? { description: title } : {}),
    });
  };

  /**
   * Create an async error handler function
   * @param asyncFunction The async function to wrap
   * @param onSuccess Optional success callback
   * @param errorMessage Optional custom error message
   * @returns The wrapped function
   */
  const createAsyncErrorHandler = <T extends any[], R>(
    asyncFunction: (...args: T) => Promise<R>,
    onSuccess?: (result: R) => void,
    errorMessage?: string,
  ) => {
    return async (...args: T): Promise<R | null> => {
      try {
        const result = await asyncFunction(...args);
        if (onSuccess) {
          onSuccess(result);
        }
        return result;
      } catch (error) {
        handleError(error, t('error.handler.title'), errorMessage);
        return null;
      }
    };
  };

  return {
    handleError,
    createAsyncErrorHandler,
  };
};
