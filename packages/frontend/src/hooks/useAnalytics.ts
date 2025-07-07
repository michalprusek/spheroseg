import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  analyticsService,
  EventCategory,
  EventAction,
  UserProperties,
  PerformanceMetrics,
  CustomMetric,
} from '@/services/analyticsService';
import { useStore } from '@/store';

/**
 * Unified Analytics Hooks
 * React hooks for analytics tracking and reporting
 */

/**
 * Initialize analytics and track page views
 */
export function useAnalytics() {
  const location = useLocation();
  const user = useStore((state) => state.user);
  const hasInitialized = useRef(false);

  // Initialize analytics
  useEffect(() => {
    if (!hasInitialized.current) {
      analyticsService.initialize();
      hasInitialized.current = true;
    }
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (hasInitialized.current) {
      analyticsService.trackPageView(location.pathname);
    }
  }, [location]);

  // Update user properties when user changes
  useEffect(() => {
    if (hasInitialized.current && user) {
      const properties: UserProperties = {
        userId: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        role: user.role,
        createdAt: new Date(user.createdAt),
        lastActive: new Date(),
      };
      analyticsService.setUser(properties);
    }
  }, [user]);

  return analyticsService;
}

/**
 * Track events
 */
export function useTrackEvent() {
  const trackEvent = useCallback(
    (
      category: EventCategory,
      action: EventAction,
      label?: string,
      value?: number,
      metadata?: Record<string, any>
    ) => {
      analyticsService.trackEvent(category, action, label, value, metadata);
    },
    []
  );

  const trackFeatureUsage = useCallback((feature: string, metadata?: Record<string, any>) => {
    analyticsService.trackFeatureUsage(feature, metadata);
  }, []);

  const trackError = useCallback((error: Error, context?: Record<string, any>) => {
    analyticsService.trackError(error, context);
  }, []);

  return {
    trackEvent,
    trackFeatureUsage,
    trackError,
  };
}

/**
 * Track performance metrics
 */
export function usePerformanceTracking() {
  const timers = useRef<Map<string, number>>(new Map());

  const startTimer = useCallback((label: string) => {
    timers.current.set(label, performance.now());
  }, []);

  const endTimer = useCallback((label: string, tags?: Record<string, string>) => {
    const startTime = timers.current.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      analyticsService.trackPerformance(label, duration, 'ms', tags);
      timers.current.delete(label);
    }
  }, []);

  const trackPerformance = useCallback(
    (metric: string, value: number, unit: PerformanceMetrics['unit'] = 'ms', tags?: Record<string, string>) => {
      analyticsService.trackPerformance(metric, value, unit, tags);
    },
    []
  );

  const measureAsync = useCallback(
    async <T,>(label: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> => {
      const startTime = performance.now();
      try {
        const result = await fn();
        const duration = performance.now() - startTime;
        analyticsService.trackPerformance(label, duration, 'ms', { ...tags, status: 'success' });
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        analyticsService.trackPerformance(label, duration, 'ms', { ...tags, status: 'error' });
        throw error;
      }
    },
    []
  );

  return {
    startTimer,
    endTimer,
    trackPerformance,
    measureAsync,
  };
}

/**
 * Track custom metrics
 */
export function useMetrics() {
  const trackCounter = useCallback((name: string, value: number = 1, tags?: Record<string, string>) => {
    analyticsService.trackMetric(name, value, 'counter', tags);
  }, []);

  const trackGauge = useCallback((name: string, value: number, tags?: Record<string, string>) => {
    analyticsService.trackMetric(name, value, 'gauge', tags);
  }, []);

  const trackHistogram = useCallback((name: string, value: number, tags?: Record<string, string>) => {
    analyticsService.trackMetric(name, value, 'histogram', tags);
  }, []);

  return {
    trackCounter,
    trackGauge,
    trackHistogram,
  };
}

/**
 * Track segmentation analytics
 */
