/**
 * Performance Metrics API
 *
 * Provides endpoints for accessing performance metrics and system health information.
 */

import express, { Request, Response, Router } from 'express';
import performanceMonitor from '../services/performanceMonitor';
import cacheService from '../services/cacheService';
import { getPool } from '../db';
import logger from '../utils/logger';
import os from 'os';
import { getContainerInfo } from '../utils/containerInfo';
import { authenticate as authMiddleware } from '../security/middleware/auth';

const router: Router = express.Router();

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

export default router;
