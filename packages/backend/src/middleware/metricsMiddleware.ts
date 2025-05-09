import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
import logger from '../utils/logger';

// Initialize the Prometheus registry
const register = new promClient.Registry();

// Add default metrics (GC, memory usage, etc.)
promClient.collectDefaultMetrics({ register });

// Create HTTP request counter
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

// Create HTTP request duration histogram
const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Create active requests gauge
const httpRequestsActive = new promClient.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['method', 'path'],
  registers: [register],
});

// Create segmentation tasks gauge
const segmentationTasksActive = new promClient.Gauge({
  name: 'segmentation_tasks_active',
  help: 'Number of active segmentation tasks',
  registers: [register],
});

// Create segmentation tasks counter
const segmentationTasksTotal = new promClient.Counter({
  name: 'segmentation_tasks_total',
  help: 'Total number of segmentation tasks',
  labelNames: ['status'],
  registers: [register],
});

// Create segmentation duration histogram
const segmentationDurationSeconds = new promClient.Histogram({
  name: 'segmentation_duration_seconds',
  help: 'Duration of segmentation tasks in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

/**
 * Middleware to collect metrics for each request
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip metrics endpoint to avoid circular references
  if (req.path === '/api/metrics') {
    return next();
  }

  // Get the route path (normalize to avoid high cardinality)
  const path = normalizePath(req.path);

  // Increment active requests
  httpRequestsActive.inc({ method: req.method, path });

  // Record start time
  const startTime = Date.now();

  // Add response hook to record metrics after response is sent
  res.on('finish', () => {
    // Decrement active requests
    httpRequestsActive.dec({ method: req.method, path });

    // Calculate request duration
    const duration = (Date.now() - startTime) / 1000;

    // Record request count and duration
    httpRequestsTotal.inc({ method: req.method, path, status: res.statusCode });
    httpRequestDurationSeconds.observe(
      { method: req.method, path, status: res.statusCode },
      duration
    );

    // Log request for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`${req.method} ${path} ${res.statusCode} - ${duration.toFixed(3)}s`);
    }
  });

  next();
};

/**
 * Normalize path to avoid high cardinality in metrics
 * e.g. /api/users/123 -> /api/users/:id
 */
function normalizePath(path: string): string {
  // Replace numeric IDs with :id
  return path
    .replace(/\/api\/projects\/[0-9a-f-]+/g, '/api/projects/:id')
    .replace(/\/api\/images\/[0-9a-f-]+/g, '/api/images/:id')
    .replace(/\/api\/users\/[0-9a-f-]+/g, '/api/users/:id')
    .replace(/\/api\/segmentation\/[0-9a-f-]+/g, '/api/segmentation/:id');
}

/**
 * Endpoint to expose metrics
 */
export const metricsEndpoint = (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  register.metrics().then(metrics => {
    res.end(metrics);
  });
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
  }
};

export default {
  metricsMiddleware,
  metricsEndpoint,
  updateSegmentationTaskMetrics
};
