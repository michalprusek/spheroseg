import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import metricsService from '../utils/metricsService';

/**
 * Hook for tracking page performance metrics
 *
 * @returns Object with performance tracking methods
 */
export function usePerformanceTracking() {
  const location = useLocation();
  const [pageLoadTime, setPageLoadTime] = useState<number | null>(null);

  // Track page load time
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      // When the component unmounts, record the page load time
      const loadTime = performance.now() - startTime;
      setPageLoadTime(loadTime);

      // Extract page name from path
      const pageName = getPageNameFromPath(location.pathname);

      // Track the page load time
      metricsService.trackPageLoad(pageName, loadTime);
    };
  }, [location.pathname]);

  /**
   * Track component render time
   *
   * @param componentName Name of the component being tracked
   * @param callback Function to execute and time
   */
  const trackRender = (componentName: string, callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metricsService.trackComponentRender(componentName, renderTime);
    return renderTime;
  };

  return {
    pageLoadTime,
    trackRender,
  };
}

/**
 * Extract page name from path
 */
function getPageNameFromPath(path: string): string {
  // Remove query params and hash
  const cleanPath = path.split(/[?#]/)[0];

  // Split by slashes and remove empty segments
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    return 'home';
  }

  // Check for specific patterns
  if (segments.length >= 2) {
    if (segments[0] === 'projects' && segments.length === 2) {
      return 'project_detail';
    }

    if (segments[0] === 'projects' && segments[1] === 'new') {
      return 'new_project';
    }

    if (segments[0] === 'segmentation') {
      return 'segmentation';
    }

    if (segments[0] === 'export') {
      return 'export';
    }
  }

  // Default to the first segment
  return segments[0];
}

export default usePerformanceTracking;
