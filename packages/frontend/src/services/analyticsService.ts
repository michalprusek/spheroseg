import { getConfigValue } from '@/config';
import { z } from 'zod';

/**
 * Unified Analytics Service
 * Comprehensive analytics tracking and reporting for SpherosegV4
 */

// Event types
export enum EventCategory {
  USER = 'user',
  PROJECT = 'project',
  IMAGE = 'image',
  SEGMENTATION = 'segmentation',
  EXPORT = 'export',
  SYSTEM = 'system',
  PERFORMANCE = 'performance',
  ERROR = 'error',
}

export enum EventAction {
  // User actions
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PROFILE_UPDATE = 'profile_update',
  SETTINGS_CHANGE = 'settings_change',
  
  // Project actions
  PROJECT_CREATE = 'project_create',
  PROJECT_OPEN = 'project_open',
  PROJECT_DELETE = 'project_delete',
  PROJECT_SHARE = 'project_share',
  PROJECT_DUPLICATE = 'project_duplicate',
  
  // Image actions
  IMAGE_UPLOAD = 'image_upload',
  IMAGE_VIEW = 'image_view',
  IMAGE_DELETE = 'image_delete',
  IMAGE_EDIT = 'image_edit',
  
  // Segmentation actions
  SEGMENTATION_START = 'segmentation_start',
  SEGMENTATION_COMPLETE = 'segmentation_complete',
  SEGMENTATION_FAILED = 'segmentation_failed',
  SEGMENTATION_EDIT = 'segmentation_edit',
  
  // Export actions
  EXPORT_START = 'export_start',
  EXPORT_COMPLETE = 'export_complete',
  EXPORT_FAILED = 'export_failed',
  
  // System actions
  PAGE_VIEW = 'page_view',
  FEATURE_USE = 'feature_use',
  API_CALL = 'api_call',
  
  // Performance actions
  LOAD_TIME = 'load_time',
  RENDER_TIME = 'render_time',
  API_LATENCY = 'api_latency',
  
  // Error actions
  ERROR_OCCURRED = 'error_occurred',
  ERROR_BOUNDARY = 'error_boundary',
  API_ERROR = 'api_error',
}

// Analytics event interface
export interface AnalyticsEvent {
  category: EventCategory;
  action: EventAction;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp?: Date;
  userId?: string;
  sessionId?: string;
}

// User properties
export interface UserProperties {
  userId: string;
  email?: string;
  name?: string;
  organization?: string;
  role?: string;
  plan?: string;
  createdAt?: Date;
  lastActive?: Date;
  customProperties?: Record<string, any>;
}

// Page view data
export interface PageViewData {
  path: string;
  title: string;
  referrer?: string;
  queryParams?: Record<string, string>;
  duration?: number;
}

// Performance metrics
export interface PerformanceMetrics {
  metric: string;
  value: number;
  unit: 'ms' | 's' | 'bytes' | 'MB' | 'count' | 'percent';
  tags?: Record<string, string>;
}

// Custom metrics
export interface CustomMetric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram';
  tags?: Record<string, string>;
}

// Analytics provider interface
interface AnalyticsProvider {
  initialize(config: any): void;
  trackEvent(event: AnalyticsEvent): void;
  trackPageView(data: PageViewData): void;
  setUserProperties(properties: UserProperties): void;
  trackPerformance(metrics: PerformanceMetrics): void;
  trackCustomMetric(metric: CustomMetric): void;
  flush(): Promise<void>;
}

// Google Analytics provider
class GoogleAnalyticsProvider implements AnalyticsProvider {
  private initialized = false;

  initialize(config: { measurementId: string }): void {
    if (this.initialized || !config.measurementId) return;

    // Load gtag script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`;
    document.head.appendChild(script);

    // Initialize gtag
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).gtag = function() {
      (window as any).dataLayer.push(arguments);
    };
    (window as any).gtag('js', new Date());
    (window as any).gtag('config', config.measurementId);

