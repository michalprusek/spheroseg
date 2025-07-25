import express, { Request, Response, Router, NextFunction } from 'express';
import type { Request as ExpressRequest } from 'express';
import pool from '../db';
import { authenticate as authMiddleware, AuthenticatedRequest, optionalAuthenticate } from '../security/middleware/auth';
import {
  triggerSegmentationTask,
  getSegmentationQueueStatus,
  cancelSegmentationTask,
} from '../services/segmentationService';
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

const router: Router = express.Router();

// --- Validation Schema for Batch Trigger ---
const triggerBatchSchema = z.object({
  body: z.object({
    imageIds: z
      .array(
        z.string().refine(
          (id) => {
            // Accept either UUID format or frontend-generated format (img-timestamp-random)
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
// -----------------------------------------

// GET /api/images/:id/segmentation - Get segmentation result for an image
// This endpoint returns the segmentation status from the images table to ensure consistency
// with the image list view. The segmentation_results table may have stale status.
// @ts-ignore // TS2769: No overload matches this call.
router.get(
  '/images/:id/segmentation',
  authMiddleware,
  validate(getSegmentationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const imageId = req.params.id;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user has access to the image via project ownership and fetch image dimensions AND segmentation_status
      const imageCheck = await pool.query(
        'SELECT i.id, i.width, i.height, i.segmentation_status FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId]
      );
      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found or access denied' });
        return;
      }

      const imageInfo = imageCheck.rows[0];

      // Fetch segmentation result
      const result = await pool.query('SELECT * FROM segmentation_results WHERE image_id = $1', [
        imageId,
      ]);

      if (result.rows.length === 0) {
        // If no segmentation result found, check the image's segmentation_status
        // Use the status from the images table if available
        const imageStatus =
          imageInfo.segmentation_status || SEGMENTATION_STATUS.WITHOUT_SEGMENTATION;

        const emptyResult = {
          image_id: imageId,
          status: imageStatus, // Use the status from images table
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
      // This handles cases where the segmentation_results table might have stale status
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
// @ts-ignore // TS2769: No overload matches this call.
router.post(
  '/images/:id/segmentation',
  authMiddleware,
  validate(triggerSingleWithPrioritySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const imageId = req.params.id;
    // Get parameters and priority from request body
    const segmentationParams = req.body.parameters || {};
    const priority = req.body.priority || 1;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    let imageCheck;
    try {
      // Verify user has access to the image
      imageCheck = await pool.query(
        'SELECT i.id, i.storage_path, i.project_id, p.user_id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId]
      );
      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found or access denied' });
        return;
      }
      const { storage_path: imagePath } = imageCheck.rows[0];
      // Ensure the user_id matches (redundant check due to query, but safe)
      if (imageCheck.rows[0].user_id !== userId) {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      // Update image status to 'queued' in the database
      await pool.query(
        `UPDATE images SET status = '${SEGMENTATION_STATUS.QUEUED}', updated_at = NOW() WHERE id = $1`,
        [imageId]
      );
      // Also update or create segmentation_results entry
      await pool.query(
        `INSERT INTO segmentation_results (image_id, status, parameters)
              VALUES ($1, '${SEGMENTATION_STATUS.QUEUED}', $2)
              ON CONFLICT (image_id) DO UPDATE SET status = '${SEGMENTATION_STATUS.QUEUED}', parameters = $2, updated_at = NOW()`,
        [imageId, { ...segmentationParams, priority }]
      );

      // Trigger the actual segmentation task asynchronously with priority
      // No need to await, the service handles status updates internally
      triggerSegmentationTask(imageId, imagePath, segmentationParams, priority);

      // Broadcast the status update
      const projectId = imageCheck.rows[0].project_id;
      
      // Invalidate image list cache when segmentation is triggered
      try {
        await cacheService.invalidateImageList(projectId);
        logger.info('Invalidated image list cache for project after triggering segmentation', { projectId });
      } catch (cacheError) {
        logger.error('Failed to invalidate image list cache', { projectId, error: cacheError });
      }
      
      broadcastSegmentationUpdate(projectId, imageId, SEGMENTATION_STATUS.QUEUED);

      // Get current queue status
      const queueStatus = getSegmentationQueueStatus();

      res.status(202).json({
        message: 'Segmentation process started',
        queueStatus,
      });
    } catch (error) {
      console.error('Error triggering segmentation:', error);
      // Attempt to revert status if triggering failed
      try {
        await pool.query(
          `UPDATE images SET status = '${SEGMENTATION_STATUS.FAILED}', updated_at = NOW() WHERE id = $1`,
          [imageId]
        );
        await pool.query(
          `UPDATE segmentation_results SET status = '${SEGMENTATION_STATUS.FAILED}', updated_at = NOW() WHERE image_id = $1`,
          [imageId]
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
              // Accept either UUID format or frontend-generated format (img-timestamp-random)
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              const frontendIdRegex = /^img-\d+-\d+$/;
              return uuidRegex.test(id) || frontendIdRegex.test(id);
            },
            { message: 'Invalid image ID format in array' }
          )
        )
        .min(1, 'At least one image ID is required')
        .max(200, 'Maximum 200 image IDs allowed per batch'), // Zvýšeno na 200 pro podporu větších dávek
      priority: z.number().int().min(0).max(10).optional().default(1),
      model_type: z.string().optional(),
      parameters: z.object({}).passthrough().optional(), // Explicitně povolíme parametry pro segmentaci
    })
    .passthrough(), // Povolíme další parametry pro segmentaci
});

// Shared handler function for batch segmentation
async function handleBatchSegmentation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.userId;
  // Extrahujeme všechny parametry z těla požadavku
  const { imageIds, priority = 1, model_type, parameters = {}, ...otherParams } = req.body;

  if (!userId) {
    res.status(401).json({ message: 'Authentication error' });
    return;
  }

  // Logujeme přijaté parametry pro debugging
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
            SELECT i.id, i.storage_path
            FROM images i
            JOIN projects p ON i.project_id = p.id
            WHERE i.id = ANY($1) AND p.user_id = $2;
        `;
    const imagesCheckResult = await pool.query(imagesCheckQuery, [imageIds, userId]);

    // Logujeme počet nalezených obrázků
    logger.debug('Found images for batch segmentation', {
      requestedCount: imageIds.length,
      foundCount: imagesCheckResult.rows.length,
    });

    const foundImagesMap = new Map<string, { storage_path: string }>();
    imagesCheckResult.rows.forEach((row) =>
      foundImagesMap.set(row.id, { storage_path: row.storage_path })
    );

    const segmentationPromises: Promise<any>[] = [];

    // Připravíme kompletní parametry pro segmentaci
    const combinedParameters = {
      ...otherParams,
      ...parameters,
      priority,
      model_type: model_type || 'resunet', // Výchozí model je resunet
      threshold: parameters.threshold || 0.5, // Výchozí threshold
    };

    // Logujeme kombinované parametry
    logger.debug('Combined segmentation parameters', { combinedParameters });

    for (const imageId of imageIds) {
      const imageData = foundImagesMap.get(imageId);
      if (imageData) {
        // Update status in DB
        segmentationPromises.push(
          pool.query(
            `UPDATE images SET segmentation_status = $1, updated_at = NOW() WHERE id = $2`,
            [SEGMENTATION_STATUS.QUEUED, imageId]
          )
        );
        segmentationPromises.push(
          pool.query(
            `INSERT INTO segmentation_results (image_id, status, parameters) VALUES ($1, $2, $3)
                          ON CONFLICT (image_id) DO UPDATE SET status = $2, parameters = $3, updated_at = NOW()`,
            [imageId, SEGMENTATION_STATUS.QUEUED, combinedParameters] // Použijeme kompletní parametry
          )
        );
        // Trigger task asynchronously with priority and other parameters
        triggerSegmentationTask(imageId, imageData.storage_path, combinedParameters, priority);
        successfullyTriggered.push(imageId);
      } else {
        failedToTrigger.push({
          id: imageId,
          reason: 'Not found or access denied',
        });
      }
    }

    // Wait for all DB updates to finish (optional, but safer)
    await Promise.all(segmentationPromises);

    // Get project IDs for successfully triggered images and broadcast updates
    try {
      const projectQuery = await pool.query(
        'SELECT DISTINCT project_id FROM images WHERE id = ANY($1)',
        [successfullyTriggered]
      );

      // Broadcast status updates for each project and invalidate cache
      for (const row of projectQuery.rows) {
        const projectId = row.project_id;
        
        // Invalidate image list cache for this project
        try {
          await cacheService.invalidateImageList(projectId);
          logger.info('Invalidated image list cache for project after batch segmentation', { projectId });
        } catch (cacheError) {
          logger.error('Failed to invalidate image list cache', { projectId, error: cacheError });
        }
        
        for (const imageId of successfullyTriggered) {
          broadcastSegmentationUpdate(projectId, imageId, SEGMENTATION_STATUS.QUEUED);
        }
      }
    } catch (broadcastError) {
      logger.error('Error broadcasting batch segmentation updates:', { error: broadcastError });
    }

    // Get current queue status
    const queueStatus = getSegmentationQueueStatus();

    // Logujeme výsledek
    logger.info('Batch segmentation triggered', {
      successCount: successfullyTriggered.length,
      failCount: failedToTrigger.length,
    });

    res.status(202).json({
      message: `Segmentation triggered for ${successfullyTriggered.length} image(s).`,
      triggered: successfullyTriggered,
      failed: failedToTrigger,
      queueStatus,
    });
  } catch (error) {
    logger.error('Error triggering batch segmentation:', { error });
    next(error);
  }
}

// Middleware that allows internal requests from ML service
const authOrInternalMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Log request details for debugging
  logger.info('Auth middleware check', {
    ip: req.ip,
    hostname: req.hostname,
    userAgent: req.headers['user-agent'],
    xForwardedFor: req.headers['x-forwarded-for'],
    xRealIp: req.headers['x-real-ip'],
  });

  // Check if request is from ML service (internal)
  const isInternalRequest =
    req.headers['user-agent']?.includes('python-requests') ||
    req.ip?.includes('172.') || // Docker network
    req.hostname === 'ml' ||
    req.ip === '172.22.0.5' || // ML service IP (old)
    req.ip === '172.22.0.6' || // ML service IP (current)
    req.ip === '::ffff:172.22.0.5' ||
    req.ip === '::ffff:172.22.0.6' ||
    req.headers['x-forwarded-for']?.includes('172.22.0.5') ||
    req.headers['x-forwarded-for']?.includes('172.22.0.6');

  if (isInternalRequest) {
    logger.info('Internal request detected, skipping auth');
    // Skip auth for internal requests
    next();
  } else {
    // Use normal auth for external requests
    authMiddleware(req, res, next);
  }
};

// PUT /api/images/:id/segmentation - Update segmentation result (e.g., after manual edit or completion)
// This might be called by the segmentation service itself upon completion, or by the frontend after editing.
// @ts-ignore // TS2769: No overload matches this call.
router.put(
  '/images/:id/segmentation',
  authOrInternalMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Log incoming request first
    logger.info('PUT /images/:id/segmentation raw request', {
      params: req.params,
      body: req.body,
      headers: req.headers,
    });

    // Manual validation to catch the exact error
    try {
      updateSegmentationSchema.parse({ params: req.params, body: req.body });
    } catch (validationError) {
      logger.error('Validation error in PUT segmentation', {
        error: validationError instanceof Error ? validationError.message : String(validationError),
        body: req.body,
      });
      res.status(400).json({
        message: 'Validation error',
        error: validationError instanceof Error ? validationError.message : String(validationError),
      });
      return;
    }
    const imageId = req.params.id;
    const { result_data, status, parameters } = req.body; // Expecting segmentation result and status

    // Check if request is from ML service (internal) or user (needs auth)
    const isInternalRequest =
      req.headers['user-agent']?.includes('python-requests') ||
      req.ip?.includes('172.') || // Docker network
      req.hostname === 'ml';

    // Get userId from authenticated request
    const userId = req.user?.userId;

    // For non-internal requests, require authentication
    if (!isInternalRequest && !userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }
    if (!status || ![SEGMENTATION_STATUS.COMPLETED, SEGMENTATION_STATUS.FAILED].includes(status)) {
      res.status(400).json({
        message: 'Invalid status provided. Must be completed or failed.',
      });
      return;
    }
    if (status === SEGMENTATION_STATUS.COMPLETED && !result_data) {
      res.status(400).json({ message: 'Result data is required for completed status' });
      return;
    }

    try {
      logger.info('Processing segmentation update', {
        imageId,
        status,
        isInternalRequest,
        userId,
        hasResultData: !!result_data,
        resultDataKeys: result_data ? Object.keys(result_data) : [],
      });

      // Verify permissions
      if (userId) {
        // For user requests, verify user has access to the image
        const imageCheck = await pool.query(
          'SELECT i.id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
          [imageId, userId]
        );
        if (imageCheck.rows.length === 0) {
          res.status(404).json({ message: 'Image not found or access denied' });
          return;
        }
      } else {
        // For internal requests, just verify image exists
        const imageCheck = await pool.query('SELECT id FROM images WHERE id = $1', [imageId]);
        if (imageCheck.rows.length === 0) {
          res.status(404).json({ message: 'Image not found' });
          return;
        }
      }

      // Update segmentation result and status
      const updateResult = await pool.query(
        `UPDATE segmentation_results
             SET result_data = $1, status = $2, parameters = COALESCE($3, parameters), updated_at = NOW()
             WHERE image_id = $4
             RETURNING *`,
        [result_data || null, status, parameters, imageId]
      );

      // Also update the main image status
      await pool.query(
        'UPDATE images SET segmentation_status = $1, updated_at = NOW() WHERE id = $2',
        [status, imageId]
      );

      // Update the segmentation task status if it exists
      if (status === SEGMENTATION_STATUS.COMPLETED || status === SEGMENTATION_STATUS.FAILED) {
        const taskUpdateResult = await pool.query(
          `UPDATE segmentation_tasks 
           SET status = $1::task_status, 
               completed_at = NOW(), 
               updated_at = NOW(),
               result = CASE WHEN $1 = 'completed' THEN $2::jsonb ELSE NULL END,
               error = CASE WHEN $1 = 'failed' THEN $3 ELSE NULL END
           WHERE image_id = $4 AND status IN ('queued', 'processing')
           RETURNING id`,
          [
            status,
            result_data || null,
            status === SEGMENTATION_STATUS.FAILED ? 'Segmentation failed' : null,
            imageId,
          ]
        );

        if (taskUpdateResult.rows.length === 0) {
          logger.warn('No segmentation task found to update', {
            imageId,
            status,
            lookingForStatuses: ['queued', 'processing'],
          });

          // Check if task exists in a different status
          const existingTask = await pool.query(
            'SELECT id, status FROM segmentation_tasks WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1',
            [imageId]
          );

          if (existingTask.rows.length > 0) {
            logger.warn('Found task in different status', {
              imageId,
              taskId: existingTask.rows[0].id,
              currentStatus: existingTask.rows[0].status,
              attemptedStatus: status,
            });
          }
        } else {
          logger.info('Successfully updated segmentation task', {
            imageId,
            taskId: taskUpdateResult.rows[0].id,
            newStatus: status,
          });
        }

        logger.info('Updated segmentation task status', {
          imageId,
          status,
          taskUpdateResult: 'completed',
        });

        // Trigger immediate queue status update
        try {
          const segmentationQueueService = (await import('../services/segmentationQueueService'))
            .default;
          // Force an immediate queue status update
          await segmentationQueueService.forceQueueUpdate();
        } catch (queueError) {
          logger.error('Failed to trigger queue status update:', queueError);
        }
      }

      if (updateResult.rows.length === 0) {
        // This might happen if the segmentation_results record didn't exist yet for some reason
        // Maybe try an INSERT ON CONFLICT here instead or handle it differently?
        res.status(404).json({ message: 'Segmentation record not found for image' });
        return;
      }

      // Get the project ID for the image to emit to the correct room
      const projectResult = await pool.query('SELECT project_id FROM images WHERE id = $1', [
        imageId,
      ]);

      if (projectResult.rows.length > 0) {
        const projectId = projectResult.rows[0].project_id;

        // Invalidate image list cache when segmentation completes or fails
        if (status === SEGMENTATION_STATUS.COMPLETED || status === SEGMENTATION_STATUS.FAILED) {
          try {
            await cacheService.invalidateImageList(projectId);
            logger.info('Invalidated image list cache for project', { projectId });
          } catch (cacheError) {
            logger.error('Failed to invalidate image list cache', { projectId, error: cacheError });
          }
        }

        // Broadcast the segmentation update to all clients in the project room
        broadcastSegmentationUpdate(
          projectId,
          imageId,
          status,
          status === SEGMENTATION_STATUS.COMPLETED ? updateResult.rows[0].result_path : undefined,
          status === SEGMENTATION_STATUS.FAILED ? updateResult.rows[0].error : undefined
        );

        logger.info('Broadcasted segmentation update', {
          projectId,
          imageId,
          status,
        });
      }

      res.status(200).json(updateResult.rows[0]);
    } catch (error) {
      logger.error('Error updating segmentation result:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        imageId,
        status,
        isInternalRequest,
      });
      console.error('Error updating segmentation result:', error);
      next(error);
    }
  }
);

// POST /api/projects/:projectId/segmentation/batch-trigger - Trigger segmentation for all images in a project
// @ts-ignore // TS2769: No overload matches this call.
router.post(
  '/projects/:projectId/segmentation/batch-trigger',
  authMiddleware,
  validate(triggerProjectBatchSegmentationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    // projectId is now validated by the middleware
    const { projectId } = req.params as { projectId: string };
    // imageIds, priority, model_type are validated by the middleware if present in body
    const { priority, model_type, imageIds: requestedImageIds, ...otherParams } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user has access to the project
      const projectCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        res.status(404).json({ message: 'Project not found or access denied' });
        return;
      }

      let imageIds: string[] = [];

      // If specific image IDs were provided, use those
      if (requestedImageIds && Array.isArray(requestedImageIds) && requestedImageIds.length > 0) {
        // Verify that all requested images belong to this project
        const verifyImagesQuery = `
                SELECT id
                FROM images
                WHERE project_id = $1 AND id = ANY($2)
            `;
        const verifyResult = await pool.query(verifyImagesQuery, [projectId, requestedImageIds]);

        // Only use the image IDs that were verified to belong to this project
        imageIds = verifyResult.rows.map((img) => img.id);

        if (imageIds.length === 0) {
          res.status(404).json({ message: 'No valid images found for segmentation' });
          return;
        }

        if (imageIds.length < requestedImageIds.length) {
          logger.warn('Some requested images were not found in the project', {
            projectId,
            requestedCount: requestedImageIds.length,
            foundCount: imageIds.length,
          });
        }
      } else {
        // Get all images for this project
        const imagesQuery = `
                SELECT id
                FROM images
                WHERE project_id = $1
                ORDER BY created_at DESC
            `;
        const imagesResult = await pool.query(imagesQuery, [projectId]);

        if (imagesResult.rows.length === 0) {
          res.status(404).json({ message: 'No images found in this project' });
          return;
        }

        // Extract image IDs
        imageIds = imagesResult.rows.map((img) => img.id);
      }

      // Directly call the batch segmentation handler with the parameters
      req.body = {
        imageIds,
        priority,
        model_type,
      };

      // Call the batch segmentation handler
      return handleBatchSegmentation(req, res, next);
    } catch (error) {
      console.error('Error triggering batch segmentation for project:', error);
      next(error);
    }
  }
);

// GET /api/segmentation/queue - Get current segmentation queue status
// @ts-ignore // TS2769: No overload matches this call.
router.get(
  '/queue',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const queueStatus = await getSegmentationQueueStatus();

      // Logujeme stav fronty pro debugging
      logger.debug('Segmentation queue status endpoint response:', {
        pendingTasksCount: queueStatus.pendingTasks?.length || 0,
        runningTasksCount: queueStatus.runningTasks?.length || 0,
        queueLength: queueStatus.queueLength || 0,
        activeTasksCount: queueStatus.activeTasksCount || 0,
      });

      res.json(queueStatus);
    } catch (error) {
      logger.error('Error getting segmentation queue status:', error);
      next(error);
    }
  }
);

// GET /api/queue-status/:projectId - Get segmentation queue status for a specific project
// @ts-ignore // TS2769: No overload matches this call.
router.get(
  '/queue-status/:projectId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId } = req.params;

    // Logujeme požadavek pro debugging
    logger.debug('Project queue status request:', { userId, projectId });

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user has access to the project
      const projectCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        res.status(404).json({ message: 'Project not found or access denied' });
        return;
      }

      // Get queue status for this project
      const queueQuery = `
            SELECT
                COUNT(*) FILTER (WHERE st.status = '${SEGMENTATION_STATUS.QUEUED}') AS pending_count,
                COUNT(*) FILTER (WHERE st.status = '${SEGMENTATION_STATUS.PROCESSING}') AS processing_count,
                COUNT(*) FILTER (WHERE st.status = '${SEGMENTATION_STATUS.COMPLETED}') AS completed_count,
                COUNT(*) FILTER (WHERE st.status = '${SEGMENTATION_STATUS.FAILED}') AS failed_count,
                COUNT(*) AS total_count
            FROM segmentation_tasks st
            JOIN images i ON st.image_id = i.id
            WHERE i.project_id = $1
        `;
      const queueResult = await pool.query(queueQuery, [projectId]);
      const queueStats = queueResult.rows[0] || {
        pending_count: 0,
        processing_count: 0,
        completed_count: 0,
        failed_count: 0,
        total_count: 0,
      };

      // Get image segmentation status for this project
      const imageStatsQuery = `
            SELECT
                COUNT(*) FILTER (WHERE segmentation_status = '${SEGMENTATION_STATUS.QUEUED}') AS pending_count,
                COUNT(*) FILTER (WHERE segmentation_status = '${SEGMENTATION_STATUS.PROCESSING}') AS processing_count,
                COUNT(*) FILTER (WHERE segmentation_status = '${SEGMENTATION_STATUS.COMPLETED}') AS completed_count,
                COUNT(*) FILTER (WHERE segmentation_status = '${SEGMENTATION_STATUS.FAILED}') AS failed_count,
                COUNT(*) AS total_count
            FROM images
            WHERE project_id = $1
        `;
      const imageStatsResult = await pool.query(imageStatsQuery, [projectId]);
      const imageStats = imageStatsResult.rows[0] || {
        pending_count: 0,
        processing_count: 0,
        completed_count: 0,
        failed_count: 0,
        total_count: 0,
      };

      // Získáme globální stav fronty
      const globalQueueStatus = await getSegmentationQueueStatus();

      // Logujeme stav fronty pro debugging
      logger.debug('Project queue status response:', {
        projectId,
        queueStats,
        imageStats,
        pendingTasksCount: globalQueueStatus.pendingTasks?.length || 0,
        runningTasksCount: globalQueueStatus.runningTasks?.length || 0,
      });

      res.json({
        status: 'success',
        projectId,
        queue: queueStats,
        images: imageStats,
        globalQueueStatus,
      });
    } catch (error) {
      console.error('Error fetching project queue status:', error);
      next(error);
    }
  }
);

// Removed mock-queue-status endpoint - Instead, use the real queue status endpoint at /api/segmentation/queue

// GET /api/segmentation/jobs/:projectId - Get segmentation jobs for a project
// @ts-ignore // TS2769: No overload matches this call.
router.get(
  '/jobs/:projectId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement logic - verify project access, query jobs
      res.json({ message: 'Placeholder: Get jobs for project' });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/segmentation/job/:jobId - Get details of a specific segmentation job
// @ts-ignore // TS2769: No overload matches this call.
router.get(
  '/job/:jobId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement logic - verify job access, query job details
      res.json({ message: 'Placeholder: Get job details' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/segmentation/job - Create a new segmentation job
// @ts-ignore // TS2769: No overload matches this call.
router.post(
  '/job',
  authMiddleware,
  validate(createSegmentationJobSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { imageIds, priority = 1, parameters = {} } = req.body;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      logger.info('Creating segmentation job', { imageIds, priority, userId });
      
      // Import the segmentation queue service
      const segmentationQueueService = (await import('../services/segmentationQueueService')).default;
      
      // Create tasks for each image
      const taskIds = [];
      for (const imageId of imageIds) {
        // Get image details
        const imageQuery = await pool.getPool().query(
          'SELECT id, storage_path FROM images WHERE id = $1',
          [imageId]
        );
        
        if (imageQuery.rows.length === 0) {
          logger.warn('Image not found for segmentation job', { imageId });
          continue;
        }
        
        const image = imageQuery.rows[0];
        const taskId = await segmentationQueueService.addTask(
          image.id,
          image.storage_path,
          parameters,
          priority
        );
        taskIds.push(taskId);
      }
      
      logger.info('Segmentation job created', { taskIds });
      
      res.status(201).json({
        success: true,
        taskIds,
        message: `Created ${taskIds.length} segmentation tasks`
      });
    } catch (error) {
      logger.error('Error creating segmentation job', { error });
      next(error);
    }
  }
);

// DELETE /api/segmentation/job/:jobId - Delete a segmentation job
// @ts-ignore // Keep ignore for now
router.delete(
  '/job/:jobId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // ... handler code ...
  }
);

// POST /api/segmentation/:imageId/resegment - Trigger resegmentation for an image
// @ts-ignore // TS2769: No overload matches this call.
router.post(
  '/:imageId/resegment',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const imageId = req.params.imageId;
    const { project_id } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify that the image exists and user has access to it
      const imageQuery = `
            SELECT i.id, i.storage_path, i.project_id
            FROM images i
            JOIN projects p ON i.project_id = p.id
            WHERE i.id = $1 AND (p.user_id = $2 OR p.public = true)
        `;
      const imageResult = await pool.query(imageQuery, [imageId, userId]);

      if (imageResult.rows.length === 0) {
        res.status(404).json({ message: 'Image not found or access denied' });
        return;
      }

      const image = imageResult.rows[0];

      // If project_id is provided, verify it matches the image's project
      if (project_id && image.project_id !== project_id) {
        res.status(400).json({ message: 'Image does not belong to the specified project' });
        return;
      }

      logger.info(`Starting resegmentation for image ${imageId}`);

      // First, delete old segmentation results
      await pool.query('BEGIN');
      try {
        // Delete old segmentation results
        const deleteSegmentationResult = await pool.query(
          'DELETE FROM segmentation_results WHERE image_id = $1',
          [imageId]
        );
        logger.info(
          `Deleted ${deleteSegmentationResult.rowCount} segmentation results for image ${imageId}`
        );

        // Update image status to queued
        await pool.query(
          `UPDATE images SET segmentation_status = '${SEGMENTATION_STATUS.QUEUED}', updated_at = NOW() WHERE id = $1`,
          [imageId]
        );

        // Create new segmentation result entry with queued status
        await pool.query(
          `INSERT INTO segmentation_results (image_id, status, parameters)
           VALUES ($1, '${SEGMENTATION_STATUS.QUEUED}', $2)`,
          [imageId, { model_type: 'resunet', force_resegment: true }]
        );

        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }

      // Set high priority for resegmentation (5 out of 10)
      const priority = 5;

      // Add parameters for resegmentation
      const parameters = {
        model_type: 'resunet',
        force_resegment: true,
        // Add any other parameters needed for resegmentation
      };

      // Trigger the segmentation task with high priority
      await triggerSegmentationTask(imageId, image.storage_path, parameters, priority);

      // Return success response
      res.status(200).json({
        message: 'Resegmentation started successfully',
        imageId,
        status: SEGMENTATION_STATUS.QUEUED,
      });
    } catch (error) {
      console.error('Error triggering resegmentation:', error);
      next(error);
    }
  }
);

// Fetch all polygons for a specific image
// @ts-ignore // TS2769
router.get(
  '/:imageId/polygons',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const { imageId } = req.params;
    // ... existing code ...
  }
);

// Save or update polygons for a specific image
// @ts-ignore // TS2769
router.post(
  '/:imageId/polygons',
  authMiddleware,
  /* validatePolygonData, */ async (req: AuthenticatedRequest, res: Response) => {
    // TODO: Uncomment validatePolygonData when implemented
    const { imageId } = req.params;
    const { polygons } = req.body;
    // ... existing code ...
  }
);

// Clear all polygons for a specific image
// @ts-ignore // TS2769
router.delete(
  '/:imageId/polygons',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const { imageId } = req.params;
    // ... existing code ...
  }
);

// POST /api/segmentations/batch - Alternative endpoint for batch segmentation
router.post(
  '/batch',
  authMiddleware,
  validate(triggerBatchWithPrioritySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    logger.info('Batch segmentation via /api/segmentations/batch', {
      imageCount: req.body.imageIds?.length || 0,
    });
    return handleBatchSegmentation(req, res, next);
  }
);

// POST /api/projects/:projectId/segmentations/batch - Project-specific batch segmentation
router.post(
  '/projects/:projectId/segmentations/batch',
  authMiddleware,
  validate(triggerProjectBatchSegmentationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId } = req.params as { projectId: string };
    const { priority, model_type, imageIds: requestedImageIds, ...otherParams } = req.body;

    logger.info('Project batch segmentation via /api/projects/:projectId/segmentations/batch', {
      projectId,
      imageCount: requestedImageIds?.length || 0,
    });

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user has access to the project
      const projectCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        res.status(404).json({ message: 'Project not found or access denied' });
        return;
      }

      let imageIds: string[] = [];

      // If specific image IDs were provided, use those
      if (requestedImageIds && Array.isArray(requestedImageIds) && requestedImageIds.length > 0) {
        // Verify that all requested images belong to this project
        const verifyImagesQuery = `
          SELECT id
          FROM images
          WHERE project_id = $1 AND id = ANY($2)
        `;
        const verifyResult = await pool.query(verifyImagesQuery, [projectId, requestedImageIds]);

        // Only use the image IDs that were verified to belong to this project
        imageIds = verifyResult.rows.map((img) => img.id);

        if (imageIds.length === 0) {
          res.status(404).json({ message: 'No valid images found for segmentation' });
          return;
        }

        if (imageIds.length < requestedImageIds.length) {
          logger.warn('Some requested images were not found in the project', {
            projectId,
            requestedCount: requestedImageIds.length,
            foundCount: imageIds.length,
          });
        }
      } else {
        // Get all images for this project
        const imagesQuery = `
          SELECT id
          FROM images
          WHERE project_id = $1
          ORDER BY created_at DESC
        `;
        const imagesResult = await pool.query(imagesQuery, [projectId]);

        if (imagesResult.rows.length === 0) {
          res.status(404).json({ message: 'No images found in this project' });
          return;
        }

        // Extract image IDs
        imageIds = imagesResult.rows.map((img) => img.id);
      }

      // Update request body and call batch handler
      req.body = {
        imageIds,
        priority,
        model_type,
        ...otherParams,
      };

      // Call the batch segmentation handler
      return handleBatchSegmentation(req, res, next);
    } catch (error) {
      logger.error('Error triggering project batch segmentation:', error);
      next(error);
    }
  }
);

// GET /api/segmentation/queue-status - Get the current status of the segmentation queue
// @ts-ignore
router.get(
  '/queue-status',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log('GET /api/segmentation/queue-status called');
    const userId = req.user?.userId;

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

      if (runningTasks.length > 0 && userId) {
        // Query database to get image names for the running tasks
        // Only get user's images if authenticated
        const imagesQuery = await pool.query(
          `SELECT i.id, i.name, i.project_id
         FROM images i
         JOIN projects p ON i.project_id = p.id
         WHERE i.id = ANY($1::uuid[]) AND p.user_id = $2`,
          [runningTasks, userId]
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
  }
);

// GET /api/segmentation/queue-status/:projectId - Get queue status filtered by project
// @ts-ignore
router.get(
  '/queue-status/:projectId',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const projectId = req.params.projectId;

    try {
      // Verify project access if user is authenticated
      if (userId) {
        const projectCheck = await pool.query(
          'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
          [projectId, userId]
        );

        if (projectCheck.rows.length === 0) {
          res.status(404).json({ message: 'Project not found or access denied' });
          return;
        }
      }

      // Get basic queue status from segmentation service
      const queueStatus = await getSegmentationQueueStatus();
      const { runningTasks, pendingTasks } = queueStatus;

      // Get image details for running tasks, filtered by project
      // Note: runningTasks contains segmentation_task IDs, not image IDs
      let runningImagesQuery;
      if (userId) {
        // If authenticated, only show user's images
        runningImagesQuery = await pool.query(
          `SELECT DISTINCT i.id, i.name, st.id as task_id
           FROM segmentation_tasks st
           INNER JOIN images i ON st.image_id = i.id
           INNER JOIN projects p ON i.project_id = p.id
           WHERE st.id = ANY($1::uuid[]) AND i.project_id = $2 AND p.user_id = $3`,
          [runningTasks, projectId, userId]
        );
      } else {
        // If not authenticated, show all images for the project (public access)
        runningImagesQuery = await pool.query(
          `SELECT DISTINCT i.id, i.name, st.id as task_id
           FROM segmentation_tasks st
           INNER JOIN images i ON st.image_id = i.id
           WHERE st.id = ANY($1::uuid[]) AND i.project_id = $2`,
          [runningTasks, projectId]
        );
      }

      // Map the results to the expected format
      const processingImages = runningImagesQuery.rows.map((row) => ({
        id: row.id,
        name: row.name,
        projectId: projectId,
      }));

      // Get the actual running task IDs for this project
      const projectRunningTasks = runningImagesQuery.rows.map((row) => row.task_id);

      // Get queued images for this project
      // Note: pendingTasks contains segmentation_task IDs, not image IDs
      let projectQueuedTasks: string[] = [];
      let queuedImageDetails: any[] = [];
      if (pendingTasks && pendingTasks.length > 0) {
        let queuedQuery;
        if (userId) {
          // If authenticated, only show user's images
          queuedQuery = await pool.query(
            `SELECT DISTINCT i.id, i.name, st.id as task_id
             FROM segmentation_tasks st
             INNER JOIN images i ON st.image_id = i.id
             INNER JOIN projects p ON i.project_id = p.id
             WHERE st.id = ANY($1::uuid[]) AND i.project_id = $2 AND p.user_id = $3`,
            [pendingTasks, projectId, userId]
          );
        } else {
          // If not authenticated, show all images for the project (public access)
          queuedQuery = await pool.query(
            `SELECT DISTINCT i.id, i.name, st.id as task_id
             FROM segmentation_tasks st
             INNER JOIN images i ON st.image_id = i.id
             WHERE st.id = ANY($1::uuid[]) AND i.project_id = $2`,
            [pendingTasks, projectId]
          );
        }

        projectQueuedTasks = queuedQuery.rows.map((row) => row.task_id);
        queuedImageDetails = queuedQuery.rows.map((row) => ({
          id: row.id,
          name: row.name,
          projectId: projectId,
        }));
      }

      // Return project-specific queue status
      res.status(200).json({
        queueLength: projectQueuedTasks.length,
        runningTasks: projectRunningTasks, // Use the filtered task IDs
        queuedTasks: projectQueuedTasks,
        pendingTasks: projectQueuedTasks, // Include both for compatibility
        processingImages,
        queuedImages: queuedImageDetails, // Include queued image details
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
  }
);

// GET /api/segmentation/queue - Get the current segmentation queue
// @ts-ignore
router.get(
  '/queue',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log('GET /api/segmentation/queue called');
    const userId = req.user?.userId;

    try {
      // Get basic queue status from segmentation service
      const queueStatus = await getSegmentationQueueStatus();

      // Return queue status
      res.status(200).json({
        success: true,
        data: queueStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting segmentation queue status:', error);
      res.status(200).json({
        success: true,
        data: {
          queueLength: 0,
          runningTasks: [],
          pendingTasks: [],
          mlServiceStatus: 'offline',
          lastUpdated: new Date(),
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// DELETE /api/segmentation/task/:imageId - Cancel a segmentation task
router.delete(
  '/task/:imageId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { imageId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // First check if the user owns this image
      const imageCheck = await pool.query('SELECT id FROM images WHERE id = $1 AND user_id = $2', [
        imageId,
        userId,
      ]);

      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found or access denied' });
        return;
      }

      // Cancel the segmentation task
      const cancelled = await cancelSegmentationTask(imageId);

      if (cancelled) {
        // Update image status to without_segmentation
        await pool.query(
          `UPDATE images SET segmentation_status = '${SEGMENTATION_STATUS.WITHOUT_SEGMENTATION}', updated_at = NOW() WHERE id = $1`,
          [imageId]
        );

        // Delete any queued/processing segmentation results
        await pool.query(
          `DELETE FROM segmentation_results WHERE image_id = $1 AND status IN ('queued', 'processing')`,
          [imageId]
        );

        res.status(200).json({
          success: true,
          message: 'Segmentation task cancelled successfully',
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Task not found in queue',
        });
      }
    } catch (error) {
      console.error('Error cancelling segmentation task:', error);
      next(error);
    }
  }
);

export default router;
