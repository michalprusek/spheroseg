import { onCLS, onFCP, onFID, onLCP, onTTFB } from 'web-vitals';
import apiClient from '@/lib/apiClient';

/**
 * Service for collecting and reporting frontend performance metrics
 */
class MetricsService {
  private static instance: MetricsService;
  private metricsEndpoint = '/api/metrics/frontend';
  private isEnabled = process.env.NODE_ENV === 'production' || process.env.METRICS_ENABLED === 'true';
  private buffer: any[] = [];
  private flushInterval = 10000; // 10 seconds
  private componentRenderTimes: Record<string, number[]> = {};
  private pageLoadTimes: Record<string, number[]> = {};
  private apiRequestTimes: Record<string, { duration: number; status: number }[]> = {};
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    if (this.isEnabled) {
      this.initWebVitals();
      this.setupFlushInterval();
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Initialize web vitals collection
   */
  private initWebVitals(): void {
    onCLS(this.handleWebVital);
    onFCP(this.handleWebVital);
    onFID(this.handleWebVital);
    onLCP(this.handleWebVital);
    onTTFB(this.handleWebVital);
  }

  /**
   * Handler for web vitals metrics
   */
  private handleWebVital = (metric: any): void => {
    const { name, value, id } = metric;
    this.buffer.push({
      type: 'web_vital',
      name,
      value,
      id,
      timestamp: Date.now(),
    });
  };

  /**
   * Set up interval to flush metrics to server
   */
  private setupFlushInterval(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);

    // Add event listener for beforeunload to flush metrics
    window.addEventListener('beforeunload', () => {
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      this.flushMetrics();
    });
  }

  /**
   * Send collected metrics to server
   */
  private flushMetrics(): void {
    if (this.buffer.length === 0) return;

    // Prepare data for component render times
    Object.entries(this.componentRenderTimes).forEach(([component, times]) => {
      if (times.length > 0) {
        this.buffer.push({
          type: 'component_render',
          component,
          value: this.calculateP50(times),
          count: times.length,
          timestamp: Date.now(),
        });
        this.componentRenderTimes[component] = [];
      }
    });

    // Prepare data for page load times
    Object.entries(this.pageLoadTimes).forEach(([page, times]) => {
      if (times.length > 0) {
        this.buffer.push({
          type: 'page_load',
          page,
          value: this.calculateP50(times),
          count: times.length,
          timestamp: Date.now(),
        });
        this.pageLoadTimes[page] = [];
      }
    });

    // Prepare data for API request times
    Object.entries(this.apiRequestTimes).forEach(([endpoint, requests]) => {
      if (requests.length > 0) {
        const durations = requests.map((r) => r.duration);
        const successRate = requests.filter((r) => r.status >= 200 && r.status < 300).length / requests.length;

        this.buffer.push({
          type: 'api_request',
          endpoint,
          value: this.calculateP50(durations),
          count: requests.length,
          successRate,
          timestamp: Date.now(),
        });
        this.apiRequestTimes[endpoint] = [];
      }
    });

    // Send data to server
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(this.metricsEndpoint, JSON.stringify(this.buffer));
      } else {
        apiClient
          .post(this.metricsEndpoint, this.buffer, {
            headers: {
              'Content-Type': 'application/json',
            },
            // Axios handles keepalive implicitly for POST requests
          })
          .catch((error) => {
            console.error('Failed to send metrics:', error);
          });
      }

      // Clear buffer after sending
      this.buffer = [];
    } catch (error) {
      console.error('Error sending metrics:', error);
    }
  }

  /**
   * Track component render time
   */
  public trackComponentRender(componentName: string, renderTimeMs: number): void {
    if (!this.isEnabled) return;

    if (!this.componentRenderTimes[componentName]) {
      this.componentRenderTimes[componentName] = [];
    }

    this.componentRenderTimes[componentName].push(renderTimeMs);
  }

  /**
   * Track page load time
   */
  public trackPageLoad(pageName: string, loadTimeMs: number): void {
    if (!this.isEnabled) return;

    if (!this.pageLoadTimes[pageName]) {
      this.pageLoadTimes[pageName] = [];
    }

    this.pageLoadTimes[pageName].push(loadTimeMs);
  }

  /**
   * Track API request
   */
  public trackApiRequest(endpoint: string, durationMs: number, statusCode: number): void {
    if (!this.isEnabled) return;

    if (!this.apiRequestTimes[endpoint]) {
      this.apiRequestTimes[endpoint] = [];
    }

    this.apiRequestTimes[endpoint].push({
      duration: durationMs,
      status: statusCode,
    });
  }

  /**
   * Calculate P50 (median) from array of numbers
   */
  private calculateP50(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const midIndex = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[midIndex - 1] + sorted[midIndex]) / 2;
    } else {
      return sorted[midIndex];
    }
  }
}

export default MetricsService.getInstance();

// React hook for tracking component render time
export function useComponentRenderTracking(componentName: string) {
  return {
    trackRender: (callback: () => void) => {
      const start = performance.now();
      callback();
      const end = performance.now();
      MetricsService.getInstance().trackComponentRender(componentName, end - start);
    },
  };
}

// Axios interceptor for tracking API requests
export function setupAxiosMetricsInterceptors(axiosInstance: any) {
  axiosInstance.interceptors.request.use((config: any) => {
    config.metadata = { startTime: performance.now() };
    return config;
  });

  axiosInstance.interceptors.response.use(
    (response: any) => {
      const duration = performance.now() - response.config.metadata.startTime;
      const endpoint = response.config.url.replace(/\/[0-9a-f-]+(?=\/|$)/g, '/:id');

      MetricsService.getInstance().trackApiRequest(endpoint, duration, response.status);

      return response;
    },
    (error: any) => {
      if (error.config) {
        const duration = performance.now() - error.config.metadata.startTime;
        const endpoint = error.config.url.replace(/\/[0-9a-f-]+(?=\/|$)/g, '/:id');
        const status = error.response ? error.response.status : 0;

        MetricsService.getInstance().trackApiRequest(endpoint, duration, status);
      }

      return Promise.reject(error);
    },
  );
}
