/**
 * Business Metrics API Routes
 * 
 * Provides endpoints for business metrics dashboard and alert management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getBusinessMetrics } from '../utils/businessMetrics';
import logger from '../utils/logger';
import { authenticate } from '../security/middleware/auth';

const router = Router();

/**
 * Get current metric value
 * GET /api/metrics/:metricName
 */
router.get('/:metricName', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { metricName } = req.params;
      const metricsService = getBusinessMetrics();
      
      const metricValue = await metricsService.getMetricValue(metricName);
      
      if (!metricValue) {
        return res.status(404).json({
          success: false,
          error: 'Metric not found',
        });
      }
      
      res.json({
        success: true,
        data: metricValue,
      });
    } catch (error) {
      logger.error('Failed to get metric value', {
        metric: req.params.metricName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
);

/**
 * Get metric statistics
 * GET /api/metrics/:metricName/stats
 */
router.get('/:metricName/stats', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { metricName } = req.params;
      const metricsService = getBusinessMetrics();
      
      const stats = await metricsService.getMetricStats(metricName);
      
      if (!stats) {
        return res.status(404).json({
          success: false,
          error: 'Metric stats not found',
        });
      }
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get metric stats', {
        metric: req.params.metricName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
);

/**
 * Get metric history
 * GET /api/metrics/:metricName/history
 */
router.get('/:metricName/history', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { metricName } = req.params;
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Start and end timestamps are required',
        });
      }
      
      const startTime = new Date(start as string);
      const endTime = new Date(end as string);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format',
        });
      }
      
      const metricsService = getBusinessMetrics();
      const history = await metricsService.getMetricHistory(metricName, startTime, endTime);
      
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Failed to get metric history', {
        metric: req.params.metricName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
);

/**
 * Get dashboard data (all metrics and active alerts)
 * GET /api/metrics/dashboard
 */
router.get('/dashboard/data', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metricsService = getBusinessMetrics();
      const dashboardData = await metricsService.getDashboardData();
      
      res.json({
        success: true,
        data: dashboardData,
      });
    } catch (error) {
      logger.error('Failed to get dashboard data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
);

/**
 * Get active alerts
 * GET /api/metrics/alerts
 */
router.get('/alerts/active', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { metric, severity } = req.query;
      
      const metricsService = getBusinessMetrics();
      const alerts = await metricsService.getActiveAlerts(
        metric as string | undefined,
        severity as 'warning' | 'critical' | undefined
      );
      
      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      logger.error('Failed to get active alerts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
);

/**
 * Acknowledge an alert
 * POST /api/metrics/alerts/:alertId/acknowledge
 */
router.post('/alerts/:alertId/acknowledge', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { alertId } = req.params;
      const userId = req.user?.id || 'unknown';
      
      const metricsService = getBusinessMetrics();
      await metricsService.acknowledgeAlert(alertId, userId);
      
      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
      });
    } catch (error) {
      logger.error('Failed to acknowledge alert', {
        alertId: req.params.alertId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
);

/**
 * Manually trigger metric collection
 * POST /api/metrics/:metricName/collect
 */
router.post('/:metricName/collect', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { metricName } = req.params;
      const metricsService = getBusinessMetrics();
      
      const metricValue = await metricsService.collectMetric(metricName);
      
      if (!metricValue) {
        return res.status(500).json({
          success: false,
          error: 'Failed to collect metric',
        });
      }
      
      res.json({
        success: true,
        data: metricValue,
      });
    } catch (error) {
      logger.error('Failed to collect metric', {
        metric: req.params.metricName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
);

export default router;