import {
  PerformanceMonitoring,
  PerformanceMonitoringOptions,
  MetricType,
  PageLoadMetric,
  ComponentRenderMetric,
  ApiRequestMetric,
  ResourceLoadMetric,
  UserInteractionMetric,
  MemoryUsageMetric,
} from '@spheroseg/shared';
import apiClient from '@/lib/apiClient';

/**
 * Frontend implementation of performance monitoring
 */
export class FrontendPerformanceMonitoring extends PerformanceMonitoring {
  private static instance: FrontendPerformanceMonitoring | null = null;

  /**
   * Get singleton instance
   */
  public static getInstance(options?: Partial<PerformanceMonitoringOptions>): FrontendPerformanceMonitoring {
    if (!FrontendPerformanceMonitoring.instance) {
      FrontendPerformanceMonitoring.instance = new FrontendPerformanceMonitoring(options);
    } else if (options) {
      // Update options if provided
      FrontendPerformanceMonitoring.instance.options = {
        ...FrontendPerformanceMonitoring.instance.options,
        ...options,
      };
    }
    return FrontendPerformanceMonitoring.instance;
  }

  constructor(options: Partial<PerformanceMonitoringOptions> = {}) {
    super({
      ...options,
      globalLabels: {
        ...options.globalLabels,
        app: 'frontend',
        environment: import.meta.env.MODE || 'development',
      },
    });

    // Set up performance observers if in browser environment
    if (typeof window !== 'undefined') {
      this.setupPerformanceObservers();
    }
  }

  /**
   * Set up performance observers to automatically collect metrics
   */
  private setupPerformanceObservers(): void {
    // Observe page load metrics
    if ('performance' in window) {
      // Record navigation timing metrics when page load completes
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.recordPageLoadMetrics();
        }, 0);
      });

      // Observe resource timing
      if ('PerformanceObserver' in window) {
        try {
          // Resource timing
          const resourceObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (entry.entryType === 'resource') {
                this.recordResourceLoadMetric(entry as PerformanceResourceTiming);
              }
            });
          });
          resourceObserver.observe({ entryTypes: ['resource'] });

          // Largest Contentful Paint
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
              this.recordMetric({
                type: MetricType.PAGE_LOAD,
                timestamp: Date.now(),
                value: lastEntry.startTime,
                route: window.location.pathname,
                loadTime: performance.now(),
                largestContentfulPaint: lastEntry.startTime,
              });
            }
          });
          lcpObserver.observe({
            type: 'largest-contentful-paint',
            buffered: true,
          });

          // First Input Delay
          const fidObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              this.recordMetric({
                type: MetricType.USER_INTERACTION,
                timestamp: Date.now(),
                value: entry.duration,
                action: 'first-input',
                target: 'document',
                duration: entry.duration,
              });
            });
          });
          fidObserver.observe({ type: 'first-input', buffered: true });
        } catch (e) {
          console.error('Error setting up PerformanceObserver:', e);
        }
      }
    }

    // Monitor memory usage periodically
    if (performance && (performance as unknown).memory) {
      setInterval(() => {
        this.recordMemoryUsageMetric();
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Record page load metrics
   */
  public recordPageLoadMetrics(): void {
    if (!this.options.enabled || typeof window === 'undefined' || !performance) return;

    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      if (navigationEntry) {
        const metric: PageLoadMetric = {
          type: MetricType.PAGE_LOAD,
          timestamp: Date.now(),
          value: navigationEntry.duration,
          route: window.location.pathname,
          loadTime: navigationEntry.duration,
          domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime,
          firstPaint: 0,
          firstContentfulPaint: 0,
        };

        // Get first paint and first contentful paint
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach((entry) => {
          if (entry.name === 'first-paint') {
            metric.firstPaint = entry.startTime;
          } else if (entry.name === 'first-contentful-paint') {
            metric.firstContentfulPaint = entry.startTime;
          }
        });

        this.recordMetric(metric);
      }
    } catch (e) {
      console.error('Error recording page load metrics:', e);
    }
  }

  /**
   * Record component render time
   */
  public recordComponentRenderMetric(component: string, renderTime: number): void {
    if (!this.options.enabled) return;

    const metric: ComponentRenderMetric = {
      type: MetricType.COMPONENT_RENDER,
      timestamp: Date.now(),
      value: renderTime,
      component,
      renderTime,
    };

    this.recordMetric(metric);
  }

  /**
   * Record API request metric
   */
  public recordApiRequestMetric(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    error?: string,
  ): void {
    if (!this.options.enabled) return;

    const metric: ApiRequestMetric = {
      type: MetricType.API_REQUEST,
      timestamp: Date.now(),
      value: duration,
      endpoint,
      method,
      duration,
      status,
      error,
    };

    this.recordMetric(metric);
  }

  /**
   * Record resource load metric
   */
  private recordResourceLoadMetric(entry: PerformanceResourceTiming): void {
    if (!this.options.enabled) return;

    // Skip monitoring requests to avoid circular reporting
    if (entry.name.includes(this.options.endpoint || '/api/metrics')) {
      return;
    }

    const metric: ResourceLoadMetric = {
      type: MetricType.RESOURCE_LOAD,
      timestamp: Date.now(),
      value: entry.duration,
      resourceUrl: entry.name,
      resourceType: entry.initiatorType,
      loadTime: entry.duration,
      size: entry.transferSize,
    };

    this.recordMetric(metric);
  }

  /**
   * Record user interaction metric
   */
  public recordUserInteractionMetric(action: string, target: string, duration: number): void {
    if (!this.options.enabled) return;

    const metric: UserInteractionMetric = {
      type: MetricType.USER_INTERACTION,
      timestamp: Date.now(),
      value: duration,
      action,
      target,
      duration,
    };

    this.recordMetric(metric);
  }

  /**
   * Record memory usage metric
   */
  private recordMemoryUsageMetric(): void {
    if (!this.options.enabled || typeof window === 'undefined') return;

    try {
      const memory = (performance as unknown).memory;
      if (memory) {
        const metric: MemoryUsageMetric = {
          type: MetricType.MEMORY_USAGE,
          timestamp: Date.now(),
          value: memory.usedJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          totalJSHeapSize: memory.totalJSHeapSize,
          usedJSHeapSize: memory.usedJSHeapSize,
        };

        this.recordMetric(metric);
      }
    } catch (e) {
      console.error('Error recording memory usage metrics:', e);
    }
  }

  /**
   * Flush metrics to the server
   */
  protected async flushMetrics(): Promise<void> {
    if (!this.options.enabled || this.metricsQueue.length === 0) return;

    const metrics = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      await apiClient.post(
        this.options.endpoint || '/api/metrics',
        { metrics },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      // Axios throws an error for non-2xx responses, so no need to check response.ok
    } catch (error) {
      console.error('Error sending metrics:', error);
      // Put metrics back in the queue to try again later
      this.metricsQueue = [...metrics, ...this.metricsQueue];
    }
  }
}

/**
 * Create a frontend performance monitoring instance
 */
export function createPerformanceMonitoring(
  options: Partial<PerformanceMonitoringOptions> = {},
): FrontendPerformanceMonitoring {
  return FrontendPerformanceMonitoring.getInstance(options);
}
