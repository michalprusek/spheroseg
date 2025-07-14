/**
 * Consolidated Code Splitting Utilities
 * 
 * This module combines the best features from all code splitting implementations:
 * - LRU cache to prevent memory leaks
 * - Better cache key generation
 * - Error boundaries integration
 * - Type safety improvements
 * - Performance monitoring
 * - Retry logic with exponential backoff
 * - Prefetching strategies
 */

import React, { lazy, ComponentType, LazyExoticComponent, Suspense } from 'react';
import { matchPath } from 'react-router-dom';
import { LRUCache, PromiseCache } from './lruCache';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingFallback from '@/components/LoadingFallback';

// Types
export interface CodeSplitOptions {
  prefetch?: boolean;
  prefetchDelay?: number;
  chunkName?: string;
  fallbackComponent?: ComponentType;
  retryAttempts?: number;
  retryDelay?: number;
  cacheKey?: string;
  preload?: boolean;
}

export interface PrefetchConfig {
  routes: string[];
  priority: 'high' | 'low';
  strategy: 'hover' | 'visible' | 'idle';
}

export interface ChunkLoadMetrics {
  chunkName: string;
  loadTime: number;
  size: number;
  success: boolean;
  retries: number;
}

// Type for the import function
type ImportFunction<T> = () => Promise<{ default: ComponentType<T> }>;

// Logger for production-safe logging
class ChunkLogger {
  private isDevelopment = import.meta.env.DEV;
  private metrics: ChunkLoadMetrics[] = [];

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (this.isDevelopment) {
      console[level](`[CodeSplitting] ${message}`, data);
    }
  }

  recordMetric(metric: ChunkLoadMetrics): void {
    this.metrics.push(metric);
    
    // Send to analytics in production
    if (!this.isDevelopment && metric.loadTime > 3000) {
      this.sendSlowLoadWarning(metric);
    }
  }

  private sendSlowLoadWarning(metric: ChunkLoadMetrics): void {
    // Send to monitoring service
    if ((window as any).gtag) {
      (window as any).gtag('event', 'slow_chunk_load', {
        event_category: 'Performance',
        event_label: metric.chunkName,
        value: metric.loadTime,
      });
    }
  }

  getMetrics(): ChunkLoadMetrics[] {
    return [...this.metrics];
  }
}

// Initialize caches and logger
const componentCache = new LRUCache<string, LazyExoticComponent<ComponentType<any>>>(50);
const loadingPromises = new PromiseCache<string>(30);
const logger = new ChunkLogger();

/**
 * Generate a stable cache key for components
 */
function generateCacheKey(importFn: () => Promise<any>, options: CodeSplitOptions): string {
  if (options.cacheKey) {
    return options.cacheKey;
  }
  
  if (options.chunkName) {
    return options.chunkName;
  }
  
  // Generate a stable key from the import function
  const fnString = importFn.toString();
  const match = fnString.match(/import\(["']([^"']+)["']\)/);
  if (match) {
    return match[1];
  }
  
  // Fallback to hash
  return hashCode(fnString).toString();
}

