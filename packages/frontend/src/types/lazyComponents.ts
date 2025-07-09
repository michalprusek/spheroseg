/**
 * Type definitions for lazy-loaded components
 * Ensures type safety for React.lazy imports
 */

import { ComponentType, LazyExoticComponent, lazy } from 'react';

/**
 * Type for a module with a default export of a React component
 */
export interface ComponentModule {
  default: ComponentType<any>;
}

/**
 * Helper type for lazy loading with fallback
 */
export type LazyComponentWithFallback<T = any> = LazyExoticComponent<ComponentType<T>>;

/**
 * Creates a properly typed lazy component with error fallback
 */
export function createLazyComponent<T = any>(
  importFn: () => Promise<ComponentModule>,
  fallbackImportFn?: () => Promise<ComponentModule>,
): LazyComponentWithFallback<T> {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      console.error('Failed to load component:', error);
      if (fallbackImportFn) {
        return await fallbackImportFn();
      }
      throw error;
    }
  });
}

// Re-export lazy for convenience
export { lazy } from 'react';
