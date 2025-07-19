/**
 * Global Error Handler
 * 
 * Sets up global handlers for unhandled errors and promise rejections
 * to ensure all errors are caught and processed through our centralized system
 */

import { handleError, ErrorType, ErrorSeverity } from './unifiedErrorHandler';

/**
 * Initialize global error handlers
 */
export function initializeGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // Prevent the default browser error handling
    event.preventDefault();
    
    // Log to centralized error handler
    handleError(error, {
      showToast: true,
      context: {
        type: 'unhandledRejection',
        promise: event.promise,
        location: window.location.href,
      },
      customMessage: 'An unexpected error occurred. Please try again.',
    });
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    // Skip errors that are already handled by React Error Boundaries
    if (event.error && event.error._isHandledByBoundary) {
      return;
    }

    // Skip cross-origin script errors
    if (event.message === 'Script error.' && !event.filename) {
      return;
    }
    
    // Prevent the default browser error handling
    event.preventDefault();
    
    // Log to centralized error handler
    handleError(event.error || event.message, {
      showToast: true,
      context: {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        location: window.location.href,
      },
      customMessage: 'An unexpected error occurred. Please refresh the page.',
    });
  });

  // Handle network errors specifically
  window.addEventListener('offline', () => {
    handleError(new Error('Network connection lost'), {
      showToast: true,
      context: {
        type: 'networkOffline',
        location: window.location.href,
      },
      customMessage: 'You are offline. Please check your internet connection.',
    });
  });

  // Log when network is restored
  window.addEventListener('online', () => {
    // This is informational, not an error
    console.log('Network connection restored');
  });

  // Add handler for console errors in development
  if (import.meta.env.DEV) {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Call original console.error
      originalConsoleError.apply(console, args);
      
      // Skip React's error boundary warnings
      const message = args[0]?.toString() || '';
      if (message.includes('ReactErrorBoundary') || message.includes('Consider adding an error boundary')) {
        return;
      }
      
      // Log to our system for tracking
      handleError(new Error(message), {
        showToast: false, // Don't show toast for console errors
        logError: true,
        context: {
          type: 'consoleError',
          args,
          location: window.location.href,
        },
      });
    };
  }
}

/**
 * Mark an error as handled by an error boundary
 * This prevents double-handling of errors
 */
export function markErrorAsHandled(error: Error): void {
  (error as any)._isHandledByBoundary = true;
}

/**
 * Clean up global error handlers (useful for testing)
 */
export function cleanupGlobalErrorHandlers(): void {
  window.removeEventListener('unhandledrejection', () => {});
  window.removeEventListener('error', () => {});
  window.removeEventListener('offline', () => {});
  window.removeEventListener('online', () => {});
}