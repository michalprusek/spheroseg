import express, { Response, Router } from 'express';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import userStatsService from '../services/userStatsService';
import pool from '../db';
import logger from '../utils/logger';

const router: Router = express.Router();

// GET /api/debug/stats - Debug endpoint for user statistics
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    logger.info('Debug: Fetching stats for user', { userId });

    // Get stats from service
    const stats = await userStatsService.getUserStats(pool, userId);
    
    // Get raw counts from database
    const projectsRes = await pool.query(
      'SELECT COUNT(*) as count FROM projects WHERE user_id = $1',
      [userId]
    );
    
    const imagesRes = await pool.query(
      'SELECT COUNT(*) as count FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
      [userId]
    );
    
    const completedRes = await pool.query(
      'SELECT COUNT(*) as count FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.segmentation_status = $2',
      [userId, 'completed']
    );
    
    const storageRes = await pool.query(
      'SELECT SUM(file_size) as sum FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
      [userId]
    );

    res.status(200).json({
      debug: true,
      userId,
      serviceStats: stats,
      rawCounts: {
        projects: parseInt(projectsRes.rows[0].count, 10),
        images: parseInt(imagesRes.rows[0].count, 10),
        completed: parseInt(completedRes.rows[0].count, 10),
        storageBytes: storageRes.rows[0].sum || 0,
        storageMB: storageRes.rows[0].sum ? (Number(storageRes.rows[0].sum) / (1024 * 1024)).toFixed(2) : '0.00',
      },
      apiResponse: {
        totalProjects: stats.totalProjects,
        totalImages: stats.totalImages,
        completedSegmentations: stats.completedSegmentations,
        storageUsedMB: stats.storageUsedBytes ? Math.round((Number(stats.storageUsedBytes) / (1024 * 1024)) * 100) / 100 : 0,
      }
    });
  } catch (error) {
    logger.error('Debug: Error fetching user stats', { error, userId });
    res.status(500).json({ message: 'Failed to fetch debug statistics', error: error.message });
  }
});

export default router;