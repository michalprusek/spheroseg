import express, { Request, Response, Router } from 'express';
import pool from '../db';
import logger from '../utils/logger';
import config from '../config';

const router: Router = express.Router();

// GET /api/health - Basic health check endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const dbConnected = await checkDbConnection();

    // Check ML service if required
    const mlServiceStatus = config.segmentation.checkpointExists ? 'configured' : 'missing_checkpoint';

    // Send health status
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      components: {
        api: 'healthy',
        database: dbConnected ? 'connected' : 'disconnected',
        mlService: mlServiceStatus,
      },
      environment: config.env,
    });

    logger.debug('Health check succeeded', {
      database: dbConnected,
      mlService: mlServiceStatus,
    });
  } catch (error) {
    logger.error('Health check failed', { error });

    // Even on error, return 200 with degraded status
    // This allows load balancers to still route traffic
    res.status(200).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      components: {
        api: 'healthy',
        database: 'disconnected',
        mlService: 'unknown',
      },
      environment: config.env,
    });
  }
});

// Helper function to check database connection
async function checkDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as connection_test');
    client.release();
    return result.rows[0].connection_test === 1;
  } catch (error) {
    logger.error('Database connection check failed', { error });
    return false;
  }
}

export default router;