    this.initialized = true;
  }

  trackEvent(event: AnalyticsEvent): void {
    if (!this.initialized) return;
    
    (window as any).gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      custom_parameters: event.metadata,
    });
  }

  trackPageView(data: PageViewData): void {
    if (!this.initialized) return;
    
    (window as any).gtag('event', 'page_view', {
      page_path: data.path,
      page_title: data.title,
      page_referrer: data.referrer,
    });
  }

  setUserProperties(properties: UserProperties): void {
    if (!this.initialized) return;
    
    (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
      user_id: properties.userId,
      user_properties: {
        email: properties.email,
        organization: properties.organization,
        role: properties.role,
        plan: properties.plan,
      },
    });
  }

  trackPerformance(metrics: PerformanceMetrics): void {
    if (!this.initialized) return;
    
    (window as any).gtag('event', 'timing_complete', {
      name: metrics.metric,
      value: metrics.value,
      event_category: 'performance',
      event_label: metrics.unit,
    });
  }

  trackCustomMetric(metric: CustomMetric): void {
    if (!this.initialized) return;
    
    (window as any).gtag('event', 'custom_metric', {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_type: metric.type,
      ...metric.tags,
    });
  }

  async flush(): Promise<void> {
    // GA handles this automatically
  }
}

// Mixpanel provider
class MixpanelProvider implements AnalyticsProvider {
  private initialized = false;

  initialize(config: { token: string }): void {
    if (this.initialized || !config.token) return;

    // Initialize Mixpanel
    (window as any).mixpanel?.init(config.token);
    this.initialized = true;
  }

  trackEvent(event: AnalyticsEvent): void {
    if (!this.initialized) return;
    
    (window as any).mixpanel?.track(event.action, {
      category: event.category,
      label: event.label,
      value: event.value,
      ...event.metadata,
    });
  }

  trackPageView(data: PageViewData): void {
    if (!this.initialized) return;
    
    (window as any).mixpanel?.track('Page View', {
      path: data.path,
      title: data.title,
      referrer: data.referrer,
      duration: data.duration,
    });
  }

  setUserProperties(properties: UserProperties): void {
    if (!this.initialized) return;
    
    (window as any).mixpanel?.identify(properties.userId);
    (window as any).mixpanel?.people.set({
      $email: properties.email,
      $name: properties.name,
      organization: properties.organization,
      role: properties.role,
      plan: properties.plan,
    });
  }

  trackPerformance(metrics: PerformanceMetrics): void {
    if (!this.initialized) return;
    
    (window as any).mixpanel?.track('Performance Metric', {
      metric: metrics.metric,
      value: metrics.value,
      unit: metrics.unit,
      ...metrics.tags,
    });
  }

  trackCustomMetric(metric: CustomMetric): void {
    if (!this.initialized) return;
    
    (window as any).mixpanel?.track('Custom Metric', {
      name: metric.name,
      value: metric.value,
      type: metric.type,
      ...metric.tags,
    });
  }

  async flush(): Promise<void> {
    return new Promise((resolve) => {
      (window as any).mixpanel?.track('Flush', {}, resolve);
    });
  }
}

// Console provider for development
class ConsoleProvider implements AnalyticsProvider {
  private config: any;

  initialize(config: any): void {
    this.config = config;
    console.log('[Analytics] Initialized with config:', config);
  }

  trackEvent(event: AnalyticsEvent): void {
    console.log('[Analytics] Event:', event);
  }

  trackPageView(data: PageViewData): void {
    console.log('[Analytics] Page View:', data);
  }

  setUserProperties(properties: UserProperties): void {
    console.log('[Analytics] User Properties:', properties);
  }

  trackPerformance(metrics: PerformanceMetrics): void {
    console.log('[Analytics] Performance:', metrics);
  }

  trackCustomMetric(metric: CustomMetric): void {
    console.log('[Analytics] Custom Metric:', metric);
  }

  async flush(): Promise<void> {
    console.log('[Analytics] Flushed');
  }
}

// Analytics configuration
interface AnalyticsConfig {
  enabled: boolean;
  providers: {
    google?: {
      enabled: boolean;
      measurementId: string;
    };
    mixpanel?: {
      enabled: boolean;
      token: string;
    };
  };
  debug?: boolean;
  anonymizeIp?: boolean;
  sessionTimeout?: number;
  excludePaths?: string[];
  customDimensions?: Record<string, string>;
}

// Main Analytics Service
class AnalyticsService {
  private providers: AnalyticsProvider[] = [];
  private config: AnalyticsConfig;
  private sessionId: string;
  private queue: Array<() => void> = [];
  private isInitialized = false;
  private userProperties: UserProperties | null = null;
  private pageStartTime: number = Date.now();

  constructor() {
    this.sessionId = this.generateSessionId();
    this.config = this.loadConfig();
  }

