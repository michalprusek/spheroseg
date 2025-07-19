/**
 * Rate Limit Management Routes
 * 
 * Provides endpoints for monitoring and managing rate limits
 */

import express, { Router } from 'express';
import { authenticate } from '../security/middleware/auth';
import { authorize } from '../middleware/authorization';
import { asyncHandler } from '../middleware/errorHandler.enhanced';
import { rateLimiter } from '../middleware/rateLimiter.enhanced';
import { ApiError } from '../utils/ApiError.enhanced';
import logger from '../utils/logger';

const router: Router = express.Router();

/**
 * Get current rate limit status for authenticated user
 */
router.get('/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const identifier = userId || req.ip;

    const status = await rateLimiter.getUserStatus(identifier);

    res.json({
      success: true,
      data: {
        ...status,
        currentTime: new Date().toISOString(),
      },
    });
  })
);

/**
 * Get rate limit status for any user (admin only)
 */
router.get('/status/:identifier',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { identifier } = req.params;

    if (!identifier) {
      throw ApiError.requiredField('identifier');
    }

    const status = await rateLimiter.getUserStatus(identifier);

    logger.info('Admin checked rate limit status', {
      admin: (req as any).user.id,
      targetIdentifier: identifier,
    });

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * Reset rate limit for a user (admin only)
 */
router.post('/reset/:identifier',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { identifier } = req.params;

    if (!identifier) {
      throw ApiError.requiredField('identifier');
    }

    await rateLimiter.resetUserLimit(identifier);

    logger.warn('Rate limit reset by admin', {
      admin: (req as any).user.id,
      targetIdentifier: identifier,
      reason: req.body.reason,
    });

    res.json({
      success: true,
      message: 'Rate limit reset successfully',
      data: {
        identifier,
        resetAt: new Date().toISOString(),
        resetBy: (req as any).user.id,
      },
    });
  })
);

/**
 * Get rate limit configuration (admin only)
 */
router.get('/config',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    // Import the configurations
    const { RATE_LIMITS, ENDPOINT_MULTIPLIERS, UserCategory } = await import('../middleware/rateLimiter.enhanced');

    res.json({
      success: true,
      data: {
        categories: Object.values(UserCategory),
        limits: RATE_LIMITS,
        endpointMultipliers: ENDPOINT_MULTIPLIERS,
      },
    });
  })
);

/**
 * Get rate limit metrics (admin only)
 */
router.get('/metrics',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { startTime, endTime, category } = req.query;

    // This would typically query from a metrics database
    // For now, return mock data structure
    const metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      rateLimitedRequests: 0,
      averageRequestsPerUser: 0,
      topOffenders: [],
      byCategory: {},
      byEndpoint: {},
    };

    res.json({
      success: true,
      data: {
        metrics,
        period: {
          start: startTime || new Date(Date.now() - 3600000).toISOString(),
          end: endTime || new Date().toISOString(),
        },
      },
    });
  })
);

export default router;