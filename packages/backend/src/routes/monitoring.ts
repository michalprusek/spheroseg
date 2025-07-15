/**
 * Monitoring and Metrics API Routes
 *
 * Provides comprehensive monitoring endpoints for system health,
 * performance metrics, error tracking, and operational insights
 */

import { Router, Request, Response, NextFunction } from 'express';
import { register as promRegister } from 'prom-client';
import { requireAdmin } from '../security/middleware/auth';
import { unifiedRegistry } from '../monitoring/unified';
import { getErrorMetrics } from '../monitoring/errorTracker';
import { getPerformanceMetrics } from '../monitoring/performanceTracker';
import {
  checkSystemHealth,
  checkDatabaseHealth,
  checkRedisHealth,
  checkMLServiceHealth,
} from '../utils/healthChecks';
import logger from '../utils/logger';
import config from '../config';

const router = Router();

/**
 * GET /api/monitoring/health
 * System health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const systemHealth = await checkSystemHealth();

    const healthData = {
      status: systemHealth.overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
      node: process.version,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      services: {
        database: systemHealth.services.database.status,
        redis: systemHealth.services.redis.status,
        ml: systemHealth.services.ml.status,
      },
      serviceDetails: systemHealth.services,
      summary: systemHealth.summary,
    };

    const statusCode =
      systemHealth.overall === 'healthy' ? 200 : systemHealth.overall === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthData);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Prometheus metrics endpoint
 */
router.get('/metrics', (req: Request, res: Response) => {
  res.set('Content-Type', promRegister.contentType);
  res.end(unifiedRegistry.metrics());
});

/**
 * GET /api/monitoring/errors
 * Error tracking and analysis
 */
router.get('/errors', requireAdmin, (req: Request, res: Response) => {
  try {
    const errorMetrics = getErrorMetrics();
    res.json(errorMetrics);
  } catch (error) {
    logger.error('Error fetching error metrics', error);
    res.status(500).json({ error: 'Failed to fetch error metrics' });
  }
});

/**
 * GET /api/monitoring/performance
 * Performance tracking and analysis
 */
router.get('/performance', requireAdmin, (req: Request, res: Response) => {
  try {
    const performanceMetrics = getPerformanceMetrics();
    res.json(performanceMetrics);
  } catch (error) {
    logger.error('Error fetching performance metrics', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * GET /api/monitoring/dashboard
 * Unified monitoring dashboard data
 */
router.get('/dashboard', requireAdmin, async (req: Request, res: Response) => {
  try {
    const [errorMetrics, performanceMetrics, systemHealth] = await Promise.all([
      getErrorMetrics(),
      getPerformanceMetrics(),
      checkSystemHealth(),
    ]);

    const dashboardData = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        environment: config.env,
        version: process.env.npm_package_version || '1.0.0',
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      health: {
        overall: systemHealth.overall,
        services: {
          database: systemHealth.services.database.status,
          redis: systemHealth.services.redis.status,
          ml: systemHealth.services.ml.status,
        },
        serviceDetails: systemHealth.services,
        summary: systemHealth.summary,
      },
      errors: {
        total: errorMetrics.stats.totalErrors,
        active: errorMetrics.stats.activeErrors,
        health: errorMetrics.health,
        topErrors: errorMetrics.stats.topErrors,
      },
      performance: {
        healthScore: performanceMetrics.report.healthScore,
        avgResponseTime: performanceMetrics.report.summary.avgResponseTime,
        errorRate: performanceMetrics.report.summary.errorRate,
        slowOperations: performanceMetrics.report.topSlowOperations,
        recommendations: performanceMetrics.report.recommendations,
      },
      alerts: [...errorMetrics.stats.recentAlerts, ...performanceMetrics.stats.alerts]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10),
    };

    res.json(dashboardData);
  } catch (error) {
    logger.error('Error fetching dashboard data', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/monitoring/logs
 * Recent logs endpoint (admin only)
 */
router.get('/logs', requireAdmin, (req: Request, res: Response) => {
  try {
    const { level = 'info', limit = 100 } = req.query;

    // TODO: Implement log retrieval from winston transports
    // For now, return a placeholder response
    const logs = {
      message: 'Log retrieval not implemented yet',
      parameters: {
        level,
        limit: parseInt(limit as string, 10),
      },
    };

    res.json(logs);
  } catch (error) {
    logger.error('Error fetching logs', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * POST /api/monitoring/alerts/:alertId/resolve
 * Resolve an alert
 */
router.post('/alerts/:alertId/resolve', requireAdmin, (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolution } = req.body;

    // TODO: Implement alert resolution
    logger.info('Alert resolved', {
      alertId,
      resolution,
      resolvedBy: (req as any).user?.userId,
    });

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      alertId,
      resolution,
    });
  } catch (error) {
    logger.error('Error resolving alert', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * GET /api/monitoring/system
 * System information and configuration
 */
router.get('/system', requireAdmin, (req: Request, res: Response) => {
  try {
    const systemInfo = {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
      },
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        isDevelopment: config.isDevelopment,
        isProduction: config.isProduction,
      },
      configuration: {
        server: {
          port: config.server.port,
          host: config.server.host,
        },
        database: {
          host: config.db.host,
          port: config.db.port,
          database: config.db.database,
          maxConnections: config.db.maxConnections,
        },
        monitoring: {
          metricsEnabled: config.monitoring.metricsEnabled,
          metricsPrefix: config.monitoring.metricsPrefix,
        },
      },
    };

    res.json(systemInfo);
  } catch (error) {
    logger.error('Error fetching system information', error);
    res.status(500).json({ error: 'Failed to fetch system information' });
  }
});

/**
 * GET /api/monitoring/recommendations
 * Performance and optimization recommendations
 */
router.get('/recommendations', requireAdmin, (req: Request, res: Response) => {
  try {
    const performanceMetrics = getPerformanceMetrics();
    const recommendations = performanceMetrics.report.recommendations;

    res.json({
      recommendations,
      total: recommendations.length,
      highPriority: recommendations.filter((r) => r.priority > 80).length,
      mediumPriority: recommendations.filter((r) => r.priority > 50 && r.priority <= 80).length,
      lowPriority: recommendations.filter((r) => r.priority <= 50).length,
    });
  } catch (error) {
    logger.error('Error fetching recommendations', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

export default router;
