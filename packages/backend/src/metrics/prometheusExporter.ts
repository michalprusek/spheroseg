import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Initialize Prometheus metrics registry
register.clear();

// WebSocket Batching Metrics
export const wsConnectionsGauge = new Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
  labelNames: ['namespace'],
});

export const wsBatchSizeHistogram = new Histogram({
  name: 'websocket_batch_size',
  help: 'Size of WebSocket message batches',
  labelNames: ['event_type'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

export const wsBatchLatencyHistogram = new Histogram({
  name: 'websocket_batch_latency_ms',
  help: 'Latency of WebSocket batch processing in milliseconds',
  labelNames: ['event_type'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

export const wsMessagesCounter = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['event_type', 'direction'],
});

export const wsBatchesCounter = new Counter({
  name: 'websocket_batches_total',
  help: 'Total number of WebSocket batches sent',
  labelNames: ['event_type'],
});

// GraphQL Performance Metrics
export const graphqlQueryDuration = new Histogram({
  name: 'graphql_query_duration_ms',
  help: 'Duration of GraphQL query execution in milliseconds',
  labelNames: ['operation_name', 'operation_type'],
  buckets: [0.1, 5, 15, 50, 100, 500, 1000, 2500, 5000],
});

export const graphqlFieldResolveDuration = new Histogram({
  name: 'graphql_field_resolve_duration_ms',
  help: 'Duration of GraphQL field resolution in milliseconds',
  labelNames: ['type_name', 'field_name'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100],
});

export const graphqlRequestCounter = new Counter({
  name: 'graphql_requests_total',
  help: 'Total number of GraphQL requests',
  labelNames: ['operation_type', 'status'],
});

export const graphqlDepthHistogram = new Histogram({
  name: 'graphql_query_depth',
  help: 'Depth of GraphQL queries',
  labelNames: ['operation_name'],
  buckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20],
});

export const graphqlComplexityHistogram = new Histogram({
  name: 'graphql_query_complexity',
  help: 'Complexity score of GraphQL queries',
  labelNames: ['operation_name'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

// Database Read Replica Metrics
export const dbConnectionsGauge = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['pool_type', 'database'],
});

export const dbReplicaLagGauge = new Gauge({
  name: 'database_replica_lag_seconds',
  help: 'Replication lag in seconds for read replicas',
  labelNames: ['replica_name'],
});

export const dbQueryDuration = new Histogram({
  name: 'database_query_duration_ms',
  help: 'Duration of database queries in milliseconds',
  labelNames: ['query_type', 'table', 'pool_type'],
  buckets: [0.1, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
});

export const dbTransactionDuration = new Histogram({
  name: 'database_transaction_duration_ms',
  help: 'Duration of database transactions in milliseconds',
  labelNames: ['transaction_type'],
  buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000],
});

export const dbPoolWaitTime = new Histogram({
  name: 'database_pool_wait_time_ms',
  help: 'Time spent waiting for a database connection from the pool',
  labelNames: ['pool_type'],
  buckets: [0.1, 1, 5, 10, 25, 50, 100, 250, 500],
});

// ML Service Scaling Metrics
export const mlWorkersGauge = new Gauge({
  name: 'ml_workers_active',
  help: 'Number of active ML worker processes',
  labelNames: ['worker_type'],
});

export const mlQueueDepthGauge = new Gauge({
  name: 'ml_queue_depth',
  help: 'Number of tasks in ML processing queue',
  labelNames: ['queue_name', 'priority'],
});

export const mlTaskDuration = new Histogram({
  name: 'ml_task_duration_seconds',
  help: 'Duration of ML task processing in seconds',
  labelNames: ['task_type', 'model_version'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200],
});

export const mlModelLoadTime = new Histogram({
  name: 'ml_model_load_time_seconds',
  help: 'Time to load ML model in seconds',
  labelNames: ['model_name', 'model_version'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 25, 50],
});

export const mlGpuUtilization = new Gauge({
  name: 'ml_gpu_utilization_percent',
  help: 'GPU utilization percentage',
  labelNames: ['gpu_id', 'metric_type'],
});

export const mlBatchSizeHistogram = new Histogram({
  name: 'ml_batch_size',
  help: 'Batch size for ML inference',
  labelNames: ['model_name'],
  buckets: [1, 2, 4, 8, 16, 32, 64, 128],
});

// CDN Performance Metrics
export const cdnCacheHitRate = new Gauge({
  name: 'cdn_cache_hit_rate',
  help: 'CDN cache hit rate percentage',
  labelNames: ['cache_type', 'content_type'],
});

export const cdnBandwidthGauge = new Gauge({
  name: 'cdn_bandwidth_bytes_per_second',
  help: 'CDN bandwidth usage in bytes per second',
  labelNames: ['direction', 'content_type'],
});

export const cdnRequestDuration = new Histogram({
  name: 'cdn_request_duration_ms',
  help: 'Duration of CDN requests in milliseconds',
  labelNames: ['method', 'status_code', 'content_type'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

export const cdnOriginRequests = new Counter({
  name: 'cdn_origin_requests_total',
  help: 'Total number of requests to origin server',
  labelNames: ['content_type', 'cache_status'],
});

// System Resource Metrics
export const systemMemoryGauge = new Gauge({
  name: 'system_memory_usage_bytes',
  help: 'System memory usage in bytes',
  labelNames: ['service', 'type'],
});

export const systemCpuGauge = new Gauge({
  name: 'system_cpu_usage_percent',
  help: 'System CPU usage percentage',
  labelNames: ['service', 'core'],
});

export const systemDiskIOGauge = new Gauge({
  name: 'system_disk_io_bytes_per_second',
  help: 'Disk I/O in bytes per second',
  labelNames: ['service', 'operation', 'device'],
});

// Application-specific metrics
export const imageProcessingDuration = new Histogram({
  name: 'image_processing_duration_seconds',
  help: 'Duration of image processing tasks in seconds',
  labelNames: ['operation', 'image_format', 'size_category'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100],
});

export const segmentationAccuracy = new Gauge({
  name: 'segmentation_accuracy_percent',
  help: 'Segmentation model accuracy percentage',
  labelNames: ['model_version', 'image_type'],
});

export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_ms',
  help: 'Duration of API requests in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 5, 15, 50, 100, 500, 1000, 2500, 5000],
});

export const apiRequestsTotal = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Cache Metrics
export const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_name', 'cache_type'],
});

export const cacheOperationDuration = new Histogram({
  name: 'cache_operation_duration_ms',
  help: 'Duration of cache operations in milliseconds',
  labelNames: ['operation', 'cache_name'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50],
});

// Business Metrics
export const activeUsersGauge = new Gauge({
  name: 'active_users_count',
  help: 'Number of active users',
  labelNames: ['time_period'],
});

export const imagesProcessedCounter = new Counter({
  name: 'images_processed_total',
  help: 'Total number of images processed',
  labelNames: ['processing_type', 'status'],
});

export const projectsCreatedCounter = new Counter({
  name: 'projects_created_total',
  help: 'Total number of projects created',
  labelNames: ['project_type'],
});

// Middleware for collecting HTTP metrics
export const prometheusMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    apiRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    apiRequestsTotal.inc({ method, route, status_code: statusCode });
  });

  next();
};

