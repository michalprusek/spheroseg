import express, { Response, NextFunction } from 'express';
import { adminMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import stuckImageCleanupService from '../services/stuckImageCleanup';
import logger from '../utils/logger';

const router = express.Router();

/**
 * POST /api/admin/cleanup-stuck-images
 * Manually trigger cleanup of stuck images
 *
 * Requires authentication
 */
router.post('/cleanup-stuck-images', adminMiddleware, async (req: express.Request, res: Response, next: NextFunction) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    logger.info('Manual stuck image cleanup triggered', { userId: authenticatedReq.user?.userId });

    const count = await stuckImageCleanupService.forceCleanup();

    res.json({
      success: true,
      message: `Cleanup completed. Found and fixed ${count} stuck images.`,
      fixedCount: count,
    });
  } catch (error) {
    logger.error('Error during manual stuck image cleanup:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    next(error);
  }
});

export default router;
