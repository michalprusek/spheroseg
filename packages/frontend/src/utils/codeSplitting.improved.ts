/**
 * Improved Code Splitting Utilities
 * 
 * Improvements:
 * - LRU cache to prevent memory leaks
 * - Better cache key generation
 * - Error boundaries integration
 * - Type safety improvements
 * - Performance monitoring
 */

import { lazy, ComponentType, LazyExoticComponent, Suspense } from 'react';
import { matchPath } from 'react-router-dom';
import { LRUCache, PromiseCache } from './lruCache';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Types
export interface CodeSplitOptions {
  prefetch?: boolean;
  prefetchDelay?: number;
  chunkName?: string;
  fallbackComponent?: ComponentType;
  retryAttempts?: number;
  retryDelay?: number;
  cacheKey?: string;
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
    if (window.gtag) {
      window.gtag('event', 'slow_chunk_load', {
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
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: CodeSplitOptions = {}
): LazyExoticComponent<T> {
  const {
    retryAttempts = 3,
    retryDelay = 1000,
  } = options;

  const cacheKey = generateCacheKey(importFn, options);

  // Return cached component if available
  const cached = componentCache.get(cacheKey);
  if (cached) {
    logger.log('debug', 'Returning cached component', { cacheKey });
    return cached as LazyExoticComponent<T>;
  }

  // Create retry import function with monitoring
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

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Clear module cache in development
      if (import.meta.env.DEV && import.meta.hot) {
        import.meta.hot.invalidate();
      }
      
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
export async function prefetchComponent(
  importFn: () => Promise<any>,
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
 * Route prefetching configuration with dynamic loading
 */
export function getRoutePrefetchConfig(): PrefetchConfig[] {
  return [
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
}

/**
 * Prefetch routes based on current location and strategy
 */
export function prefetchRoutes(currentPath: string): void {
  const config = getRoutePrefetchConfig();
  
  // Use requestIdleCallback for non-critical prefetching
  const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
  
  idleCallback(() => {
    config.forEach(({ routes, strategy, priority }) => {
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
      () => import('../pages/projects/ProjectList'),
      () => import('../pages/settings/Settings'),
    ],
    '/projects/:id': [
      () => import('../pages/segmentation/SegmentationPage'),
      () => import('../pages/export/ExportPage'),
    ],
    '/settings': [
      () => import('../pages/profile/Profile'),
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
 * Create a code-split component with advanced features
 */
export function createCodeSplitComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: CodeSplitOptions = {}
): {
  Component: LazyExoticComponent<T>;
  prefetch: () => Promise<void>;
  preload: () => Promise<{ default: T }>;
} {
  const Component = lazyWithRetry(importFn, options);

  return {
    Component,
    prefetch: () => prefetchComponent(importFn, options),
    preload: () => importFn(),
  };
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
      <Suspense fallback={<LoadingSpinner />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
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
   * Get Vite/Webpack optimization config
   */
  getOptimizationConfig() {
    return {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name(module: any) {
              const packageName = module.context.match(
                /[\\/]node_modules[\\/](.*?)([\\/]|$)/
              )[1];
              
              // Find which vendor group this package belongs to
              for (const [groupName, packages] of Object.entries(this.vendorChunks)) {
                if (packages.some(pkg => packageName.startsWith(pkg))) {
                  return `vendor-${groupName}`;
                }
              }
              
              return 'vendor-misc';
            },
          },
        },
      },
    };
  },
};

/**
 * Component-level code splitting helper with type safety
 */
export function splitComponent<T extends ComponentType<any>>(
  componentPath: string,
  options?: CodeSplitOptions
): LazyExoticComponent<T> {
  // Create a proper import function
  const importFn = () => import(
    /* @vite-ignore */
    componentPath
  );

  return lazyWithRetry(importFn, {
    ...options,
    cacheKey: componentPath,
  });
}

/**
 * Heavy component splitting configuration
 */
export const heavyComponents = {
  // Segmentation editor components
  SegmentationCanvas: () => createCodeSplitComponent(
    () => import('../pages/segmentation/components/canvas/CanvasV2'),
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

// Export all utilities
export default {
  lazyWithRetry,
  prefetchComponent,
  prefetchRoutes,
  createCodeSplitComponent,
  splitComponent,
  heavyComponents,
  LazyBoundary,
  setupChunkMonitoring,
  getCacheStats,
  bundleOptimization,
  getRoutePrefetchConfig,
};