// Export metrics endpoint handler
export const metricsHandler = async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end();
  }
};

// Helper functions for updating metrics
export const updateWebSocketMetrics = {
  connectionOpened: (namespace: string) => wsConnectionsGauge.inc({ namespace }),
  connectionClosed: (namespace: string) => wsConnectionsGauge.dec({ namespace }),
  messageSent: (eventType: string, batchSize: number, latency: number) => {
    wsBatchSizeHistogram.observe({ event_type: eventType }, batchSize);
    wsBatchLatencyHistogram.observe({ event_type: eventType }, latency);
    wsBatchesCounter.inc({ event_type: eventType });
    wsMessagesCounter.inc({ event_type: eventType, direction: 'outbound' }, batchSize);
  },
  messageReceived: (eventType: string) => {
    wsMessagesCounter.inc({ event_type: eventType, direction: 'inbound' });
  },
};

export const updateDatabaseMetrics = {
  queryExecuted: (queryType: string, table: string, poolType: string, duration: number) => {
    dbQueryDuration.observe({ query_type: queryType, table, pool_type: poolType }, duration);
  },
  connectionPoolStatus: (poolType: string, activeConnections: number) => {
    dbConnectionsGauge.set({ pool_type: poolType, database: 'spheroseg' }, activeConnections);
  },
  replicaLag: (replicaName: string, lagSeconds: number) => {
    dbReplicaLagGauge.set({ replica_name: replicaName }, lagSeconds);
  },
  poolWaitTime: (poolType: string, waitTime: number) => {
    dbPoolWaitTime.observe({ pool_type: poolType }, waitTime);
  },
};

