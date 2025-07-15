import express, { Response, Router } from 'express';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import { userStatsLimiter } from '../security/middleware/rateLimitMiddleware';
import userStatsService from '../services/userStatsService';
import { userStatsServiceOptimized } from '../services/userStatsServiceOptimized';
import pool from '../db';
import logger from '../utils/logger';

const router: Router = express.Router();

// GET /api/users/me/stats - Get basic statistics for the current user
router.get(
  '/me/stats',
  authMiddleware,
  userStatsLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      logger.info('Fetching stats for user', { userId });

      // Get stats from optimized service
      const stats = await userStatsServiceOptimized.getUserStats(pool, userId);

      // Return stats with both new format and old format keys for compatibility
      res.status(200).json({
        // New format property names
        totalProjects: stats.totalProjects,
        totalImages: stats.totalImages,
        completedSegmentations: stats.completedSegmentations,
        storageUsedBytes: stats.storageUsedBytes.toString(),
        storageLimitBytes: stats.storageLimitBytes.toString(),
        storageUsedMB:
          Number(stats.storageUsedBytes) > 0
            ? Math.round((Number(stats.storageUsedBytes) / (1024 * 1024)) * 100) / 100
            : 0.01, // Use a small non-zero value if no storage used
        recentActivity: stats.recentActivity,
        recentProjects: stats.recentProjects,
        recentImages: stats.recentImages,
        comparisons: {
          projectsThisMonth: stats.projectsThisMonth,
          projectsLastMonth: stats.projectsLastMonth,
          projectsChange: stats.projectsThisMonth - stats.projectsLastMonth,
          imagesThisMonth: stats.imagesThisMonth,
          imagesLastMonth: stats.imagesLastMonth,
          imagesChange: stats.imagesThisMonth - stats.imagesLastMonth,
        },

        // Old format property names for compatibility
        projects_count: stats.totalProjects,
        images_count: stats.totalImages,
        segmentations_count: stats.completedSegmentations,
        storage_used_mb:
          Number(stats.storageUsedBytes) > 0
            ? Math.round((Number(stats.storageUsedBytes) / (1024 * 1024)) * 100) / 100
            : 0.01, // Use a small non-zero value if no storage used
        storage_used_bytes: stats.storageUsedBytes.toString(),
        storage_limit_bytes: stats.storageLimitBytes.toString(),
        last_login: new Date().toISOString(),
        recent_activity: stats.recentActivity,
        recent_projects: stats.recentProjects,
        recent_images: stats.recentImages,
        projects_this_month: stats.projectsThisMonth,
        projects_last_month: stats.projectsLastMonth,
        projects_change: stats.projectsThisMonth - stats.projectsLastMonth,
        images_this_month: stats.imagesThisMonth,
        images_last_month: stats.imagesLastMonth,
        images_change: stats.imagesThisMonth - stats.imagesLastMonth,
      });
    } catch (error) {
      logger.error('Error fetching user stats', { error, userId });
      res.status(500).json({ message: 'Failed to fetch user statistics' });
    }
  }
);

// GET /api/users/me/statistics - Alias for /api/users/me/stats
router.get(
  '/me/statistics',
  authMiddleware,
  userStatsLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      logger.info('Fetching statistics for user', { userId });

      // Get stats from optimized service
      const stats = await userStatsServiceOptimized.getUserStats(pool, userId);

      // Return stats with both new format and old format keys for compatibility
      res.status(200).json({
        // New format property names
        totalProjects: stats.totalProjects,
        totalImages: stats.totalImages,
        completedSegmentations: stats.completedSegmentations,
        storageUsedBytes: stats.storageUsedBytes.toString(),
        storageLimitBytes: stats.storageLimitBytes.toString(),
        storageUsedMB:
          Number(stats.storageUsedBytes) > 0
            ? Math.round((Number(stats.storageUsedBytes) / (1024 * 1024)) * 100) / 100
            : 0.01, // Use a small non-zero value if no storage used
        recentActivity: stats.recentActivity,
        recentProjects: stats.recentProjects,
        recentImages: stats.recentImages,
        comparisons: {
          projectsThisMonth: stats.projectsThisMonth,
          projectsLastMonth: stats.projectsLastMonth,
          projectsChange: stats.projectsThisMonth - stats.projectsLastMonth,
          imagesThisMonth: stats.imagesThisMonth,
          imagesLastMonth: stats.imagesLastMonth,
          imagesChange: stats.imagesThisMonth - stats.imagesLastMonth,
        },

        // Old format property names for compatibility
        projects_count: stats.totalProjects,
        images_count: stats.totalImages,
        segmentations_count: stats.completedSegmentations,
        storage_used_mb:
          Number(stats.storageUsedBytes) > 0
            ? Math.round((Number(stats.storageUsedBytes) / (1024 * 1024)) * 100) / 100
            : 0.01, // Use a small non-zero value if no storage used
        storage_used_bytes: stats.storageUsedBytes.toString(),
        storage_limit_bytes: stats.storageLimitBytes.toString(),
        last_login: new Date().toISOString(),
        recent_activity: stats.recentActivity,
        recent_projects: stats.recentProjects,
        recent_images: stats.recentImages,
        projects_this_month: stats.projectsThisMonth,
        projects_last_month: stats.projectsLastMonth,
        projects_change: stats.projectsThisMonth - stats.projectsLastMonth,
        images_this_month: stats.imagesThisMonth,
        images_last_month: stats.imagesLastMonth,
        images_change: stats.imagesThisMonth - stats.imagesLastMonth,
      });
    } catch (error) {
      logger.error('Error fetching user statistics', { error, userId });
      res.status(500).json({ message: 'Failed to fetch user statistics' });
    }
  }
);

export default router;
