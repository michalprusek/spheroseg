import express from 'express';
import { Request, Response } from 'express';
import pool from '../db';
import logger from '../utils/logger';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import { 
  getPerformanceCoordinatorReport, 
  getPerformanceCoordinatorSourceStatus 
} from '../startup/performanceCoordinator.startup';

const router = express.Router();

/**
 * Route handler for receiving performance metrics
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const metrics = req.body;

    if (!metrics || typeof metrics !== 'object') {
      return res.status(400).json({ error: 'Invalid metrics format' });
    }

    // Log the metrics for now
    logger.debug('Received performance metrics', { metrics });

    // Store metrics in database if needed
    try {
      // Check if performance_metrics table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'performance_metrics'
        )
      `);

      if (tableCheck.rows[0].exists) {
        // Store metrics in database
        await pool.query(
          `INSERT INTO performance_metrics
           (client_id, page, component, metric_type, value, timestamp, user_agent, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            metrics.clientId || null,
            metrics.page || null,
            metrics.component || null,
            metrics.type || 'unknown',
            metrics.value || 0,
            new Date(),
            req.headers['user-agent'] || null,
            JSON.stringify(metrics.metadata || {}),
          ]
        );
      }
    } catch (dbError) {
      logger.error('Error storing performance metrics', { error: dbError });
      // Continue even if DB storage fails
    }

    // Return success
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing performance metrics:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Route handler for getting performance metrics for the current user
 */
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    // Check if performance_metrics table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'performance_metrics'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.status(200).json({ metrics: [] });
    }

    // Get metrics for the user
    const result = await pool.query(
      `SELECT * FROM performance_metrics
       WHERE client_id = $1
       ORDER BY timestamp DESC
       LIMIT 100`,
      [userId]
    );

    res.status(200).json({ metrics: result.rows });
  } catch (error) {
    logger.error('Error fetching performance metrics', { error, userId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Route handler for getting comprehensive performance report
 */
router.get('/report', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await getPerformanceCoordinatorReport();
    res.status(200).json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error generating performance report', { error });
    res.status(500).json({ error: 'Failed to generate performance report' });
  }
});

/**
 * Route handler for getting monitoring source status
 */
router.get('/sources', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sourceStatus = getPerformanceCoordinatorSourceStatus();
    res.status(200).json({
      success: true,
      sources: sourceStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting source status', { error });
    res.status(500).json({ error: 'Failed to get source status' });
  }
});

/**
 * Route handler for getting performance insights
 */
router.get('/insights', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { severity } = req.query;
    const report = await getPerformanceCoordinatorReport();
    
    let insights = report.insights;
    if (severity && typeof severity === 'string') {
      insights = insights.filter((insight: any) => insight.severity === severity);
    }

    res.status(200).json({
      success: true,
      insights,
      correlations: report.correlations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting performance insights', { error });
    res.status(500).json({ error: 'Failed to get performance insights' });
  }
});

/**
 * Route handler for getting performance recommendations
 */
router.get('/recommendations', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await getPerformanceCoordinatorReport();
    
    res.status(200).json({
      success: true,
      recommendations: report.recommendations,
      optimizations: report.optimizations,
      systemHealth: report.summary.systemHealth,
      resourceUtilization: report.summary.resourceUtilization,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting performance recommendations', { error });
    res.status(500).json({ error: 'Failed to get performance recommendations' });
  }
});

export default router;
