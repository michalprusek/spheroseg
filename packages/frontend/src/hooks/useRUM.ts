/**
 * React Hook for Real User Metrics Integration
 * 
 * Provides integration with authentication and routing
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { rum, useRealUserMetrics } from '@/utils/realUserMetrics';

export function useRUM() {
  const location = useLocation();
  const { user } = useAuth();
  const rumHook = useRealUserMetrics();

  // Track user ID when authenticated
  useEffect(() => {
    if (user?.id) {
      rum.setUserId(user.id.toString());
    }
  }, [user]);

  // Track page views
  useEffect(() => {
    rum.trackPageView(location.pathname);
  }, [location.pathname]);

  return rumHook;
}

/**
 * Higher-order component to track component performance
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: P) {
    const rum = useRealUserMetrics();
    
    useEffect(() => {
      const startTime = performance.now();
      
      return () => {
        const duration = performance.now() - startTime;
        rum.trackCustomMetric(`component_${componentName}_render_time`, duration);
      };
    }, [rum]);

    return <Component {...props} />;
  };
}