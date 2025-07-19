/**
 * React hooks for A/B testing integration
 *
 * Provides easy-to-use hooks for:
 * - Feature flags
 * - Experiment variants
 * - Metric tracking
 * - User segmentation
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getABTestingInstance,
  initializeABTesting,
  ExperimentResult,
  FeatureFlag,
  UserContext,
} from '@/services/abTesting/abTestingService';

// Configuration
const AB_TESTING_CONFIG = {
  analyticsEndpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT || '/api/analytics',
  apiKey: import.meta.env.VITE_ANALYTICS_API_KEY || '',
};

/**
 * Initialize A/B testing service
 */
export function useABTestingInit() {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!user) return;

    const initService = async () => {
      try {
        const service = initializeABTesting(AB_TESTING_CONFIG);

        const userContext: UserContext = {
          userId: user.id,
          sessionId: sessionStorage.getItem('sessionId') || generateSessionId(),
          properties: {
            plan: user.plan,
            createdAt: user.createdAt,
            projectCount: user.projectCount,
            // Add more user properties as needed
          },
        };

        await service.initialize(userContext);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize A/B testing:', error);
      }
    };

    initService();
  }, [user]);

  return isInitialized;
}

/**
 * Get experiment variant
 */
export function useExperiment(experimentId: string): ExperimentResult | null {
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const isInitialized = useABTestingInit();

  useEffect(() => {
    if (!isInitialized) return;

    const service = getABTestingInstance();
    if (service) {
      const experimentResult = service.getVariant(experimentId);
      setResult(experimentResult);
    }
  }, [experimentId, isInitialized]);

  return result;
}

/**
 * Get feature flag value
 */
export function useFeatureFlag<T = boolean>(flagKey: string, defaultValue?: T): T {
  const [value, setValue] = useState<T>(defaultValue as T);
  const isInitialized = useABTestingInit();

  useEffect(() => {
    if (!isInitialized) return;

    const service = getABTestingInstance();
    if (service) {
      const flagValue = service.getFeatureFlag(flagKey, defaultValue);
      setValue(flagValue);
    }
  }, [flagKey, defaultValue, isInitialized]);

  return value;
}

/**
 * Get multiple feature flags
 */
export function useFeatureFlags(flagKeys: string[]): Record<string, any> {
  const [flags, setFlags] = useState<Record<string, any>>({});
  const isInitialized = useABTestingInit();

  useEffect(() => {
    if (!isInitialized) return;

    const service = getABTestingInstance();
    if (service) {
      const allFlags = service.getAllFeatureFlags();
      const requestedFlags = allFlags.filter((flag) => flagKeys.includes(flag.key));

      const flagMap = requestedFlags.reduce(
        (acc, flag) => ({
          ...acc,
          [flag.key]: flag.value,
        }),
        {},
      );

      setFlags(flagMap);
    }
  }, [flagKeys, isInitialized]);

  return flags;
}

/**
 * Track A/B testing metrics
 */
export function useABTestingMetrics() {
  const isInitialized = useABTestingInit();

  const trackEvent = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      if (!isInitialized) return;

      const service = getABTestingInstance();
      if (service) {
        service.trackEvent(eventName, properties);
      }
    },
    [isInitialized],
  );

  const trackConversion = useCallback(
    (conversionName: string, value?: number) => {
      if (!isInitialized) return;

      const service = getABTestingInstance();
      if (service) {
        service.trackConversion(conversionName, value);
      }
    },
    [isInitialized],
  );

  const trackTiming = useCallback(
    (timingName: string, duration: number, properties?: Record<string, any>) => {
      if (!isInitialized) return;

      const service = getABTestingInstance();
      if (service) {
        service.trackTiming(timingName, duration, properties);
      }
    },
    [isInitialized],
  );

  return {
    trackEvent,
    trackConversion,
    trackTiming,
  };
}

/**
 * Track A/B testing events - alias for useABTestingMetrics
 */
export const useABTestingEvents = useABTestingMetrics;

/**
 * Conditional rendering based on feature flag
 */
export function useFeatureEnabled(flagKey: string): boolean {
  return useFeatureFlag(flagKey, false);
}

/**
 * Get all active experiments for debugging
 */
export function useActiveExperiments(): FeatureFlag[] {
  const [experiments, setExperiments] = useState<FeatureFlag[]>([]);
  const isInitialized = useABTestingInit();

  useEffect(() => {
    if (!isInitialized) return;

    const service = getABTestingInstance();
    if (service) {
      const flags = service.getAllFeatureFlags();
      setExperiments(flags);
    }
  }, [isInitialized]);

  return experiments;
}

/**
 * Variant-specific hook for rendering different UI
 */
export function useVariant(experimentId: string, variantId: string): boolean {
  const experiment = useExperiment(experimentId);
  return experiment?.variantId === variantId && experiment.isInExperiment;
}

/**
 * Multi-variant hook
 */
export function useVariants(experimentId: string): {
  variant: string | null;
  isInExperiment: boolean;
  features: Record<string, any>;
} {
  const experiment = useExperiment(experimentId);

  return {
    variant: experiment?.variantId || null,
    isInExperiment: experiment?.isInExperiment || false,
    features: experiment?.features || {},
  };
}

/**
 * Performance-optimized feature flag hook with memoization
 */
export function useOptimizedFeatureFlag<T = boolean>(flagKey: string, defaultValue?: T, dependencies: unknown[] = []): T {
  const value = useFeatureFlag(flagKey, defaultValue);

  return useMemo(() => value, [value, ...dependencies]);
}

// Helper functions
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export all hooks
export default {
  useABTestingInit,
  useExperiment,
  useFeatureFlag,
  useFeatureFlags,
  useABTestingMetrics,
  useABTestingEvents,
  useFeatureEnabled,
  useActiveExperiments,
  useVariant,
  useVariants,
  useOptimizedFeatureFlag,
};
