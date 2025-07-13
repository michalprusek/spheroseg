/**
 * A/B Testing Service
 * 
 * Provides a comprehensive A/B testing framework with:
 * - Feature flag management
 * - Experiment tracking
 * - User segmentation
 * - Analytics integration
 * - Performance monitoring
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Types
export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
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

export interface AllocationStrategy {
  type: 'random' | 'deterministic' | 'sticky';
  seed?: string;
}

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

// Constants
const STORAGE_KEY = 'ab_testing_assignments';
const METRICS_BUFFER_KEY = 'ab_testing_metrics_buffer';
const METRICS_FLUSH_INTERVAL = 30000; // 30 seconds
const MAX_METRICS_BUFFER_SIZE = 100;

// A/B Testing Service Class
export class ABTestingService {
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, string> = new Map(); // experimentId -> variantId
  private userContext: UserContext | null = null;
  private metricsBuffer: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private analyticsEndpoint: string;
  private apiKey: string;

  constructor(config: { analyticsEndpoint: string; apiKey: string }) {
    this.analyticsEndpoint = config.analyticsEndpoint;
    this.apiKey = config.apiKey;
    this.loadAssignments();
    this.loadMetricsBuffer();
    this.startMetricsFlush();
  }

  /**
   * Initialize the service with user context
   */
  public async initialize(userContext: UserContext): Promise<void> {
    this.userContext = userContext;
    
    // Detect device and geo info if not provided
    if (!userContext.device) {
      userContext.device = this.detectDevice();
    }
    
    if (!userContext.geo) {
      userContext.geo = await this.detectGeo();
    }

    // Load experiments from backend
    await this.loadExperiments();
  }

  /**
   * Get variant for a specific experiment
   */
  public getVariant(experimentId: string): ExperimentResult {
    const experiment = this.experiments.get(experimentId);
    
    if (!experiment || !this.userContext) {
      return {
        experimentId,
        variantId: 'control',
        features: {},
        isInExperiment: false,
      };
    }

    // Check if user is already assigned
    let variantId = this.assignments.get(experimentId);
    
    if (!variantId) {
      // Check if user should be in experiment
      if (!this.shouldIncludeUser(experiment)) {
        return {
          experimentId,
          variantId: 'control',
          features: {},
          isInExperiment: false,
        };
      }

      // Assign variant
      variantId = this.assignVariant(experiment);
      this.assignments.set(experimentId, variantId);
      this.saveAssignments();
      
      // Track assignment
      this.trackEvent('experiment_assigned', {
        experimentId,
        variantId,
        userId: this.userContext.userId,
      });
    }

    const variant = experiment.variants.find(v => v.id === variantId);
    
    return {
      experimentId,
      variantId,
      features: variant?.features || {},
      isInExperiment: true,
    };
  }

  /**
   * Get feature flag value
   */
  public getFeatureFlag(key: string, defaultValue: any = false): any {
    // Check all running experiments for this feature
    for (const [experimentId, experiment] of this.experiments) {
      if (experiment.status !== 'running') continue;
      
      const result = this.getVariant(experimentId);
      if (result.isInExperiment && key in result.features) {
        return result.features[key];
      }
    }
    
    return defaultValue;
  }

  /**
   * Get all active feature flags for the user
   */
  public getAllFeatureFlags(): FeatureFlag[] {
    const flags: FeatureFlag[] = [];
    
    for (const [experimentId, experiment] of this.experiments) {
      if (experiment.status !== 'running') continue;
      
      const result = this.getVariant(experimentId);
      if (result.isInExperiment) {
        Object.entries(result.features).forEach(([key, value]) => {
          flags.push({
            key,
            enabled: !!value,
            value,
            experiment: experimentId,
            variant: result.variantId,
          });
        });
      }
    }
    
    return flags;
  }

  /**
   * Track metric event
   */
  public trackEvent(eventName: string, properties?: Record<string, any>): void {
    if (!this.userContext) return;

    const event = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId: this.userContext.userId,
      sessionId: this.userContext.sessionId,
      eventName,
      properties: {
        ...properties,
        experiments: Object.fromEntries(this.assignments),
      },
      context: {
        device: this.userContext.device,
        geo: this.userContext.geo,
      },
    };

    this.metricsBuffer.push(event);
    this.saveMetricsBuffer();

    // Flush if buffer is full
    if (this.metricsBuffer.length >= MAX_METRICS_BUFFER_SIZE) {
      this.flushMetrics();
    }
  }

  /**
   * Track conversion event
   */
  public trackConversion(conversionName: string, value?: number): void {
    this.trackEvent('conversion', {
      conversionName,
      value,
    });
  }

  /**
   * Manually flush metrics
   */
  public async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const events = [...this.metricsBuffer];
    this.metricsBuffer = [];
    this.saveMetricsBuffer();

    try {
      await axios.post(
        `${this.analyticsEndpoint}/events`,
        { events },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Re-add events to buffer on failure
      this.metricsBuffer.unshift(...events);
      this.saveMetricsBuffer();
    }
  }

  // Private methods

  private shouldIncludeUser(experiment: Experiment): boolean {
    if (!this.userContext) return false;

    const { targeting } = experiment;

    // Check explicit includes/excludes
    if (targeting.includeUserIds?.includes(this.userContext.userId)) {
      return true;
    }
    
    if (targeting.excludeUserIds?.includes(this.userContext.userId)) {
      return false;
    }

    // Check percentage
    if (targeting.percentage !== undefined) {
      const hash = this.hashString(`${experiment.id}-${this.userContext.userId}`);
      const bucket = (hash % 100) + 1;
      if (bucket > targeting.percentage) {
        return false;
      }
    }

    // Check segments
    if (targeting.segments) {
      const inSegment = targeting.segments.some(segment =>
        this.evaluateSegment(segment)
      );
      if (!inSegment) return false;
    }

    // Check geo targeting
    if (targeting.geoTargeting && this.userContext.geo) {
      const { geoTargeting } = targeting;
      const { geo } = this.userContext;
      
      if (geoTargeting.countries && geo.country &&
          !geoTargeting.countries.includes(geo.country)) {
        return false;
      }
      
      if (geoTargeting.regions && geo.region &&
          !geoTargeting.regions.includes(geo.region)) {
        return false;
      }
      
      if (geoTargeting.cities && geo.city &&
          !geoTargeting.cities.includes(geo.city)) {
        return false;
      }
    }

    // Check device targeting
    if (targeting.deviceTargeting && this.userContext.device) {
      const { deviceTargeting } = targeting;
      const { device } = this.userContext;
      
      if (deviceTargeting.types &&
          !deviceTargeting.types.includes(device.type)) {
        return false;
      }
      
      if (deviceTargeting.browsers &&
          !deviceTargeting.browsers.includes(device.browser)) {
        return false;
      }
      
      if (deviceTargeting.os &&
          !deviceTargeting.os.includes(device.os)) {
        return false;
      }
    }

    return true;
  }

  private evaluateSegment(segment: UserSegment): boolean {
    if (!this.userContext) return false;

    return segment.conditions.every(condition =>
      this.evaluateCondition(condition)
    );
  }

  private evaluateCondition(condition: SegmentCondition): boolean {
    if (!this.userContext || !this.userContext.properties) return false;

    const value = this.userContext.properties[condition.property];
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      default:
        return false;
    }
  }

  private assignVariant(experiment: Experiment): string {
    const { allocation, variants } = experiment;
    
    if (allocation.type === 'deterministic' || allocation.type === 'sticky') {
      // Use consistent hashing for deterministic assignment
      const seed = allocation.seed || experiment.id;
      const hash = this.hashString(`${seed}-${this.userContext!.userId}`);
      const bucket = hash % 100;
      
      let cumulative = 0;
      for (const variant of variants) {
        cumulative += variant.weight;
        if (bucket < cumulative) {
          return variant.id;
        }
      }
    } else {
      // Random assignment
      const random = Math.random() * 100;
      let cumulative = 0;
      
      for (const variant of variants) {
        cumulative += variant.weight;
        if (random < cumulative) {
          return variant.id;
        }
      }
    }
    
    // Fallback to control
    const control = variants.find(v => v.isControl);
    return control?.id || variants[0].id;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private detectDevice(): DeviceInfo {
    const userAgent = navigator.userAgent.toLowerCase();
    
    let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (/tablet|ipad/i.test(userAgent)) {
      type = 'tablet';
    } else if (/mobile|android|iphone/i.test(userAgent)) {
      type = 'mobile';
    }

    let browser = 'unknown';
    if (/chrome/i.test(userAgent)) browser = 'chrome';
    else if (/firefox/i.test(userAgent)) browser = 'firefox';
    else if (/safari/i.test(userAgent)) browser = 'safari';
    else if (/edge/i.test(userAgent)) browser = 'edge';

    let os = 'unknown';
    if (/windows/i.test(userAgent)) os = 'windows';
    else if (/mac/i.test(userAgent)) os = 'macos';
    else if (/linux/i.test(userAgent)) os = 'linux';
    else if (/android/i.test(userAgent)) os = 'android';
    else if (/ios|iphone|ipad/i.test(userAgent)) os = 'ios';

    return {
      type,
      browser,
      os,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }

  private async detectGeo(): Promise<GeoInfo> {
    // This would typically call a geo IP service
    // For now, return empty object
    return {};
  }

  private async loadExperiments(): Promise<void> {
    try {
      const response = await axios.get(
        `${this.analyticsEndpoint}/experiments`,
        {
          headers: {
            'X-API-Key': this.apiKey,
          },
        }
      );
      
      this.experiments.clear();
      response.data.experiments.forEach((exp: Experiment) => {
        this.experiments.set(exp.id, exp);
      });
    } catch (error) {
      console.error('Failed to load experiments:', error);
    }
  }

  private loadAssignments(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.assignments = new Map(Object.entries(data));
      } catch (error) {
        console.error('Failed to load assignments:', error);
      }
    }
  }

  private saveAssignments(): void {
    const data = Object.fromEntries(this.assignments);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private loadMetricsBuffer(): void {
    const stored = localStorage.getItem(METRICS_BUFFER_KEY);
    if (stored) {
      try {
        this.metricsBuffer = JSON.parse(stored);
      } catch (error) {
        console.error('Failed to load metrics buffer:', error);
      }
    }
  }

  private saveMetricsBuffer(): void {
    localStorage.setItem(METRICS_BUFFER_KEY, JSON.stringify(this.metricsBuffer));
  }

  private startMetricsFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, METRICS_FLUSH_INTERVAL);
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushMetrics();
  }
}

// Singleton instance
let instance: ABTestingService | null = null;

export function initializeABTesting(config: {
  analyticsEndpoint: string;
  apiKey: string;
}): ABTestingService {
  if (!instance) {
    instance = new ABTestingService(config);
  }
  return instance;
}

export function getABTestingInstance(): ABTestingService | null {
  return instance;
}