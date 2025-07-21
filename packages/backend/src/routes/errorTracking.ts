/**
 * Error Tracking API Routes
 * 
 * Provides REST API endpoints for the error tracking and alerting system.
 * Includes endpoints for viewing errors, managing alerts, and accessing insights.
 */

import { Router, Request, Response } from 'express';
import { getErrorTrackingService } from '../startup/errorTracking.startup';
import { checkErrorTrackingHealth } from '../startup/errorTracking.startup';
import { ApiError } from '../utils/ApiError.enhanced';
import { asyncHandler } from '../middleware/errorHandler.enhanced';
import { authenticate } from '../security/middleware/auth';
import { createValidationMiddleware, commonSchemas } from '../middleware/enhancedValidation';
import { z } from 'zod';
import logger from '../utils/logger';
import { apiCache, staleWhileRevalidate, cacheStrategies } from '../middleware/advancedApiCache';
import { createErrorTrackingRateLimit, customErrorTrackingLimit } from '../middleware/errorTrackingRateLimit';

const router = Router();

// Validation schemas
const alertAcknowledgeSchema = z.object({
  notes: z.string().max(500).optional(),
});

const errorQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z.enum(['authentication', 'validation', 'permission', 'business', 'external', 'system']).optional(),
  resolved: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  fingerprint: z.string().length(32).optional(),
});

const alertQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  acknowledged: z.boolean().optional(),
  resolved: z.boolean().optional(),
  alertType: z.enum(['threshold', 'pattern', 'anomaly', 'trend', 'spike']).optional(),
});

// All routes require authentication
router.use(authenticate);

// Apply base rate limiting to all error tracking routes
router.use(createErrorTrackingRateLimit());

/**
 * GET /errors
 * Get error logs with filtering and pagination
 */
router.get('/errors', 
  staleWhileRevalidate({
    strategy: 'WARM',
    ttl: 2 * 60 * 1000, // 2 minutes
    private: true,
    tags: ['errors', 'admin'],
    varyBy: ['query']
  }),
  createValidationMiddleware({ query: errorQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      const query = req.validatedQuery as z.infer<typeof errorQuerySchema>;
      
      // Build the summary based on filters
      const summary = await service.getErrorSummary(3600, {
        severity: query.severity,
        category: query.category,
        resolved: query.resolved,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        fingerprint: query.fingerprint,
      });

      res.json({
        success: true,
        data: summary,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: summary.totalErrors,
          pages: Math.ceil(summary.totalErrors / query.limit),
        },
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'get',
        resource: 'errors',
      });
    }
  })
);

/**
 * GET /errors/:fingerprint
 * Get detailed error information by fingerprint
 */
router.get('/errors/:fingerprint', 
  createValidationMiddleware({ 
    params: z.object({ fingerprint: z.string().length(32) })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      const { fingerprint } = req.validatedParams as { fingerprint: string };
      
      const pattern = await service.getErrorPattern(fingerprint);
      if (!pattern) {
        throw ApiError.resourceNotFound('Error pattern', fingerprint);
      }

      const recentOccurrences = await service.getRecentErrorOccurrences(fingerprint, 50);
      const insights = await service.getErrorInsights(fingerprint);

      res.json({
        success: true,
        data: {
          pattern,
          recentOccurrences,
          insights,
        },
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'get',
        resource: 'error-pattern',
        resourceId: req.params.fingerprint,
      });
    }
  })
);

/**
 * POST /errors/:fingerprint/resolve
 * Mark an error pattern as resolved
 */
