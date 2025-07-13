/**
 * React components for A/B testing
 * 
 * Provides components for:
 * - Feature flag based rendering
 * - Experiment variants
 * - Debug panel
 * - Metric tracking
 */

import React, { ReactNode, useEffect } from 'react';
import {
  useFeatureFlag,
  useVariant,
  useVariants,
  useActiveExperiments,
  useABTestingMetrics,
} from '@/hooks/useABTesting';

// Types
interface FeatureFlagProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface ExperimentProps {
  experimentId: string;
  children: (variant: string | null, features: Record<string, any>) => ReactNode;
  fallback?: ReactNode;
}

interface VariantProps {
  experimentId: string;
  variantId: string;
  children: ReactNode;
}

interface ABTestDebugPanelProps {
  show?: boolean;
}

interface TrackEventProps {
  event: string;
  properties?: Record<string, any>;
  children: ReactNode;
  trigger?: 'mount' | 'click' | 'hover' | 'focus';
}

interface TrackConversionProps {
  name: string;
  value?: number;
  children: ReactNode;
  trigger?: 'mount' | 'click';
}

/**
 * Feature flag component
 * Conditionally renders children based on feature flag
 */
export function FeatureFlag({ flag, children, fallback = null }: FeatureFlagProps) {
  const isEnabled = useFeatureFlag(flag, false);
  
  return <>{isEnabled ? children : fallback}</>;
}

/**
 * Experiment component
 * Renders different content based on experiment variant
 */
export function Experiment({ experimentId, children, fallback = null }: ExperimentProps) {
  const { variant, isInExperiment, features } = useVariants(experimentId);
  
  if (!isInExperiment) {
    return <>{fallback}</>;
  }
  
  return <>{children(variant, features)}</>;
}

/**
 * Variant component
 * Renders children only for specific variant
 */
export function Variant({ experimentId, variantId, children }: VariantProps) {
  const isVariant = useVariant(experimentId, variantId);
  
  return isVariant ? <>{children}</> : null;
}

/**
 * Multi-variant switch component
 */
interface VariantSwitchProps {
  experimentId: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function VariantSwitch({ experimentId, children, fallback }: VariantSwitchProps) {
  const { variant, isInExperiment } = useVariants(experimentId);
  
  if (!isInExperiment) {
    return <>{fallback}</>;
  }
  
  // Find matching variant child
  const variantChildren = React.Children.toArray(children);
  const matchingChild = variantChildren.find((child) => {
    if (React.isValidElement(child) && child.type === Variant) {
      return child.props.variantId === variant;
    }
    return false;
  });
  
  return <>{matchingChild || fallback}</>;
}

/**
 * Track event component
 */
export function TrackEvent({ 
  event, 
  properties, 
  children, 
  trigger = 'mount' 
}: TrackEventProps) {
  const { trackEvent } = useABTestingMetrics();
  
  useEffect(() => {
    if (trigger === 'mount') {
      trackEvent(event, properties);
    }
  }, [event, properties, trackEvent, trigger]);
  
  const handleInteraction = () => {
    if (trigger !== 'mount') {
      trackEvent(event, properties);
    }
  };
  
  const interactionProps = {
    ...(trigger === 'click' && { onClick: handleInteraction }),
    ...(trigger === 'hover' && { onMouseEnter: handleInteraction }),
    ...(trigger === 'focus' && { onFocus: handleInteraction }),
  };
  
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, interactionProps);
  }
  
  return <div {...interactionProps}>{children}</div>;
}

/**
 * Track conversion component
 */
export function TrackConversion({ 
  name, 
  value, 
  children, 
  trigger = 'click' 
}: TrackConversionProps) {
  const { trackConversion } = useABTestingMetrics();
  
  useEffect(() => {
    if (trigger === 'mount') {
      trackConversion(name, value);
    }
  }, [name, value, trackConversion, trigger]);
  
  const handleClick = () => {
    if (trigger === 'click') {
      trackConversion(name, value);
    }
  };
  
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, { onClick: handleClick });
  }
  
  return <div onClick={handleClick}>{children}</div>;
}

/**
 * A/B Test Debug Panel
 * Shows active experiments and feature flags in development
 */
export function ABTestDebugPanel({ show = import.meta.env.DEV }: ABTestDebugPanelProps) {
  const experiments = useActiveExperiments();
  
  if (!show || experiments.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 p-4 bg-gray-900 text-white rounded-lg shadow-lg max-w-sm z-50">
      <h3 className="text-sm font-bold mb-2">A/B Testing Debug</h3>
      <div className="space-y-2 text-xs">
        {experiments.map((flag) => (
          <div key={flag.key} className="border-b border-gray-700 pb-1">
            <div className="font-medium">{flag.key}</div>
            <div className="text-gray-400">
              Experiment: {flag.experiment || 'none'}
            </div>
            <div className="text-gray-400">
              Variant: {flag.variant || 'control'}
            </div>
            <div className="text-gray-400">
              Value: {JSON.stringify(flag.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Feature-specific components with A/B testing
 */

// New UI experiment
export function NewUIExperiment({ children }: { children: ReactNode }) {
  return (
    <Experiment experimentId="new-ui-2024">
      {(variant, features) => {
        if (variant === 'modern') {
          return (
            <div className={features.darkMode ? 'dark' : ''}>
              {children}
            </div>
          );
        }
        return <>{children}</>;
      }}
    </Experiment>
  );
}

// Onboarding flow experiment
export function OnboardingExperiment() {
  return (
    <VariantSwitch experimentId="onboarding-flow-v2">
      <Variant experimentId="onboarding-flow-v2" variantId="control">
        <div>Standard onboarding flow</div>
      </Variant>
      <Variant experimentId="onboarding-flow-v2" variantId="guided">
        <div>Guided tutorial onboarding</div>
      </Variant>
      <Variant experimentId="onboarding-flow-v2" variantId="video">
        <div>Video-based onboarding</div>
      </Variant>
    </VariantSwitch>
  );
}

// Performance optimization experiment
export function PerformanceOptimizationWrapper({ children }: { children: ReactNode }) {
  const enableLazyLoading = useFeatureFlag('performance.lazy-loading', false);
  const enableVirtualization = useFeatureFlag('performance.virtualization', false);
  const enableWebWorkers = useFeatureFlag('performance.web-workers', false);
  
  return (
    <div
      data-lazy-loading={enableLazyLoading}
      data-virtualization={enableVirtualization}
      data-web-workers={enableWebWorkers}
    >
      {children}
    </div>
  );
}

// Export all components
export default {
  FeatureFlag,
  Experiment,
  Variant,
  VariantSwitch,
  TrackEvent,
  TrackConversion,
  ABTestDebugPanel,
  NewUIExperiment,
  OnboardingExperiment,
  PerformanceOptimizationWrapper,
};