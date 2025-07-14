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
  wsBatchSize,
  wsCompressionSavings,
  graphqlRequestDuration,
  graphqlResolverDuration,
  graphqlErrorsTotal,
  dbPoolConnections,
  dbReplicationLag,
  mlTasksQueued,
  mlInstanceUtilization,
  cdnCacheHits,
  cdnCacheMisses,
  activeUsers,
  imageProcessingQueue,
  cacheHitRate
} from '../monitoring/prometheus';
import { getWebSocketBatcher } from '../services/websocketBatcher';
import { getReplicationLag, getPoolStats } from '../db/readReplica';
import { getEnhancedMetrics } from '../services/socketServiceEnhanced';

const router: Router = express.Router();

// In-memory storage for RUM data (use Redis or database in production)
const rumStore: {
  reports: any[];
  aggregates: {
    webVitals: Record<string, number[]>;
    customMetrics: Record<string, number[]>;
    errors: number;
    totalSessions: number;
  };
} = {
  reports: [],
  aggregates: {
    webVitals: {
      fcp: [],
      lcp: [],
      fid: [],
      cls: [],
      ttfb: [],
      inp: [],
    },
    customMetrics: {},
    errors: 0,
    totalSessions: 0,
  },
};

// Helper to calculate percentiles
function calculatePercentiles(values: number[]): {
  median: number;
  p75: number;
  p95: number;
  average: number;
} {
  if (values.length === 0) {
    return { median: 0, p75: 0, p95: 0, average: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  const getPercentile = (p: number) => {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  };

  return {
    median: getPercentile(0.5),
    p75: getPercentile(0.75),
    p95: getPercentile(0.95),
    average: Math.round(average),
  };
}

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
      hit_rate: cdnCacheHits.hashMap.size > 0 
        ? (cdnCacheHits.hashMap.size / (cdnCacheHits.hashMap.size + cdnCacheMisses.hashMap.size)) * 100
        : 0,
    };
    
    res.json(cdnMetrics);
  } catch (error) {
    logger.error('Error fetching CDN metrics:', error);
    res.status(500).json({ error: 'Failed to fetch CDN metrics' });
  }
});

/**
 * POST /api/metrics/rum
 * Receive real user metrics data
 */
