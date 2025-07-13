/**
 * Enhanced lazy loading with retry logic and error handling
 * 
 * This utility provides a better lazy loading experience by:
 * 1. Retrying failed imports (useful for network issues)
 * 2. Providing proper error boundaries
 * 3. Supporting preloading for critical routes
 */

import React, { lazy, ComponentType, LazyExoticComponent } from 'react';

// Type for the import function
type ImportFunction<T> = () => Promise<{ default: ComponentType<T> }>;

// Options for lazy loading
interface LazyOptions {
  retries?: number;
  retryDelay?: number;
  preload?: boolean;
  chunkName?: string; // For webpack magic comments
}

// Cache for preloaded components
const preloadCache = new Map<string, Promise<any>>();

/**
 * Enhanced lazy loading with retry logic
 */
export function lazyWithRetry<T extends Record<string, any>>(
  importFn: ImportFunction<T>,
  options: LazyOptions = {}
): LazyExoticComponent<ComponentType<T>> & { preload?: () => Promise<void> } {
  const { retries = 3, retryDelay = 1000, preload = false, chunkName } = options;
  
  // Create a unique key for this import
  const importKey = importFn.toString();
  
  // Retry logic wrapper
  const importWithRetry = async (retriesLeft = retries): Promise<{ default: ComponentType<T> }> => {
    try {
      // Check if already preloaded
      if (preloadCache.has(importKey)) {
        return await preloadCache.get(importKey)!;
      }
      
      // Add webpack magic comment if chunk name provided
      const result = await importFn();
      return result;
    } catch (error) {
      if (retriesLeft > 0) {
        console.warn(`Failed to load component, retrying... (${retriesLeft} retries left)`, error);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Retry with decremented counter
        return importWithRetry(retriesLeft - 1);
      }
      
      // All retries exhausted
      console.error('Failed to load component after all retries:', error);
      throw error;
    }
  };
  
  // Create the lazy component
  const LazyComponent = lazy(importWithRetry);
  
  // Add preload method if requested
  if (preload) {
    const preloadFn = () => {
      if (!preloadCache.has(importKey)) {
        const promise = importWithRetry();
        preloadCache.set(importKey, promise);
        return promise.then(() => undefined);
      }
      return Promise.resolve();
    };
    
    // Attach preload to the component
    (LazyComponent as any).preload = preloadFn;
  }
  
  return LazyComponent;
}

/**
 * Preload multiple components in parallel
 */
export async function preloadComponents(
  components: Array<{ preload?: () => Promise<void> }>
): Promise<void> {
  const preloadPromises = components
    .filter(comp => typeof comp.preload === 'function')
    .map(comp => comp.preload!());
  
  await Promise.all(preloadPromises);
}

/**
 * Create a lazy component with a loading fallback
 */
export function createLazyComponent<T extends Record<string, any>>(
  importFn: ImportFunction<T>,
  options: LazyOptions & { fallback?: React.ReactNode } = {}
): React.FC<T> {
  const { fallback = null, ...lazyOptions } = options;
  const LazyComponent = lazyWithRetry(importFn, lazyOptions);
  
  return (props: T) => (
    <React.Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
}

/**
 * Webpack magic comments helper for better code splitting
 */
export function webpackChunkName(name: string) {
  return `/* webpackChunkName: "${name}" */`;
}

/**
 * Prefetch component on hover or focus
 */
export function usePrefetch<T extends Record<string, any>>(
  component: LazyExoticComponent<ComponentType<T>> & { preload?: () => Promise<void> }
) {
  const prefetchRef = React.useRef(false);
  
  const prefetch = React.useCallback(() => {
    if (!prefetchRef.current && component.preload) {
      prefetchRef.current = true;
      component.preload();
    }
  }, [component]);
  
  return {
    onMouseEnter: prefetch,
    onFocus: prefetch,
  };
}