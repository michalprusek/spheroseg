/**
 * Secure A/B Testing Service
 *
 * Security improvements:
 * - No API keys in client-side code
 * - Uses secure storage instead of localStorage
 * - Server-side configuration fetching
 * - Session-based authentication
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { getSecureStorage, SecureStorage } from './secureStorage';
import type {
  Experiment,
  UserContext,
  ExperimentResult,
  FeatureFlag,
  UserSegment,
  SegmentCondition,
  DeviceInfo,
  GeoInfo,
} from './types';

// Constants
const ASSIGNMENTS_KEY = 'ab_testing_assignments';
const METRICS_BUFFER_KEY = 'ab_testing_metrics_buffer';
const METRICS_FLUSH_INTERVAL = 30000; // 30 seconds
const MAX_METRICS_BUFFER_SIZE = 100;

// Logger interface for production-safe logging
interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, error?: any) => void;
}

// Production-safe logger
class ProductionLogger implements Logger {
  private isDevelopment = import.meta.env.DEV;

  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.debug(`[AB Testing] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.info(`[AB Testing] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.warn(`[AB Testing] ${message}`, ...args);
    }
  }

  error(message: string, error?: any): void {
    // Always log errors, but in production send to monitoring service
    if (this.isDevelopment) {
      console.error(`[AB Testing] ${message}`, error);
    } else {
      // Send to error monitoring service (e.g., Sentry)
      this.sendToMonitoring(message, error);
    }
  }

  private sendToMonitoring(message: string, error?: any): void {
    // Implement error monitoring integration
    // e.g., Sentry.captureException(error, { extra: { message } });
  }
}

export class SecureABTestingService {
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, string> = new Map();
  private userContext: UserContext | null = null;
  private metricsBuffer: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private secureStorage: SecureStorage;
  private logger: Logger;
  private initialized: boolean = false;

  constructor() {
    this.secureStorage = getSecureStorage();
    this.logger = new ProductionLogger();
  }

  /**
   * Initialize the service with user context
   * Fetches configuration from server using session authentication
   */
  public async initialize(userContext: UserContext): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.secureStorage.initialize();
      this.userContext = userContext;

      // Detect device and geo info if not provided
      if (!userContext.device) {
        userContext.device = this.detectDevice();
      }

      if (!userContext.geo) {
        userContext.geo = await this.detectGeo();
      }

      // Load saved data
      await this.loadAssignments();
      await this.loadMetricsBuffer();

      // Load experiments from server (no API key needed)
      await this.loadExperiments();

      // Start metrics flush timer
      this.startMetricsFlush();

      this.initialized = true;
      this.logger.info('AB Testing service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize AB Testing service', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  public async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flushMetrics();
    this.initialized = false;
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
      this.saveAssignments().catch((error) => {
        this.logger.error('Failed to save assignments', error);
      });

      // Track assignment
      this.trackEvent('experiment_assigned', {
        experimentId,
        variantId,
        userId: this.userContext.userId,
      });
    }

    const variant = experiment.variants.find((v) => v.id === variantId);

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
    this.saveMetricsBuffer().catch((error) => {
      this.logger.error('Failed to save metrics buffer', error);
    });

    // Flush if buffer is full
    if (this.metricsBuffer.length >= MAX_METRICS_BUFFER_SIZE) {
      this.flushMetrics().catch((error) => {
        this.logger.error('Failed to flush metrics', error);
      });
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
    await this.saveMetricsBuffer();

    try {
      // Send to server using session authentication
      await axios.post(
        '/api/analytics/events',
        { events },
        {
          withCredentials: true, // Include session cookies
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.debug(`Flushed ${events.length} events`);
    } catch (error) {
      this.logger.error('Failed to flush metrics', error);
      // Re-add events to buffer on failure
      this.metricsBuffer.unshift(...events);
      await this.saveMetricsBuffer();
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
      const inSegment = targeting.segments.some((segment) => this.evaluateSegment(segment));
      if (!inSegment) return false;
    }

    // Check geo targeting
    if (targeting.geoTargeting && this.userContext.geo) {
      if (!this.evaluateGeoTargeting(targeting.geoTargeting, this.userContext.geo)) {
        return false;
      }
    }

    // Check device targeting
    if (targeting.deviceTargeting && this.userContext.device) {
      if (!this.evaluateDeviceTargeting(targeting.deviceTargeting, this.userContext.device)) {
        return false;
      }
    }

    return true;
  }

  private evaluateGeoTargeting(geoTargeting: any, geo: GeoInfo): boolean {
    if (geoTargeting.countries && geo.country && !geoTargeting.countries.includes(geo.country)) {
      return false;
    }

    if (geoTargeting.regions && geo.region && !geoTargeting.regions.includes(geo.region)) {
      return false;
    }

    if (geoTargeting.cities && geo.city && !geoTargeting.cities.includes(geo.city)) {
      return false;
    }

    return true;
  }

  private evaluateDeviceTargeting(deviceTargeting: any, device: DeviceInfo): boolean {
    if (deviceTargeting.types && !deviceTargeting.types.includes(device.type)) {
      return false;
    }

    if (deviceTargeting.browsers && !deviceTargeting.browsers.includes(device.browser)) {
      return false;
    }

    if (deviceTargeting.os && !deviceTargeting.os.includes(device.os)) {
      return false;
    }

    return true;
  }

  private evaluateSegment(segment: UserSegment): boolean {
    if (!this.userContext) return false;

    return segment.conditions.every((condition) => this.evaluateCondition(condition));
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
    const control = variants.find((v) => v.isControl);
    return control?.id || variants[0].id;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
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
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) browser = 'chrome';
    else if (/firefox/i.test(userAgent)) browser = 'firefox';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'safari';
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
    // Server should provide geo info based on IP
    try {
      const response = await axios.get('/api/user/geo', {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to detect geo', error);
      return {};
    }
  }

  private async loadExperiments(): Promise<void> {
    try {
      const response = await axios.get('/api/experiments', {
        withCredentials: true, // Use session authentication
      });

      this.experiments.clear();
      response.data.experiments.forEach((exp: Experiment) => {
        this.experiments.set(exp.id, exp);
      });

      this.logger.info(`Loaded ${this.experiments.size} experiments`);
    } catch (error) {
      this.logger.error('Failed to load experiments', error);
    }
  }

  private async loadAssignments(): Promise<void> {
    try {
      const data = await this.secureStorage.getItem(ASSIGNMENTS_KEY);
      if (data) {
        this.assignments = new Map(Object.entries(data));
        this.logger.debug(`Loaded ${this.assignments.size} assignments`);
      }
    } catch (error) {
      this.logger.error('Failed to load assignments', error);
    }
  }

  private async saveAssignments(): Promise<void> {
    const data = Object.fromEntries(this.assignments);
    await this.secureStorage.setItem(ASSIGNMENTS_KEY, data);
  }

  private async loadMetricsBuffer(): Promise<void> {
    try {
      const data = await this.secureStorage.getItem(METRICS_BUFFER_KEY);
      if (data && Array.isArray(data)) {
        this.metricsBuffer = data;
        this.logger.debug(`Loaded ${this.metricsBuffer.length} buffered metrics`);
      }
    } catch (error) {
      this.logger.error('Failed to load metrics buffer', error);
    }
  }

  private async saveMetricsBuffer(): Promise<void> {
    await this.secureStorage.setItem(METRICS_BUFFER_KEY, this.metricsBuffer);
  }

  private startMetricsFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics().catch((error) => {
        this.logger.error('Scheduled metrics flush failed', error);
      });
    }, METRICS_FLUSH_INTERVAL);
  }
}

// Singleton instance
let instance: SecureABTestingService | null = null;

export function initializeABTesting(): SecureABTestingService {
  if (!instance) {
    instance = new SecureABTestingService();
  }
  return instance;
}

export function getABTestingInstance(): SecureABTestingService | null {
  return instance;
}
