import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
import logger from '../utils/logger';
import { unifiedRegistry } from '../monitoring/unified';

// Use the unified registry instead of creating a new one
const register = unifiedRegistry;

// Create segmentation-specific metrics (HTTP metrics are already in unified monitoring)
// Create segmentation tasks gauge
const segmentationTasksActive = new promClient.Gauge({
  name: 'spheroseg_segmentation_tasks_active',
  help: 'Number of active segmentation tasks',
  registers: [register],
});

// Create segmentation tasks counter
const segmentationTasksTotal = new promClient.Counter({
  name: 'spheroseg_segmentation_tasks_total',
  help: 'Total number of segmentation tasks',
  labelNames: ['status'],
  registers: [register],
});

// Create segmentation duration histogram
const segmentationDurationSeconds = new promClient.Histogram({
  name: 'spheroseg_segmentation_duration_seconds',
  help: 'Duration of segmentation tasks in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

/**
 * Middleware to collect metrics for each request
 * Note: HTTP metrics are handled by unified monitoring system
 * This middleware is kept for backwards compatibility but delegates to unified monitoring
 */
export const metricsMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  // All HTTP metrics are now handled by requestLoggerMiddleware in unified monitoring
  // This middleware is kept for backwards compatibility
  next();
};

/**
 * Normalize path to avoid high cardinality in metrics
 * e.g. /api/users/123 -> /api/users/:id
 * Currently unused but kept for future implementation
 */
// function _normalizePath(path: string): string {
//   // Replace numeric IDs with :id
//   return path
//     .replace(/\/api\/projects\/[0-9a-f-]+/g, '/api/projects/:id')
//     .replace(/\/api\/images\/[0-9a-f-]+/g, '/api/images/:id')
//     .replace(/\/api\/users\/[0-9a-f-]+/g, '/api/users/:id')
//     .replace(/\/api\/segmentation\/[0-9a-f-]+/g, '/api/segmentation/:id');
// }

/**
 * Endpoint to expose metrics
 * Uses unified registry that contains all application metrics
 */
export const metricsEndpoint = async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error getting metrics', { error });
    res.status(500).json({ error: 'Failed to get metrics' });
  }
};

/**
 * Update segmentation task metrics
 */
export const updateSegmentationTaskMetrics = {
  // Update active tasks count
  setActiveTasks: (count: number) => {
    segmentationTasksActive.set(count);
  },

  // Increment task counter by status
  incrementTasks: (status: 'success' | 'failure') => {
    segmentationTasksTotal.inc({ status });
  },

  // Observe segmentation duration
  observeDuration: (durationSeconds: number) => {
    segmentationDurationSeconds.observe(durationSeconds);
  },
};

export default {
  metricsMiddleware,
  metricsEndpoint,
  updateSegmentationTaskMetrics,
};
