import { useCallback, useEffect, useRef } from 'react';
import { getLogger } from '@/utils/logging/unifiedLogger';

// Get logger for performance monitoring
const logger = getLogger('performance');

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitoring = () => {
  // Record navigation timing
  if (window.performance && window.performance.timing) {
    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;

    // Report basic metrics
    const metrics = {
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnection: timing.connectEnd - timing.connectStart,
      requestTime: timing.responseEnd - timing.requestStart,
      domProcessing: timing.domComplete - timing.domLoading,
      totalPageLoad: timing.loadEventEnd - navigationStart,
    };

    logger.debug('Navigation timing metrics', metrics);

    // Send metrics to backend (with error handling)
    if (navigator.sendBeacon) {
      const metricsPayload = {
        ...metrics,
        timestamp: new Date().toISOString(),
      };

      try {
        // Check if performance metrics endpoint is available
        // Disable performance metrics if the endpoint doesn't exist
        const performanceMetricsEnabled = false; // Disabled until backend endpoint is available
        
        if (performanceMetricsEnabled) {
          // Use fetch instead of sendBeacon for better error handling
          fetch('/api/metrics/performance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(metricsPayload),
            // Don't block page unload if this fails
            keepalive: true,
          }).catch((error) => {
            // Silently log performance metric failures to avoid noise
            logger.debug('Failed to send performance metrics to backend', { error: error.message });
          });
        } else {
          // Log metrics locally only
          logger.debug('Performance metrics (local only)', metricsPayload);
        }
      } catch (error) {
        // Fallback - don't throw errors for performance metrics
        logger.debug('Performance metrics collection failed', { error });
      }
    }
  }

  // Register performance observer if available
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          logger.debug(`Performance entry: ${entry.name}`, {
            startTime: entry.startTime.toFixed(2),
            duration: entry.duration.toFixed(2),
            entryType: entry.entryType,
          });
        });
      });

      observer.observe({ entryTypes: ['resource', 'paint', 'navigation'] });
    } catch (_e) {
      logger.error('Performance observer initialization failed', _e);
    }
  }
};

/**
 * Mark a performance event
 */
export const markPerformance = (name: string) => {
  if (window.performance && window.performance.mark) {
    window.performance.mark(name);
    logger.debug(`Performance mark created: ${name}`);
    return true;
  }
  return false;
};

/**
 * Measure time between two performance marks OR measure function execution time
 */
