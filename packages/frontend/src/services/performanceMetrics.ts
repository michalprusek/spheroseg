/**
 * Performance Metrics Collection Service
 * Tracks and reports application performance metrics
 */

import { debounce } from '@/utils/debounce';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ChunkLoadMetric {
  chunkName: string;
  loadTime: number;
  size: number;
  cached: boolean;
  retries: number;
}

export interface NavigationMetric {
  from: string;
  to: string;
  duration: number;
  type: 'push' | 'pop' | 'replace';
}

export interface RenderMetric {
  componentName: string;
  renderTime: number;
  updateCount: number;
  props: Record<string, any>;
}

class PerformanceMetricsService {
  private metrics: PerformanceMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private navigationStart: number = 0;
  private renderMetrics: Map<string, RenderMetric> = new Map();
  private isDevelopment = import.meta.env.DEV;
  private reportingEndpoint = '/api/metrics';
  private batchSize = 50;
  private flushInterval = 60000; // 1 minute
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupObservers();
    this.startBatchReporting();
  }

  /**
   * Track a custom metric
   */
  track(metric: PerformanceMetric): void {
    this.metrics.push({
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    });

    if (this.metrics.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Track chunk loading performance
   */
  trackChunkLoad(metric: ChunkLoadMetric): void {
    this.track({
      name: `chunk_load_${metric.chunkName}`,
      value: metric.loadTime,
      unit: 'ms',
      timestamp: Date.now(),
      metadata: {
        size: metric.size,
        cached: metric.cached,
        retries: metric.retries,
      },
    });

    // Log slow loads
    if (metric.loadTime > 3000 && !metric.cached) {
      this.logSlowOperation('chunk_load', metric);
    }
  }

  /**
   * Track navigation performance
   */
  trackNavigation(metric: NavigationMetric): void {
    this.track({
      name: 'navigation',
      value: metric.duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata: {
        from: metric.from,
        to: metric.to,
        type: metric.type,
      },
    });
  }

  /**
   * Track component render performance
   */
  trackRender(componentName: string, renderTime: number, props?: Record<string, any>): void {
    const existing = this.renderMetrics.get(componentName) || {
      componentName,
      renderTime: 0,
      updateCount: 0,
      props: {},
    };

    existing.renderTime = (existing.renderTime * existing.updateCount + renderTime) / (existing.updateCount + 1);
    existing.updateCount++;
    existing.props = props || {};

    this.renderMetrics.set(componentName, existing);

    // Track if render is slow
    if (renderTime > 16) {
      // More than one frame (60fps)
      this.track({
        name: `slow_render_${componentName}`,
        value: renderTime,
        unit: 'ms',
        timestamp: Date.now(),
        metadata: { props },
      });
    }
  }

  /**
   * Start navigation timing
   */
  startNavigation(): void {
    this.navigationStart = performance.now();
  }

  /**
   * End navigation timing
   */
  endNavigation(from: string, to: string, type: 'push' | 'pop' | 'replace' = 'push'): void {
    if (this.navigationStart) {
      const duration = performance.now() - this.navigationStart;
      this.trackNavigation({ from, to, duration, type });
      this.navigationStart = 0;
    }
  }

  /**
   * Get Web Vitals
   */
  getWebVitals(): Record<string, number> {
    const vitals: Record<string, number> = {};

    // Get CLS (Cumulative Layout Shift)
    const clsEntries = performance.getEntriesByType('layout-shift') as any[];
    let cls = 0;
    clsEntries.forEach((entry) => {
      if (!entry.hadRecentInput) {
        cls += entry.value;
      }
    });
    vitals.CLS = cls;

    // Get FID (First Input Delay)
    const fidEntries = performance.getEntriesByType('first-input') as any[];
    if (fidEntries.length > 0) {
      vitals.FID = fidEntries[0].processingStart - fidEntries[0].startTime;
    }

    // Get LCP (Largest Contentful Paint)
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as any[];
    if (lcpEntries.length > 0) {
      vitals.LCP = lcpEntries[lcpEntries.length - 1].startTime;
    }

    // Get FCP (First Contentful Paint)
    const fcpEntries = performance.getEntriesByName('first-contentful-paint');
    if (fcpEntries.length > 0) {
      vitals.FCP = fcpEntries[0].startTime;
    }

    // Get TTFB (Time to First Byte)
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      vitals.TTFB = navEntries[0].responseStart - navEntries[0].requestStart;
    }

    return vitals;
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    metrics: PerformanceMetric[];
    webVitals: Record<string, number>;
    renderMetrics: RenderMetric[];
    memoryUsage?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  } {
    const summary = {
      metrics: [...this.metrics],
      webVitals: this.getWebVitals(),
      renderMetrics: Array.from(this.renderMetrics.values()),
    } as any;

    // Add memory usage if available
    if ('memory' in performance) {
      summary.memoryUsage = {
        usedJSHeapSize: (performance as unknown).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as unknown).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as unknown).memory.jsHeapSizeLimit,
      };
    }

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.renderMetrics.clear();
  }

  /**
   * Setup performance observers
   */
  private setupObservers(): void {
    // Observe long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.track({
                name: 'long_task',
                value: entry.duration,
                unit: 'ms',
                timestamp: entry.startTime,
                metadata: {
                  name: entry.name,
                },
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (e) {
        // Long task observer not supported
      }

      // Observe resource timing
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const resourceEntry = entry as PerformanceResourceTiming;

            // Track slow resources
            if (resourceEntry.duration > 1000) {
              this.track({
                name: 'slow_resource',
                value: resourceEntry.duration,
                unit: 'ms',
                timestamp: resourceEntry.startTime,
                metadata: {
                  url: resourceEntry.name,
                  type: resourceEntry.initiatorType,
                  size: resourceEntry.transferSize || 0,
                },
              });
            }
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);
      } catch (e) {
        // Resource observer not supported
      }
    }
  }

  /**
   * Start batch reporting
   */
  private startBatchReporting(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Flush metrics to server
   */
  private flush = debounce(async () => {
    if (this.metrics.length === 0) {
      return;
    }

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      // In production, send to analytics endpoint
      if (!this.isDevelopment) {
        await fetch(this.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metrics: metricsToSend,
            webVitals: this.getWebVitals(),
            timestamp: Date.now(),
          }),
        });
      } else {
        // In development, log to console
        console.debug('[Performance Metrics]', {
          metrics: metricsToSend,
          webVitals: this.getWebVitals(),
        });
      }
    } catch (error) {
      // Re-add metrics on error
      this.metrics.unshift(...metricsToSend);
    }
  }, 1000);

  /**
   * Log slow operations
   */
  private logSlowOperation(type: string, data: any): void {
    if (this.isDevelopment) {
      console.warn(`[Performance] Slow ${type} detected:`, data);
    }

    // Send to monitoring in production
    if (!this.isDevelopment && window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: type,
        value: data.loadTime || data.duration,
        event_category: 'Performance',
        event_label: JSON.stringify(data),
      });
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Stop observers
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();

    // Stop batch reporting
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining metrics
    this.flush();
  }
}

// Create singleton instance
let instance: PerformanceMetricsService | null = null;

export function getPerformanceMetrics(): PerformanceMetricsService {
  if (!instance) {
    instance = new PerformanceMetricsService();
  }
  return instance;
}

// React hook for performance tracking
export function usePerformanceTracking(componentName: string) {
  const metrics = getPerformanceMetrics();
  const renderStart = performance.now();

  // Track render time
  if (import.meta.env.DEV) {
    // Use useEffect to measure after render
    import('react').then(({ useEffect }) => {
      useEffect(() => {
        const renderTime = performance.now() - renderStart;
        metrics.trackRender(componentName, renderTime);
      });
    });
  }

  return {
    trackEvent: (name: string, value: number, metadata?: Record<string, any>) => {
      metrics.track({
        name: `${componentName}_${name}`,
        value,
        unit: 'ms',
        timestamp: Date.now(),
        metadata,
      });
    },
  };
}

// Export types and utilities
export type { PerformanceMetricsService };
export default getPerformanceMetrics();