router.post('/rum', async (req: Request, res: Response) => {
  try {
    const report = req.body;
    
    // Validate report structure
    if (!report.sessionId || !report.timestamp || !report.webVitals) {
      return res.status(400).json({ 
        error: 'Invalid metrics report format' 
      });
    }

    // Store report (limit to last 1000)
    rumStore.reports.push(report);
    if (rumStore.reports.length > 1000) {
      rumStore.reports = rumStore.reports.slice(-1000);
    }

    // Update aggregates
    const { webVitals, customMetrics } = report;
    
    // Aggregate Web Vitals
    Object.entries(webVitals).forEach(([metric, value]) => {
      if (value !== null && value !== undefined) {
        if (!rumStore.aggregates.webVitals[metric]) {
          rumStore.aggregates.webVitals[metric] = [];
        }
        rumStore.aggregates.webVitals[metric].push(value as number);
        
        // Keep only last 1000 values
        if (rumStore.aggregates.webVitals[metric].length > 1000) {
          rumStore.aggregates.webVitals[metric] = 
            rumStore.aggregates.webVitals[metric].slice(-1000);
        }
      }
    });

    // Aggregate custom metrics
    if (customMetrics) {
      Object.entries(customMetrics).forEach(([name, value]) => {
        if (!rumStore.aggregates.customMetrics[name]) {
          rumStore.aggregates.customMetrics[name] = [];
        }
        rumStore.aggregates.customMetrics[name].push(value as number);
        
        // Keep only last 1000 values
        if (rumStore.aggregates.customMetrics[name].length > 1000) {
          rumStore.aggregates.customMetrics[name] = 
            rumStore.aggregates.customMetrics[name].slice(-1000);
        }
      });
    }

    // Track errors from user actions
    if (report.userActions) {
      const errorActions = report.userActions.filter((action: any) => !action.success);
      rumStore.aggregates.errors += errorActions.length;
    }

    // Track unique sessions
    const sessionIds = new Set(rumStore.reports.map(r => r.sessionId));
    rumStore.aggregates.totalSessions = sessionIds.size;

    // Log performance issues
    if (webVitals.lcp && webVitals.lcp > 4000) {
      logger.warn('Poor LCP detected', {
        sessionId: report.sessionId,
        lcp: webVitals.lcp,
        url: report.url,
      });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('Error processing RUM data:', error);
    res.status(500).json({ error: 'Failed to process metrics' });
  }
});

/**
 * GET /api/metrics/rum/summary
 * Get aggregated RUM statistics
 */
router.get('/rum/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const webVitalsSummary: Record<string, any> = {};
    
    // Calculate percentiles for each Web Vital
    Object.entries(rumStore.aggregates.webVitals).forEach(([metric, values]) => {
      if (values.length > 0) {
        webVitalsSummary[metric] = calculatePercentiles(values);
      }
    });

    // Calculate custom metrics summary
    const customMetricsSummary: Record<string, any> = {};
    Object.entries(rumStore.aggregates.customMetrics).forEach(([name, values]) => {
      if (values.length > 0) {
        customMetricsSummary[name] = calculatePercentiles(values);
      }
    });

    // Get recent reports for timeline
    const recentReports = rumStore.reports.slice(-100);
    const timeline = recentReports.map(report => ({
      timestamp: report.timestamp,
      lcp: report.webVitals.lcp,
      fcp: report.webVitals.fcp,
      cls: report.webVitals.cls,
    }));

    // Top slow resources
    const allResources = recentReports.flatMap(r => r.resources || []);
    const slowResources = allResources
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // User action performance
    const allActions = recentReports.flatMap(r => r.userActions || []);
    const actionsByType = allActions.reduce((acc, action) => {
      if (!acc[action.action]) {
        acc[action.action] = {
          count: 0,
          totalDuration: 0,
          failures: 0,
        };
      }
      acc[action.action].count++;
      acc[action.action].totalDuration += action.duration;
      if (!action.success) {
        acc[action.action].failures++;
      }
      return acc;
    }, {} as Record<string, any>);

    const summary = {
      totalSessions: rumStore.aggregates.totalSessions,
      totalReports: rumStore.reports.length,
      totalErrors: rumStore.aggregates.errors,
      webVitals: webVitalsSummary,
      customMetrics: customMetricsSummary,
      timeline,
      slowResources,
      userActions: Object.entries(actionsByType).map(([action, stats]) => ({
        action,
        count: stats.count,
        averageDuration: Math.round(stats.totalDuration / stats.count),
        failureRate: (stats.failures / stats.count) * 100,
      })),
    };

    res.json(summary);
  } catch (error) {
    logger.error('Error generating RUM summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * GET /api/metrics/rum/sessions/:sessionId
 * Get detailed metrics for a specific session
 */
router.get('/rum/sessions/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const sessionReports = rumStore.reports.filter(
      report => report.sessionId === sessionId
    );

    if (sessionReports.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get latest report for session details
    const latestReport = sessionReports[sessionReports.length - 1];
    
    // Build session timeline
    const timeline = sessionReports.map(report => ({
      timestamp: report.timestamp,
      url: report.url,
      webVitals: report.webVitals,
      actionCount: report.userActions?.length || 0,
      resourceCount: report.resources?.length || 0,
    }));

    // Aggregate all user actions
    const allActions = sessionReports.flatMap(r => r.userActions || []);
    
    // Aggregate all resources
    const allResources = sessionReports.flatMap(r => r.resources || []);
    const resourcesByType = allResources.reduce((acc, resource) => {
      if (!acc[resource.type]) {
        acc[resource.type] = {
          count: 0,
          totalSize: 0,
          totalDuration: 0,
          cached: 0,
        };
      }
      acc[resource.type].count++;
      acc[resource.type].totalSize += resource.size;
      acc[resource.type].totalDuration += resource.duration;
      if (resource.cached) {
        acc[resource.type].cached++;
      }
      return acc;
    }, {} as Record<string, any>);

    const sessionDetails = {
      sessionId,
      startTime: sessionReports[0].timestamp,
      endTime: latestReport.timestamp,
      duration: latestReport.timestamp - sessionReports[0].timestamp,
      reportCount: sessionReports.length,
      timeline,
      finalWebVitals: latestReport.webVitals,
      userActions: allActions,
      resourceSummary: Object.entries(resourcesByType).map(([type, stats]) => ({
        type,
        count: stats.count,
        totalSize: stats.totalSize,
        averageDuration: Math.round(stats.totalDuration / stats.count),
        cacheHitRate: (stats.cached / stats.count) * 100,
      })),
      customMetrics: latestReport.customMetrics,
    };

    res.json(sessionDetails);
  } catch (error) {
    logger.error('Error fetching session details:', error);
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
});

/**
 * DELETE /api/metrics/rum
 * Clear all RUM data (development only)
 */
router.delete('/rum', authMiddleware, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Only available in development' });
  }

  // Clear all data
  rumStore.reports = [];
  rumStore.aggregates = {
    webVitals: {
      fcp: [],
      lcp: [],
      fid: [],
      cls: [],
      ttfb: [],
      inp: [],
    },
    customMetrics: {},
    errors: 0,
    totalSessions: 0,
  };

  res.json({ success: true, message: 'RUM data cleared' });
});

export default router;