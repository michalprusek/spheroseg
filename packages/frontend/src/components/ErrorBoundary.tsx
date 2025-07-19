import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import logger from '@/utils/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { handleError } from '@/utils/error/unifiedErrorHandler';
import { markErrorAsHandled } from '@/utils/error/globalErrorHandler';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  componentName?: string;
  t?: (key: string) => string;
  level?: 'page' | 'component' | 'app';
  resetKeys?: Array<string | number>;
  isolate?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  errorCount: number;
  lastErrorTime: number;
}

/**
 * Error boundary component to catch JavaScript errors in child component tree
 * and display a fallback UI instead of crashing the whole application.
 */
class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      errorCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId,
      errorCount: 0,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Mark error as handled to prevent double-handling by global error handler
    markErrorAsHandled(error);

    const { errorId, errorCount, lastErrorTime } = this.state;
    const currentTime = Date.now();
    
    // Check if we're getting too many errors (rate limiting)
    const timeSinceLastError = currentTime - lastErrorTime;
    const isRapidError = timeSinceLastError < 1000; // Less than 1 second
    const newErrorCount = isRapidError ? errorCount + 1 : 1;
    
    // If we're getting too many errors too quickly, don't log each one
    const shouldLog = newErrorCount <= 5 || timeSinceLastError > 5000;
    
    if (shouldLog) {
      // Log the error to our logging service
      logger.error('Error caught by ErrorBoundary', {
        errorId,
        error: error.toString(),
        componentStack: errorInfo.componentStack,
        component: this.props.componentName || 'Unknown',
        level: this.props.level || 'component',
        errorCount: newErrorCount,
        rapidErrors: isRapidError,
      });
    }

    // Handle the error with our error handling system
    handleError(error, {
      showToast: false, // Don't show toast for UI errors
      logError: false, // Already logged above
      context: {
        errorId,
        component: `ErrorBoundary: ${this.props.componentName || 'Unknown'}`,
        componentStack: errorInfo.componentStack,
        level: this.props.level,
        errorCount: newErrorCount,
      },
    });

    this.setState({
      errorInfo,
      errorCount: newErrorCount,
      lastErrorTime: currentTime,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // If isolate is true and this is a component-level error, don't propagate
    if (this.props.isolate && this.props.level === 'component') {
      error.stopPropagation?.();
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      errorCount: 0,
      lastErrorTime: 0,
    });
  };

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset the error state when props change if resetOnPropsChange is true
    if (this.state.hasError && this.props.resetOnPropsChange && prevProps !== this.props) {
      this.handleReset();
    }
    
    // Reset if any reset keys changed
    if (this.state.hasError && this.props.resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      
      if (hasResetKeyChanged) {
        this.handleReset();
      }
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise, use the default fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="text-red-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2 dark:text-white">
            {this.props.level === 'app' 
              ? (this.props.t ? this.props.t('errors.applicationError') : 'Application Error')
              : this.props.level === 'page'
              ? (this.props.t ? this.props.t('errors.pageError') : 'Page Error')
              : (this.props.t ? this.props.t('errors.somethingWentWrong') : 'Something went wrong')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-center max-w-md">
            {this.props.level === 'app'
              ? (this.props.t 
                  ? this.props.t('errors.applicationErrorDesc') 
                  : "The application encountered a critical error. Please refresh the page or contact support if the issue persists.")
              : this.props.level === 'page'
              ? (this.props.t 
                  ? this.props.t('errors.pageErrorDesc') 
                  : "This page encountered an error. You can try refreshing or navigating to a different page.")
              : (this.props.t
                  ? this.props.t('errors.componentError')
                  : "An error occurred in this component. We've been notified and will fix the issue as soon as possible.")}
          </p>
          
          {this.state.errorId && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Error ID: {this.state.errorId}
            </p>
          )}
          
          {this.state.errorCount > 3 && (
            <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {this.props.t 
                  ? this.props.t('errors.multipleErrors') 
                  : `Multiple errors detected (${this.state.errorCount} errors). The component may be unstable.`}
              </p>
            </div>
          )}

          {process.env.NODE_ENV !== 'production' && (
            <div className="mb-6 w-full max-w-md">
              <details className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm">
                <summary className="font-medium cursor-pointer">
                  {this.props.t ? this.props.t('errors.errorDetails') : 'Error Details'}
                </summary>
                <pre className="mt-2 text-red-600 dark:text-red-400 overflow-auto max-h-[200px]">
                  {this.state.error?.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre className="mt-2 text-gray-700 dark:text-gray-300 overflow-auto max-h-[200px]">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="default" onClick={this.handleReset}>
              {this.props.t ? this.props.t('errors.tryAgain') : 'Try Again'}
            </Button>
            {(this.props.level === 'app' || this.props.level === 'page') && (
              <>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  {this.props.t ? this.props.t('errors.reloadPage') : 'Reload Page'}
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/'}>
                  {this.props.t ? this.props.t('errors.goHome') : 'Go Home'}
                </Button>
              </>
            )}
            {this.props.level === 'component' && (
              <Button variant="outline" onClick={() => window.history.back()}>
                {this.props.t ? this.props.t('errors.goBack') : 'Go Back'}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper component to provide translations to the ErrorBoundary
 */
const ErrorBoundary: React.FC<ErrorBoundaryProps> = (props) => {
  // Try to use the language context, but don't fail if it's not available
  let t: (key: string) => string;
  let _hasLanguageContext = true;

  try {
    const languageContext = useLanguage();
    t = languageContext.t;
  } catch (_error) {
    // If useLanguage fails, we're outside of a LanguageProvider
    _hasLanguageContext = false;
    t = (key: string) => {
      // Simple fallback function that returns the key or a default value
      const fallbacks: Record<string, string> = {
        'errors.somethingWentWrong': 'Something went wrong',
        'errors.applicationError': 'Application Error',
        'errors.applicationErrorDesc': 'The application encountered a critical error. Please refresh the page or contact support if the issue persists.',
        'errors.pageError': 'Page Error',
        'errors.pageErrorDesc': 'This page encountered an error. You can try refreshing or navigating to a different page.',
        'errors.componentError':
          "An error occurred in this component. We've been notified and will fix the issue as soon as possible.",
        'errors.errorDetails': 'Error Details',
        'errors.tryAgain': 'Try Again',
        'errors.reloadPage': 'Reload Page',
        'errors.goBack': 'Go Back',
        'errors.goHome': 'Go Home',
        'errors.multipleErrors': 'Multiple errors detected. The component may be unstable.',
      };
      return fallbacks[key] || key;
    };
  }

  // Create a custom fallback with translations if none is provided
  const translatedFallback = props.fallback ? (
    props.fallback
  ) : (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="text-red-500 mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-bold mb-2 dark:text-white">{t('errors.somethingWentWrong')}</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6 text-center max-w-md">{t('errors.componentError')}</p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="default" onClick={() => window.location.reload()}>
          {t('errors.tryAgain')}
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          {t('errors.goBack')}
        </Button>
      </div>
    </div>
  );

  return <ErrorBoundaryClass {...props} fallback={translatedFallback} t={t} />;
};

export default ErrorBoundary;
