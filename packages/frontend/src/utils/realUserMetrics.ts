/**
 * Real User Metrics (RUM) Module
 * 
 * Comprehensive performance monitoring from real user sessions
 * Tracks Core Web Vitals, custom metrics, and user interactions
 */

import { logger } from './logger';

// ===========================
// Types
// ===========================

export interface WebVitalsMetrics {
  fcp: number | null;  // First Contentful Paint
  lcp: number | null;  // Largest Contentful Paint
  fid: number | null;  // First Input Delay
  cls: number | null;  // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  inp: number | null;  // Interaction to Next Paint
}

export interface NavigationMetrics {
  dnsTime: number;
  tcpTime: number;
  requestTime: number;
  responseTime: number;
  domParsingTime: number;
  domContentLoadedTime: number;
  loadEventTime: number;
  totalTime: number;
}

export interface ResourceMetrics {
  name: string;
  type: string;
  size: number;
  duration: number;
  startTime: number;
  protocol: string;
  cached: boolean;
}

export interface UserActionMetrics {
  action: string;
  target: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface SessionMetrics {
  sessionId: string;
  userId?: string;
  startTime: number;
  duration: number;
  pageViews: number;
  interactions: number;
  errors: number;
  deviceInfo: DeviceInfo;
}

export interface DeviceInfo {
  userAgent: string;
  viewport: { width: number; height: number };
  screenResolution: { width: number; height: number };
  connection?: {
    effectiveType: string;
    downlink?: number;
    rtt?: number;
  };
  memory?: {
    total: number;
    used: number;
    limit: number;
  };
}

export interface PerformanceReport {
  timestamp: number;
  sessionId: string;
  url: string;
  webVitals: WebVitalsMetrics;
  navigation: NavigationMetrics;
  resources: ResourceMetrics[];
  userActions: UserActionMetrics[];
  customMetrics: Record<string, number>;
}

// ===========================
// Core Web Vitals Observer
// ===========================

class WebVitalsObserver {
  private metrics: WebVitalsMetrics = {
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    inp: null,
  };

  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    // First Contentful Paint
    this.observePaintMetrics();

    // Largest Contentful Paint
    this.observeLCP();

    // First Input Delay
    this.observeFID();

    // Cumulative Layout Shift
    this.observeCLS();

    // Time to First Byte
    this.observeTTFB();

    // Interaction to Next Paint (INP)
    this.observeINP();
  }

  private observePaintMetrics(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = Math.round(entry.startTime);
          }
        }
      });
      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (e) {
      logger.debug('Paint metrics observer not supported');
    }
  }

  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.lcp = Math.round(lastEntry.renderTime || lastEntry.loadTime);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (e) {
      logger.debug('LCP observer not supported');
    }
  }

  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.name === 'first-input') {
            this.metrics.fid = Math.round(entry.processingStart - entry.startTime);
            break;
          }
        }
      });
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (e) {
      logger.debug('FID observer not supported');
    }
  }

  private observeCLS(): void {
    try {
      let clsValue = 0;
      let clsEntries: any[] = [];

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsEntries.push(entry);
            clsValue += entry.value;
          }
        }
        this.metrics.cls = Math.round(clsValue * 1000) / 1000;
      });
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (e) {
      logger.debug('CLS observer not supported');
    }
  }

  private observeTTFB(): void {
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        this.metrics.ttfb = Math.round(navigationEntry.responseStart - navigationEntry.requestStart);
      }
    } catch (e) {
      logger.debug('TTFB calculation not supported');
    }
  }

  private observeINP(): void {
    try {
      let maxDuration = 0;
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.duration > maxDuration) {
            maxDuration = entry.duration;
            this.metrics.inp = Math.round(maxDuration);
          }
        }
      });
      observer.observe({ entryTypes: ['event'] });
      this.observers.push(observer);
    } catch (e) {
      logger.debug('INP observer not supported');
    }
  }

  getMetrics(): WebVitalsMetrics {
    return { ...this.metrics };
  }

  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// ===========================
// Navigation Performance
// ===========================

class NavigationPerformance {
  getMetrics(): NavigationMetrics | null {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return null;
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) {
      return null;
    }

    return {
      dnsTime: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
      tcpTime: Math.round(navigation.connectEnd - navigation.connectStart),
      requestTime: Math.round(navigation.responseStart - navigation.requestStart),
      responseTime: Math.round(navigation.responseEnd - navigation.responseStart),
      domParsingTime: Math.round(navigation.domInteractive - navigation.responseEnd),
      domContentLoadedTime: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
      loadEventTime: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
      totalTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),
    };
  }
}

// ===========================
// Resource Performance
// ===========================

class ResourcePerformance {
  private resourceThreshold = 100; // Only track resources that take > 100ms

