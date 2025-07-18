import express, { Request, Response, Router, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import pool from '../db';
import { monitorQuery } from '../monitoring/unified';

const router: Router = express.Router();

// Log entry validation schema
const logEntrySchema = z.object({
  timestamp: z.string().optional(),
  level: z.number().int().min(0).max(3),
  levelName: z.string(),
  message: z.string(),
  data: z.any().optional(),
});

// Batch logs validation schema
const batchLogsSchema = z.object({
  logs: z.array(logEntrySchema),
  source: z.string().default('frontend'),
  userAgent: z.string().optional(),
  timestamp: z.string().optional(),
});

/**
 * Ensure logs table exists in database
 */
async function ensureLogsTableExists() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        level INT NOT NULL,
        level_name VARCHAR(10) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        user_agent VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await monitorQuery(createTableQuery, [], () => pool.query(createTableQuery));
    logger.info('Logs table created or already exists');
  } catch (error) {
    logger.error('Error creating logs table:', { error });
  }
}

// Create table on module load
ensureLogsTableExists().catch((err) => {
  logger.error('Failed to create logs table on startup:', { error: err });
});

/**
 * POST /api/logs - Log client-side messages (single log)
 * This endpoint allows the frontend to send logs to the server
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if this is a batch of logs or a single log
    if (req.body.logs && Array.isArray(req.body.logs)) {
      // Handle batch of logs
      return handleBatchLogs(req, res, next);
    }

    // Validate single log entry
    const validation = logEntrySchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Invalid log format received', { errors: validation.error });
      return res.status(400).json({
        success: false,
        message: 'Invalid log format',
        errors: validation.error.errors,
      });
    }

    const { level, levelName, message, data } = validation.data;
    const timestamp = validation.data.timestamp || new Date().toISOString();
    const userAgent = req.headers['user-agent'];

    // Log the message with the appropriate level
    switch (level) {
      case 0: // ERROR
        logger.error(`[Client] ${message}`, { clientData: data, timestamp });
        break;
      case 1: // WARN
        logger.warn(`[Client] ${message}`, { clientData: data, timestamp });
        break;
      case 2: // INFO
        logger.info(`[Client] ${message}`, { clientData: data, timestamp });
        break;
      case 3: // DEBUG
        logger.debug(`[Client] ${message}`, { clientData: data, timestamp });
        break;
      default:
        logger.info(`[Client] ${message}`, {
          clientData: data,
          timestamp,
          level: levelName,
        });
    }

    // Store in database for persistent storage
    try {
      await pool.query(
        `INSERT INTO logs (source, level, level_name, message, data, timestamp, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'frontend',
          level,
          levelName,
          message,
          data ? JSON.stringify(data) : null,
          new Date(timestamp),
          userAgent || null,
        ]
      );
    } catch (dbError) {
      logger.error('Error saving log to database:', { error: dbError });
      // Continue even if database storage fails
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing client log', { error });
    res.status(500).json({ success: false, message: 'Failed to process log' });
  }
});

/**
 * POST /api/logs/batch - Log multiple client-side messages at once
 * This endpoint allows the frontend to send multiple logs in one request
 */
router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  return handleBatchLogs(req, res, next);
});

/**
 * Helper function to handle batch logs
 */
