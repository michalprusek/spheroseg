/**
 * Auto-Scaler Integration Module
 * 
 * Integrates the auto-scaler with the main application,
 * sets up event listeners, and provides initialization logic.
 */

import logger from './logger';
import { AutoScaler } from './autoScaler';
import { BusinessMetricsService } from './businessMetrics';
import { getRedis } from '../config/redis';
import config from '../config';

let autoScalerInstance: AutoScaler | null = null;

/**
 * Initialize the auto-scaler with business metrics integration
 */
export async function initializeAutoScaler(businessMetrics: BusinessMetricsService): Promise<AutoScaler> {
  try {
    const redis = getRedis();
    
    if (!redis) {
      throw new Error('Redis connection required for auto-scaling');
    }
    
    // Create auto-scaler instance
    autoScalerInstance = new AutoScaler(redis, businessMetrics);
    
    // Set up event listeners
    setupEventListeners(autoScalerInstance);
    
    // Load configuration from environment
    configureFromEnvironment(autoScalerInstance);
    
    logger.info('Auto-scaler initialized successfully');
    
    return autoScalerInstance;
    
  } catch (error) {
    logger.error('Failed to initialize auto-scaler', { error });
    throw error;
  }
}

/**
 * Get the auto-scaler instance
 */
export function getAutoScaler(): AutoScaler | null {
  return autoScalerInstance;
}

/**
 * Set up event listeners for auto-scaler events
 */
function setupEventListeners(autoScaler: AutoScaler): void {
  // Listen to scaling events
  autoScaler.on('scalingExecuted', (event) => {
    logger.info('Scaling action completed', {
      service: event.service,
      action: event.action,
      fromReplicas: event.fromReplicas,
      toReplicas: event.toReplicas,
      duration: event.duration,
      reason: event.reason,
    });
    
    // You could send notifications here
    // sendScalingNotification(event);
  });
  
  autoScaler.on('scalingFailed', (event) => {
    logger.error('Scaling action failed', {
      service: event.service,
      action: event.action,
      error: event.error,
      reason: event.reason,
    });
    
    // Send critical alert
    // sendCriticalAlert('Scaling Failed', event);
  });
  
  autoScaler.on('policyEvaluated', (data) => {
    logger.debug('Scaling policy evaluated', {
      policy: data.policy,
      decision: data.decision.action,
      confidence: data.decision.confidence,
      triggeredBy: data.decision.triggeredBy,
    });
  });
  
  autoScaler.on('evaluationError', (data) => {
    logger.error('Policy evaluation error', {
      policy: data.policy,
      error: data.error,
    });
  });
}

/**
 * Configure auto-scaler from environment variables
 */
function configureFromEnvironment(autoScaler: AutoScaler): void {
  // Check if auto-scaling should be enabled
  const autoScalingEnabled = process.env['AUTOSCALING_ENABLED'] === 'true';
  
  if (autoScalingEnabled) {
    logger.info('Auto-scaling enabled via environment variable');
    autoScaler.setEnabled(true);
  } else {
    logger.info('Auto-scaling disabled (set AUTOSCALING_ENABLED=true to enable)');
  }
  
  // You could load custom policies from environment here
  // loadCustomPoliciesFromEnvironment(autoScaler);
}

/**
 * Gracefully shutdown the auto-scaler
 */
export function shutdownAutoScaler(): void {
  if (autoScalerInstance) {
    logger.info('Shutting down auto-scaler...');
    autoScalerInstance.destroy();
    autoScalerInstance = null;
  }
}

/**
 * Register business metrics that can be used for scaling
 */
export function registerAutoScalingMetrics(businessMetrics: BusinessMetricsService): void {
  // Register request rate metric
  businessMetrics.registerMetric({
    name: 'request_rate',
    description: 'HTTP requests per minute',
    calculator: async () => {
      // This would be implemented to count actual requests
      // For now, return a simulated value
      return Math.floor(Math.random() * 200);
    },
    unit: 'count',
    aggregation: 'avg',
    interval: 1, // Collect every minute
    thresholds: {
      warning: 100,
      critical: 200,
    },
    tags: ['autoscaling', 'performance'],
  });
  
  // Register processing queue length metric
  businessMetrics.registerMetric({
    name: 'processing_queue_length',
    description: 'Number of items in ML processing queue',
    query: `
      SELECT COUNT(*) as value 
      FROM segmentation_queue 
      WHERE status IN ('queued', 'processing')
    `,
    unit: 'count',
    aggregation: 'avg',
    interval: 2, // Collect every 2 minutes
    thresholds: {
      warning: 10,
      critical: 25,
    },
    tags: ['autoscaling', 'ml', 'queue'],
  });
  
  // Register error rate metric
  businessMetrics.registerMetric({
    name: 'error_rate',
    description: 'Percentage of failed requests',
    calculator: async () => {
      // This would calculate actual error rate
      // For now, return a simulated value
      return Math.random() * 5; // 0-5% error rate
    },
    unit: 'percentage',
    aggregation: 'avg',
    interval: 1,
    thresholds: {
      warning: 2,
      critical: 5,
    },
    tags: ['autoscaling', 'errors'],
  });
  
  // Register response time metric
  businessMetrics.registerMetric({
    name: 'response_time_p95',
    description: '95th percentile response time in milliseconds',
    calculator: async () => {
      // This would calculate actual P95 response time
      // For now, return a simulated value
      return 100 + Math.random() * 400; // 100-500ms
    },
    unit: 'duration',
    aggregation: 'p95',
    interval: 1,
    thresholds: {
      warning: 300,
      critical: 500,
    },
    tags: ['autoscaling', 'performance', 'latency'],
  });
  
  logger.info('Auto-scaling metrics registered with business metrics service');
}

/**
 * Health check for auto-scaling system
 */
export function getAutoScalingHealth(): {
  enabled: boolean;
  healthy: boolean;
  policies: number;
  lastEvaluation?: Date;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!autoScalerInstance) {
    errors.push('Auto-scaler not initialized');
    return {
      enabled: false,
      healthy: false,
      policies: 0,
      errors,
    };
  }
  
  // Check Redis connection
  const redis = getRedis();
  if (!redis) {
    errors.push('Redis connection not available');
  }
  
  // TODO: Add more health checks
  // - Check if policies are loaded
  // - Check if metrics are being collected
  // - Check if scaling operations are working
  
  return {
    enabled: true, // Would get actual enabled state from autoScaler
    healthy: errors.length === 0,
    policies: 2, // Would get actual policy count
    errors,
  };
}

/**
 * Get auto-scaling metrics for monitoring
 */
export async function getAutoScalingMetrics(): Promise<{
  totalScalingEvents: number;
  successfulScalings: number;
  failedScalings: number;
  servicesManaged: string[];
  lastScalingEvent?: Date;
}> {
  if (!autoScalerInstance) {
    return {
      totalScalingEvents: 0,
      successfulScalings: 0,
      failedScalings: 0,
      servicesManaged: [],
    };
  }
  
  // This would query Redis for actual metrics
  // For now, return simulated data
  return {
    totalScalingEvents: 15,
    successfulScalings: 13,
    failedScalings: 2,
    servicesManaged: ['backend', 'ml'],
    lastScalingEvent: new Date(Date.now() - 3600000), // 1 hour ago
  };
}

export default {
  initializeAutoScaler,
  getAutoScaler,
  shutdownAutoScaler,
  registerAutoScalingMetrics,
  getAutoScalingHealth,
  getAutoScalingMetrics,
};