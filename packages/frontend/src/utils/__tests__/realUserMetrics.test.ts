/**
 * Real User Metrics Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealUserMetrics, PERFORMANCE_THRESHOLDS } from '../realUserMetrics';

// Mock PerformanceObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
const mockPerformanceObserver = vi.fn((callback) => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
}));

// Mock performance.getEntriesByType
const mockGetEntriesByType = vi.fn();

// Mock fetch
const mockFetch = vi.fn();

// Mock navigator.sendBeacon
const mockSendBeacon = vi.fn();

describe('RealUserMetrics', () => {
  let rum: RealUserMetrics;

  beforeEach(() => {
    // Setup global mocks
    global.PerformanceObserver = mockPerformanceObserver as any;
    global.performance.getEntriesByType = mockGetEntriesByType;
    global.fetch = mockFetch as any;
    global.navigator.sendBeacon = mockSendBeacon;

    // Reset mocks
    vi.clearAllMocks();
    mockGetEntriesByType.mockReturnValue([]);
    mockFetch.mockResolvedValue({ ok: true });
    mockSendBeacon.mockReturnValue(true);

    // Create instance
    rum = RealUserMetrics.getInstance();
  });

  afterEach(() => {
    rum.cleanup();
  });

  describe('Web Vitals tracking', () => {
    it('should initialize performance observers', () => {
      expect(mockPerformanceObserver).toHaveBeenCalled();
      expect(mockObserve).toHaveBeenCalledWith(
        expect.objectContaining({ entryTypes: expect.any(Array) })
      );
    });

    it('should track FCP (First Contentful Paint)', () => {
      const observer = mockPerformanceObserver.mock.calls[0][0];
      const mockEntries = [
        { entryType: 'paint', name: 'first-contentful-paint', startTime: 1234 }
      ];

      observer({ getEntries: () => mockEntries });

      const metrics = rum.getWebVitals();
      expect(metrics.fcp).toBe(1234);
    });

    it('should calculate TTFB from navigation timing', () => {
      mockGetEntriesByType.mockReturnValue([{
        responseStart: 200,
        requestStart: 100,
      }]);

      const newRum = RealUserMetrics.getInstance();
      const metrics = newRum.getWebVitals();
      
      expect(metrics.ttfb).toBe(100);
    });
  });

  describe('Custom metrics', () => {
    it('should track custom metrics', () => {
      rum.trackCustomMetric('api_call_duration', 250);
      rum.trackCustomMetric('image_load_time', 500);

      // Metrics should be included in reports
      expect(mockFetch).not.toHaveBeenCalled(); // Not sent immediately
    });

    it('should track user actions', () => {
      rum.trackAction('button_click', 'submit-form', 100, true);
      rum.trackAction('api_call', 'fetch-data', 500, false);

      const sessionMetrics = rum.getSessionMetrics();
      expect(sessionMetrics.interactions).toBeGreaterThan(0);
    });
  });

  describe('Session tracking', () => {
    it('should generate unique session ID', () => {
      const metrics1 = rum.getSessionMetrics();
      expect(metrics1.sessionId).toBeTruthy();
      expect(metrics1.sessionId).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it('should track page views', () => {
      const initialMetrics = rum.getSessionMetrics();
      const initialPageViews = initialMetrics.pageViews;

      rum.trackPageView('/dashboard');
      rum.trackPageView('/projects');

      const updatedMetrics = rum.getSessionMetrics();
      expect(updatedMetrics.pageViews).toBe(initialPageViews + 2);
    });

    it('should set user ID', () => {
      rum.setUserId('user-123');
      const metrics = rum.getSessionMetrics();
      expect(metrics.userId).toBe('user-123');
    });
  });

  describe('Performance measurement helpers', () => {
    it('should measure async operations', async () => {
      const mockOperation = vi.fn().mockResolvedValue('result');
      
      const result = await rum.measureAsync('fetch_data', mockOperation);
      
      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should measure sync operations', () => {
      const mockOperation = vi.fn().mockReturnValue('result');
      
      const result = rum.measure('calculate', mockOperation);
      
      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should handle errors in measured operations', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(rum.measureAsync('failing_operation', mockOperation))
        .rejects.toThrow('Test error');
    });
  });

  describe('Reporting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should send reports periodically', () => {
      // Fast-forward 30 seconds (default reporting interval)
      vi.advanceTimersByTime(30000);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/metrics/rum',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );
    });

    it('should use sendBeacon on page unload', () => {
      // Trigger beforeunload event
      window.dispatchEvent(new Event('beforeunload'));

      expect(mockSendBeacon).toHaveBeenCalledWith(
        '/api/metrics/rum',
        expect.any(Blob)
      );
    });

    it('should send report on visibility change', () => {
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true,
      });

      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Device information', () => {
    it('should collect basic device info', () => {
      const metrics = rum.getSessionMetrics();
      const deviceInfo = metrics.deviceInfo;

      expect(deviceInfo).toBeDefined();
      expect(deviceInfo.userAgent).toBe(navigator.userAgent);
      expect(deviceInfo.viewport).toEqual({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      expect(deviceInfo.screenResolution).toEqual({
        width: window.screen.width,
        height: window.screen.height,
      });
    });

    it('should collect network info if available', () => {
      // Mock navigator.connection
      (navigator as any).connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
      };

      const newRum = RealUserMetrics.getInstance();
      const metrics = newRum.getSessionMetrics();
      
      expect(metrics.deviceInfo.connection).toEqual({
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
      });
    });
  });

  describe('Performance thresholds', () => {
    it('should export correct threshold values', () => {
      expect(PERFORMANCE_THRESHOLDS.webVitals.fcp.good).toBe(1800);
      expect(PERFORMANCE_THRESHOLDS.webVitals.lcp.good).toBe(2500);
      expect(PERFORMANCE_THRESHOLDS.webVitals.fid.good).toBe(100);
      expect(PERFORMANCE_THRESHOLDS.webVitals.cls.good).toBe(0.1);
      expect(PERFORMANCE_THRESHOLDS.webVitals.ttfb.good).toBe(800);
      expect(PERFORMANCE_THRESHOLDS.webVitals.inp.good).toBe(200);
    });

    it('should have custom metric thresholds', () => {
      expect(PERFORMANCE_THRESHOLDS.custom.apiCall.good).toBe(500);
      expect(PERFORMANCE_THRESHOLDS.custom.imageLoad.good).toBe(1000);
      expect(PERFORMANCE_THRESHOLDS.custom.routeChange.good).toBe(300);
    });
  });

  describe('Error tracking', () => {
    it('should track window errors', () => {
      const error = new Error('Test error');
      const errorEvent = new ErrorEvent('error', { error });
      
      window.dispatchEvent(errorEvent);

      const metrics = rum.getSessionMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should track unhandled promise rejections', () => {
      const reason = new Error('Unhandled rejection');
      const event = new PromiseRejectionEvent('unhandledrejection', {
        reason,
        promise: Promise.reject(reason),
      });
      
      window.dispatchEvent(event);

      const metrics = rum.getSessionMetrics();
      expect(metrics.errors).toBe(1);
    });
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RealUserMetrics.getInstance();
      const instance2 = RealUserMetrics.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});