export function measurePerformance<T extends (...args: unknown[]) => unknown>(
  nameOrFunction: string | T,
  startMark?: string,
  endMark?: string
): number | { result?: ReturnType<T>; executionTime: number; error?: Error } | null {
  // Function execution measurement
  if (typeof nameOrFunction === 'function') {
    const fn = nameOrFunction;
    const start = performance.now();
    
    try {
      const result = fn();
      const executionTime = performance.now() - start;
      
      logger.debug(`Function execution time`, { executionTime: executionTime.toFixed(2) });
      
      return {
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - start;
      
      logger.error(`Function execution failed`, { error, executionTime: executionTime.toFixed(2) });
      
      return {
        executionTime,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
  
  // Performance marks measurement
  if (typeof nameOrFunction === 'string' && startMark && endMark) {
    if (window.performance && window.performance.measure) {
      try {
        window.performance.measure(nameOrFunction, startMark, endMark);
        const measures = window.performance.getEntriesByName(nameOrFunction, 'measure');
        if (measures.length > 0) {
          const duration = measures[0].duration;
          logger.debug(`Performance measure: ${nameOrFunction}`, { duration: duration.toFixed(2) });
          return duration;
        }
      } catch (_e) {
        logger.error(`Performance measurement failed for ${nameOrFunction}`, _e);
      }
    }
  }
  
  return null;
}

/**
 * Utility to measure and report frontend performance metrics
 */
export const usePerformance = () => {
  const renderCount = useRef<number>(0);
  const lastRenderTime = useRef<number>(0);
  const initialRenderTime = useRef<number | null>(null);

  // Record initial load time
  useEffect(() => {
    if (initialRenderTime.current === null) {
      initialRenderTime.current = performance.now();

      // Report initial load time to backend (disabled until backend endpoint is available)
      const frontendMetricsEnabled = false; // Disabled until backend endpoint is available
      
      if (frontendMetricsEnabled && navigator.sendBeacon) {
        const metrics = {
          initialLoadTime: initialRenderTime.current,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        };

        // Only send if endpoint exists
        navigator.sendBeacon('/api/metrics/frontend', JSON.stringify(metrics));
      } else {
        // Log metrics locally only
        logger.debug('Frontend initial load metrics (local only)', {
          initialLoadTime: initialRenderTime.current,
          userAgent: navigator.userAgent,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        });
      }

      // Record web vitals
      if ('web-vitals' in window) {
        import('web-vitals').then(({ getCLS, getFID, getLCP }) => {
          getCLS(sendToAnalytics);
          getFID(sendToAnalytics);
          getLCP(sendToAnalytics);
        });
      }
    }
  }, []);

  // Track render performance
  useEffect(() => {
    const now = performance.now();
    renderCount.current += 1;

    if (lastRenderTime.current > 0) {
      const timeSinceLastRender = now - lastRenderTime.current;

      // Log render times if they exceed a threshold (e.g., 50ms)
      if (timeSinceLastRender > 50) {
        logger.debug('Slow render detected', { 
          duration: timeSinceLastRender.toFixed(2),
          renderCount: renderCount.current,
        });
      }
    }

    lastRenderTime.current = now;
  });

  // Helper to send metrics to analytics
  const sendToAnalytics = useCallback((metric: unknown) => {
    // You can implement any analytics service here
    logger.debug(`Web Vitals: ${metric.name}`, { 
      value: metric.value,
      id: metric.id,
      rating: metric.rating,
    });

    // Optionally send to backend (disabled until backend endpoint is available)
    const webVitalsMetricsEnabled = false; // Disabled until backend endpoint is available
    
    if (webVitalsMetricsEnabled && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/metrics/vitals',
        JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }, []);

  return {
    renderCount: renderCount.current,
    initialLoadTime: initialRenderTime.current,
    measureOperation: (operation: () => void, label = 'Operation') => {
      const start = performance.now();
      operation();
      const duration = performance.now() - start;
      logger.debug(`Operation timing: ${label}`, { duration: duration.toFixed(2) });
      return duration;
    },
  };
};

/**
 * Utility to measure image loading performance
 */
export const useImageLoadPerformance = () => {
  const trackImageLoad = useCallback((imageUrl: string, onLoaded?: (duration: number) => void) => {
    const startTime = performance.now();

    return (event: React.SyntheticEvent<HTMLImageElement>) => {
      const loadTime = performance.now() - startTime;
      logger.debug('Image loaded', { 
        url: imageUrl,
        loadTime: loadTime.toFixed(2),
      });

      // Report image load time
      const img = event.currentTarget;
      const metrics = {
        imageUrl,
        loadTime,
        width: img.naturalWidth,
        height: img.naturalHeight,
        timestamp: new Date().toISOString(),
      };

      // Disable image load metrics until backend endpoint is available
      const imageLoadMetricsEnabled = false; // Disabled until backend endpoint is available
      
      if (imageLoadMetricsEnabled && navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics/image-load', JSON.stringify(metrics));
      } else {
        logger.debug('Image load metrics (local only)', metrics);
      }

      if (onLoaded) {
        onLoaded(loadTime);
      }
    };
  }, []);

  return { trackImageLoad };
};

/**
 * Utility for lazily loading images
 */
export const useLazyLoading = () => {
  useEffect(() => {
    if ('IntersectionObserver' in window) {
      const lazyImages = document.querySelectorAll('img[data-src]');

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      });

      lazyImages.forEach((image) => {
        observer.observe(image);
      });

      return () => {
        observer.disconnect();
      };
    } else {
      // Fallback for browsers without IntersectionObserver
      const lazyImages = document.querySelectorAll('img[data-src]');
      lazyImages.forEach((img) => {
        if ((img as HTMLImageElement).dataset.src) {
          (img as HTMLImageElement).src = (img as HTMLImageElement).dataset.src!;
          (img as HTMLImageElement).removeAttribute('data-src');
        }
      });
    }
  }, []);
};

/**
 * Performance monitoring class for tracking multiple metrics
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private activeOperations: Map<string, number> = new Map();

  start(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      this.metrics.get(label)!.push(duration);
    };
  }

  startOperation(operationName: string): void {
    this.activeOperations.set(operationName, performance.now());
  }

  endOperation(operationName: string): number | null {
    const startTime = this.activeOperations.get(operationName);
    if (startTime === undefined) {
      return null;
    }
    
    const duration = performance.now() - startTime;
    this.activeOperations.delete(operationName);
    
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    this.metrics.get(operationName)!.push(duration);
    
    return duration;
  }

  trackOperation<T extends (...args: unknown[]) => unknown>(operationName: string, fn: T): T {
    return ((...args: Parameters<T>) => {
      this.startOperation(operationName);
      try {
        const result = fn(...args);
        this.endOperation(operationName);
        return result;
      } catch (error) {
        this.endOperation(operationName);
        throw error;
      }
    }) as T;
  }

  getStats(): Record<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  }> {
    const stats: Record<string, any> = {};
    
    for (const [label, values] of this.metrics.entries()) {
      if (values.length > 0) {
        const totalTime = values.reduce((sum, val) => sum + val, 0);
        stats[label] = {
          count: values.length,
          totalTime,
          averageTime: totalTime / values.length,
          minTime: Math.min(...values),
          maxTime: Math.max(...values),
        };
      }
    }
    
    return stats;
  }

  getMetrics(label: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
  } | null {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) {
      return null;
    }

    return {
      count: values.length,
      total: values.reduce((sum, val) => sum + val, 0),
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  reset(label?: string): void {
    if (label) {
      this.metrics.delete(label);
      this.activeOperations.delete(label);
    } else {
      this.metrics.clear();
      this.activeOperations.clear();
    }
  }

  getReport(): string {
    const stats = this.getStats();
    const lines = ['Performance Report:', '=================='];
    
    for (const [operation, data] of Object.entries(stats)) {
      lines.push(`${operation}: ${data.count} calls, avg: ${data.averageTime.toFixed(2)}ms, total: ${data.totalTime.toFixed(2)}ms`);
    }
    
    return lines.join('\n');
  }

  getAllMetrics(): Map<string, number[]> {
    return new Map(this.metrics);
  }
}

/**
 * Simple debounce implementation
 */
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: number;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay) as unknown as number;
  };
}

