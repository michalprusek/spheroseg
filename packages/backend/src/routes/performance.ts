import express from 'express';
import { Request, Response } from 'express';
import pool from '../db';
import logger from '../utils/logger';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import { getMemoryInfo } from '../utils/containerInfo';
import { getWebSocketBatcher } from '../services/websocketBatcher';
import performanceMonitor from '../services/performanceMonitor';
import redisService from '../services/redisService';

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
 * Route handler for getting memory usage metrics
 */
router.get('/memory', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memoryInfo = await getMemoryInfo();
    
    res.status(200).json({
      success: true,
      data: {
        used: Math.round(memoryInfo.usedMB),
        limit: Math.round(memoryInfo.limitMB),
        percentage: Math.round(memoryInfo.percentage),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching memory metrics', { error });
    res.status(500).json({ error: 'Failed to fetch memory metrics' });
  }
});

/**
 * Route handler for getting cache metrics
 */
router.get('/cache', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cacheAvailable = await redisService.isAvailable();
    let cacheStats = null;
    
    if (cacheAvailable) {
      const client = await redisService.getClient();
      if (client) {
        const info = await client.info('stats');
        const dbSize = await client.dbsize();
        
        // Parse Redis info
        const stats: any = {};
        info.split('\n').forEach(line => {
          if (line.includes(':')) {
            const [key, value] = line.split(':');
            stats[key.trim()] = value.trim();
          }
        });
        
        cacheStats = {
          keys: dbSize,
          hits: parseInt(stats.keyspace_hits || '0'),
          misses: parseInt(stats.keyspace_misses || '0'),
          hitRate: stats.keyspace_hits && stats.keyspace_misses
            ? (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2)
            : 0,
          totalConnections: parseInt(stats.total_connections_received || '0'),
          usedMemory: stats.used_memory_human || 'N/A'
        };
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        available: cacheAvailable,
        stats: cacheStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching cache metrics', { error });
    res.status(500).json({ error: 'Failed to fetch cache metrics' });
  }
});

/**
 * Route handler for getting WebSocket metrics
 */
router.get('/websocket', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const batcher = getWebSocketBatcher();
    const batcherMetrics = batcher ? batcher.getMetrics() : null;
    
    res.status(200).json({
      success: true,
      data: {
        batcherEnabled: !!batcher,
        metrics: batcherMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching WebSocket metrics', { error });
    res.status(500).json({ error: 'Failed to fetch WebSocket metrics' });
  }
});

/**
 * Route handler for getting comprehensive performance metrics
 */
router.get('/metrics', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get all metrics
    const [memoryInfo, performanceMetrics] = await Promise.all([
      getMemoryInfo(),
      performanceMonitor.getMetrics()
    ]);
    
    const cacheAvailable = await redisService.isAvailable();
    const batcher = getWebSocketBatcher();
    
    res.status(200).json({
      success: true,
      data: {
        memory: {
          used: Math.round(memoryInfo.usedMB),
          limit: Math.round(memoryInfo.limitMB),
          percentage: Math.round(memoryInfo.percentage)
        },
        performance: performanceMetrics,
        cache: {
          available: cacheAvailable
        },
        websocket: {
          batcherEnabled: !!batcher,
          metrics: batcher ? batcher.getMetrics() : null
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching comprehensive metrics', { error });
    res.status(500).json({ error: 'Failed to fetch comprehensive metrics' });
  }
});

export default router;