export const updateMLMetrics = {
  workerStatus: (workerType: string, count: number) => {
    mlWorkersGauge.set({ worker_type: workerType }, count);
  },
  queueDepth: (queueName: string, priority: string, depth: number) => {
    mlQueueDepthGauge.set({ queue_name: queueName, priority }, depth);
  },
  taskProcessed: (taskType: string, modelVersion: string, duration: number) => {
    mlTaskDuration.observe({ task_type: taskType, model_version: modelVersion }, duration);
  },
  modelLoaded: (modelName: string, modelVersion: string, loadTime: number) => {
    mlModelLoadTime.observe({ model_name: modelName, model_version: modelVersion }, loadTime);
  },
  gpuStatus: (gpuId: string, utilization: number, memoryUsage: number) => {
    mlGpuUtilization.set({ gpu_id: gpuId, metric_type: 'utilization' }, utilization);
    mlGpuUtilization.set({ gpu_id: gpuId, metric_type: 'memory' }, memoryUsage);
  },
  batchProcessed: (modelName: string, batchSize: number) => {
    mlBatchSizeHistogram.observe({ model_name: modelName }, batchSize);
  },
};

export const updateCDNMetrics = {
  cacheHit: (cacheType: string, contentType: string, hitRate: number) => {
    cdnCacheHitRate.set({ cache_type: cacheType, content_type: contentType }, hitRate);
  },
  bandwidth: (direction: string, contentType: string, bytesPerSecond: number) => {
    cdnBandwidthGauge.set({ direction, content_type: contentType }, bytesPerSecond);
  },
  request: (method: string, statusCode: string, contentType: string, duration: number) => {
    cdnRequestDuration.observe(
      { method, status_code: statusCode, content_type: contentType },
      duration
    );
  },
  originRequest: (contentType: string, cacheStatus: string) => {
    cdnOriginRequests.inc({ content_type: contentType, cache_status: cacheStatus });
  },
};

export const updateSystemMetrics = {
  memory: (service: string, used: number, total: number) => {
    systemMemoryGauge.set({ service, type: 'used' }, used);
    systemMemoryGauge.set({ service, type: 'total' }, total);
  },
  cpu: (service: string, core: string, usage: number) => {
    systemCpuGauge.set({ service, core }, usage);
  },
  diskIO: (service: string, operation: string, device: string, bytesPerSecond: number) => {
    systemDiskIOGauge.set({ service, operation, device }, bytesPerSecond);
  },
};

export const updateBusinessMetrics = {
  activeUsers: (timePeriod: string, count: number) => {
    activeUsersGauge.set({ time_period: timePeriod }, count);
  },
  imageProcessed: (processingType: string, status: string) => {
    imagesProcessedCounter.inc({ processing_type: processingType, status });
  },
  projectCreated: (projectType: string) => {
    projectsCreatedCounter.inc({ project_type: projectType });
  },
};
