/**
 * CORS Management Routes
 * 
 * Provides endpoints for monitoring and managing CORS configuration
 */

import express, { Router } from 'express';
import { authenticate } from '../security/middleware/auth';
import { authorize } from '../middleware/authorization';
import { asyncHandler } from '../middleware/errorHandler.enhanced';
import { getCorsConfiguration, validateCorsConfiguration } from '../middleware/cors.enhanced';
import { ApiError } from '../utils/ApiError.enhanced';
import logger from '../utils/logger';

const router: Router = express.Router();

/**
 * Get current CORS configuration (admin only)
 */
router.get('/config',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const config = getCorsConfiguration();

    logger.info('CORS configuration retrieved', {
      admin: (req as any).user.id,
      requestId: (req as any).id,
    });

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * Validate CORS configuration (admin only)
 */
router.post('/validate',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    try {
      validateCorsConfiguration();
      
      res.json({
        success: true,
        message: 'CORS configuration is valid',
        data: {
          validatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      throw ApiError.validationError('CORS configuration validation failed', [
        {
          field: 'configuration',
          constraint: 'valid',
          message: error instanceof Error ? error.message : 'Invalid configuration',
        },
      ]);
    }
  })
);

/**
 * Test CORS with a specific origin (admin only)
 */
router.post('/test',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { origin } = req.body;

    if (!origin) {
      throw ApiError.requiredField('origin');
    }

    // Import the validation function
    const { isOriginAllowed, validateOriginStructure } = await import('../middleware/cors.enhanced');

    // Validate origin structure
    if (!validateOriginStructure(origin)) {
      throw ApiError.validationError('Invalid origin format', [
        {
          field: 'origin',
          constraint: 'format',
          message: 'Origin must be a valid URL without path',
        },
      ]);
    }

    // Check if origin is allowed
    const allowed = isOriginAllowed(origin);

    logger.info('CORS origin test performed', {
      admin: (req as any).user.id,
      origin,
      allowed: !!allowed,
      pattern: allowed?.description,
    });

    res.json({
      success: true,
      data: {
        origin,
        allowed: !!allowed,
        pattern: allowed?.description || null,
        allowCredentials: allowed?.allowCredentials || false,
        testedAt: new Date().toISOString(),
      },
    });
  })
);

/**
 * Get CORS request statistics (admin only)
 */
router.get('/stats',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { startTime, endTime } = req.query;

    // This would typically query from a metrics database
    // For now, return mock data structure
    const stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      uniqueOrigins: [],
      topOrigins: [],
      blockedOrigins: [],
      byHour: {},
    };

    res.json({
      success: true,
      data: {
        stats,
        period: {
          start: startTime || new Date(Date.now() - 86400000).toISOString(),
          end: endTime || new Date().toISOString(),
        },
      },
    });
  })
);

export default router;