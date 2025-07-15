/**
 * Advanced Code Splitting Utilities
 *
 * This module provides enhanced code splitting capabilities including:
 * - Route-based prefetching
 * - Component-level code splitting
 * - Bundle size optimization
 * - Loading state management
 * - Error boundary integration
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { matchPath } from 'react-router-dom';

// Types
export interface CodeSplitOptions {
  prefetch?: boolean;
  prefetchDelay?: number;
  chunkName?: string;
  fallbackComponent?: ComponentType;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface PrefetchConfig {
  routes: string[];
  priority: 'high' | 'low';
  strategy: 'hover' | 'visible' | 'idle';
}

// Cache for loaded components
const componentCache = new Map<string, LazyExoticComponent<ComponentType<any>>>();
const loadingPromises = new Map<string, Promise<any>>();

/**
 * Enhanced lazy loading with retry logic and caching
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: CodeSplitOptions = {},
): LazyExoticComponent<T> {
  const { chunkName, retryAttempts = 3, retryDelay = 1000 } = options;

  // Generate cache key
  const cacheKey = chunkName || importFn.toString();

  // Return cached component if available
  if (componentCache.has(cacheKey)) {
    return componentCache.get(cacheKey) as LazyExoticComponent<T>;
  }

  // Create retry import function
  const retryImport = async (attemptsLeft: number = retryAttempts): Promise<{ default: T }> => {
    try {
      return await importFn();
    } catch (error) {
      if (attemptsLeft <= 1) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));

      // Retry with decremented attempts
      return retryImport(attemptsLeft - 1);
    }
  };

  // Create lazy component with retry logic
  const LazyComponent = lazy(() => retryImport());

  // Cache the component
  componentCache.set(cacheKey, LazyComponent);

  return LazyComponent;
}

/**
 * Prefetch a component
 */
export async function prefetchComponent(importFn: () => Promise<any>, chunkName?: string): Promise<void> {
  const cacheKey = chunkName || importFn.toString();

  // Check if already loading or loaded
  if (loadingPromises.has(cacheKey)) {
    await loadingPromises.get(cacheKey);
    return;
  }

  // Start loading
  const loadPromise = importFn();
  loadingPromises.set(cacheKey, loadPromise);

  try {
    await loadPromise;
  } catch (error) {
    console.error(`Failed to prefetch component ${chunkName}:`, error);
    loadingPromises.delete(cacheKey);
  }
}

/**
 * Route-based prefetching configuration
 */
export const routePrefetchConfig: PrefetchConfig[] = [
  {
    routes: ['/dashboard', '/projects/:id'],
    priority: 'high',
    strategy: 'idle',
  },
  {
    routes: ['/settings', '/profile'],
    priority: 'low',
    strategy: 'hover',
  },
  {
    routes: ['/documentation', '/about'],
    priority: 'low',
    strategy: 'visible',
  },
];

/**
 * Prefetch routes based on current location
 */
export function prefetchRoutes(currentPath: string): void {
  // Use requestIdleCallback for non-critical prefetching
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      routePrefetchConfig.forEach((config) => {
        if (config.strategy === 'idle') {
          config.routes.forEach((route) => {
            if (matchPath(route, currentPath)) {
              // Prefetch related routes
              prefetchRelatedRoutes(route);
            }
          });
        }
      });
    });
  }
}

/**
 * Prefetch related routes based on navigation patterns
 */
function prefetchRelatedRoutes(route: string): void {
  const relatedRoutes: Record<string, string[]> = {
    '/dashboard': ['/projects/:id', '/settings'],
    '/projects/:id': ['/projects/:id/export', '/images/:imageId/segmentation'],
    '/settings': ['/profile'],
  };

  const related = relatedRoutes[route] || [];
  related.forEach((relatedRoute) => {
    // Prefetch related components
    // This would be implemented based on your route component mapping
  });
}

/**
 * Create a code-split component with advanced features
 */
