/**
 * Diagnostics Routes
 *
 * Provides endpoints for system diagnostics and health checks
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import {
  checkProjectConsistency,
  fixProjectConsistency,
  getProjectStatusBreakdown,
  verifyRecentUploads,
} from '../utils/dbConsistencyCheck';
import logger from '../utils/logger';
import { diagnosticsLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting to all diagnostic routes
router.use(diagnosticsLimiter);

/**
 * GET /api/diagnostics/project/:projectId/consistency
 * Check database consistency for a specific project
 */
router.get(
  '/project/:projectId/consistency',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.userId;

      logger.info('Consistency check requested', { projectId, userId });

      // Verify user has access to the project
      const { getPool } = await import('../db');
      const pool = getPool();
      const projectCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      const report = await checkProjectConsistency(projectId);
      const statusBreakdown = await getProjectStatusBreakdown(projectId);
      const recentUploads = await verifyRecentUploads(projectId);

      res.json({
        consistency: report,
        statusBreakdown,
        recentUploads,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error performing consistency check', { error });
      next(error);
    }
  }
);

/**
 * POST /api/diagnostics/project/:projectId/fix-consistency
 * Fix database consistency issues for a project
 */
router.post(
  '/project/:projectId/fix-consistency',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const { dryRun = true } = req.body;
      const userId = req.user?.userId;

      logger.info('Consistency fix requested', { projectId, userId, dryRun });

      // Verify user has access to the project
      const { getPool } = await import('../db');
      const pool = getPool();
      const projectCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      const report = await fixProjectConsistency(projectId, dryRun);

      res.json({
        report,
        dryRun,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fixing consistency issues', { error });
      next(error);
    }
  }
);

// Health check endpoint removed - use /api/health instead
// The main health endpoint provides comprehensive system health checks

export default router;
