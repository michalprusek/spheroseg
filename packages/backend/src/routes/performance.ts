import express from 'express';
import { Request, Response } from 'express';
import pool from '../db';
import logger from '../utils/logger';
import devAuthMiddleware, { AuthenticatedRequest } from '../middleware/devAuthMiddleware';

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
          ],
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
router.get('/me', devAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
      [userId],
    );

    res.status(200).json({ metrics: result.rows });
  } catch (error) {
    logger.error('Error fetching performance metrics', { error, userId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
