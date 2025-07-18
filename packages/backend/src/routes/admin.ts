import express from 'express';
import { requireAdmin } from '../security/middleware/auth';
import stuckImageCleanupService from '../services/stuckImageCleanup';
import logger from '../utils/logger';

const router = express.Router();

/**
 * POST /api/admin/cleanup-stuck-images
 * Manually trigger cleanup of stuck images
 *
 * Requires authentication
 */
router.post('/cleanup-stuck-images', requireAdmin, async (req, res, next) => {
  try {
    logger.info('Manual stuck image cleanup triggered', { userId: req.user?.userId });

    const count = await stuckImageCleanupService.forceCleanup();

    res.json({
      success: true,
      message: `Cleanup completed. Found and fixed ${count} stuck images.`,
      fixedCount: count,
    });
  } catch (error) {
    logger.error('Error during manual stuck image cleanup:', error);
    next(error);
  }
});

export default router;
