import { useCallback, useEffect, useRef } from 'react';

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitoring = () => {
  // Record navigation timing
  if (window.performance && window.performance.timing) {
    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;

    // Report basic metrics
    console.debug('[Performance] DNS lookup:', timing.domainLookupEnd - timing.domainLookupStart, 'ms');
    console.debug('[Performance] TCP connection:', timing.connectEnd - timing.connectStart, 'ms');
    console.debug('[Performance] Request time:', timing.responseEnd - timing.requestStart, 'ms');
    console.debug('[Performance] DOM processing:', timing.domComplete - timing.domLoading, 'ms');
    console.debug('[Performance] Total page load:', timing.loadEventEnd - navigationStart, 'ms');

    // Send metrics to backend
    if (navigator.sendBeacon) {
      const metrics = {
        dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
        tcpConnection: timing.connectEnd - timing.connectStart,
        requestTime: timing.responseEnd - timing.requestStart,
        domProcessing: timing.domComplete - timing.domLoading,
        totalPageLoad: timing.loadEventEnd - navigationStart,
        timestamp: new Date().toISOString()
      };

      navigator.sendBeacon('/api/metrics/performance', JSON.stringify(metrics));
    }
  }

  // Register performance observer if available
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          console.debug(`[Performance] ${entry.name}: ${entry.startTime.toFixed(2)}ms (duration: ${entry.duration.toFixed(2)}ms)`);
        });
      });

      observer.observe({ entryTypes: ['resource', 'paint', 'navigation'] });
    } catch (e) {
      console.error('Performance observer error:', e);
    }
  }
};

/**
 * Mark a performance event
 */
export const markPerformance = (name: string) => {
  if (window.performance && window.performance.mark) {
    window.performance.mark(name);
    console.debug(`[Performance] Marked: ${name}`);
    return true;
  }
  return false;
};

/**
 * Measure time between two performance marks
 */
export const measurePerformance = (name: string, startMark: string, endMark: string) => {
  if (window.performance && window.performance.measure) {
    try {
      window.performance.measure(name, startMark, endMark);
      const measures = window.performance.getEntriesByName(name, 'measure');
      if (measures.length > 0) {
        const duration = measures[0].duration;
        console.debug(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
        return duration;
      }
    } catch (e) {
      console.error(`[Performance] Error measuring ${name}:`, e);
    }
  }
  return null;
};

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

      // Report initial load time to backend (optional)
      if (navigator.sendBeacon) {
        const metrics = {
          initialLoadTime: initialRenderTime.current,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight
        };

        navigator.sendBeacon('/api/metrics/frontend', JSON.stringify(metrics));
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
        console.debug(`[Performance] Render took ${timeSinceLastRender.toFixed(2)}ms`);
      }
    }

    lastRenderTime.current = now;
  });

  // Helper to send metrics to analytics
  const sendToAnalytics = useCallback((metric: any) => {
    // You can implement any analytics service here
    console.debug(`[Web Vitals] ${metric.name}: ${metric.value}`);

    // Optionally send to backend
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/vitals', JSON.stringify({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  return {
    renderCount: renderCount.current,
    initialLoadTime: initialRenderTime.current,
    measureOperation: (operation: () => void, label = 'Operation') => {
      const start = performance.now();
      operation();
      const duration = performance.now() - start;
      console.debug(`[Performance] ${label} took ${duration.toFixed(2)}ms`);
      return duration;
    }
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
      console.debug(`[Performance] Image ${imageUrl} loaded in ${loadTime.toFixed(2)}ms`);

      // Report image load time
      const img = event.currentTarget;
      const metrics = {
        imageUrl,
        loadTime,
        width: img.naturalWidth,
        height: img.naturalHeight,
        timestamp: new Date().toISOString()
      };

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics/image-load', JSON.stringify(metrics));
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

export default {
  usePerformance,
  useImageLoadPerformance,
  useLazyLoading,
  initPerformanceMonitoring,
  markPerformance,
  measurePerformance
};
