import express, { Request, Response, Router, NextFunction } from 'express';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getSegmentationQueueStatus, getProjectSegmentationQueueStatus } from '../services/segmentationService';
import pool from '../db';
import logger from '../utils/logger';

const router: Router = express.Router();

// GET / - Simple health check endpoint
router.get('/', (_req: Request, res: Response) => {
  logger.debug('Health check endpoint called');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// GET /check - Dedicated health check endpoint for Docker
router.get('/check', (_req: Request, res: Response) => {
  logger.debug('Docker health check endpoint called');
  res.status(200).send('OK');
});

// GET /api/queue-status - Get the current status of the segmentation queue with image details
// @ts-ignore // TODO: Define AuthenticatedRequest properly if needed
router.get('/queue-status', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log('GET /api/queue-status called');
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ message: 'Authentication error' });
    return;
  }

  try {
    // Get basic queue status from segmentation service
    const queueStatus = await getSegmentationQueueStatus();
    const { queueLength, runningTasks } = queueStatus;

    // Get image details for running tasks
    const processingImages: {
      id: string;
      name: string;
      projectId: string;
    }[] = [];

    if (runningTasks.length > 0) {
      // Query database to get image names for the running tasks
      const imagesQuery = await pool.query(
        `SELECT i.id, i.name, i.project_id
         FROM images i
         JOIN projects p ON i.project_id = p.id
         WHERE i.id = ANY($1::uuid[]) AND p.user_id = $2`,
        [runningTasks, userId],
      );

      // Map the results to the expected format
      for (const image of imagesQuery.rows) {
        processingImages.push({
          id: image.id,
          name: image.name,
          projectId: image.project_id,
        });
      }
    }

    // Return enhanced queue status
    res.status(200).json({
      queueLength,
      runningTasks,
      processingImages,
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    next(error);
  }
});

// GET /api/queue-status/:projectId - Get queue status filtered by project
// @ts-ignore
router.get(
  '/queue-status/:projectId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const projectId = req.params.projectId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify project access
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

      if (projectCheck.rows.length === 0) {
        res.status(404).json({ message: 'Project not found or access denied' });
        return;
      }

      // Get project-specific queue status from V2 service
      const projectQueueStatus = await getProjectSegmentationQueueStatus(projectId);

      // Return project-specific queue status with all required fields
      res.status(200).json({
        ...projectQueueStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Error fetching queue status for project ${projectId}:`, error);
      // Return empty queue status instead of error to prevent frontend from crashing
      res.status(200).json({
        queueLength: 0,
        runningTasks: [],
        queuedTasks: [],
        pendingTasks: [],
        processingImages: [],
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /api/mock-queue-status - Get mock queue status for development
// @ts-ignore
router.get(
  '/mock-queue-status',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Return mock data to demonstrate the UI during development
      // Generate some random UUIDs for demonstration
      const mockImageId1 = '123e4567-e89b-12d3-a456-426614174000';
      const mockImageId2 = '223e4567-e89b-12d3-a456-426614174001';
      const mockQueuedId1 = '323e4567-e89b-12d3-a456-426614174002';
      const mockQueuedId2 = '423e4567-e89b-12d3-a456-426614174003';

      // Return mock data
      res.json({
        queueLength: 2,
        runningTasks: [mockImageId1, mockImageId2],
        queuedTasks: [mockQueuedId1, mockQueuedId2],
        processingImages: [
          {
            id: mockImageId1,
            name: 'Sample Image 1',
            projectId: req.query.projectId || 'project-123',
          },
          {
            id: mockImageId2,
            name: 'Sample Image 2',
            projectId: 'project-456',
          },
        ],
      });
    } catch (error) {
      console.error('Error fetching mock queue status:', error);
      next(error);
    }
  },
);

// GET /api/mock-queue-status/:projectId - Get mock queue status for a specific project
// @ts-ignore
router.get(
  '/mock-queue-status/:projectId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const projectId = req.params.projectId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Return mock data specific to the requested project
      const mockImageId1 = '123e4567-e89b-12d3-a456-426614174000';
      const mockQueuedId1 = '323e4567-e89b-12d3-a456-426614174002';

      // Return mock data
      res.json({
        queueLength: 1,
        runningTasks: [mockImageId1],
        queuedTasks: [mockQueuedId1],
        processingImages: [
          {
            id: mockImageId1,
            name: `Sample Image for Project ${projectId}`,
            projectId: projectId,
          },
        ],
      });
    } catch (error) {
      console.error(`Error fetching mock queue status for project ${projectId}:`, error);
      next(error);
    }
  },
);

export default router;
