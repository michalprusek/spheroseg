/**
 * App-level Error Boundary
 * 
 * Top-level error boundary that catches all unhandled errors in the application
 */

import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { APP_CONFIG } from '@/config/app.config';
import logger from '@/utils/logger';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

const AppErrorFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="max-w-md w-full p-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full mb-4">
          <svg
            className="w-10 h-10 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
          Critical Application Error
        </h1>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          We&apos;re sorry, but the application has encountered a critical error and cannot continue.
          This issue has been logged and our team has been notified.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reload Application
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Go to Home
          </button>
          
          <a
            href={`mailto:${APP_CONFIG.contact.email}?subject=Application Error`}
            className="block w-full px-4 py-2 text-center text-blue-600 dark:text-blue-400 hover:underline"
          >
            Contact Support
          </a>
        </div>
        
        <div className="mt-8 text-xs text-gray-500 dark:text-gray-400">
          <p>Application Version: {APP_CONFIG.version}</p>
          <p>Error Time: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  </div>
);

export const AppErrorBoundary: React.FC<AppErrorBoundaryProps> = ({ children }) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log critical app-level errors with extra context
    logger.error('Critical application error', {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      appVersion: APP_CONFIG.version,
    });
    
    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service
      // sendToErrorTracker({ error, errorInfo, context: 'app-level' });
    }
  };
  
  return (
    <ErrorBoundary
      level="app"
      fallback={<AppErrorFallback />}
      onError={handleError}
      componentName="Application"
    >
      {children}
    </ErrorBoundary>
  );
};

export default AppErrorBoundary;