  /**
   * Load configuration
   */
  private loadConfig(): AnalyticsConfig {
    return {
      enabled: getConfigValue('analytics.enabled', true),
      providers: {
        google: {
          enabled: getConfigValue('analytics.providers.google.enabled', false),
          measurementId: getConfigValue('analytics.providers.google.measurementId', ''),
        },
        mixpanel: {
          enabled: getConfigValue('analytics.providers.mixpanel.enabled', false),
          token: getConfigValue('analytics.providers.mixpanel.token', ''),
        },
      },
      debug: getConfigValue('analytics.debug', false),
      anonymizeIp: getConfigValue('analytics.anonymizeIp', true),
      sessionTimeout: getConfigValue('analytics.sessionTimeout', 30 * 60 * 1000), // 30 minutes
      excludePaths: getConfigValue('analytics.excludePaths', []),
      customDimensions: getConfigValue('analytics.customDimensions', {}),
    };
  }

  /**
   * Initialize analytics
   */
  initialize(): void {
    if (this.isInitialized || !this.config.enabled) return;

    // Initialize providers
    if (this.config.providers.google?.enabled) {
      const ga = new GoogleAnalyticsProvider();
      ga.initialize({ measurementId: this.config.providers.google.measurementId });
      this.providers.push(ga);
    }

    if (this.config.providers.mixpanel?.enabled) {
      const mp = new MixpanelProvider();
      mp.initialize({ token: this.config.providers.mixpanel.token });
      this.providers.push(mp);
    }

    // Always add console provider in debug mode
    if (this.config.debug || this.providers.length === 0) {
      const console = new ConsoleProvider();
      console.initialize(this.config);
      this.providers.push(console);
    }

    // Process queued events
    this.processQueue();

    // Set up automatic page tracking
    this.setupAutomaticPageTracking();

    // Set up performance tracking
    this.setupPerformanceTracking();

    // Set up error tracking
    this.setupErrorTracking();

    this.isInitialized = true;
  }

  /**
   * Track event
   */
  trackEvent(
    category: EventCategory,
    action: EventAction,
    label?: string,
    value?: number,
    metadata?: Record<string, any>
  ): void {
    const event: AnalyticsEvent = {
      category,
      action,
      label,
      value,
      metadata,
      timestamp: new Date(),
      userId: this.userProperties?.userId,
      sessionId: this.sessionId,
    };

    if (!this.isInitialized) {
      this.queue.push(() => this.trackEventInternal(event));
      return;
    }

    this.trackEventInternal(event);
  }

  /**
   * Internal event tracking
   */
  private trackEventInternal(event: AnalyticsEvent): void {
    this.providers.forEach(provider => {
      try {
        provider.trackEvent(event);
      } catch (error) {
        console.error('[Analytics] Provider error:', error);
      }
    });
  }

  /**
   * Track page view
   */
  trackPageView(path: string, title?: string): void {
    if (this.config.excludePaths?.includes(path)) return;

    const duration = Date.now() - this.pageStartTime;
    this.pageStartTime = Date.now();

    const data: PageViewData = {
      path,
      title: title || document.title,
      referrer: document.referrer,
      queryParams: this.parseQueryParams(window.location.search),
      duration,
    };

    if (!this.isInitialized) {
      this.queue.push(() => this.trackPageViewInternal(data));
      return;
    }

    this.trackPageViewInternal(data);
  }

  /**
   * Internal page view tracking
   */
  private trackPageViewInternal(data: PageViewData): void {
    this.providers.forEach(provider => {
      try {
        provider.trackPageView(data);
      } catch (error) {
        console.error('[Analytics] Provider error:', error);
      }
    });
  }

  /**
   * Set user properties
   */
  setUser(properties: UserProperties): void {
    this.userProperties = properties;

    if (!this.isInitialized) {
      this.queue.push(() => this.setUserInternal(properties));
      return;
    }

    this.setUserInternal(properties);
  }