/**
 * Simple throttle implementation
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T, 
  limit: number, 
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<T>) => void {
  const { leading = true, trailing = false } = options;
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown;
  let hasInvoked = false;

  return function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;

    if (!inThrottle) {
      if (leading) {
        fn.apply(this, args);
        hasInvoked = true;
      }
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
        if (trailing && lastArgs && (!leading || hasInvoked)) {
          fn.apply(lastThis, lastArgs);
        }
        if (!leading && !hasInvoked && lastArgs) {
          fn.apply(lastThis, lastArgs);
        }
        lastArgs = null;
        hasInvoked = false;
      }, limit) as unknown as number;
    } else if (trailing) {
      lastArgs = args;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastThis = this;
    }
  };
}

/**
 * Simple memoize implementation
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T, 
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Track operation time with callbacks
 */
export function trackOperationTime<T extends (...args: unknown[]) => unknown>(
  operation: T,
  operationName: string,
  onComplete?: (name: string, duration: number) => void,
  onError?: (error: Error) => void
): (...args: Parameters<T>) => ReturnType<T> {
  return ((...args: Parameters<T>) => {
    const start = performance.now();
    try {
      const result = operation(...args);
      const duration = performance.now() - start;
      
      logger.debug(`Operation completed: ${operationName}`, { duration: duration.toFixed(2) });
      
      if (onComplete) {
        onComplete(operationName, duration);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      logger.error(`Operation failed: ${operationName}`, { error, duration: duration.toFixed(2) });
      
      if (onComplete) {
        onComplete(operationName, duration);
      }
      if (onError && error instanceof Error) {
        onError(error);
      }
      
      throw error;
    }
  }) as (...args: Parameters<T>) => ReturnType<T>;
}

export default {
  usePerformance,
  useImageLoadPerformance,
  useLazyLoading,
  initPerformanceMonitoring,
  markPerformance,
  measurePerformance,
  PerformanceMonitor,
  debounce,
  throttle,
  memoize,
  trackOperationTime,
};