router.post('/errors/:fingerprint/resolve',
  createValidationMiddleware({ 
    params: z.object({ fingerprint: z.string().length(32) }),
    body: z.object({
      notes: z.string().max(500).optional(),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      const { fingerprint } = req.validatedParams as { fingerprint: string };
      const { notes } = req.validatedBody as { notes?: string };
      const userId = (req as any).user?.id;

      const success = await service.resolveErrorPattern(fingerprint, userId, notes);
      if (!success) {
        throw ApiError.resourceNotFound('Error pattern', fingerprint);
      }

      logger.info('Error pattern resolved', {
        fingerprint,
        userId,
        notes,
      });

      res.json({
        success: true,
        message: 'Error pattern marked as resolved',
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'resolve',
        resource: 'error-pattern',
        resourceId: req.params.fingerprint,
      });
    }
  })
);

/**
 * GET /alerts
 * Get alerts with filtering and pagination
 */
router.get('/alerts',
  staleWhileRevalidate({
    strategy: 'HOT',
    ttl: 30 * 1000, // 30 seconds for alerts
    private: true,
    tags: ['alerts', 'admin'],
    varyBy: ['query']
  }),
  createValidationMiddleware({ query: alertQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      const query = req.validatedQuery as z.infer<typeof alertQuerySchema>;
      
      const alerts = await service.getAlerts({
        page: query.page,
        limit: query.limit,
        severity: query.severity,
        acknowledged: query.acknowledged,
        resolved: query.resolved,
        alertType: query.alertType,
      });

      const total = alerts.length; // In a real implementation, you'd get this from a count query
      
      res.json({
        success: true,
        data: alerts,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'get',
        resource: 'alerts',
      });
    }
  })
);

/**
 * POST /alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge',
  createValidationMiddleware({ 
    params: z.object({ alertId: z.string().min(1) }),
    body: alertAcknowledgeSchema,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      const { alertId } = req.validatedParams as { alertId: string };
      const { notes } = req.validatedBody as { notes?: string };
      const userId = (req as any).user?.id;

      const success = await service.acknowledgeAlert(alertId, userId, notes);
      if (!success) {
        throw ApiError.resourceNotFound('Alert', alertId);
      }

      logger.info('Alert acknowledged', {
        alertId,
        userId,
        notes,
      });

      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'acknowledge',
        resource: 'alert',
        resourceId: req.params.alertId,
      });
    }
  })
);

/**
 * GET /patterns
 * Get error patterns with trend analysis
 */
router.get('/patterns',
  createValidationMiddleware({ query: commonSchemas.pagination }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      const query = req.validatedQuery as z.infer<typeof commonSchemas.pagination>;
      
      const patterns = await service.getErrorPatterns({
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy || 'priorityScore',
        sortOrder: query.sortOrder || 'desc',
      });

      res.json({
        success: true,
        data: patterns,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: patterns.length,
          pages: Math.ceil(patterns.length / query.limit),
        },
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'get',
        resource: 'error-patterns',
      });
    }
  })
);

/**
 * GET /insights
 * Get error insights and recommendations
 */
router.get('/insights',
  createValidationMiddleware({ query: commonSchemas.pagination }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      const query = req.validatedQuery as z.infer<typeof commonSchemas.pagination>;
      
      const insights = await service.getAllInsights({
        page: query.page,
        limit: query.limit,
      });

      res.json({
        success: true,
        data: insights,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: insights.length,
          pages: Math.ceil(insights.length / query.limit),
        },
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'get',
        resource: 'insights',
      });
    }
  })
);

/**
 * GET /dashboard
 * Get dashboard data with summary statistics
 */
router.get('/dashboard',
  customErrorTrackingLimit(10, 1, 5), // 10 requests per minute, 5 min block
  apiCache({
    strategy: 'HOT',
    ttl: 60 * 1000, // 1 minute
    private: true,
    tags: ['dashboard', 'admin']
  }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      
      // Get dashboard data for the last 24 hours
      const dashboard = await service.getDashboardData(24 * 60); // 24 hours in minutes

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'get',
        resource: 'dashboard',
      });
    }
  })
);

// Health check endpoint removed - use /api/health instead
// The main health endpoint includes error tracking health in its comprehensive checks

/**
 * GET /stats
 * Get error statistics and trends
 */
router.get('/stats',
  createValidationMiddleware({ 
    query: z.object({
      timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
      groupBy: z.enum(['hour', 'day']).optional(),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const service = getErrorTrackingService();
      const { timeRange, groupBy } = req.validatedQuery as { 
        timeRange: '1h' | '24h' | '7d' | '30d';
        groupBy?: 'hour' | 'day';
      };
      
      // Convert time range to minutes
      const timeRangeMinutes = {
        '1h': 60,
        '24h': 24 * 60,
        '7d': 7 * 24 * 60,
        '30d': 30 * 24 * 60,
      }[timeRange];

      const stats = await service.getErrorStatistics(timeRangeMinutes, groupBy);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      throw ApiError.from(error, { 
        userId: (req as any).user?.id,
        action: 'get',
        resource: 'stats',
      });
    }
  })
);

export default router;