export function createCodeSplitComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: CodeSplitOptions = {},
): {
  Component: LazyExoticComponent<T>;
  prefetch: () => Promise<void>;
  preload: () => Promise<{ default: T }>;
} {
  const Component = lazyWithRetry(importFn, options);

  return {
    Component,
    prefetch: () => prefetchComponent(importFn, options.chunkName),
    preload: () => importFn(),
  };
}

/**
 * Bundle size optimization utilities
 */
export const bundleOptimization = {
  /**
   * Split vendor chunks intelligently
   */
  vendorChunks: {
    // Core React ecosystem
    react: ['react', 'react-dom', 'react-router-dom'],
    // UI libraries
    ui: ['@radix-ui', '@headlessui', 'framer-motion'],
    // Data fetching and state
    data: ['@tanstack/react-query', 'axios', 'socket.io-client'],
    // Utilities
    utils: ['lodash', 'date-fns', 'uuid'],
    // Visualization
    viz: ['recharts', 'd3', 'konva'],
  },

  /**
   * Analyze bundle size thresholds
   */
  sizeThresholds: {
    warning: 244 * 1024, // 244kb
    error: 500 * 1024, // 500kb
  },
};

/**
 * Component-level code splitting helper
 */
export function splitComponent<T extends ComponentType<any>>(
  componentPath: string,
  options?: CodeSplitOptions,
): LazyExoticComponent<T> {
  return lazyWithRetry(
    () =>
      import(
        /* webpackChunkName: "[request]" */
        /* webpackPrefetch: true */
        componentPath
      ),
    options,
  );
}

/**
 * Heavy component splitting configuration
 */
export const heavyComponents = {
  // Segmentation editor components
  SegmentationCanvas: () =>
    splitComponent<any>('../pages/segmentation/components/canvas/CanvasV2', {
      chunkName: 'segmentation-canvas',
      prefetch: true,
    }),

  // Export components
  ExcelExporter: () =>
    splitComponent<any>('../pages/segmentation/components/project/export/ExcelExporter', {
      chunkName: 'excel-exporter',
    }),

  // Analytics dashboard
  AnalyticsDashboard: () =>
    splitComponent<any>('../components/analytics/AnalyticsDashboardOptimized', { chunkName: 'analytics-dashboard' }),

  // Image gallery with virtual scrolling
  VirtualImageGrid: () =>
    splitComponent<any>('../components/project/VirtualImageGrid', { chunkName: 'virtual-image-grid', prefetch: true }),
};

/**
 * Route loading priorities
 */
export const routeLoadingPriorities = {
  critical: ['/sign-in', '/sign-up', '/'],
  high: ['/dashboard', '/projects/:id'],
  medium: ['/settings', '/profile', '/documentation'],
  low: ['/about', '/terms-of-service', '/privacy-policy'],
};

/**
 * Intersection Observer for visible prefetching
 */
let observer: IntersectionObserver | null = null;

export function setupVisibilityPrefetching(): void {
  if (!observer && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const componentName = element.dataset.prefetch;

            if (componentName && heavyComponents[componentName as keyof typeof heavyComponents]) {
              heavyComponents[componentName as keyof typeof heavyComponents]();
            }
          }
        });
      },
      { rootMargin: '50px' },
    );
  }
}

/**
 * Performance monitoring for code splitting
 */
export function monitorChunkLoading(): void {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource' && entry.name.includes('.chunk.js')) {
          const loadTime = entry.duration;
          const size = (entry as any).transferSize || 0;

          // Log slow chunk loads
          if (loadTime > 3000) {
            console.warn(`Slow chunk load: ${entry.name} took ${loadTime}ms (${size} bytes)`);
          }
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });
  }
}

// Export all utilities
export default {
  lazyWithRetry,
  prefetchComponent,
  prefetchRoutes,
  createCodeSplitComponent,
  splitComponent,
  heavyComponents,
  setupVisibilityPrefetching,
  monitorChunkLoading,
  bundleOptimization,
  routeLoadingPriorities,
};