  getMetrics(): ResourceMetrics[] {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return [];
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    return resources
      .filter(resource => resource.duration > this.resourceThreshold)
      .map(resource => ({
        name: this.getResourceName(resource.name),
        type: this.getResourceType(resource),
        size: resource.transferSize || 0,
        duration: Math.round(resource.duration),
        startTime: Math.round(resource.startTime),
        protocol: resource.nextHopProtocol || 'unknown',
        cached: resource.transferSize === 0 && resource.decodedBodySize > 0,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20); // Top 20 slowest resources
  }

  private getResourceName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').pop() || urlObj.pathname;
    } catch {
      return url.split('/').pop() || url;
    }
  }

  private getResourceType(resource: PerformanceResourceTiming): string {
    const { name } = resource;
    
    if (name.includes('.js')) return 'script';
    if (name.includes('.css')) return 'stylesheet';
    if (/\.(jpg|jpeg|png|gif|webp|svg)/.test(name)) return 'image';
    if (/\.(woff|woff2|ttf|eot)/.test(name)) return 'font';
    if (name.includes('/api/')) return 'api';
    
    return 'other';
  }
}

// ===========================
// User Action Tracking
// ===========================

class UserActionTracker {
  private actions: UserActionMetrics[] = [];
  private maxActions = 50;

  trackAction(
    action: string,
    target: string,
    duration: number,
    success: boolean = true,
    error?: string
  ): void {
    const metric: UserActionMetrics = {
      action,
      target,
      duration: Math.round(duration),
      timestamp: Date.now(),
      success,
      error,
    };

    this.actions.push(metric);

    // Keep only recent actions
    if (this.actions.length > this.maxActions) {
      this.actions = this.actions.slice(-this.maxActions);
    }
  }

  getActions(): UserActionMetrics[] {
    return [...this.actions];
  }

  clear(): void {
    this.actions = [];
  }
}

// ===========================
// Device Information
// ===========================

class DeviceInfoCollector {
  collect(): DeviceInfo {
    const info: DeviceInfo = {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screenResolution: {
        width: window.screen.width,
        height: window.screen.height,
      },
    };

    // Network Information API
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      info.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      };
    }

    // Memory Information (Chrome only)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      info.memory = {
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      };
    }

    return info;
  }
}

// ===========================
// Real User Metrics Manager
// ===========================

export class RealUserMetrics {
  private static instance: RealUserMetrics;
  
  private webVitalsObserver: WebVitalsObserver;
  private navigationPerformance: NavigationPerformance;
  private resourcePerformance: ResourcePerformance;
  private userActionTracker: UserActionTracker;
  private deviceInfoCollector: DeviceInfoCollector;
  
  private sessionId: string;
  private userId?: string;
  private customMetrics: Record<string, number> = {};
  private reportingInterval: number = 30000; // 30 seconds
  private reportingTimer?: NodeJS.Timeout;
  private metricsEndpoint = '/api/metrics/rum';
  
  private sessionMetrics: SessionMetrics;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.webVitalsObserver = new WebVitalsObserver();
    this.navigationPerformance = new NavigationPerformance();
    this.resourcePerformance = new ResourcePerformance();
    this.userActionTracker = new UserActionTracker();
    this.deviceInfoCollector = new DeviceInfoCollector();

    this.sessionMetrics = {
      sessionId: this.sessionId,
      startTime: Date.now(),
      duration: 0,
      pageViews: 1,
      interactions: 0,
      errors: 0,
      deviceInfo: this.deviceInfoCollector.collect(),
    };

