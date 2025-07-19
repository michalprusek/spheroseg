import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { useEffect } from 'react';
import { handleError, ErrorType } from '@/utils/error/unifiedErrorHandler';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export function RouterErrorBoundary() {
  const error = useRouteError();
  const { t } = useLanguage();

  // Log the error to our centralized error handler
  useEffect(() => {
    if (error) {
      let _errorType = ErrorType.UNKNOWN;
      let errorMessage = 'An unexpected error occurred';
      
      if (isRouteErrorResponse(error)) {
        switch (error.status) {
          case 404:
            _errorType = ErrorType.NOT_FOUND;
            errorMessage = error.data?.message || 'Page not found';
            break;
          case 401:
            _errorType = ErrorType.AUTHENTICATION;
            errorMessage = 'Authentication required';
            break;
          case 403:
            _errorType = ErrorType.AUTHORIZATION;
            errorMessage = 'Access denied';
            break;
          default:
            _errorType = error.status >= 500 ? ErrorType.SERVER : ErrorType.CLIENT;
            errorMessage = error.data?.message || error.statusText || 'An error occurred';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      handleError(error, {
        showToast: false, // Don't show toast for route errors - we're showing a full page
        context: { component: 'RouterErrorBoundary', route: window.location.pathname }
      });
    }
  }, [error]);

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-red-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error.status === 404 ? t('errors.pageNotFound') : `${error.status} ${error.statusText}`}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error.data?.message || t('errors.routeError')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="default" onClick={() => window.location.href = '/'}>
              {t('errors.returnHome')}
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              {t('errors.goBack')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-red-500 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto"
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('errors.unexpectedError')}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {error instanceof Error ? error.message : t('errors.somethingWentWrong')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="default" onClick={() => window.location.href = '/'}>
            {t('errors.returnHome')}
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t('errors.reloadPage')}
          </Button>
        </div>
      </div>
    </div>
  );
}