async function handleBatchLogs(req: Request, res: Response, _next: NextFunction) {
  try {
    // Validate request
    const validation = batchLogsSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Invalid batch logs format', { errors: validation.error });
      return res.status(400).json({
        success: false,
        message: 'Invalid batch logs format',
        errors: validation.error.errors,
      });
    }

    const { logs, source = 'frontend' } = validation.data;
    const userAgent = req.headers['user-agent'];

    if (logs.length === 0) {
      return res.status(200).json({ success: true, message: 'No logs to process' });
    }

    logger.info(`Processing batch of ${logs.length} logs from ${source}`);

    // Process each log
    for (const log of logs) {
      const { level, levelName, message, data } = log;
      const timestamp = log.timestamp || new Date().toISOString();

      // Log with appropriate level (but with less detail in console for batch processing)
      if (level === 0) {
        // ERROR
        logger.error(
          `[${source}] ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`
        );
      } else if (level === 1) {
        // WARN
        logger.warn(`[${source}] ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
      }
    }

    // Store all logs in database in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const log of logs) {
        const { level, levelName, message, data } = log;
        const timestamp = log.timestamp || new Date().toISOString();

        // Only store ERROR and WARN logs to database to save space
        if (level <= 1) {
          await client.query(
            `INSERT INTO logs (source, level, level_name, message, data, timestamp, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              source,
              level,
              levelName,
              message,
              data ? JSON.stringify(data) : null,
              new Date(timestamp),
              userAgent || null,
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      logger.error('Error saving batch logs to database:', { error: dbError });
      // Continue even if database storage fails
    } finally {
      client.release();
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${logs.length} logs`,
    });
  } catch (error) {
    logger.error('Error processing batch logs', { error });
    res.status(500).json({ success: false, message: 'Failed to process logs' });
  }
}

// GET /api/logs/admin - Get logs data (admin only)
router.get('/admin', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    // Admin role check
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Check if user has admin role
    try {
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }
    } catch (roleError) {
      logger.error('Error checking admin role:', { error: roleError });
      // In development mode, allow access even without admin role check
      if (process.env.NODE_ENV !== 'development') {
        return res.status(500).json({ success: false, message: 'Error checking admin access' });
      }
    }

    // Extract query parameters
    const { level, source, limit = 100, offset = 0, from, to, search } = req.query;

    // Build query
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params: any[] = [];

    // Add filters
    if (level !== undefined) {
      query += ` AND level = $${params.length + 1}`;
      params.push(Number(level));
    }

    if (source) {
      query += ` AND source = $${params.length + 1}`;
      params.push(source);
    }

    if (from) {
      query += ` AND timestamp >= $${params.length + 1}`;
      params.push(from);
    }

    if (to) {
      query += ` AND timestamp <= $${params.length + 1}`;
      params.push(to);
    }

    if (search) {
      query += ` AND (message ILIKE $${params.length + 1} OR data::text ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS filtered_logs`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit));
    params.push(Number(offset));

    // Execute query
    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving logs:', { error });
    res.status(500).json({ success: false, message: 'Failed to retrieve logs' });
  }
});

// DELETE /api/logs/admin - Clear logs (admin only)
router.delete('/admin', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    // Admin role check
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Check if user has admin role
    try {
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }
    } catch (roleError) {
      logger.error('Error checking admin role:', { error: roleError });
      // In development mode, allow access even without admin role check
      if (process.env.NODE_ENV !== 'development') {
        return res.status(500).json({ success: false, message: 'Error checking admin access' });
      }
    }

    // Extract query parameters
    const {
      olderThan, // Timestamp string
      level,
      source,
      all = 'false', // String 'true' or 'false'
    } = req.query;

    // Safety check - require at least one filter unless explicitly requesting all
    if (all !== 'true' && !olderThan && level === undefined && !source) {
      return res.status(400).json({
        success: false,
        message:
          'Please provide at least one filter (olderThan, level, source) or set all=true to delete all logs',
      });
    }

    // Build query
    let query = 'DELETE FROM logs WHERE 1=1';
    const params: any[] = [];

    // Add filters
    if (olderThan) {
      query += ` AND timestamp < $${params.length + 1}`;
      params.push(olderThan);
    }

    if (level !== undefined) {
      query += ` AND level = $${params.length + 1}`;
      params.push(Number(level));
    }

    if (source) {
      query += ` AND source = $${params.length + 1}`;
      params.push(source);
    }

    // Execute query
    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      message: `Deleted ${result.rowCount} logs`,
      count: result.rowCount,
    });
  } catch (error) {
    logger.error('Error clearing logs:', { error });
    res.status(500).json({ success: false, message: 'Failed to clear logs' });
  }
});

// GET /api/logs/stats - Get log statistics (admin only)
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    // Admin role check
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Check if user has admin role (except in development)
    if (process.env.NODE_ENV !== 'development') {
      try {
        const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);

        if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }
      } catch (roleError) {
        logger.error('Error checking admin role:', { error: roleError });
        return res.status(500).json({ success: false, message: 'Error checking admin access' });
      }
    }

    // Get count by level
    const levelCountQuery = `
      SELECT level, level_name, COUNT(*) as count
      FROM logs
      GROUP BY level, level_name
      ORDER BY level ASC
    `;
    const levelResult = await pool.query(levelCountQuery);

    // Get count by source
    const sourceCountQuery = `
      SELECT source, COUNT(*) as count
      FROM logs
      GROUP BY source
      ORDER BY count DESC
    `;
    const sourceResult = await pool.query(sourceCountQuery);

    // Get count per day for the last 7 days
    const timeSeriesQuery = `
      SELECT
        DATE_TRUNC('day', timestamp) as day,
        COUNT(*) as count
      FROM logs
      WHERE timestamp > NOW() - INTERVAL '7 days'
      GROUP BY day
      ORDER BY day ASC
    `;
    const timeSeriesResult = await pool.query(timeSeriesQuery);

    // Get total count
    const totalCountQuery = 'SELECT COUNT(*) as total FROM logs';
    const totalResult = await pool.query(totalCountQuery);

    // Return stats
    res.status(200).json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].total),
        byLevel: levelResult.rows,
        bySource: sourceResult.rows,
        byDay: timeSeriesResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error retrieving log statistics:', { error });
    res.status(500).json({ success: false, message: 'Failed to retrieve log statistics' });
  }
});

export default router;