export function useSegmentationAnalytics() {
  const { trackEvent } = useTrackEvent();
  const { measureAsync } = usePerformanceTracking();

  const trackSegmentationStart = useCallback((imageId: string, algorithm: string) => {
    analyticsService.trackSegmentationStart(imageId, algorithm);
  }, []);

  const trackSegmentationComplete = useCallback(
    (imageId: string, duration: number, cellCount: number) => {
      analyticsService.trackSegmentationComplete(imageId, duration, cellCount);
    },
    []
  );

  const trackSegmentationFailed = useCallback((imageId: string, error: string) => {
    analyticsService.trackSegmentationFailed(imageId, error);
  }, []);

  const measureSegmentation = useCallback(
    async <T,>(
      imageId: string,
      algorithm: string,
      fn: () => Promise<T>
    ): Promise<T> => {
      trackSegmentationStart(imageId, algorithm);
      
      try {
        const result = await measureAsync(
          'segmentation_duration',
          fn,
          { imageId, algorithm }
        );
        
        // Assume result contains cell count information
        if (result && typeof result === 'object' && 'cellCount' in result) {
          trackSegmentationComplete(
            imageId,
            0, // Duration is tracked by measureAsync
            (result as any).cellCount
          );
        }
        
        return result;
      } catch (error) {
        trackSegmentationFailed(imageId, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    },
    [trackSegmentationStart, trackSegmentationComplete, trackSegmentationFailed, measureAsync]
  );

  return {
    trackSegmentationStart,
    trackSegmentationComplete,
    trackSegmentationFailed,
    measureSegmentation,
  };
}

/**
 * Track export analytics
 */
export function useExportAnalytics() {
  const { trackEvent } = useTrackEvent();
  const { measureAsync } = usePerformanceTracking();

  const trackExportStart = useCallback(
    (format: string, itemCount: number) => {
      trackEvent(
        EventCategory.EXPORT,
        EventAction.EXPORT_START,
        format,
        itemCount
      );
    },
    [trackEvent]
  );

  const trackExportComplete = useCallback(
    (format: string, itemCount: number, fileSize?: number) => {
      analyticsService.trackExport(format, itemCount, fileSize);
    },
    []
  );

  const trackExportFailed = useCallback(
    (format: string, error: string) => {
      trackEvent(
        EventCategory.EXPORT,
        EventAction.EXPORT_FAILED,
        format,
        undefined,
        { error }
      );
    },
    [trackEvent]
  );

  const measureExport = useCallback(
    async <T,>(
      format: string,
      itemCount: number,
      fn: () => Promise<T>
    ): Promise<T> => {
      trackExportStart(format, itemCount);
      
      try {
        const result = await measureAsync(
          'export_duration',
          fn,
          { format, itemCount: itemCount.toString() }
        );
        
        // Assume result contains file size information
        if (result && typeof result === 'object' && 'fileSize' in result) {
          trackExportComplete(format, itemCount, (result as any).fileSize);
        } else {
          trackExportComplete(format, itemCount);
        }
        
        return result;
      } catch (error) {
        trackExportFailed(format, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    },
    [trackExportStart, trackExportComplete, trackExportFailed, measureAsync]
  );

  return {
    trackExportStart,
    trackExportComplete,
    trackExportFailed,
    measureExport,
  };
}

/**
 * Track user interactions
 */
export function useInteractionTracking() {
  const { trackEvent } = useTrackEvent();

  const trackClick = useCallback(
    (element: string, metadata?: Record<string, any>) => {
      trackEvent(
        EventCategory.USER,
        EventAction.FEATURE_USE,
        `click_${element}`,
        undefined,
        metadata
      );
    },
    [trackEvent]
  );

  const trackFormSubmit = useCallback(
    (formName: string, success: boolean, metadata?: Record<string, any>) => {
      trackEvent(
        EventCategory.USER,
        EventAction.FEATURE_USE,
        `form_${formName}`,
        success ? 1 : 0,
        { ...metadata, success }
      );
    },
    [trackEvent]
  );

  const trackSearch = useCallback(
    (query: string, resultCount: number, metadata?: Record<string, any>) => {
      trackEvent(
        EventCategory.USER,
        EventAction.FEATURE_USE,
        'search',
        resultCount,
        { query, resultCount, ...metadata }
      );
    },
    [trackEvent]
  );

  const trackFilter = useCallback(
    (filterType: string, filterValue: string, metadata?: Record<string, any>) => {
      trackEvent(
        EventCategory.USER,
        EventAction.FEATURE_USE,
        `filter_${filterType}`,
        undefined,
        { filterType, filterValue, ...metadata }
      );
    },
    [trackEvent]
  );

  return {
    trackClick,
    trackFormSubmit,
    trackSearch,
    trackFilter,
  };
}

/**
 * Track API performance
 */
export function useAPITracking() {
  const { measureAsync } = usePerformanceTracking();
  const { trackError } = useTrackEvent();

  const trackAPICall = useCallback(
    async <T,>(
      endpoint: string,
      method: string,
      fn: () => Promise<T>
    ): Promise<T> => {
      try {
        return await measureAsync(
          'api_call',
          fn,
          { endpoint, method }
        );
      } catch (error) {
        trackError(
          error instanceof Error ? error : new Error('API call failed'),
          { endpoint, method }
        );
        throw error;
      }
    },
    [measureAsync, trackError]
  );

  return {
    trackAPICall,
  };
}

/**
 * Analytics dashboard hook
 */
export function useAnalyticsDashboard() {
  const getSessionId = useCallback(() => {
    return (analyticsService as any).sessionId;
  }, []);

  const flush = useCallback(async () => {
    await analyticsService.flush();
  }, []);

  return {
    getSessionId,
    flush,
  };
}