/**
 * Optimized User Statistics Routes
 *
 * Enhanced user statistics endpoints using advanced database optimization,
 * intelligent caching, and performance monitoring
 */

import express, { Response, Router } from 'express';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import { getOptimizationService } from '../middleware/databaseOptimizationMiddleware';
import logger from '../utils/logger';

const router: Router = express.Router();

/**
 * GET /api/users/stats - Get comprehensive user statistics (optimized)
 */
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const startTime = Date.now();

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const optimizationService = getOptimizationService();

    if (!optimizationService) {
      return res.status(503).json({
        message: 'Optimization service not available',
        fallback: true,
      });
    }

    logger.debug('Fetching optimized user stats', { userId });

    // Get optimized user statistics
    const stats = await optimizationService.getUserStatsOptimized(userId);

    if (!stats) {
      return res.status(404).json({ message: 'User statistics not found' });
    }

    const responseTime = Date.now() - startTime;

    // Add performance metadata
    const response = {
      ...stats,
      meta: {
        responseTime,
        cached: responseTime < 50, // Likely cached if very fast
        optimized: true,
        version: 'v2',
      },
    };

    logger.info('Optimized user stats retrieved successfully', {
      userId,
      responseTime,
      totalProjects: stats.total_projects,
      totalImages: stats.total_images,
    });

    res.json(response);
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error fetching optimized user stats', {
      userId,
      responseTime,
      error: error.message,
    });

    res.status(500).json({
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/users/stats/basic - Get basic user statistics (for frequent polling)
 */
router.get('/stats/basic', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const startTime = Date.now();

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const optimizationService = getOptimizationService();

    if (!optimizationService) {
      return res.status(503).json({
        message: 'Optimization service not available',
      });
    }

    // Get basic stats from cache or optimized query
    const cacheKey = `user_stats_basic:${userId}`;
    const cached = await optimizationService['cacheService'].get(
      cacheKey,
      'HOT', // Basic stats are accessed very frequently
      async () => {
        // If not cached, get from optimized query
        const fullStats = await optimizationService.getUserStatsOptimized(userId);
        return {
          totalProjects: fullStats?.total_projects || 0,
          totalImages: fullStats?.total_images || 0,
          completedSegmentations: fullStats?.completed_segmentations || 0,
          storageUsedBytes: fullStats?.storage_used_bytes || 0,
          lastUpdated: new Date().toISOString(),
        };
      }
    );

    const responseTime = Date.now() - startTime;

    res.json({
      ...cached,
      meta: {
        responseTime,
        cached: responseTime < 20, // Very likely cached if extremely fast
        basic: true,
      },
    });
  } catch (error) {
    logger.error('Error fetching basic user stats', {
      userId,
      error: error.message,
    });

    res.status(500).json({
      message: 'Failed to fetch basic user statistics',
    });
  }
});

/**
 * GET /api/users/stats/performance - Get performance metrics for user data access
 */
router.get(
  '/stats/performance',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const optimizationService = getOptimizationService();

      if (!optimizationService) {
        return res.status(503).json({
          message: 'Optimization service not available',
        });
      }

      const metrics = optimizationService.getMetrics();
      const profile = await optimizationService.generatePerformanceProfile();

      res.json({
        performance: profile,
        metrics: {
          query: {
            totalQueries: metrics.query.totalQueries,
            averageTime: metrics.query.averageTime,
            slowQueries: metrics.query.slowQueries,
            cacheHits: metrics.query.cacheHits,
          },
          cache: {
            hitRate: metrics.cache.hitRate,
            memoryUsage: metrics.cache.memoryUsage,
            size: metrics.cache.memoryCacheSize,
            redisConnected: metrics.cache.redisConnected,
          },
        },
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching performance metrics', {
        userId,
        error: error.message,
      });

      res.status(500).json({
        message: 'Failed to fetch performance metrics',
      });
    }
  }
);

/**
 * POST /api/users/stats/invalidate - Manually invalidate user statistics cache
 */
router.post(
  '/stats/invalidate',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const optimizationService = getOptimizationService();

      if (!optimizationService) {
        return res.status(503).json({
          message: 'Optimization service not available',
        });
      }

      // Invalidate all user-related caches
      await optimizationService.invalidateRelatedCaches('user', userId);

      logger.info('User statistics cache invalidated manually', { userId });

      res.json({
        message: 'Cache invalidated successfully',
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error invalidating user stats cache', {
        userId,
        error: error.message,
      });

      res.status(500).json({
        message: 'Failed to invalidate cache',
      });
    }
  }
);

/**
 * GET /api/users/stats/health - Get database and cache health for user operations
 */
router.get('/stats/health', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const optimizationService = getOptimizationService();

    if (!optimizationService) {
      return res.status(503).json({
        message: 'Optimization service not available',
        healthy: false,
      });
    }

    const healthHistory = optimizationService.getHealthHistory();
    const latestHealth = healthHistory[healthHistory.length - 1];

    const isHealthy =
      latestHealth &&
      latestHealth.performance.averageQueryTime < 1000 &&
      latestHealth.cache.hitRate > 50 &&
      latestHealth.connectionPool.waiting < 10;

    res.json({
      healthy: isHealthy,
      current: latestHealth,
      history: healthHistory.slice(-10), // Last 10 health checks
      recommendations: latestHealth?.recommendations || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error checking user stats health', {
      error: error.message,
    });

    res.status(500).json({
      message: 'Failed to check health status',
      healthy: false,
    });
  }
});

/**
 * GET /api/users/projects/optimized - Get optimized project list with intelligent pagination
 */
router.get(
  '/projects/optimized',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const startTime = Date.now();

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const optimizationService = getOptimizationService();

      if (!optimizationService) {
        return res.status(503).json({
          message: 'Optimization service not available',
        });
      }

      // Extract query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items

      // Build filters from query parameters
      const filters: any = {};
      if (req.query.search) filters.search = req.query.search;
      if (req.query.status) filters.status = req.query.status;
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo;

      logger.debug('Fetching optimized project list', {
        userId,
        page,
        limit,
        filters,
      });

      const result = await optimizationService.getProjectListOptimized(
        userId,
        page,
        limit,
        filters
      );
      const responseTime = Date.now() - startTime;

      res.json({
        ...result,
        meta: {
          responseTime,
          cached: responseTime < 100,
          optimized: true,
          filters,
        },
      });

      logger.info('Optimized project list retrieved', {
        userId,
        page,
        totalProjects: result.total,
        responseTime,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error('Error fetching optimized project list', {
        userId,
        responseTime,
        error: error.message,
      });

      res.status(500).json({
        message: 'Failed to fetch project list',
      });
    }
  }
);

export default router;
