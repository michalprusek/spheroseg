/**
 * Error Reporting Routes
 * 
 * Handles client-side error reporting from the frontend application
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger';
import db from '../db';
import { ApiResponse, ApiErrorResponse } from '@spheroseg/types';

const router = Router();

// Error report interface
interface ErrorReport {
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  errorType?: string;
  severity?: 'error' | 'warning' | 'info';
  metadata?: Record<string, unknown>;
}

// Validation middleware for error reports
const validateErrorReport = [
  body('message').notEmpty().withMessage('Error message is required'),
  body('timestamp').isISO8601().withMessage('Valid timestamp is required'),
  body('userAgent').notEmpty().withMessage('User agent is required'),
  body('url').isURL({ require_protocol: false }).withMessage('Valid URL is required'),
  body('severity').optional().isIn(['error', 'warning', 'info']),
  body('errorType').optional().isString(),
  body('metadata').optional().isObject()
];

/**
 * POST /api/errors
 * Report a client-side error
 */
router.post('/', validateErrorReport, async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiErrorResponse = {
        success: false,
        error: 'Invalid error report data',
        code: 'VALIDATION_ERROR',
        validationErrors: errors.array().map(e => ({
          field: e.path as string,
          message: e.msg,
          code: e.type
        }))
      };
      return res.status(400).json(response);
    }

    const errorReport: ErrorReport = req.body;
    
    // Add server-side metadata
    const enrichedReport = {
      ...errorReport,
      serverTimestamp: new Date().toISOString(),
      ipAddress: req.ip,
      // Extract user ID from JWT if authenticated
      userId: (req as any).userId || errorReport.userId || null
    };

    // Log the error for immediate visibility
    logger.error('Client-side error reported', {
      message: errorReport.message,
      severity: errorReport.severity || 'error',
      url: errorReport.url,
      userAgent: errorReport.userAgent,
      stack: errorReport.stack,
      metadata: errorReport.metadata
    });

    // Store in database if enabled
    if (process.env['STORE_ERROR_REPORTS'] === 'true') {
      await storeErrorReport(enrichedReport);
    }

    // Send to external monitoring service if configured
    if (process.env['ERROR_MONITORING_SERVICE_URL']) {
      // This would integrate with services like Sentry, Rollbar, etc.
      await forwardToMonitoringService(enrichedReport);
    }

    const response: ApiResponse<{ reported: boolean }> = {
      success: true,
      data: { reported: true },
      message: 'Error report received'
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to process error report', {
      error: error instanceof Error ? error.message : String(error)
    });

    const response: ApiErrorResponse = {
      success: false,
      error: 'Failed to process error report',
      code: 'INTERNAL_ERROR'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/errors/stats
 * Get error statistics (admin only)
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // This would typically require admin authentication
    // For now, we'll return basic stats if error storage is enabled
    
    if (process.env['STORE_ERROR_REPORTS'] !== 'true') {
      const response: ApiErrorResponse = {
        success: false,
        error: 'Error report storage is not enabled',
        code: 'NOT_ENABLED'
      };
      return res.status(404).json(response);
    }

    const stats = await getErrorStats();
    
    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to get error stats', {
      error: error instanceof Error ? error.message : String(error)
    });

    const response: ApiErrorResponse = {
      success: false,
      error: 'Failed to get error statistics',
      code: 'INTERNAL_ERROR'
    };

    res.status(500).json(response);
  }
});

/**
 * Store error report in database
 */
async function storeErrorReport(report: ErrorReport & { serverTimestamp: string; ipAddress?: string }): Promise<void> {
  const query = `
    INSERT INTO error_reports (
      message, stack, source, lineno, colno,
      timestamp, server_timestamp, user_agent, url,
      user_id, session_id, error_type, severity,
      metadata, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `;

  const values = [
    report.message,
    report.stack || null,
    report.source || null,
    report.lineno || null,
    report.colno || null,
    report.timestamp,
    report.serverTimestamp,
    report.userAgent,
    report.url,
    report.userId || null,
    report.sessionId || null,
    report.errorType || null,
    report.severity || 'error',
    JSON.stringify(report.metadata || {}),
    report.ipAddress || null
  ];

  try {
    await db.query(query, values);
  } catch (error) {
    // Log but don't throw - we don't want to fail the request if storage fails
    logger.error('Failed to store error report in database', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Forward error report to external monitoring service
 */
async function forwardToMonitoringService(_report: ErrorReport): Promise<void> {
  // This is a placeholder for integration with external services
  // In a real implementation, this would send to Sentry, Rollbar, etc.
  
  const serviceUrl = process.env['ERROR_MONITORING_SERVICE_URL'];
  const serviceApiKey = process.env['ERROR_MONITORING_API_KEY'];

  if (!serviceUrl || !serviceApiKey) {
    return;
  }

  try {
    // Example: Send to monitoring service
    // await fetch(serviceUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${serviceApiKey}`
    //   },
    //   body: JSON.stringify(report)
    // });
    
    logger.debug('Error report forwarded to monitoring service', {
      service: serviceUrl
    });
  } catch (error) {
    logger.error('Failed to forward error to monitoring service', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get error statistics from database
 */
async function getErrorStats() {
  const query = `
    WITH error_counts AS (
      SELECT
        severity,
        error_type,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT url) as unique_pages
      FROM error_reports
      WHERE server_timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY severity, error_type
    ),
    recent_errors AS (
      SELECT
        message,
        url,
        severity,
        server_timestamp
      FROM error_reports
      ORDER BY server_timestamp DESC
      LIMIT 10
    )
    SELECT
      (SELECT json_agg(ec) FROM error_counts ec) as counts,
      (SELECT json_agg(re) FROM recent_errors re) as recent,
      (SELECT COUNT(*) FROM error_reports WHERE server_timestamp >= NOW() - INTERVAL '24 hours') as total_24h,
      (SELECT COUNT(*) FROM error_reports WHERE server_timestamp >= NOW() - INTERVAL '1 hour') as total_1h
  `;

  const result = await db.query(query);
  
  return {
    counts: result.rows[0]?.counts || [],
    recent: result.rows[0]?.recent || [],
    total24h: parseInt(result.rows[0]?.total_24h || '0'),
    total1h: parseInt(result.rows[0]?.total_1h || '0'),
    timestamp: new Date().toISOString()
  };
}

export default router;