    this.setupEventListeners();
    this.startReporting();
  }

  static getInstance(): RealUserMetrics {
    if (!RealUserMetrics.instance) {
      RealUserMetrics.instance = new RealUserMetrics();
    }
    return RealUserMetrics.instance;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventListeners(): void {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sendReport();
      }
    });

    // Track before unload
    window.addEventListener('beforeunload', () => {
      this.sendReport(true); // Send beacon
    });

    // Track errors
    window.addEventListener('error', (event) => {
      this.sessionMetrics.errors++;
      this.trackError(event.error);
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.sessionMetrics.errors++;
      this.trackError(event.reason);
    });

    // Track user interactions
    ['click', 'submit'].forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        this.sessionMetrics.interactions++;
        this.trackInteraction(event);
      });
    });
  }

  private trackInteraction(event: Event): void {
    const target = event.target as HTMLElement;
    const targetInfo = this.getTargetInfo(target);
    
    // Track interaction timing
    const startTime = performance.now();
    
    // Wait for next frame to measure interaction cost
    requestAnimationFrame(() => {
      const duration = performance.now() - startTime;
      this.userActionTracker.trackAction(
        event.type,
        targetInfo,
        duration,
        true
      );
    });
  }

  private getTargetInfo(element: HTMLElement): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const text = element.textContent?.trim().substring(0, 50) || '';
    
    return `${tag}${id}${className}${text ? `: ${text}` : ''}`;
  }

  private trackError(error: any): void {
    const errorInfo = {
      message: error?.message || String(error),
      stack: error?.stack,
      timestamp: Date.now(),
    };
    
    logger.error('RUM: Error tracked', errorInfo);
  }

  private startReporting(): void {
    this.reportingTimer = setInterval(() => {
      this.sendReport();
    }, this.reportingInterval);
  }

  private async sendReport(useBeacon: boolean = false): Promise<void> {
    const report = this.generateReport();
    
    if (useBeacon && 'sendBeacon' in navigator) {
      // Use sendBeacon for reliable delivery on page unload
      const blob = new Blob([JSON.stringify(report)], { type: 'application/json' });
      navigator.sendBeacon(this.metricsEndpoint, blob);
    } else {
      // Regular fetch
      try {
        await fetch(this.metricsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });
      } catch (error) {
        logger.debug('Failed to send RUM report:', error);
      }
    }
  }

  private generateReport(): PerformanceReport {
    this.sessionMetrics.duration = Date.now() - this.sessionMetrics.startTime;

    return {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      url: window.location.href,
      webVitals: this.webVitalsObserver.getMetrics(),
      navigation: this.navigationPerformance.getMetrics() || {} as NavigationMetrics,
      resources: this.resourcePerformance.getMetrics(),
      userActions: this.userActionTracker.getActions(),
      customMetrics: { ...this.customMetrics },
    };
  }

  // Public API

  setUserId(userId: string): void {
    this.userId = userId;
    this.sessionMetrics.userId = userId;
  }

  trackCustomMetric(name: string, value: number): void {
    this.customMetrics[name] = value;
  }

  trackPageView(url?: string): void {
    this.sessionMetrics.pageViews++;
    if (url) {
      logger.debug(`RUM: Page view tracked - ${url}`);
    }
  }

  trackAction(action: string, target: string, duration: number, success: boolean = true): void {
    this.userActionTracker.trackAction(action, target, duration, success);
  }

  async measureAsync<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    let success = true;
    
    try {
      const result = await operation();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      this.trackAction(name, 'async-operation', duration, success);
      this.trackCustomMetric(`async_${name}_duration`, duration);
    }
  }

  measure<T>(
    name: string,
    operation: () => T
  ): T {
    const startTime = performance.now();
    let success = true;
    
    try {
      const result = operation();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      this.trackAction(name, 'sync-operation', duration, success);
      this.trackCustomMetric(`sync_${name}_duration`, duration);
    }
  }

  getSessionMetrics(): SessionMetrics {
    return { ...this.sessionMetrics };
  }

  getWebVitals(): WebVitalsMetrics {
    return this.webVitalsObserver.getMetrics();
  }

  cleanup(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }
    this.webVitalsObserver.cleanup();
    this.sendReport(true);
  }
}

// ===========================
// React Hook
// ===========================

export function useRealUserMetrics() {
  const rum = RealUserMetrics.getInstance();
  
  return {
    trackAction: (action: string, target: string, duration: number) => 
      rum.trackAction(action, target, duration),
    trackCustomMetric: (name: string, value: number) => 
      rum.trackCustomMetric(name, value),
    measureAsync: <T>(name: string, operation: () => Promise<T>) => 
      rum.measureAsync(name, operation),
    measure: <T>(name: string, operation: () => T) => 
      rum.measure(name, operation),
    getWebVitals: () => rum.getWebVitals(),
    getSessionMetrics: () => rum.getSessionMetrics(),
  };
}

// ===========================
// Performance Thresholds
// ===========================

export const PERFORMANCE_THRESHOLDS = {
  webVitals: {
    fcp: { good: 1800, needsImprovement: 3000 },      // First Contentful Paint
    lcp: { good: 2500, needsImprovement: 4000 },      // Largest Contentful Paint
    fid: { good: 100, needsImprovement: 300 },        // First Input Delay
    cls: { good: 0.1, needsImprovement: 0.25 },       // Cumulative Layout Shift
    ttfb: { good: 800, needsImprovement: 1800 },      // Time to First Byte
    inp: { good: 200, needsImprovement: 500 },        // Interaction to Next Paint
  },
  custom: {
    apiCall: { good: 500, needsImprovement: 1000 },
    imageLoad: { good: 1000, needsImprovement: 3000 },
    routeChange: { good: 300, needsImprovement: 1000 },
  },
};

// ===========================
// Export Singleton Instance
// ===========================

export const rum = RealUserMetrics.getInstance();

// Auto-initialize if in browser
if (typeof window !== 'undefined' && !import.meta.env.SSR) {
  // Set up in next tick to ensure DOM is ready
  setTimeout(() => {
    logger.info('Real User Metrics initialized');
  }, 0);
}

export default rum;