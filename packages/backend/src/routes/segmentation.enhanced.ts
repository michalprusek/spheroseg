import express, { Request, Response, Router, NextFunction } from 'express';
import type { Request as ExpressRequest } from 'express';
import { authenticate as authMiddleware, AuthenticatedRequest, optionalAuthenticate } from '../security/middleware/auth';
import { validate } from '../middleware/validationMiddleware';
import { z } from 'zod';
import logger from '../utils/logger';
import {
  getSegmentationSchema,
  triggerSegmentationSchema,
  updateSegmentationSchema,
  triggerProjectBatchSegmentationSchema,
  createSegmentationJobSchema
} from '../validators/segmentationValidators';
import { SEGMENTATION_STATUS } from '../constants/segmentationStatus';
import { broadcastSegmentationUpdate } from '../services/socketService';
import cacheService from '../services/cacheService';
import { v4 as uuidv4 } from 'uuid';

const router: Router = express.Router();

// Get services from app (injected by server.enhanced.ts)
const getServices = (req: Request) => {
  const app = req.app;
  return (app as any).scalabilityServices || {};
};

// --- Validation Schema for Batch Trigger ---
const triggerBatchSchema = z.object({
  body: z.object({
    imageIds: z
      .array(
        z.string().refine(
          (id) => {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const frontendIdRegex = /^img-\d+-\d+$/;
            return uuidRegex.test(id) || frontendIdRegex.test(id);
          },
          { message: 'Invalid image ID format in array' }
        )
      )
      .min(1, 'At least one image ID is required'),
  }),
});

// GET /api/images/:id/segmentation - Get segmentation result for an image
router.get(
  '/images/:id/segmentation',
  authMiddleware,
  validate(getSegmentationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const imageId = req.params.id;
    const { dbPool } = getServices(req);

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user has access to the image via project ownership
      const imageCheck = await dbPool.query(
        'SELECT i.id, i.width, i.height, i.segmentation_status FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId]
      );
      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found or access denied' });
        return;
      }

      const imageInfo = imageCheck.rows[0];

      // Fetch segmentation result
      const result = await dbPool.query('SELECT * FROM segmentation_results WHERE image_id = $1', [
        imageId,
      ]);

      if (result.rows.length === 0) {
        const imageStatus =
          imageInfo.segmentation_status || SEGMENTATION_STATUS.WITHOUT_SEGMENTATION;

        const emptyResult = {
          image_id: imageId,
          status: imageStatus,
          result_data: {
            polygons: [],
          },
          polygons: [],
          imageWidth: imageInfo.width,
          imageHeight: imageInfo.height,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        res.status(200).json(emptyResult);
        return;
      }

      // Format the result
      const segmentationResult = result.rows[0];

      // Use the status from the images table if it's more up-to-date
      if (imageInfo.segmentation_status) {
        segmentationResult.status = imageInfo.segmentation_status;
      }

      // Ensure polygons are available in the expected format
      if (segmentationResult.result_data && segmentationResult.result_data.polygons) {
        segmentationResult.polygons = segmentationResult.result_data.polygons;
      } else if (!segmentationResult.polygons) {
        segmentationResult.polygons = [];
      }

      // Add image dimensions to the result
      segmentationResult.imageWidth = imageInfo.width;
      segmentationResult.imageHeight = imageInfo.height;

      res.status(200).json(segmentationResult);
    } catch (error) {
      console.error('Error fetching segmentation result:', error);
      next(error);
    }
  }
);

// --- Validation Schema for Single Image Segmentation with Priority ---
const triggerSingleWithPrioritySchema = z.object({
  body: z.object({
    parameters: z.object({}).passthrough().optional(),
    priority: z.number().int().min(0).max(10).optional().default(1),
  }),
});

