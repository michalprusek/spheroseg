/**
 * Hook for Error Boundary integration
 * 
 * Provides utilities for working with error boundaries in functional components
 */

import { useCallback, useState } from 'react';
import logger from '@/utils/logger';

interface ErrorState {
  hasError: boolean;
  error: Error | null;
  resetCount: number;
}

interface UseErrorBoundaryReturn {
  resetErrorBoundary: () => void;
  throwError: (error: Error) => void;
  errorState: ErrorState;
  resetKey: string | number;
}

/**
 * Hook that provides error boundary functionality for functional components
 * 
 * @param onError - Optional callback when an error is caught
 * @returns Object with error handling utilities
 */
export function useErrorBoundary(
  onError?: (error: Error) => void
): UseErrorBoundaryReturn {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    resetCount: 0,
  });

  // Generate a reset key that changes when reset is called
  const resetKey = `reset-${errorState.resetCount}`;

  const resetErrorBoundary = useCallback(() => {
    setErrorState(prev => ({
      hasError: false,
      error: null,
      resetCount: prev.resetCount + 1,
    }));
  }, []);

  const throwError = useCallback((error: Error) => {
    logger.error('Error thrown via useErrorBoundary', {
      error: error.message,
      stack: error.stack,
    });
    
    if (onError) {
      onError(error);
    }
    
    setErrorState(prev => ({
      hasError: true,
      error,
      resetCount: prev.resetCount,
    }));
    
    // Throw the error to be caught by the nearest error boundary
    throw error;
  }, [onError]);

  return {
    resetErrorBoundary,
    throwError,
    errorState,
    resetKey,
  };
}

/**
 * Hook that automatically resets error boundary on dependency changes
 * 
 * @param dependencies - Array of dependencies that trigger reset
 * @returns Reset key for error boundary
 */
export function useErrorBoundaryReset(dependencies: any[]): string {
  const [resetCount, setResetCount] = useState(0);
  
  // Create a stable string from dependencies for comparison
  const depString = JSON.stringify(dependencies);
  
  // Reset when dependencies change
  useState(() => {
    setResetCount(prev => prev + 1);
  });
  
  return `reset-${resetCount}-${depString}`;
}

/**
 * Hook for async error handling in functional components
 * 
 * @param asyncFunction - The async function to wrap
 * @returns Wrapped function that catches and rethrows errors
 */
export function useAsyncError<T extends (...args: any[]) => Promise<any>>(
  asyncFunction: T
): T {
  const [, setError] = useState<Error | null>(null);
  
  return useCallback(((...args: Parameters<T>) => {
    return asyncFunction(...args).catch((error: Error) => {
      logger.error('Async error caught', {
        error: error.message,
        stack: error.stack,
      });
      
      // This will trigger the error boundary
      setError(() => {
        throw error;
      });
    });
  }) as T, [asyncFunction]);
}

/**
 * Hook for declarative error throwing
 * 
 * @returns Function to throw errors that will be caught by error boundary
 */
export function useThrowError(): (error: Error) => never {
  const [, setError] = useState<Error | null>(null);
  
  return useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
    
    // TypeScript needs this for the never return type
    throw error;
  }, []);
}