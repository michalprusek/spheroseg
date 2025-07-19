/**
 * Performance Metrics API
 *
 * Provides endpoints for accessing performance metrics, system health information,
 * and Prometheus metrics for monitoring.
 */

import express, { Request, Response, Router } from 'express';
import performanceMonitor from '../services/performanceMonitor';
import cacheService from '../services/cacheService';
import { getPool } from '../db';
import logger from '../utils/logger';
import os from 'os';
import { getContainerInfo } from '../utils/containerInfo';
import { authenticate as authMiddleware } from '../security/middleware/auth';
import {
  metricsHandler,
  wsActiveConnections,
  wsMessagesTotal,
  wsBatchesTotal,
  wsCompressionSavings,
  graphqlRequestDuration,
  graphqlResolverDuration,
  graphqlErrorsTotal,
  dbPoolConnections,
  dbReplicationLag,
  cdnCacheHits,
  cdnCacheMisses,
} from '../monitoring/prometheus';
import { getWebSocketBatcher } from '../services/websocketBatcher';
import { getReplicationLag, getPoolStats } from '../db/readReplica';
import { getEnhancedMetrics } from '../services/socketServiceEnhanced';

const router: Router = express.Router();

/**
 * GET /api/metrics
 *
 * Prometheus metrics endpoint
 */
router.get('/', metricsHandler);

/**
 * GET /api/metrics/performance
 *
 * Returns comprehensive performance metrics including:
 * - API endpoint performance statistics
 * - Database query performance
 * - System resource usage
 * - Cache hit/miss rates
 * - Database connection pool stats
 */
router.get('/performance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const summary = await performanceMonitor.getPerformanceSummary();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      metrics: summary,
    });
  } catch (error) {
    logger.error('Error fetching performance metrics', { error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch performance metrics',
    });
  }
});

/**
 * GET /api/metrics/health
 *
 * Health check endpoint that returns system status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    let dbStatus = 'unknown';
    let dbLatency = 0;

    try {
      const startTime = Date.now();
      await getPool().query('SELECT 1');
      dbLatency = Date.now() - startTime;
      dbStatus = 'healthy';
    } catch (error) {
      dbStatus = 'unhealthy';
      logger.error('Database health check failed', { error });
    }

    // Check Redis connection
    let redisStatus = 'unknown';
    let redisLatency = 0;

    try {
      const startTime = Date.now();
      await cacheService.ping();
      redisLatency = Date.now() - startTime;
      redisStatus = 'healthy';
    } catch (error) {
      redisStatus = 'unhealthy';
      logger.error('Redis health check failed', { error });
    }

    // Get system info
    const containerInfo = await getContainerInfo();
    const systemInfo = {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      cpuCount: os.cpus().length,
      totalMemory: containerInfo.isContainer ? containerInfo.memoryLimit : os.totalmem(),
      freeMemory: containerInfo.isContainer
        ? containerInfo.memoryLimit - containerInfo.memoryUsage
        : os.freemem(),
      loadAverage: os.loadavg(),
    };

    const overallStatus =
      dbStatus === 'healthy' && redisStatus === 'healthy' ? 'healthy' : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatency,
        },
      },
      system: systemInfo,
    });
  } catch (error) {
    logger.error('Error in health check', { error });
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});

/**
 * GET /api/metrics/summary
 *
 * Returns a simplified performance summary suitable for dashboards
 */
/**
 * POST /api/metrics/performance
 *
 * Accepts performance metrics from frontend and stores them
 */
router.post('/performance', async (req: Request, res: Response) => {
  try {
    const metrics = req.body;

    // Log frontend performance metrics
    logger.info('Frontend performance metrics received', {
      dnsLookup: metrics.dnsLookup,
      tcpConnection: metrics.tcpConnection,
      requestTime: metrics.requestTime,
      domProcessing: metrics.domProcessing,
      totalPageLoad: metrics.totalPageLoad,
      timestamp: metrics.timestamp,
      userAgent: req.get('User-Agent'),
    });

    // You could store these in database or forward to monitoring system
    // For now, we just acknowledge receipt
    res.json({
      status: 'success',
      message: 'Performance metrics received',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error processing frontend performance metrics', { error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to process metrics',
      error: process.env["NODE_ENV"] === 'development' ? error.message : 'Internal server error',
    });
  }
});

router.get('/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const summary = await performanceMonitor.getPerformanceSummary();

    // Extract key metrics for dashboard
    const dashboardMetrics = {
      timestamp: summary.timestamp,
      uptime: summary.uptime,
      api: {
        requestsPerMinute: summary.api.totalRequests,
        avgResponseTime: Math.round(summary.api.avgResponseTime || 0),
        errorRate: Math.round(summary.api.errorRate || 0),
      },
      database: {
        queriesPerMinute: summary.database.totalQueries,
        avgQueryTime: Math.round(summary.database.avgDuration || 0),
        slowQueries: summary.database.slowQueries?.length || 0,
      },
      system: {
        cpuUsage: Math.round(summary.system.current?.cpu || 0),
        memoryUsage: Math.round(summary.system.current?.memory?.percentage || 0),
        eventLoopLag: Math.round(summary.system.current?.eventLoopLag || 0),
      },
      cache: {
        hitRate: Math.round(summary.cache?.hitRate || 0),
        totalHits: summary.cache?.hits || 0,
        totalMisses: summary.cache?.misses || 0,
      },
    };

    res.json(dashboardMetrics);
  } catch (error) {
    logger.error('Error fetching metrics summary', { error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch metrics summary',
    });
  }
});