// POST /api/images/:id/segmentation - Trigger segmentation process for an image
router.post(
  '/images/:id/segmentation',
  authMiddleware,
  validate(triggerSingleWithPrioritySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const imageId = req.params.id;
    const segmentationParams = req.body.parameters || {};
    const priority = req.body.priority || 1;
    const { dbPool, queueService } = getServices(req);

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    let imageCheck;
    try {
      // Verify user has access to the image
      imageCheck = await dbPool.query(
        'SELECT i.id, i.storage_path, i.project_id, p.user_id, u.subscription_tier FROM images i JOIN projects p ON i.project_id = p.id JOIN users u ON p.user_id = u.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId]
      );
      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found or access denied' });
        return;
      }
      
      const { storage_path: imagePath, subscription_tier } = imageCheck.rows[0];
      
      // Ensure the user_id matches
      if (imageCheck.rows[0].user_id !== userId) {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      // Generate task ID
      const taskId = uuidv4();

      // Start transaction to update statuses
      await dbPool.transaction(async (client) => {
        // Update image status to 'queued'
        await client.query(
          `UPDATE images SET segmentation_status = $1, updated_at = NOW() WHERE id = $2`,
          [SEGMENTATION_STATUS.QUEUED, imageId]
        );

        // Create or update segmentation_results entry
        await client.query(
          `INSERT INTO segmentation_results (image_id, status, parameters)
           VALUES ($1, $2, $3)
           ON CONFLICT (image_id) DO UPDATE 
           SET status = $2, parameters = $3, updated_at = NOW()`,
          [imageId, SEGMENTATION_STATUS.QUEUED, { ...segmentationParams, priority }]
        );

        // Create segmentation task record
        await client.query(
          `INSERT INTO segmentation_tasks (task_id, image_id, task_status, parameters, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [taskId, imageId, SEGMENTATION_STATUS.QUEUED, segmentationParams]
        );
      });

      // Add job to Bull queue
      const job = await queueService.addSegmentationJob({
        taskId,
        imageId: parseInt(imageId),
        imagePath,
        userId,
        priority: subscription_tier === 'premium' ? Math.max(priority, 5) : priority,
      });

      // Track job in database
      await dbPool.query(
        `INSERT INTO queue_jobs (job_id, task_id, image_id, user_id, status, priority)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [job.id, taskId, imageId, userId, 'queued', priority]
      );

      // Broadcast the status update
      const projectId = imageCheck.rows[0].project_id;
      
      // Invalidate image list cache
      try {
        await cacheService.invalidateImageList(projectId);
        logger.info('Invalidated image list cache for project after triggering segmentation', { projectId });
      } catch (cacheError) {
        logger.error('Failed to invalidate image list cache', { projectId, error: cacheError });
      }
      
      broadcastSegmentationUpdate(projectId, imageId, SEGMENTATION_STATUS.QUEUED);

      // Get current queue status
      const queueMetrics = await queueService.getQueueMetrics();

      res.status(202).json({
        message: 'Segmentation process queued',
        taskId,
        jobId: job.id,
        queueStatus: {
          position: queueMetrics.waiting + 1,
          waiting: queueMetrics.waiting,
          active: queueMetrics.active,
        },
      });
    } catch (error) {
      console.error('Error triggering segmentation:', error);
      
      // Attempt to revert status if triggering failed
      try {
        await dbPool.query(
          `UPDATE images SET segmentation_status = $1, updated_at = NOW() WHERE id = $2`,
          [SEGMENTATION_STATUS.FAILED, imageId]
        );
        await dbPool.query(
          `UPDATE segmentation_results SET status = $1, updated_at = NOW() WHERE image_id = $2`,
          [SEGMENTATION_STATUS.FAILED, imageId]
        );

        // Broadcast the failure
        const projectId = imageCheck?.rows[0]?.project_id;
        broadcastSegmentationUpdate(
          projectId,
          imageId,
          SEGMENTATION_STATUS.FAILED,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      } catch (revertError) {
        console.error('Failed to revert status after trigger error:', revertError);
      }
      next(error);
    }
  }
);

// --- Validation Schema for Batch Trigger with Priority ---
const triggerBatchWithPrioritySchema = z.object({
  body: z
    .object({
      imageIds: z
        .array(
          z.string().refine(
            (id) => {
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              const frontendIdRegex = /^img-\d+-\d+$/;
              return uuidRegex.test(id) || frontendIdRegex.test(id);
            },
            { message: 'Invalid image ID format in array' }
          )
        )
        .min(1, 'At least one image ID is required')
        .max(200, 'Maximum 200 image IDs allowed per batch'),
      priority: z.number().int().min(0).max(10).optional().default(1),
      model_type: z.string().optional(),
      parameters: z.object({}).passthrough().optional(),
    })
    .passthrough(),
});

// Shared handler function for batch segmentation
async function handleBatchSegmentation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.userId;
  const { imageIds, priority = 1, model_type, parameters = {}, ...otherParams } = req.body;
  const { dbPool, queueService } = getServices(req);

  if (!userId) {
    res.status(401).json({ message: 'Authentication error' });
    return;
  }

  logger.debug('Batch segmentation request received', {
    userId,
    imageCount: imageIds.length,
    priority,
    model_type,
    parameters,
    otherParams,
  });

  const successfullyTriggered: string[] = [];
  const failedToTrigger: { id: string; reason: string }[] = [];

  try {
    // Verify ownership and get paths for all requested images in one query
    const imagesCheckQuery = `
      SELECT i.id, i.storage_path, i.project_id, p.user_id, u.subscription_tier
      FROM images i
      JOIN projects p ON i.project_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE i.id = ANY($1) AND p.user_id = $2
    `;
    const imagesCheck = await dbPool.query(imagesCheckQuery, [imageIds, userId]);

    if (imagesCheck.rows.length === 0) {
      res.status(404).json({ message: 'No images found or access denied' });
      return;
    }

    const foundImageIds = imagesCheck.rows.map((row: any) => row.id);
    const notFoundIds = imageIds.filter((id: string) => !foundImageIds.includes(id));

    // Add not found images to failed list
    notFoundIds.forEach((id: string) => {
      failedToTrigger.push({ id, reason: 'Image not found or access denied' });
    });

    const subscription_tier = imagesCheck.rows[0]?.subscription_tier || 'free';
    const adjustedPriority = subscription_tier === 'premium' ? Math.max(priority, 5) : priority;

    // Process found images
    for (const imageRow of imagesCheck.rows) {
      const { id: imageId, storage_path: imagePath, project_id: projectId } = imageRow;

      try {
        const taskId = uuidv4();

        // Start transaction to update statuses
        await dbPool.transaction(async (client) => {
          // Update image status
          await client.query(
            `UPDATE images SET segmentation_status = $1, updated_at = NOW() WHERE id = $2`,
            [SEGMENTATION_STATUS.QUEUED, imageId]
          );

          // Create or update segmentation_results entry
          await client.query(
            `INSERT INTO segmentation_results (image_id, status, parameters)
             VALUES ($1, $2, $3)
             ON CONFLICT (image_id) DO UPDATE 
             SET status = $2, parameters = $3, updated_at = NOW()`,
            [imageId, SEGMENTATION_STATUS.QUEUED, { ...parameters, priority: adjustedPriority, model_type }]
          );

          // Create segmentation task record
          await client.query(
            `INSERT INTO segmentation_tasks (task_id, image_id, task_status, parameters, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [taskId, imageId, SEGMENTATION_STATUS.QUEUED, { ...parameters, model_type }]
          );
        });

        // Add job to Bull queue
        const job = await queueService.addSegmentationJob({
          taskId,
          imageId: parseInt(imageId),
          imagePath,
          userId,
          priority: adjustedPriority,
        });

        // Track job in database
        await dbPool.query(
          `INSERT INTO queue_jobs (job_id, task_id, image_id, user_id, status, priority)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [job.id, taskId, imageId, userId, 'queued', adjustedPriority]
        );

        successfullyTriggered.push(imageId);

        // Broadcast status update
        broadcastSegmentationUpdate(projectId, imageId, SEGMENTATION_STATUS.QUEUED);
      } catch (imageError) {
        logger.error('Failed to trigger segmentation for image', {
          imageId,
          error: imageError,
        });
        failedToTrigger.push({
          id: imageId,
          reason: imageError instanceof Error ? imageError.message : 'Unknown error',
        });
      }
    }

    // Invalidate cache for affected projects
    const projectIds = [...new Set(imagesCheck.rows.map((row: any) => row.project_id))];
    for (const projectId of projectIds) {
      try {
        await cacheService.invalidateImageList(projectId);
      } catch (cacheError) {
        logger.error('Failed to invalidate cache for project', { projectId, error: cacheError });
      }
    }

    // Get queue status
    const queueMetrics = await queueService.getQueueMetrics();

    res.status(202).json({
      message: `Batch segmentation triggered for ${successfullyTriggered.length} images`,
      successfullyTriggered,
      failedToTrigger,
      queueStatus: {
        waiting: queueMetrics.waiting,
        active: queueMetrics.active,
      },
    });
  } catch (error) {
    logger.error('Error in batch segmentation:', error);
    next(error);
  }
}

// POST /api/images/batch/segmentation - Trigger segmentation for multiple images
router.post(
  '/images/batch/segmentation',
  authMiddleware,
  validate(triggerBatchWithPrioritySchema),
  handleBatchSegmentation
);

// GET /api/segmentation/queue/status - Get queue status
router.get(
  '/segmentation/queue/status',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { queueService } = getServices(req);
    
    try {
      const metrics = await queueService.getQueueMetrics();
      const circuitBreakerStatus = (req.app as any).scalabilityServices?.mlCircuitBreaker?.getStats();

      res.status(200).json({
        queue: {
          waiting: metrics.waiting,
          active: metrics.active,
          completed: metrics.completed,
          failed: metrics.failed,
          delayed: metrics.delayed,
          paused: metrics.isPaused,
        },
        circuitBreaker: circuitBreakerStatus || { state: 'UNKNOWN' },
      });
    } catch (error) {
      logger.error('Error getting queue status:', error);
      next(error);
    }
  }
);

// GET /api/segmentation/job/:jobId - Get specific job status
router.get(
  '/segmentation/job/:jobId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const jobId = req.params.jobId;
    const { dbPool, queueService } = getServices(req);

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user owns this job
      const jobCheck = await dbPool.query(
        'SELECT * FROM queue_jobs WHERE job_id = $1 AND user_id = $2',
        [jobId, userId]
      );

      if (jobCheck.rows.length === 0) {
        res.status(404).json({ message: 'Job not found or access denied' });
        return;
      }

      // Get job status from Bull
      const jobStatus = await queueService.getJobStatus(jobId);

      if (!jobStatus) {
        res.status(404).json({ message: 'Job not found in queue' });
        return;
      }

      res.status(200).json({
        jobId,
        status: jobCheck.rows[0].status,
        progress: jobStatus.progress,
        isCompleted: jobStatus.isCompleted,
        isFailed: jobStatus.isFailed,
        failedReason: jobStatus.failedReason,
        createdAt: jobCheck.rows[0].created_at,
        updatedAt: jobCheck.rows[0].updated_at,
      });
    } catch (error) {
      logger.error('Error getting job status:', error);
      next(error);
    }
  }
);

export default router;