/**
 * Simple hash function for strings
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Enhanced lazy loading with retry logic, caching, and monitoring
 * This is the main entry point for lazy loading components
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: ImportFunction<any>,
  options: CodeSplitOptions = {}
): LazyExoticComponent<T> & { preload?: () => Promise<void> } {
  const {
    retryAttempts = 3,
    retryDelay = 1000,
    preload = false,
  } = options;

  const cacheKey = generateCacheKey(importFn, options);

  // Return cached component if available
  const cached = componentCache.get(cacheKey);
  if (cached) {
    logger.log('debug', 'Returning cached component', { cacheKey });
    return cached as LazyExoticComponent<T> & { preload?: () => Promise<void> };
  }

  // Create retry import function with exponential backoff and monitoring
  const retryImport = async (attemptsLeft: number = retryAttempts): Promise<{ default: T }> => {
    const startTime = performance.now();
    const retryCount = retryAttempts - attemptsLeft;
    
    try {
      const module = await importFn();
      
      // Record successful load
      const loadTime = performance.now() - startTime;
      logger.recordMetric({
        chunkName: options.chunkName || cacheKey,
        loadTime,
        size: 0, // Size would come from performance observer
        success: true,
        retries: retryCount,
      });
      
      return module;
    } catch (error) {
      logger.log('warn', 'Failed to load chunk', { 
        cacheKey, 
        attemptsLeft, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      if (attemptsLeft <= 1) {
        // Record failed load
        logger.recordMetric({
          chunkName: options.chunkName || cacheKey,
          loadTime: performance.now() - startTime,
          size: 0,
          success: false,
          retries: retryCount,
        });
        
        throw error;
      }

      // Exponential backoff
      const delay = retryDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Clear module cache in development
      if (import.meta.env.DEV && import.meta.hot) {
        import.meta.hot.invalidate();
      }
      
      // Retry with decremented attempts
      return retryImport(attemptsLeft - 1);
    }
  };

  // Create lazy component with retry logic
  const LazyComponent = lazy(() => retryImport()) as LazyExoticComponent<T> & { preload?: () => Promise<void> };

  // Add preload method if requested
  if (preload) {
    LazyComponent.preload = async () => {
      await loadingPromises.get(cacheKey, async () => {
        logger.log('info', 'Preloading component', { cacheKey });
        await retryImport();
      });
    };
  }

  // Cache the component
  componentCache.set(cacheKey, LazyComponent);

  return LazyComponent;
}

/**
 * Prefetch a component
 */
