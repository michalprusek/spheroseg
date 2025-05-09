import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import logger from '@/utils/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { handleError, ErrorType, ErrorSeverity } from '@/utils/errorHandling';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
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
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to our logging service
    logger.error('Error caught by ErrorBoundary', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      component: this.props.componentName || 'Unknown',
    });

    // Handle the error with our error handling system
    handleError(error, {
      showToast: false, // Don't show toast for UI errors
      logError: false, // Already logged above
      context: `ErrorBoundary: ${this.props.componentName || 'Unknown'}`,
      errorInfo: {
        type: ErrorType.CLIENT,
        severity: ErrorSeverity.ERROR,
        details: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    this.setState({
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset the error state when props change if resetOnPropsChange is true
    if (
      this.state.hasError &&
      this.props.resetOnPropsChange &&
      prevProps !== this.props
    ) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }
  };

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
          <h2 className="text-2xl font-bold mb-2 dark:text-white">Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-center max-w-md">
            An error occurred in this component. We've been notified and will fix the issue as soon as possible.
          </p>

          {process.env.NODE_ENV !== 'production' && (
            <div className="mb-6 w-full max-w-md">
              <details className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm">
                <summary className="font-medium cursor-pointer">Error Details</summary>
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
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
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
  let hasLanguageContext = true;

  try {
    const languageContext = useLanguage();
    t = languageContext.t;
  } catch (error) {
    // If useLanguage fails, we're outside of a LanguageProvider
    hasLanguageContext = false;
    t = (key: string) => {
      // Simple fallback function that returns the key or a default value
      const fallbacks: Record<string, string> = {
        'errors.somethingWentWrong': 'Something went wrong',
        'errors.componentError': 'An error occurred in this component. We\'ve been notified and will fix the issue as soon as possible.',
        'errors.tryAgain': 'Try Again',
        'errors.goBack': 'Go Back'
      };
      return fallbacks[key] || key;
    };
  }

  // Create a custom fallback with translations if none is provided
  const translatedFallback = props.fallback ? props.fallback : (
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
        {t('errors.somethingWentWrong')}
      </h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6 text-center max-w-md">
        {t('errors.componentError')}
      </p>

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

  return <ErrorBoundaryClass {...props} fallback={translatedFallback} />;
};

export default ErrorBoundary;
