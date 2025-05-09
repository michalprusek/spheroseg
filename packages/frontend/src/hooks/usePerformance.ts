import { useEffect, useRef } from 'react';
import { markPerformance, measurePerformance } from '@/utils/performance';
import { logger } from '@/utils/logger';

/**
 * Hook to measure component performance
 * @param componentName - Name of the component to measure
 * @param options - Additional options
 * @returns Object with performance measurement functions
 */
export const usePerformance = (
  componentName: string,
  options: {
    /** Whether to automatically measure mount time */
    measureMount?: boolean;
    /** Whether to automatically measure render time */
    measureRender?: boolean;
    /** Whether to automatically measure unmount time */
    measureUnmount?: boolean;
    /** Whether to log performance measurements */
    logMeasurements?: boolean;
  } = {}
) => {
  const {
    measureMount = true,
    measureRender = true,
    measureUnmount = true,
    logMeasurements = true,
  } = options;

  const renderCount = useRef(0);
  const mountTimeRef = useRef<number | null>(null);
  const renderStartTimeRef = useRef<number>(0);

  // Create unique IDs for this component instance
  const mountMarkId = `${componentName}-mount`;
  const renderMarkId = `${componentName}-render-${renderCount.current}`;
  const unmountMarkId = `${componentName}-unmount`;

  // Mark the start of the render
  if (measureRender) {
    renderStartTimeRef.current = performance.now();
    markPerformance(`${renderMarkId}-start`);
  }

  useEffect(() => {
    // Mark the end of the render and measure render time
    if (measureRender) {
      markPerformance(`${renderMarkId}-end`);
      const renderTime = measurePerformance(
        `${renderMarkId}-duration`,
        `${renderMarkId}-start`,
        `${renderMarkId}-end`
      );

      if (logMeasurements && renderTime !== null) {
        logger.debug(`${componentName} render time`, {
          component: componentName,
          renderTime,
          renderCount: renderCount.current,
        });
      }

      renderCount.current += 1;
    }

    // Mark mount time on first render
    if (measureMount && renderCount.current === 0) {
      markPerformance(`${mountMarkId}-end`);
      const mountTime = performance.now() - renderStartTimeRef.current;
      mountTimeRef.current = mountTime;

      if (logMeasurements) {
        logger.info(`${componentName} mounted`, {
          component: componentName,
          mountTime,
        });
      }
    }

    // Cleanup on unmount
    return () => {
      if (measureUnmount) {
        markPerformance(`${unmountMarkId}-start`);
        const unmountStartTime = performance.now();

        // We need to use setTimeout to measure unmount time
        // because the component is already unmounted when this runs
        setTimeout(() => {
          markPerformance(`${unmountMarkId}-end`);
          const unmountTime = performance.now() - unmountStartTime;

          if (logMeasurements) {
            logger.info(`${componentName} unmounted`, {
              component: componentName,
              unmountTime,
              totalMountedTime: mountTimeRef.current
                ? performance.now() - renderStartTimeRef.current
                : null,
            });
          }
        }, 0);
      }
    };
  }, [componentName, logMeasurements, measureMount, measureRender, measureUnmount, mountMarkId, renderMarkId, unmountMarkId]);

  // Return functions to manually measure performance
  return {
    /**
     * Mark a specific point in time
     * @param name - Name of the mark
     */
    mark: (name: string) => markPerformance(`${componentName}-${name}`),

    /**
     * Measure time between two marks
     * @param name - Name of the measurement
     * @param startMark - Name of the start mark
     * @param endMark - Name of the end mark
     * @returns Duration in milliseconds
     */
    measure: (name: string, startMark: string, endMark: string) =>
      measurePerformance(
        `${componentName}-${name}`,
        `${componentName}-${startMark}`,
        `${componentName}-${endMark}`
      ),

    /**
     * Start measuring an operation
     * @param operationName - Name of the operation
     * @returns Function to stop measuring
     */
    startMeasure: (operationName: string) => {
      const startMarkName = `${componentName}-${operationName}-start`;
      markPerformance(startMarkName);
      const startTime = performance.now();

      return {
        /**
         * Stop measuring the operation
         * @returns Duration in milliseconds
         */
        stop: () => {
          const endMarkName = `${componentName}-${operationName}-end`;
          markPerformance(endMarkName);
          const duration = performance.now() - startTime;

          if (logMeasurements) {
            logger.debug(`${componentName} ${operationName} completed`, {
              component: componentName,
              operation: operationName,
              duration,
            });
          }

          return duration;
        },
      };
    },
  };
};