export async function prefetchComponent(
  importFn: ImportFunction<any>,
  options: CodeSplitOptions = {}
): Promise<void> {
  const cacheKey = generateCacheKey(importFn, options);

  try {
    await loadingPromises.get(cacheKey, async () => {
      logger.log('info', 'Prefetching component', { cacheKey });
      const startTime = performance.now();
      
      await importFn();
      
      const loadTime = performance.now() - startTime;
      logger.log('debug', 'Prefetch completed', { cacheKey, loadTime });
    });
  } catch (error) {
    logger.log('error', 'Failed to prefetch component', { 
      cacheKey, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * Create a code-split component with advanced features
 */
export function createCodeSplitComponent<T extends ComponentType<any>>(
  importFn: ImportFunction<any>,
  options: CodeSplitOptions = {}
): {
  Component: LazyExoticComponent<T>;
  prefetch: () => Promise<void>;
  preload: () => Promise<{ default: T }>;
} {
  const Component = lazyWithRetry<T>(importFn, { ...options, preload: true });

  return {
    Component,
    prefetch: () => prefetchComponent(importFn, options),
    preload: () => importFn(),
  };
}

/**
 * Create a lazy component with a loading fallback and error boundary
 */
export function createLazyComponent<T extends Record<string, any>>(
  importFn: ImportFunction<T>,
  options: CodeSplitOptions & { 
    fallback?: React.ReactNode;
    errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  } = {}
): React.FC<T> {
  const { fallback = <LoadingFallback />, errorFallback, ...lazyOptions } = options;
  const LazyComponent = lazyWithRetry(importFn, lazyOptions);
  
  return (props: T) => (
    <LazyBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    </LazyBoundary>
  );
}

/**
 * Error boundary wrapper for lazy components
 */
export function LazyBoundary({ 
  children, 
  fallback,
  onError,
}: {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      fallback={fallback}
      onError={(error, errorInfo) => {
        logger.log('error', 'Lazy component error', { error: error.message });
        onError?.(error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Route prefetching configuration
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
 * Prefetch routes based on current location and strategy
 */
export function prefetchRoutes(currentPath: string): void {
  // Use requestIdleCallback for non-critical prefetching
  const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
  
  idleCallback(() => {
    routePrefetchConfig.forEach(({ routes, strategy, priority }) => {
      if (strategy === 'idle' && priority === 'high') {
        routes.forEach(route => {
          if (matchPath(route, currentPath)) {
            // Prefetch related routes based on current location
            prefetchRelatedRoutes(route);
          }
        });
      }
    });
  });
}

/**
 * Prefetch related routes based on navigation patterns
 */
function prefetchRelatedRoutes(route: string): void {
  const relatedRoutes: Record<string, (() => Promise<any>)[]> = {
    '/dashboard': [
      () => import('../pages/Dashboard'),
      () => import('../pages/Settings'),
    ],
    '/projects/:id': [
      () => import('../pages/ProjectDetail'),
      () => import('../pages/export/ProjectExport'),
    ],
    '/settings': [
      () => import('../pages/Profile'),
    ],
  };

  const importFns = relatedRoutes[route] || [];
  importFns.forEach((importFn, index) => {
    // Stagger prefetching to avoid blocking
    setTimeout(() => {
      prefetchComponent(importFn, { 
        chunkName: `related-${route}-${index}` 
      });
    }, index * 100);
  });
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
    error: 500 * 1024,   // 500kb
  },

  /**
   * Get Vite optimization config
   */
  getViteOptimizationConfig() {
    return {
      build: {
        rollupOptions: {
          output: {
            manualChunks: (id: string) => {
              if (id.includes('node_modules')) {
                // Find which vendor group this package belongs to
                for (const [groupName, packages] of Object.entries(this.vendorChunks)) {
                  if (packages.some(pkg => id.includes(pkg))) {
                    return `vendor-${groupName}`;
                  }
                }
                return 'vendor-misc';
              }
            },
          },
        },
      },
    };
  },
};

/**
 * Heavy component splitting configuration
 */
export const heavyComponents = {
  // Segmentation editor components
  SegmentationCanvas: () => createCodeSplitComponent(
    () => import('../pages/segmentation/components/canvas/CanvasContainer'),
    { chunkName: 'segmentation-canvas', prefetch: true }
  ),
  
  // Export components
  ExcelExporter: () => createCodeSplitComponent(
    () => import('../pages/segmentation/components/project/export/ExcelExporter'),
    { chunkName: 'excel-exporter' }
  ),
  
  // Analytics dashboard
  AnalyticsDashboard: () => createCodeSplitComponent(
    () => import('../components/analytics/AnalyticsDashboardOptimized'),
    { chunkName: 'analytics-dashboard' }
  ),
  
  // Image gallery with virtual scrolling
  VirtualImageGrid: () => createCodeSplitComponent(
    () => import('../components/project/VirtualImageGrid'),
    { chunkName: 'virtual-image-grid', prefetch: true }
  ),
};

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
 * Performance monitoring for code splitting
 */
export function setupChunkMonitoring(): void {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource' && entry.name.includes('.js')) {
          const isChunk = entry.name.includes('chunk') || entry.name.includes('vendor');
          if (isChunk) {
            const resourceEntry = entry as PerformanceResourceTiming;
            const loadTime = resourceEntry.duration;
            const size = resourceEntry.transferSize || 0;
            
            // Log slow chunk loads
            if (loadTime > 3000) {
              logger.log('warn', 'Slow chunk load detected', {
                url: entry.name,
                loadTime,
                size,
              });
            }
          }
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    componentCache: componentCache.getStats(),
    loadingPromises: loadingPromises.getStats(),
    metrics: logger.getMetrics(),
  };
}

// Convenience re-exports for backward compatibility
export { lazy } from 'react';

// Export default object with all utilities
export default {
  lazyWithRetry,
  prefetchComponent,
  prefetchRoutes,
  createCodeSplitComponent,
  createLazyComponent,
  heavyComponents,
  LazyBoundary,
  setupChunkMonitoring,
  getCacheStats,
  bundleOptimization,
  routePrefetchConfig,
  usePrefetch,
  preloadComponents,
};