/**
 * Prometheus Metrics Collection
 *
 * Centralized metrics for all performance improvements
 */
import { register, collectDefaultMetrics, Counter, Gauge, Histogram, Summary } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// WebSocket Batching Metrics
export const wsMessagesTotal = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['event', 'room', 'batched'],
});

export const wsBatchesTotal = new Counter({
  name: 'websocket_batches_sent_total',
  help: 'Total number of WebSocket batches sent',
  labelNames: ['room'],
});

export const wsBatchSize = new Histogram({
  name: 'websocket_batch_size',
  help: 'Size of WebSocket batches',
  labelNames: ['room'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

export const wsActiveConnections = new Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
  labelNames: ['room', 'supports_batching'],
});

export const wsCompressionSavings = new Counter({
  name: 'websocket_compression_savings_bytes',
  help: 'Bytes saved through WebSocket compression',
});

// GraphQL Metrics
export const graphqlRequestDuration = new Histogram({
  name: 'graphql_request_duration_seconds',
  help: 'GraphQL request duration in seconds',
  labelNames: ['operation_name', 'operation_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const graphqlResolverDuration = new Histogram({
  name: 'graphql_resolver_duration_seconds',
  help: 'GraphQL resolver duration in seconds',
  labelNames: ['parent_type', 'field_name'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
});

export const graphqlErrorsTotal = new Counter({
  name: 'graphql_errors_total',
  help: 'Total number of GraphQL errors',
  labelNames: ['operation_name', 'error_type'],
});

export const graphqlDepth = new Histogram({
  name: 'graphql_query_depth',
  help: 'GraphQL query depth',
  buckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
});

export const graphqlComplexity = new Histogram({
  name: 'graphql_query_complexity',
  help: 'GraphQL query complexity score',
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
});

// Database Read Replica Metrics
export const dbPoolConnections = new Gauge({
  name: 'db_pool_connections',
  help: 'Database pool connections',
  labelNames: ['pool', 'state'], // pool: write/read, state: active/idle/waiting
});

export const dbReplicationLag = new Gauge({
  name: 'db_replication_lag_seconds',
  help: 'Database replication lag in seconds',
  labelNames: ['replica'],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['pool', 'query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const dbReadWriteSplit = new Counter({
  name: 'db_read_write_split_total',
  help: 'Count of queries by read/write split',
  labelNames: ['pool', 'fallback'],
});

// ML Service Scaling Metrics
export const mlTasksQueued = new Gauge({
  name: 'ml_tasks_queued',
  help: 'Number of ML tasks in queue',
  labelNames: ['priority'],
});

export const mlTaskDuration = new Histogram({
  name: 'ml_task_duration_seconds',
  help: 'ML task processing duration',
  labelNames: ['task_type', 'model_version'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
});

export const mlInstanceUtilization = new Gauge({
  name: 'ml_instance_utilization',
  help: 'ML instance CPU/Memory utilization',
  labelNames: ['instance_id', 'metric'], // metric: cpu/memory
});

export const mlLoadBalancerDistribution = new Counter({
  name: 'ml_load_balancer_requests_total',
  help: 'Requests distributed by load balancer',
  labelNames: ['backend_server'],
});

export const mlModelLoadTime = new Histogram({
  name: 'ml_model_load_time_seconds',
  help: 'Time to load ML model',
  labelNames: ['model_version'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// CDN Metrics
export const cdnCacheHits = new Counter({
  name: 'cdn_cache_hits_total',
  help: 'CDN cache hits',
  labelNames: ['asset_type', 'provider'],
});

export const cdnCacheMisses = new Counter({
  name: 'cdn_cache_misses_total',
  help: 'CDN cache misses',
  labelNames: ['asset_type', 'provider'],
});

export const cdnBandwidthSaved = new Counter({
  name: 'cdn_bandwidth_saved_bytes',
  help: 'Bandwidth saved by CDN caching',
  labelNames: ['asset_type', 'provider'],
});

export const cdnResponseTime = new Histogram({
  name: 'cdn_response_time_seconds',
  help: 'CDN response time',
  labelNames: ['asset_type', 'provider', 'cache_status'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
});

// Application Performance Metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const activeUsers = new Gauge({
  name: 'app_active_users',
  help: 'Number of active users',
  labelNames: ['user_type'], // guest/authenticated
});

export const imageProcessingQueue = new Gauge({
  name: 'image_processing_queue_size',
  help: 'Size of image processing queue',
  labelNames: ['status'], // queued/processing
});

export const memoryPressureEvents = new Counter({
  name: 'memory_pressure_events_total',
  help: 'Number of memory pressure events triggered',
  labelNames: ['action'], // gc_triggered/cleanup_performed
});

// Performance optimization metrics
export const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type'], // redis/memory/cdn
});

export const apiThrottlingEvents = new Counter({
  name: 'api_throttling_events_total',
  help: 'Number of API throttling events',
  labelNames: ['endpoint', 'reason'],
});

// Express middleware for HTTP metrics
export function prometheusMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || 'unknown';

    httpRequestDuration.labels(req.method, route, res.statusCode.toString()).observe(duration);
  });

  next();
}

// Metrics endpoint handler
export function metricsHandler(req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  register
    .metrics()
    .then((metrics) => {
      res.end(metrics);
    })
    .catch((err) => {
      res.status(500).end(err.message);
    });
}

// Helper functions to update metrics
export function recordWebSocketMessage(event: string, room: string, batched: boolean) {
  wsMessagesTotal.labels(event, room, batched.toString()).inc();
}

export function recordWebSocketBatch(room: string, size: number) {
  wsBatchesTotal.labels(room).inc();
  wsBatchSize.labels(room).observe(size);
}

export function updateActiveConnections(room: string, supportsBatching: boolean, delta: number) {
  wsActiveConnections.labels(room, supportsBatching.toString()).inc(delta);
}

export function recordGraphQLRequest(
  operationName: string,
  operationType: string,
  duration: number
) {
  graphqlRequestDuration.labels(operationName, operationType).observe(duration);
}

export function recordGraphQLError(operationName: string, errorType: string) {
  graphqlErrorsTotal.labels(operationName, errorType).inc();
}

export function recordDatabaseQuery(
  pool: 'read' | 'write',
  queryType: string,
  duration: number,
  fallback: boolean = false
) {
  dbQueryDuration.labels(pool, queryType).observe(duration);
  dbReadWriteSplit.labels(pool, fallback.toString()).inc();
}

export function updateDatabasePoolMetrics(
  pool: 'read' | 'write',
  active: number,
  idle: number,
  waiting: number
) {
  dbPoolConnections.labels(pool, 'active').set(active);
  dbPoolConnections.labels(pool, 'idle').set(idle);
  dbPoolConnections.labels(pool, 'waiting').set(waiting);
}

export function recordMLTask(taskType: string, modelVersion: string, duration: number) {
  mlTaskDuration.labels(taskType, modelVersion).observe(duration);
}

export function updateMLQueueSize(priority: string, size: number) {
  mlTasksQueued.labels(priority).set(size);
}

export function recordCDNMetrics(
  assetType: string,
  provider: string,
  hit: boolean,
  responseTime: number,
  bytes: number
) {
  if (hit) {
    cdnCacheHits.labels(assetType, provider).inc();
    cdnBandwidthSaved.labels(assetType, provider).inc(bytes);
  } else {
    cdnCacheMisses.labels(assetType, provider).inc();
  }
  cdnResponseTime.labels(assetType, provider, hit ? 'hit' : 'miss').observe(responseTime);
}

// Initialize custom metrics collection
export function initializeMetrics() {
  // Set up periodic metrics collection
  setInterval(() => {
    // Update cache hit rates
    // This would be calculated from actual cache statistics
    cacheHitRate.labels('redis').set(Math.random() * 100);
    cacheHitRate.labels('memory').set(Math.random() * 100);
    cacheHitRate.labels('cdn').set(Math.random() * 100);
  }, 15000);
}
