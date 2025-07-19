/**
 * Auto-Scaling Configuration API Routes
 * 
 * Provides API endpoints for managing auto-scaling policies,
 * viewing scaling history, and controlling scaling behavior.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../security/middleware/auth';
import logger from '../utils/logger';
import { AutoScaler, type ScalingPolicy, type ScalingMetric, type ScalingThreshold } from '../utils/autoScaler';

const router = Router();

// Auto-scaler instance (will be injected from main app)
let autoScaler: AutoScaler;

/**
 * Initialize the auto-scaler instance
 */
export function initializeAutoScaler(scaler: AutoScaler): void {
  autoScaler = scaler;
}

/**
 * GET /api/autoscaling/status
 * Get current auto-scaling status and policies
 */
router.get('/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = await autoScaler.getScalingStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('Error getting auto-scaling status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get auto-scaling status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/autoscaling/enable
 * Enable or disable auto-scaling globally
 */
router.post('/enable', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean value',
      });
    }
    
    autoScaler.setEnabled(enabled);
    
    logger.info('Auto-scaling enabled state changed', {
      enabled,
      changedBy: (req as any).user?.userId,
    });
    
    res.json({
      success: true,
      enabled,
      message: `Auto-scaling ${enabled ? 'enabled' : 'disabled'}`,
    });
    
  } catch (error) {
    logger.error('Error changing auto-scaling enabled state', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to change auto-scaling state',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/autoscaling/policies
 * Get all scaling policies
 */
router.get('/policies', requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = await autoScaler.getScalingStatus();
    
    res.json({
      success: true,
      policies: status.policies,
      count: status.policies.length,
    });
    
  } catch (error) {
    logger.error('Error getting scaling policies', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get scaling policies',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/autoscaling/policies
 * Create a new scaling policy
 */
router.post('/policies', requireAdmin, async (req: Request, res: Response) => {
  try {
    const policyData = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'service', 'minReplicas', 'maxReplicas', 'metrics', 'thresholds'];
    const missingFields = requiredFields.filter(field => !policyData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        missingFields,
      });
    }
    
    // Validate policy structure
    const validationError = validateScalingPolicy(policyData);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid policy configuration',
        details: validationError,
      });
    }
    
    // Create policy with defaults
    const policy: ScalingPolicy = {
      ...policyData,
      cooldownPeriod: policyData.cooldownPeriod || 5,
      scaleUpBy: policyData.scaleUpBy || 1,
      scaleDownBy: policyData.scaleDownBy || 1,
      evaluationInterval: policyData.evaluationInterval || 5,
      enabled: policyData.enabled !== undefined ? policyData.enabled : false,
    };
    
    autoScaler.registerPolicy(policy);
    
    logger.info('Scaling policy created', {
      policyName: policy.name,
      service: policy.service,
      createdBy: (req as any).user?.userId,
    });
    
    res.status(201).json({
      success: true,
      policy,
      message: 'Scaling policy created successfully',
    });
    
  } catch (error) {
    logger.error('Error creating scaling policy', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create scaling policy',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/autoscaling/history/:service
 * Get scaling history for a service
 */
router.get('/history/:service', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const history = await autoScaler.getScalingHistory(service, limit);
    
    res.json({
      success: true,
      service,
      history,
      count: history.length,
    });
    
  } catch (error) {
    logger.error('Error getting scaling history', { error, service: req.params.service });
    res.status(500).json({
      success: false,
      error: 'Failed to get scaling history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/autoscaling/metrics
 * Get available metrics for scaling configuration
 */
router.get('/metrics', requireAdmin, async (req: Request, res: Response) => {
  try {
    const availableMetrics = {
      system: [
        {
          name: 'cpu_usage',
          type: 'cpu',
          description: 'CPU usage percentage',
          unit: 'percentage',
          source: 'system',
        },
        {
          name: 'memory_usage',
          type: 'memory',
          description: 'Memory usage percentage',
          unit: 'percentage',
          source: 'system',
        },
        {
          name: 'request_rate',
          type: 'requests',
          description: 'Requests per minute',
          unit: 'requests/min',
          source: 'business_metrics',
        },
      ],
      business: [
        {
          name: 'processing_queue_length',
          type: 'queue_length',
          description: 'Number of items in processing queue',
          unit: 'count',
          source: 'business_metrics',
        },
        {
          name: 'processing_failure_rate',
          type: 'errors',
          description: 'Processing failure rate percentage',
          unit: 'percentage',
          source: 'business_metrics',
        },
        {
          name: 'user_error_rate',
          type: 'errors',
          description: 'User error rate percentage',
          unit: 'percentage',
          source: 'business_metrics',
        },
        {
          name: 'response_time_p95',
          type: 'response_time',
          description: '95th percentile response time',
          unit: 'milliseconds',
          source: 'business_metrics',
        },
      ],
      custom: [
        {
          name: 'custom_metric',
          type: 'custom',
          description: 'Custom metric with SQL query',
          unit: 'various',
          source: 'custom',
          note: 'Requires custom query definition',
        },
      ],
    };
    
    res.json({
      success: true,
      metrics: availableMetrics,
      sources: ['system', 'business_metrics', 'prometheus', 'custom'],
      aggregations: ['avg', 'max', 'p95', 'p99', 'sum'],
      comparisons: ['greater_than', 'less_than', 'percentage_change'],
    });
    
  } catch (error) {
    logger.error('Error getting available metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get available metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/autoscaling/services
 * Get available services for scaling
 */
router.get('/services', requireAdmin, async (req: Request, res: Response) => {
  try {
    const services = [
      {
        name: 'backend',
        description: 'Node.js API backend service',
        defaultMinReplicas: 1,
        defaultMaxReplicas: 5,
        recommended: true,
      },
      {
        name: 'ml',
        description: 'Python ML processing service',
        defaultMinReplicas: 1,
        defaultMaxReplicas: 3,
        recommended: true,
      },
      {
        name: 'frontend-dev',
        description: 'React development server',
        defaultMinReplicas: 1,
        defaultMaxReplicas: 2,
        recommended: false,
        note: 'Usually not scaled in development',
      },
      {
        name: 'nginx-dev',
        description: 'Nginx reverse proxy (development)',
        defaultMinReplicas: 1,
        defaultMaxReplicas: 2,
        recommended: false,
      },
      {
        name: 'nginx-prod',
        description: 'Nginx reverse proxy (production)',
        defaultMinReplicas: 1,
        defaultMaxReplicas: 3,
        recommended: true,
      },
    ];
    
    res.json({
      success: true,
      services,
      count: services.length,
    });
    
  } catch (error) {
    logger.error('Error getting available services', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get available services',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/autoscaling/test/:service
 * Test scaling for a service (manual scaling)
 */
router.post('/test/:service', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    const { replicas } = req.body;
    
    if (!replicas || typeof replicas !== 'number' || replicas < 1 || replicas > 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid replicas count (must be between 1 and 10)',
      });
    }
    
    // This would trigger a manual scaling action for testing
    logger.info('Manual scaling test requested', {
      service,
      replicas,
      requestedBy: (req as any).user?.userId,
    });
    
    // For now, just return success as this is a test endpoint
    res.json({
      success: true,
      service,
      replicas,
      message: `Test scaling request for ${service} to ${replicas} replicas`,
      note: 'This is a test endpoint. Actual scaling would be implemented here.',
    });
    
  } catch (error) {
    logger.error('Error testing scaling', { error, service: req.params.service });
    res.status(500).json({
      success: false,
      error: 'Failed to test scaling',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/autoscaling/recommendations
 * Get scaling recommendations based on current metrics
 */
router.get('/recommendations', requireAdmin, async (req: Request, res: Response) => {
  try {
    // This would analyze current metrics and provide scaling recommendations
    const recommendations = [
      {
        service: 'backend',
        currentReplicas: 2,
        recommendedReplicas: 3,
        reason: 'High CPU usage (85%) and request rate increasing',
        confidence: 0.8,
        priority: 'high',
        metrics: {
          cpu_usage: 85,
          memory_usage: 65,
          request_rate: 120,
        },
      },
      {
        service: 'ml',
        currentReplicas: 1,
        recommendedReplicas: 1,
        reason: 'Processing queue stable, no scaling needed',
        confidence: 0.9,
        priority: 'low',
        metrics: {
          queue_length: 3,
          processing_failure_rate: 2,
        },
      },
    ];
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('Error getting scaling recommendations', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get scaling recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Validate scaling policy configuration
 */
function validateScalingPolicy(policy: any): string | null {
  // Validate basic structure
  if (!policy.name || typeof policy.name !== 'string') {
    return 'Policy name must be a string';
  }
  
  if (!policy.service || typeof policy.service !== 'string') {
    return 'Service name must be a string';
  }
  
  if (typeof policy.minReplicas !== 'number' || policy.minReplicas < 1) {
    return 'minReplicas must be a number >= 1';
  }
  
  if (typeof policy.maxReplicas !== 'number' || policy.maxReplicas < policy.minReplicas) {
    return 'maxReplicas must be a number >= minReplicas';
  }
  
  // Validate metrics
  if (!Array.isArray(policy.metrics) || policy.metrics.length === 0) {
    return 'metrics must be a non-empty array';
  }
  
  for (const metric of policy.metrics) {
    if (!metric.name || typeof metric.name !== 'string') {
      return 'Each metric must have a name';
    }
    
    if (!['cpu', 'memory', 'requests', 'errors', 'response_time', 'queue_length'].includes(metric.type)) {
      return `Invalid metric type: ${metric.type}`;
    }
    
    if (!['prometheus', 'business_metrics', 'system', 'custom'].includes(metric.source)) {
      return `Invalid metric source: ${metric.source}`;
    }
    
    if (!['avg', 'max', 'p95', 'p99', 'sum'].includes(metric.aggregation)) {
      return `Invalid aggregation: ${metric.aggregation}`;
    }
    
    if (typeof metric.window !== 'number' || metric.window < 1) {
      return 'metric.window must be a number >= 1';
    }
    
    if (typeof metric.weight !== 'number' || metric.weight < 0 || metric.weight > 1) {
      return 'metric.weight must be a number between 0 and 1';
    }
  }
  
  // Validate thresholds
  if (!Array.isArray(policy.thresholds) || policy.thresholds.length === 0) {
    return 'thresholds must be a non-empty array';
  }
  
  for (const threshold of policy.thresholds) {
    if (!threshold.metric || typeof threshold.metric !== 'string') {
      return 'Each threshold must have a metric name';
    }
    
    if (typeof threshold.scaleUp !== 'number') {
      return 'threshold.scaleUp must be a number';
    }
    
    if (typeof threshold.scaleDown !== 'number') {
      return 'threshold.scaleDown must be a number';
    }
    
    if (!['greater_than', 'less_than', 'percentage_change'].includes(threshold.comparison)) {
      return `Invalid comparison: ${threshold.comparison}`;
    }
  }
  
  return null; // No validation errors
}

export default router;