import { useEffect, useRef } from 'react';
import { FrontendPerformanceMonitoring } from './performanceMonitoring';

/**
 * Hook to measure component render time
 * @param componentName Name of the component to monitor
 * @returns Object with monitoring methods
 */
export function usePerformanceMonitoring(componentName: string) {
  const monitoring = FrontendPerformanceMonitoring.getInstance();
  const renderStartTime = useRef<number>(performance.now());
  const interactionStartTimes = useRef<Record<string, number>>({});

  // Measure initial render time
  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    monitoring.recordComponentRenderMetric(componentName, renderTime);
    
    // Reset for next render
    renderStartTime.current = performance.now();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentName]);

  /**
   * Start tracking a user interaction
   * @param action Name of the action
   * @param target Target element or description
   */
  const startInteraction = (action: string, target: string) => {
    const key = `${action}:${target}`;
    interactionStartTimes.current[key] = performance.now();
  };

  /**
   * End tracking a user interaction and record the metric
   * @param action Name of the action
   * @param target Target element or description
   */
  const endInteraction = (action: string, target: string) => {
    const key = `${action}:${target}`;
    const startTime = interactionStartTimes.current[key];
    
    if (startTime) {
      const duration = performance.now() - startTime;
      monitoring.recordUserInteractionMetric(action, target, duration);
      delete interactionStartTimes.current[key];
    }
  };

  /**
   * Track an API request
   * @param endpoint API endpoint
   * @param method HTTP method
   * @param duration Request duration in ms
   * @param status HTTP status code
   * @param error Optional error message
   */
  const trackApiRequest = (
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    error?: string
  ) => {
    monitoring.recordApiRequestMetric(endpoint, method, duration, status, error);
  };

  /**
   * Create a fetch wrapper that automatically tracks API requests
   * @returns Wrapped fetch function
   */
  const createTrackedFetch = () => {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const startTime = performance.now();
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';
      
      try {
        const response = await fetch(input, init);
        const duration = performance.now() - startTime;
        
        trackApiRequest(url, method, duration, response.status);
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        trackApiRequest(url, method, duration, 0, (error as Error).message);
        throw error;
      }
    };
  };

  return {
    startInteraction,
    endInteraction,
    trackApiRequest,
    createTrackedFetch,
  };
}
