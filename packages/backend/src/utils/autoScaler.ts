/**
 * Auto-Scaling Configuration and Management System
 * 
 * Provides metric-based auto-scaling for Docker Compose services
 * with configurable thresholds, scaling policies, and safety mechanisms.
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import { BusinessMetricsService, type MetricValue, type Alert } from './businessMetrics';

const execAsync = promisify(exec);

export interface ScalingMetric {
  name: string;
  type: 'cpu' | 'memory' | 'requests' | 'errors' | 'response_time' | 'queue_length';
  source: 'prometheus' | 'business_metrics' | 'system' | 'custom';
  query?: string; // For Prometheus or custom queries
  aggregation: 'avg' | 'max' | 'p95' | 'p99' | 'sum';
  window: number; // Time window in minutes
  weight: number; // Weight in scaling decision (0.0-1.0)
}

export interface ScalingThreshold {
  metric: string;
  scaleUp: number;
  scaleDown: number;
  comparison: 'greater_than' | 'less_than' | 'percentage_change';
}

export interface ScalingPolicy {
  name: string;
  service: string;
  minReplicas: number;
  maxReplicas: number;
  metrics: ScalingMetric[];
  thresholds: ScalingThreshold[];
  cooldownPeriod: number; // Minutes between scaling operations
  scaleUpBy: number; // Number of replicas to add
  scaleDownBy: number; // Number of replicas to remove
  evaluationInterval: number; // Minutes between evaluations
  enabled: boolean;
}

export interface ScalingDecision {
  service: string;
  action: 'scale_up' | 'scale_down' | 'no_action';
  currentReplicas: number;
  targetReplicas: number;
  reason: string;
  triggeredBy: string[];
  confidence: number; // 0.0-1.0
  timestamp: Date;
}

export interface ScalingEvent {
  id: string;
  service: string;
  action: 'scale_up' | 'scale_down';
  fromReplicas: number;
  toReplicas: number;
  reason: string;
  triggeredBy: string[];
  timestamp: Date;
  success: boolean;
  duration?: number; // milliseconds
  error?: string;
}

export class AutoScaler extends EventEmitter {
  private redis: Redis;
  private businessMetrics: BusinessMetricsService;
  private policies: Map<string, ScalingPolicy> = new Map();
  private lastScalingActions: Map<string, Date> = new Map();
  private evaluationTimers: Map<string, NodeJS.Timeout> = new Map();
  private enabled: boolean = true;
  
  private readonly SCALING_PREFIX = 'scaling:';
  private readonly EVENT_PREFIX = 'scaling:event:';
  private readonly DECISION_PREFIX = 'scaling:decision:';
  
  constructor(redisClient: Redis, businessMetrics: BusinessMetricsService) {
    super();
    this.redis = redisClient;
    this.businessMetrics = businessMetrics;
    this.setupDefaultPolicies();
  }

  /**
   * Register a scaling policy
   */
  public registerPolicy(policy: ScalingPolicy): void {
    this.policies.set(policy.name, policy);
    
    if (policy.enabled) {
      this.startPolicyEvaluation(policy);
    }
    
    logger.info('Scaling policy registered', {
      policy: policy.name,
      service: policy.service,
      enabled: policy.enabled,
    });
  }

  /**
   * Start policy evaluation timer
   */
  private startPolicyEvaluation(policy: ScalingPolicy): void {
    const existingTimer = this.evaluationTimers.get(policy.name);
    if (existingTimer) {
      clearInterval(existingTimer);
    }
    
    const interval = policy.evaluationInterval * 60 * 1000; // Convert to milliseconds
    const timer = setInterval(async () => {
      await this.evaluatePolicy(policy);
    }, interval);
    
    this.evaluationTimers.set(policy.name, timer);
    
    logger.info('Policy evaluation started', {
      policy: policy.name,
      interval: policy.evaluationInterval,
    });
  }

  /**
   * Evaluate a scaling policy
   */
  private async evaluatePolicy(policy: ScalingPolicy): Promise<void> {
    if (!this.enabled || !policy.enabled) {
      return;
    }
    
    try {
      // Check cooldown period
      const lastAction = this.lastScalingActions.get(policy.service);
      if (lastAction) {
        const timeSinceLastAction = Date.now() - lastAction.getTime();
        const cooldownMs = policy.cooldownPeriod * 60 * 1000;
        
        if (timeSinceLastAction < cooldownMs) {
          logger.debug('Policy in cooldown period', {
            policy: policy.name,
            service: policy.service,
            remainingCooldown: (cooldownMs - timeSinceLastAction) / 1000,
          });
          return;
        }
      }
      
      // Get current replica count
      const currentReplicas = await this.getCurrentReplicas(policy.service);
      
      // Collect metric values
      const metricValues = await this.collectMetrics(policy.metrics);
      
      // Evaluate thresholds
      const decision = await this.makeScalingDecision(policy, currentReplicas, metricValues);
      
      // Store decision for audit
      await this.storeScalingDecision(decision);
      
      // Execute scaling if needed
      if (decision.action !== 'no_action') {
        await this.executeScaling(decision);
      }
      
      this.emit('policyEvaluated', {
        policy: policy.name,
        decision,
        metricValues,
      });
      
    } catch (error) {
      logger.error('Error evaluating scaling policy', {
        policy: policy.name,
        error: error.message,
      });
      
      this.emit('evaluationError', {
        policy: policy.name,
        error: error.message,
      });
    }
  }

  /**
   * Collect metric values for evaluation
   */
  private async collectMetrics(metrics: ScalingMetric[]): Promise<Map<string, number>> {
    const values = new Map<string, number>();
    
    await Promise.all(metrics.map(async (metric) => {
      try {
        let value: number;
        
        switch (metric.source) {
          case 'business_metrics':
            value = await this.getBusinessMetricValue(metric);
            break;
          case 'system':
            value = await this.getSystemMetricValue(metric);
            break;
          case 'prometheus':
            value = await this.getPrometheusMetricValue(metric);
            break;
          case 'custom':
            value = await this.getCustomMetricValue(metric);
            break;
          default:
            throw new Error(`Unknown metric source: ${metric.source}`);
        }
        
        values.set(metric.name, value);
        
      } catch (error) {
        logger.error('Error collecting metric', {
          metric: metric.name,
          source: metric.source,
          error: error.message,
        });
        
        // Use default value or skip metric
        values.set(metric.name, 0);
      }
    }));
    
    return values;
  }

  /**
   * Get business metric value
   */
  private async getBusinessMetricValue(metric: ScalingMetric): Promise<number> {
    const key = `stats:metric:${metric.name}`;
    const value = await this.redis.get(key);
    
    if (!value) {
      throw new Error(`Business metric not found: ${metric.name}`);
    }
    
    const stats = JSON.parse(value);
    return stats.current || 0;
  }

  /**
   * Get system metric value (CPU, memory, etc.)
   */
  private async getSystemMetricValue(metric: ScalingMetric): Promise<number> {
    switch (metric.type) {
      case 'cpu':
        return await this.getCpuUsage();
      case 'memory':
        return await this.getMemoryUsage();
      case 'requests':
        return await this.getRequestRate();
      default:
        throw new Error(`Unsupported system metric type: ${metric.type}`);
    }
  }

  /**
   * Get Prometheus metric value
   */
  private async getPrometheusMetricValue(metric: ScalingMetric): Promise<number> {
    // Implement Prometheus query if available
    // For now, return simulated value
    logger.warn('Prometheus metrics not implemented, using simulated value', {
      metric: metric.name,
    });
    return Math.random() * 100;
  }

  /**
   * Get custom metric value
   */
  private async getCustomMetricValue(metric: ScalingMetric): Promise<number> {
    if (!metric.query) {
      throw new Error(`Custom metric query not provided: ${metric.name}`);
    }
    
    // Execute custom query (could be SQL, HTTP, etc.)
    // For now, return simulated value
    logger.warn('Custom metrics not fully implemented, using simulated value', {
      metric: metric.name,
    });
    return Math.random() * 100;
  }

  /**
   * Make scaling decision based on metrics and thresholds
   */
  private async makeScalingDecision(
    policy: ScalingPolicy,
    currentReplicas: number,
    metricValues: Map<string, number>
  ): Promise<ScalingDecision> {
    const triggeredThresholds: string[] = [];
    let scaleUpScore = 0;
    let scaleDownScore = 0;
    
    // Evaluate each threshold
    for (const threshold of policy.thresholds) {
      const metricValue = metricValues.get(threshold.metric);
      if (metricValue === undefined) {
        continue;
      }
      
      const metric = policy.metrics.find(m => m.name === threshold.metric);
      const weight = metric?.weight || 1.0;
      
      // Check scale up condition
      if (this.checkThreshold(metricValue, threshold.scaleUp, threshold.comparison)) {
        scaleUpScore += weight;
        triggeredThresholds.push(`${threshold.metric} (${metricValue} > ${threshold.scaleUp})`);
      }
      
      // Check scale down condition
      if (this.checkThreshold(metricValue, threshold.scaleDown, threshold.comparison, true)) {
        scaleDownScore += weight;
        triggeredThresholds.push(`${threshold.metric} (${metricValue} < ${threshold.scaleDown})`);
      }
    }
    
    // Determine action
    let action: 'scale_up' | 'scale_down' | 'no_action' = 'no_action';
    let targetReplicas = currentReplicas;
    let reason = 'No scaling thresholds met';
    
    // Calculate confidence based on number of triggered thresholds
    const totalWeight = policy.metrics.reduce((sum, m) => sum + m.weight, 0);
    const confidence = Math.max(scaleUpScore, scaleDownScore) / totalWeight;
    
    if (scaleUpScore > scaleDownScore && scaleUpScore > 0.5) {
      // Scale up
      targetReplicas = Math.min(currentReplicas + policy.scaleUpBy, policy.maxReplicas);
      if (targetReplicas > currentReplicas) {
        action = 'scale_up';
        reason = `High load detected: ${triggeredThresholds.join(', ')}`;
      } else {
        reason = 'Scale up needed but at maximum replicas';
      }
    } else if (scaleDownScore > scaleUpScore && scaleDownScore > 0.5) {
      // Scale down
      targetReplicas = Math.max(currentReplicas - policy.scaleDownBy, policy.minReplicas);
      if (targetReplicas < currentReplicas) {
        action = 'scale_down';
        reason = `Low load detected: ${triggeredThresholds.join(', ')}`;
      } else {
        reason = 'Scale down possible but at minimum replicas';
      }
    }
    
    return {
      service: policy.service,
      action,
      currentReplicas,
      targetReplicas,
      reason,
      triggeredBy: triggeredThresholds,
      confidence,
      timestamp: new Date(),
    };
  }

  /**
   * Check if metric value meets threshold condition
   */
  private checkThreshold(
    value: number,
    threshold: number,
    comparison: string,
    inverse: boolean = false
  ): boolean {
    switch (comparison) {
      case 'greater_than':
        return inverse ? value < threshold : value > threshold;
      case 'less_than':
        return inverse ? value > threshold : value < threshold;
      case 'percentage_change':
        // Implement percentage change logic
        return false; // Placeholder
      default:
        return false;
    }
  }

  /**
   * Execute scaling decision
   */
  private async executeScaling(decision: ScalingDecision): Promise<void> {
    const startTime = Date.now();
    const eventId = `${decision.service}-${Date.now()}`;
    
    try {
      logger.info('Executing scaling action', {
        service: decision.service,
        action: decision.action,
        from: decision.currentReplicas,
        to: decision.targetReplicas,
        reason: decision.reason,
      });
      
      // Execute Docker Compose scaling
      await this.scaleDockerComposeService(decision.service, decision.targetReplicas);
      
      // Record successful scaling event
      const scalingEvent: ScalingEvent = {
        id: eventId,
        service: decision.service,
        action: decision.action,
        fromReplicas: decision.currentReplicas,
        toReplicas: decision.targetReplicas,
        reason: decision.reason,
        triggeredBy: decision.triggeredBy,
        timestamp: new Date(),
        success: true,
        duration: Date.now() - startTime,
      };
      
      await this.storeScalingEvent(scalingEvent);
      
      // Update last scaling action timestamp
      this.lastScalingActions.set(decision.service, new Date());
      
      this.emit('scalingExecuted', scalingEvent);
      
      logger.info('Scaling action completed successfully', {
        service: decision.service,
        action: decision.action,
        duration: scalingEvent.duration,
      });
      
    } catch (error) {
      // Record failed scaling event
      const scalingEvent: ScalingEvent = {
        id: eventId,
        service: decision.service,
        action: decision.action,
        fromReplicas: decision.currentReplicas,
        toReplicas: decision.targetReplicas,
        reason: decision.reason,
        triggeredBy: decision.triggeredBy,
        timestamp: new Date(),
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
      };
      
      await this.storeScalingEvent(scalingEvent);
      
      this.emit('scalingFailed', scalingEvent);
      
      logger.error('Scaling action failed', {
        service: decision.service,
        action: decision.action,
        error: error.message,
      });
      
      throw error;
    }
  }

  /**
   * Scale Docker Compose service
   */
  private async scaleDockerComposeService(service: string, replicas: number): Promise<void> {
    const command = `docker-compose up -d --scale ${service}=${replicas}`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 60000, // 1 minute timeout
      });
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`Docker compose error: ${stderr}`);
      }
      
      logger.debug('Docker compose scaling output', {
        service,
        replicas,
        stdout: stdout.trim(),
      });
      
    } catch (error) {
      throw new Error(`Failed to scale service ${service}: ${error.message}`);
    }
  }

  /**
   * Get current number of replicas for a service
   */
  private async getCurrentReplicas(service: string): Promise<number> {
    try {
      const command = `docker-compose ps -q ${service} | wc -l`;
      const { stdout } = await execAsync(command);
      
      return parseInt(stdout.trim(), 10) || 1;
      
    } catch (error) {
      logger.warn('Failed to get current replicas, assuming 1', {
        service,
        error: error.message,
      });
      return 1;
    }
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    try {
      // Get CPU usage from docker stats
      const command = "docker stats --no-stream --format 'table {{.CPUPerc}}' | tail -n +2 | head -1";
      const { stdout } = await execAsync(command);
      
      const cpuPercent = parseFloat(stdout.replace('%', ''));
      return isNaN(cpuPercent) ? 0 : cpuPercent;
      
    } catch (error) {
      logger.warn('Failed to get CPU usage', { error: error.message });
      return 0;
    }
  }

  /**
   * Get memory usage percentage
   */
  private async getMemoryUsage(): Promise<number> {
    try {
      // Get memory usage from docker stats
      const command = "docker stats --no-stream --format 'table {{.MemPerc}}' | tail -n +2 | head -1";
      const { stdout } = await execAsync(command);
      
      const memPercent = parseFloat(stdout.replace('%', ''));
      return isNaN(memPercent) ? 0 : memPercent;
      
    } catch (error) {
      logger.warn('Failed to get memory usage', { error: error.message });
      return 0;
    }
  }

  /**
   * Get request rate (requests per minute)
   */
  private async getRequestRate(): Promise<number> {
    try {
      // Get request rate from business metrics
      const key = 'stats:metric:request_rate';
      const value = await this.redis.get(key);
      
      if (value) {
        const stats = JSON.parse(value);
        return stats.current || 0;
      }
      
      return 0;
      
    } catch (error) {
      logger.warn('Failed to get request rate', { error: error.message });
      return 0;
    }
  }

  /**
   * Store scaling decision for audit
   */
  private async storeScalingDecision(decision: ScalingDecision): Promise<void> {
    const key = `${this.DECISION_PREFIX}${decision.service}:${Date.now()}`;
    
    await this.redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(decision)); // 7 days TTL
  }

  /**
   * Store scaling event for audit
   */
  private async storeScalingEvent(event: ScalingEvent): Promise<void> {
    const key = `${this.EVENT_PREFIX}${event.id}`;
    
    await this.redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(event)); // 30 days TTL
  }

  /**
   * Get scaling history for a service
   */
  public async getScalingHistory(service: string, limit: number = 50): Promise<ScalingEvent[]> {
    const pattern = `${this.EVENT_PREFIX}${service}-*`;
    const keys = await this.redis.keys(pattern);
    
    // Sort by timestamp (newest first)
    keys.sort().reverse();
    
    const events: ScalingEvent[] = [];
    
    for (const key of keys.slice(0, limit)) {
      try {
        const eventData = await this.redis.get(key);
        if (eventData) {
          events.push(JSON.parse(eventData));
        }
      } catch (error) {
        logger.warn('Failed to parse scaling event', { key, error: error.message });
      }
    }
    
    return events;
  }

  /**
   * Get current scaling status
   */
  public async getScalingStatus(): Promise<{
    enabled: boolean;
    policies: Array<{
      name: string;
      service: string;
      enabled: boolean;
      currentReplicas: number;
      lastEvaluation: Date | null;
      lastScaling: Date | null;
    }>;
  }> {
    const policies = [];
    
    for (const [name, policy] of this.policies.entries()) {
      const currentReplicas = await this.getCurrentReplicas(policy.service);
      const lastScaling = this.lastScalingActions.get(policy.service) || null;
      
      policies.push({
        name,
        service: policy.service,
        enabled: policy.enabled,
        currentReplicas,
        lastEvaluation: new Date(), // Would need to track this
        lastScaling,
      });
    }
    
    return {
      enabled: this.enabled,
      policies,
    };
  }

  /**
   * Enable/disable auto-scaling
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    
    if (enabled) {
      // Restart policy evaluations
      for (const [name, policy] of this.policies.entries()) {
        if (policy.enabled) {
          this.startPolicyEvaluation(policy);
        }
      }
    } else {
      // Stop all evaluations
      for (const timer of this.evaluationTimers.values()) {
        clearInterval(timer);
      }
      this.evaluationTimers.clear();
    }
    
    logger.info('Auto-scaling enabled state changed', { enabled });
  }

  /**
   * Setup default scaling policies
   */
  private setupDefaultPolicies(): void {
    // Backend service scaling policy
    const backendPolicy: ScalingPolicy = {
      name: 'backend-auto-scale',
      service: 'backend',
      minReplicas: 1,
      maxReplicas: 5,
      metrics: [
        {
          name: 'cpu_usage',
          type: 'cpu',
          source: 'system',
          aggregation: 'avg',
          window: 5,
          weight: 0.4,
        },
        {
          name: 'memory_usage',
          type: 'memory',
          source: 'system',
          aggregation: 'avg',
          window: 5,
          weight: 0.3,
        },
        {
          name: 'request_rate',
          type: 'requests',
          source: 'business_metrics',
          aggregation: 'avg',
          window: 5,
          weight: 0.3,
        },
      ],
      thresholds: [
        {
          metric: 'cpu_usage',
          scaleUp: 70, // Scale up if CPU > 70%
          scaleDown: 20, // Scale down if CPU < 20%
          comparison: 'greater_than',
        },
        {
          metric: 'memory_usage',
          scaleUp: 80, // Scale up if Memory > 80%
          scaleDown: 30, // Scale down if Memory < 30%
          comparison: 'greater_than',
        },
        {
          metric: 'request_rate',
          scaleUp: 100, // Scale up if > 100 req/min per replica
          scaleDown: 20, // Scale down if < 20 req/min per replica
          comparison: 'greater_than',
        },
      ],
      cooldownPeriod: 5, // 5 minutes between scaling actions
      scaleUpBy: 1,
      scaleDownBy: 1,
      evaluationInterval: 2, // Evaluate every 2 minutes
      enabled: false, // Disabled by default for safety
    };

    this.registerPolicy(backendPolicy);

    // ML service scaling policy (more conservative)
    const mlPolicy: ScalingPolicy = {
      name: 'ml-auto-scale',
      service: 'ml',
      minReplicas: 1,
      maxReplicas: 3,
      metrics: [
        {
          name: 'processing_queue_length',
          type: 'queue_length',
          source: 'business_metrics',
          aggregation: 'avg',
          window: 10,
          weight: 0.6,
        },
        {
          name: 'processing_failure_rate',
          type: 'errors',
          source: 'business_metrics',
          aggregation: 'avg',
          window: 15,
          weight: 0.4,
        },
      ],
      thresholds: [
        {
          metric: 'processing_queue_length',
          scaleUp: 10, // Scale up if queue > 10 items
          scaleDown: 2, // Scale down if queue < 2 items
          comparison: 'greater_than',
        },
        {
          metric: 'processing_failure_rate',
          scaleUp: 5, // Scale up if failure rate > 5%
          scaleDown: 1, // Don't scale down based on low failure rate
          comparison: 'greater_than',
        },
      ],
      cooldownPeriod: 10, // 10 minutes between scaling actions
      scaleUpBy: 1,
      scaleDownBy: 1,
      evaluationInterval: 5, // Evaluate every 5 minutes
      enabled: false, // Disabled by default
    };

    this.registerPolicy(mlPolicy);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    // Clear all timers
    for (const timer of this.evaluationTimers.values()) {
      clearInterval(timer);
    }
    this.evaluationTimers.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    logger.info('Auto-scaler destroyed');
  }
}

export default AutoScaler;