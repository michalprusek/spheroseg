/**
 * Performance Monitoring Utilities
 * 
 * Provides tools for monitoring and tracking application performance in real-time.
 */

import { PERFORMANCE_BASELINES } from './__tests__/performanceBaselines.test';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  baseline?: number;
  status: 'passing' | 'warning' | 'failing';
}

interface PerformanceReport {
  id: string;
  timestamp: number;
  metrics: PerformanceMetric[];
  summary: {
    total: number;
    passing: number;
    warning: number;
    failing: number;
  };
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private observers: ((metric: PerformanceMetric) => void)[] = [];
  
  constructor() {
    this.initializeWebVitals();
  }
  
  /**
   * Initialize Web Vitals monitoring
   */
  private initializeWebVitals() {
    if (typeof window === 'undefined') return;
    
    // Monitor Core Web Vitals
    this.observePerformanceEntries();
    this.monitorResourceTiming();
    this.trackNavigationTiming();
  }
  
  /**
   * Observe performance entries
   */
  private observePerformanceEntries() {
    if (!window.PerformanceObserver) return;
    
    try {
      // Monitor paint timing
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordMetric(entry.name, entry.startTime, this.getBaseline(entry.name));
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      
      // Monitor largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.recordMetric('largest-contentful-paint', lastEntry.startTime, 2500);
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      
      // Monitor first input delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          const fid = entry.processingStart - entry.startTime;
          this.recordMetric('first-input-delay', fid, 100);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      
    } catch (error) {
      console.warn('Performance Observer not fully supported:', error);
    }
  }
  
  /**
   * Monitor resource timing
   */
  private monitorResourceTiming() {
    if (typeof window === 'undefined' || !window.performance) return;
    
    const entries = window.performance.getEntriesByType('resource');
    entries.forEach((entry: any) => {
      const loadTime = entry.responseEnd - entry.startTime;
      const resourceType = this.getResourceType(entry.name);
      this.recordMetric(`resource-load-${resourceType}`, loadTime, this.getResourceBaseline(resourceType));
    });
  }
  
  /**
   * Track navigation timing
   */
  private trackNavigationTiming() {
    if (typeof window === 'undefined' || !window.performance?.timing) return;
    
    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;
    
    // DOM Content Loaded
    const domContentLoaded = timing.domContentLoadedEventEnd - navigationStart;
    this.recordMetric('dom-content-loaded', domContentLoaded, 1500);
    
    // Page Load Complete
    const pageLoad = timing.loadEventEnd - navigationStart;
    this.recordMetric('page-load-complete', pageLoad, 3000);
    
    // DNS Lookup
    const dnsLookup = timing.domainLookupEnd - timing.domainLookupStart;
    this.recordMetric('dns-lookup', dnsLookup, 200);
    
    // TCP Connection
    const tcpConnection = timing.connectEnd - timing.connectStart;
    this.recordMetric('tcp-connection', tcpConnection, 300);
  }
  
  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, baseline?: number): PerformanceMetric {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      baseline,
      status: this.getMetricStatus(value, baseline)
    };
    
    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);
    
    // Keep only last 100 measurements per metric
    const metricHistory = this.metrics.get(name)!;
    if (metricHistory.length > 100) {
      metricHistory.splice(0, metricHistory.length - 100);
    }
    
    // Notify observers
    this.notifyObservers(metric);
    
    return metric;
  }
  
  /**
   * Measure function execution time
   */
  measureFunction<T>(name: string, fn: () => T, baseline?: number): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    this.recordMetric(name, duration, baseline);
    
    return result;
  }
  
  /**
   * Measure async function execution time
   */
  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>, baseline?: number): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    this.recordMetric(name, duration, baseline);
    
    return result;
  }
  
  /**
   * Get performance report
   */
  getReport(): PerformanceReport {
    const allMetrics: PerformanceMetric[] = [];
    this.metrics.forEach((metrics) => {
      allMetrics.push(...metrics);
    });
    
    // Get latest metric for each type
    const latestMetrics = new Map<string, PerformanceMetric>();
    allMetrics.forEach((metric) => {
      const existing = latestMetrics.get(metric.name);
      if (!existing || metric.timestamp > existing.timestamp) {
        latestMetrics.set(metric.name, metric);
      }
    });
    
    const metrics = Array.from(latestMetrics.values());
    const summary = {
      total: metrics.length,
      passing: metrics.filter(m => m.status === 'passing').length,
      warning: metrics.filter(m => m.status === 'warning').length,
      failing: metrics.filter(m => m.status === 'failing').length
    };
    
    return {
      id: `perf-report-${Date.now()}`,
      timestamp: Date.now(),
      metrics,
      summary
    };
  }
  
  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }
  
  /**
   * Subscribe to metric updates
   */
  subscribe(callback: (metric: PerformanceMetric) => void): () => void {
    this.observers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  
  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }
  
  /**
   * Get metric status based on value and baseline
   */
  private getMetricStatus(value: number, baseline?: number): 'passing' | 'warning' | 'failing' {
    if (!baseline) return 'passing';
    
    if (value <= baseline) return 'passing';
    if (value <= baseline * 1.5) return 'warning';
    return 'failing';
  }
  
  /**
   * Get baseline for metric name
   */
  private getBaseline(name: string): number | undefined {
    const baselineMap: Record<string, number> = {
      'first-paint': 1500,
      'first-contentful-paint': 1800,
      'largest-contentful-paint': 2500,
      'first-input-delay': 100,
      'cumulative-layout-shift': 0.1
    };
    
    return baselineMap[name];
  }
  
  /**
   * Get resource type from URL
   */
  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (url.includes('api/')) return 'api';
    return 'other';
  }
  
  /**
   * Get baseline for resource type
   */
  private getResourceBaseline(type: string): number {
    const baselines: Record<string, number> = {
      'javascript': 500,
      'stylesheet': 200,
      'image': 1000,
      'api': 2000,
      'other': 300
    };
    
    return baselines[type] || 500;
  }
  
  /**
   * Notify all observers
   */
  private notifyObservers(metric: PerformanceMetric): void {
    this.observers.forEach(callback => {
      try {
        callback(metric);
      } catch (error) {
        console.warn('Performance observer callback error:', error);
      }
    });
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

export { performanceMonitor, PerformanceMonitor };
export type { PerformanceMetric, PerformanceReport };