  /**
   * Internal user properties setting
   */
  private setUserInternal(properties: UserProperties): void {
    this.providers.forEach(provider => {
      try {
        provider.setUserProperties(properties);
      } catch (error) {
        console.error('[Analytics] Provider error:', error);
      }
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metric: string, value: number, unit: PerformanceMetrics['unit'] = 'ms', tags?: Record<string, string>): void {
    const metrics: PerformanceMetrics = {
      metric,
      value,
      unit,
      tags,
    };

    if (!this.isInitialized) {
      this.queue.push(() => this.trackPerformanceInternal(metrics));
      return;
    }

    this.trackPerformanceInternal(metrics);
  }

  /**
   * Internal performance tracking
   */
  private trackPerformanceInternal(metrics: PerformanceMetrics): void {
    this.providers.forEach(provider => {
      try {
        provider.trackPerformance(metrics);
      } catch (error) {
        console.error('[Analytics] Provider error:', error);
      }
    });
  }

  /**
   * Track custom metric
   */
  trackMetric(name: string, value: number, type: CustomMetric['type'] = 'gauge', tags?: Record<string, string>): void {
    const metric: CustomMetric = {
      name,
      value,
      type,
      tags,
    };

    if (!this.isInitialized) {
      this.queue.push(() => this.trackMetricInternal(metric));
      return;
    }

    this.trackMetricInternal(metric);
  }

  /**
   * Internal custom metric tracking
   */
  private trackMetricInternal(metric: CustomMetric): void {
    this.providers.forEach(provider => {
      try {
        provider.trackCustomMetric(metric);
      } catch (error) {
        console.error('[Analytics] Provider error:', error);
      }
    });
  }

  /**
   * Track timing
   */
  startTiming(label: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.trackPerformance(label, duration, 'ms');
    };
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.trackEvent(
      EventCategory.ERROR,
      EventAction.ERROR_OCCURRED,
      error.message,
      undefined,
      {
        stack: error.stack,
        name: error.name,
        ...context,
      }
    );
  }

  /**
   * Flush events
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.providers.map(provider => provider.flush())
    );
  }

  /**
   * Process queued events
   */
  private processQueue(): void {
    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      fn?.();
    }
  }

  /**
   * Set up automatic page tracking
   */
  private setupAutomaticPageTracking(): void {
    // Track initial page view
    this.trackPageView(window.location.pathname);

    // Listen for route changes (React Router)
    let lastPath = window.location.pathname;
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        this.trackPageView(lastPath);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Set up performance tracking
   */
  private setupPerformanceTracking(): void {
    // Track page load performance
    if ('performance' in window) {
      window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (perfData) {
          this.trackPerformance('page_load', perfData.loadEventEnd - perfData.fetchStart, 'ms');
          this.trackPerformance('dom_ready', perfData.domContentLoadedEventEnd - perfData.fetchStart, 'ms');
          this.trackPerformance('first_paint', perfData.domInteractive - perfData.fetchStart, 'ms');
        }
      });

      // Track Largest Contentful Paint
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.trackPerformance('lcp', lastEntry.startTime, 'ms');
          });
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
          // LCP not supported
        }
      }
    }
  }

  /**
   * Set up error tracking
   */
  private setupErrorTracking(): void {
    // Track unhandled errors
    window.addEventListener('error', (event) => {
      this.trackError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), {
        type: 'unhandledrejection',
      });
    });
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse query parameters
   */
  private parseQueryParams(search: string): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(search);
    
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return params;
  }

  /**
   * Feature usage tracking helpers
   */
  trackFeatureUsage(feature: string, metadata?: Record<string, any>): void {
    this.trackEvent(
      EventCategory.SYSTEM,
      EventAction.FEATURE_USE,
      feature,
      undefined,
      metadata
    );
  }

  /**
   * Segmentation tracking helpers
   */
  trackSegmentationStart(imageId: string, algorithm: string): void {
    this.trackEvent(
      EventCategory.SEGMENTATION,
      EventAction.SEGMENTATION_START,
      algorithm,
      undefined,
      { imageId, algorithm }
    );
  }

  trackSegmentationComplete(imageId: string, duration: number, cellCount: number): void {
    this.trackEvent(
      EventCategory.SEGMENTATION,
      EventAction.SEGMENTATION_COMPLETE,
      undefined,
      cellCount,
      { imageId, duration, cellCount }
    );
  }

  trackSegmentationFailed(imageId: string, error: string): void {
    this.trackEvent(
      EventCategory.SEGMENTATION,
      EventAction.SEGMENTATION_FAILED,
      error,
      undefined,
      { imageId, error }
    );
  }

  /**
   * Export tracking helpers
   */
  trackExport(format: string, itemCount: number, fileSize?: number): void {
    this.trackEvent(
      EventCategory.EXPORT,
      EventAction.EXPORT_COMPLETE,
      format,
      itemCount,
      { format, itemCount, fileSize }
    );
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

// Export types
export type { AnalyticsConfig, AnalyticsProvider };