/**
 * GET /api/metrics/graphql
 *
 * GraphQL specific metrics
 */
router.get('/graphql', async (req: Request, res: Response) => {
  try {
    const graphqlMetrics = {
      total_requests: graphqlRequestDuration.hashMap,
      total_errors: graphqlErrorsTotal.hashMap,
      resolver_performance: graphqlResolverDuration.hashMap,
    };

    res.json(graphqlMetrics);
  } catch (error) {
    logger.error('Error fetching GraphQL metrics:', error);
    res.status(500).json({ error: 'Failed to fetch GraphQL metrics' });
  }
});

/**
 * GET /api/metrics/websocket
 *
 * WebSocket specific metrics including batching performance
 */
router.get('/websocket', async (req: Request, res: Response) => {
  try {
    const batcher = getWebSocketBatcher();
    const enhancedMetrics = getEnhancedMetrics();

    const wsMetrics = {
      batcher_metrics: batcher?.getMetrics() || null,
      enhanced_metrics: enhancedMetrics,
      active_connections: wsActiveConnections.hashMap,
      messages_total: wsMessagesTotal.hashMap,
      batches_sent: wsBatchesTotal.hashMap,
      compression_savings: wsCompressionSavings.hashMap,
    };

    res.json(wsMetrics);
  } catch (error) {
    logger.error('Error fetching WebSocket metrics:', error);
    res.status(500).json({ error: 'Failed to fetch WebSocket metrics' });
  }
});

/**
 * GET /api/metrics/database
 *
 * Database metrics including read replica performance
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const poolStats = await getPoolStats();
    const replicationLag = await getReplicationLag();

    // Update Prometheus metrics
    if (poolStats.write_pool) {
      dbPoolConnections.labels('write', 'active').set(poolStats.write_pool.total);
      dbPoolConnections.labels('write', 'idle').set(poolStats.write_pool.idle);
      dbPoolConnections.labels('write', 'waiting').set(poolStats.write_pool.waiting);
    }

    if (poolStats.read_pool) {
      dbPoolConnections.labels('read', 'active').set(poolStats.read_pool.total);
      dbPoolConnections.labels('read', 'idle').set(poolStats.read_pool.idle);
      dbPoolConnections.labels('read', 'waiting').set(poolStats.read_pool.waiting);
    }

    if (replicationLag !== null) {
      dbReplicationLag.labels('replica1').set(replicationLag);
    }

    res.json({
      pool_stats: poolStats,
      replication_lag_seconds: replicationLag,
    });
  } catch (error) {
    logger.error('Error fetching database metrics:', error);
    res.status(500).json({ error: 'Failed to fetch database metrics' });
  }
});

/**
 * GET /api/metrics/slow-queries
 *
 * Returns list of slow database queries for optimization
 */
router.get('/slow-queries', authMiddleware, async (req: Request, res: Response) => {
  try {
    const summary = await performanceMonitor.getPerformanceSummary();
    const slowQueries = summary.database?.slowQueries || [];

    res.json({
      timestamp: new Date().toISOString(),
      slowQueries,
      recommendations: [
        'Consider adding indexes for frequently queried columns',
        'Optimize queries that scan large tables',
        'Use EXPLAIN ANALYZE to understand query execution plans',
        'Consider caching frequently accessed data',
      ],
    });
  } catch (error) {
    logger.error('Error fetching slow queries', { error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch slow queries',
    });
  }
});

/**
 * GET /api/metrics/endpoints
 *
 * Returns performance statistics for all API endpoints
 */
router.get('/endpoints', authMiddleware, async (req: Request, res: Response) => {
  try {
    const summary = await performanceMonitor.getPerformanceSummary();
    const slowEndpoints = summary.api?.slowEndpoints || [];

    res.json({
      timestamp: new Date().toISOString(),
      totalRequests: summary.api?.totalRequests || 0,
      avgResponseTime: summary.api?.avgResponseTime || 0,
      errorRate: summary.api?.errorRate || 0,
      slowEndpoints,
      percentiles: {
        p50: summary.api?.p50ResponseTime || 0,
        p95: summary.api?.p95ResponseTime || 0,
        p99: summary.api?.p99ResponseTime || 0,
      },
    });
  } catch (error) {
    logger.error('Error fetching endpoint metrics', { error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch endpoint metrics',
    });
  }
});

/**
 * GET /api/metrics/cdn
 *
 * CDN performance metrics
 */
router.get('/cdn', authMiddleware, async (req: Request, res: Response) => {
  try {
    const cdnMetrics = {
      cache_hits: cdnCacheHits.hashMap,
      cache_misses: cdnCacheMisses.hashMap,
      hit_rate:
        cdnCacheHits.hashMap.size > 0
          ? (cdnCacheHits.hashMap.size /
              (cdnCacheHits.hashMap.size + cdnCacheMisses.hashMap.size)) *
            100
          : 0,
    };

    res.json(cdnMetrics);
  } catch (error) {
    logger.error('Error fetching CDN metrics:', error);
    res.status(500).json({ error: 'Failed to fetch CDN metrics' });
  }
});

export default router;
