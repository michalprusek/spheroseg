const promClient = require('prom-client');
const logger = require('../utils/logger');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add a default label to all metrics
register.setDefaultLabels({
  app: 'cellseg-backend'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
  name: 'socket_io_active_connections',
  help: 'Number of active Socket.IO connections'
});

const segmentationTasksTotal = new promClient.Counter({
  name: 'segmentation_tasks_total',
  help: 'Total number of segmentation tasks',
  labelNames: ['status']
});

const segmentationTaskDuration = new promClient.Histogram({
  name: 'segmentation_task_duration_seconds',
  help: 'Duration of segmentation tasks in seconds',
  buckets: [1, 5, 10, 30, 60, 120, 300, 600]
});

// Register the metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestCounter);
register.registerMetric(activeConnections);
register.registerMetric(segmentationTasksTotal);
register.registerMetric(segmentationTaskDuration);

// Middleware to track HTTP request duration and count
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Record end time and calculate duration on response finish
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    
    // Get the route path (normalize to avoid high cardinality)
    let route = req.route ? req.route.path : req.path;
    
    // For routes with params, replace the actual values with placeholders
    // e.g. /api/users/123 becomes /api/users/:id
    if (req.params && Object.keys(req.params).length > 0) {
      Object.keys(req.params).forEach(param => {
        route = route.replace(req.params[param], `:${param}`);
      });
    }
    
    // Record metrics
    httpRequestDurationMicroseconds.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );
    
    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });
    
    logger.debug(`Metrics recorded for ${req.method} ${route}: ${res.statusCode} in ${duration}s`);
  });
  
  next();
};

// Endpoint to expose metrics
const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error('Error generating metrics', { error: err.message });
    res.status(500).end();
  }
};

// Helper functions to update metrics from other parts of the application
const incrementSegmentationTask = (status) => {
  segmentationTasksTotal.inc({ status });
};

const observeSegmentationDuration = (durationSeconds) => {
  segmentationTaskDuration.observe(durationSeconds);
};

const updateActiveConnections = (count) => {
  activeConnections.set(count);
};

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  incrementSegmentationTask,
  observeSegmentationDuration,
  updateActiveConnections
};
