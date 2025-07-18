/**
 * Type definitions for A/B Testing Service
 */

// Experiment and Variant Types
export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate?: Date | string;
  endDate?: Date | string;
  variants: Variant[];
  targeting: TargetingRules;
  metrics: ExperimentMetrics;
  allocation: AllocationStrategy;
}

export interface Variant {
  id: string;
  name: string;
  description?: string;
  weight: number; // 0-100 percentage
  features: Record<string, any>;
  isControl?: boolean;
}

// Targeting Types
export interface TargetingRules {
  segments?: UserSegment[];
  percentage?: number; // What percentage of users to include
  excludeUserIds?: string[];
  includeUserIds?: string[];
  geoTargeting?: GeoTargeting;
  deviceTargeting?: DeviceTargeting;
}

export interface UserSegment {
  id: string;
  name: string;
  conditions: SegmentCondition[];
}

export interface SegmentCondition {
  property: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface GeoTargeting {
  countries?: string[];
  regions?: string[];
  cities?: string[];
}

export interface DeviceTargeting {
  types?: ('desktop' | 'mobile' | 'tablet')[];
  browsers?: string[];
  os?: string[];
}

// Metrics Types
export interface ExperimentMetrics {
  primary: Metric[];
  secondary?: Metric[];
}

export interface Metric {
  id: string;
  name: string;
  type: 'conversion' | 'engagement' | 'revenue' | 'custom';
  goal?: 'increase' | 'decrease';
  threshold?: number;
}

// Allocation Types
export interface AllocationStrategy {
  type: 'random' | 'deterministic' | 'sticky';
  seed?: string;
}

// Context Types
export interface UserContext {
  userId: string;
  sessionId: string;
  properties?: Record<string, any>;
  device?: DeviceInfo;
  geo?: GeoInfo;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  viewport: { width: number; height: number };
}

export interface GeoInfo {
  country?: string;
  region?: string;
  city?: string;
}

// Result Types
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  value?: any;
  experiment?: string;
  variant?: string;
}

export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  features: Record<string, any>;
  isInExperiment: boolean;
}

// Event Types
export interface TrackingEvent {
  id: string;
  timestamp: string;
  userId: string;
  sessionId: string;
  eventName: string;
  properties?: Record<string, any>;
  context?: {
    device?: DeviceInfo;
    geo?: GeoInfo;
  };
  experiments?: Record<string, string>;
}

// Service Configuration
export interface ABTestingConfig {
  analyticsEndpoint: string;
  apiKey?: string; // Deprecated - use session auth
  flushInterval?: number;
  maxBufferSize?: number;
  enableDebug?: boolean;
}

// Hook Types
export interface UseVariantResult {
  variant: string | null;
  isInExperiment: boolean;
  features: Record<string, any>;
}

export interface UseABTestingMetricsResult {
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  trackConversion: (conversionName: string, value?: number) => void;
  trackPageView: (pageName: string) => void;
}

// Component Props Types
export interface FeatureFlagProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export interface ExperimentProps {
  experimentId: string;
  children: (variant: string | null, features: Record<string, any>) => React.ReactNode;
  fallback?: React.ReactNode;
}

export interface VariantProps {
  experimentId: string;
  variantId: string;
  children: React.ReactNode;
}

export interface ABTestDebugPanelProps {
  show?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// Legacy Types (for backward compatibility)
export interface User {
  id: string;
  email: string;
  properties?: Record<string, any>;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
}
