import express, { Request, Response, Router, NextFunction } from 'express';
import pool from '../db';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware';
import { triggerSegmentationTask, getSegmentationQueueStatus } from '../services/segmentationService';
import { validate } from '../middleware/validationMiddleware';
import { z } from 'zod';
import logger from '../utils/logger';
import {
  getSegmentationSchema,
  triggerSegmentationSchema,
  updateSegmentationSchema,
  triggerProjectBatchSegmentationSchema, // Added import
  // createSegmentationJobSchema // Commented out as it seems missing from validator file
} from '../validators/segmentationValidators';

const router: Router = express.Router();

// --- Validation Schema for Batch Trigger ---
const triggerBatchSchema = z.object({
  body: z.object({
    imageIds: z.array(z.string().uuid('Invalid image ID format in array')).min(1, 'At least one image ID is required'),
  }),
});
// -----------------------------------------

// GET /api/images/:id/segmentation - Get segmentation result for an image
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
      // Verify user has access to the image via project ownership
      const imageCheck = await pool.query(
        'SELECT i.id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId],
      );
      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found or access denied' });
        return;
      }

      // Fetch segmentation result
      const result = await pool.query('SELECT * FROM segmentation_results WHERE image_id = $1', [imageId]);

      if (result.rows.length === 0) {
        // If no segmentation result found, return an empty result instead of 404
        const emptyResult = {
          image_id: imageId,
          status: 'pending',
          result_data: {
            polygons: [],
          },
          polygons: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        res.status(200).json(emptyResult);
        return;
      }

      // Format the result
      const segmentationResult = result.rows[0];

      // Ensure polygons are available in the expected format
      if (segmentationResult.result_data && segmentationResult.result_data.polygons) {
        segmentationResult.polygons = segmentationResult.result_data.polygons;
      } else if (!segmentationResult.polygons) {
        segmentationResult.polygons = [];
      }

      res.status(200).json(segmentationResult);
    } catch (error) {
      console.error('Error fetching segmentation result:', error);
      next(error);
    }
  },
);

// GET /api/projects/:projectId/segmentations/:imageId - Get segmentation results for an image in a project
// @ts-ignore // TS2769: No overload matches this call.
router.get(
  '/projects/:projectId/segmentations/:imageId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId, imageId } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user has access to the project
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

      if (projectCheck.rows.length === 0) {
        res.status(404).json({ message: 'Project not found or access denied' });
        return;
      }

      // Verify image belongs to the project using its UUID
      const imageCheck = await pool.query('SELECT id FROM images WHERE id = $1 AND project_id = $2', [
        imageId,
        projectId,
      ]);

      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found in this project' });
        return;
      }

      // Use the actual image ID from the database for the segmentation lookup (which is just imageId now)
      const actualImageId = imageId; // Directly use the validated imageId

      // Fetch segmentation result
      const result = await pool.query('SELECT * FROM segmentation_results WHERE image_id = $1', [actualImageId]);

      if (result.rows.length === 0) {
        // If no segmentation result found, return an empty result instead of 404
        const emptyResult = {
          image_id: actualImageId,
          status: 'pending',
          result_data: {
            polygons: [],
          },
          polygons: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        res.status(200).json(emptyResult);
        return;
      }

      // Format the result
      const segmentationResult = result.rows[0];

      // Ensure polygons are available in the expected format
      if (segmentationResult.result_data && segmentationResult.result_data.polygons) {
        segmentationResult.polygons = segmentationResult.result_data.polygons;
      } else if (!segmentationResult.polygons) {
        segmentationResult.polygons = [];
      }

      res.status(200).json(segmentationResult);
    } catch (error) {
      console.error('Error fetching segmentation results:', error);
      next(error);
    }
  },
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

    try {
      // Verify user has access to the image
      const imageCheck = await pool.query(
        'SELECT i.id, i.storage_path, p.user_id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId],
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
      await pool.query("UPDATE images SET status = 'queued', updated_at = NOW() WHERE id = $1", [imageId]);
      // Also update or create segmentation_results entry
      await pool.query(
        `INSERT INTO segmentation_results (image_id, status, parameters)
              VALUES ($1, 'queued', $2)
              ON CONFLICT (image_id) DO UPDATE SET status = 'queued', parameters = $2, updated_at = NOW()`,
        [imageId, { ...segmentationParams, priority }],
      );

      // Trigger the actual segmentation task asynchronously with priority
      // No need to await, the service handles status updates internally
      triggerSegmentationTask(imageId, imagePath, segmentationParams, priority);

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
        await pool.query("UPDATE images SET status = 'failed', updated_at = NOW() WHERE id = $1", [imageId]);
        await pool.query("UPDATE segmentation_results SET status = 'failed', updated_at = NOW() WHERE image_id = $1", [
          imageId,
        ]);
      } catch (revertError) {
        console.error('Failed to revert status after trigger error:', revertError);
      }
      next(error);
    }
  },
);

// --- Validation Schema for Batch Trigger with Priority ---
const triggerBatchWithPrioritySchema = z.object({
  body: z
    .object({
      imageIds: z
        .array(z.string().uuid('Invalid image ID format in array'))
        .min(1, 'At least one image ID is required')
        .max(200, 'Maximum 200 image IDs allowed per batch'), // Zvýšeno na 200 pro podporu větších dávek
      priority: z.number().int().min(0).max(10).optional().default(1),
      model_type: z.string().optional(),
      parameters: z.object({}).passthrough().optional(), // Explicitně povolíme parametry pro segmentaci
    })
    .passthrough(), // Povolíme další parametry pro segmentaci
});

// POST /api/segmentation/trigger-batch - Trigger segmentation for multiple images
// @ts-ignore // TS2769: No overload matches this call.
router.post(
  '/segmentation/trigger-batch',
  authMiddleware,
  validate(triggerBatchWithPrioritySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Main implementation
    return handleBatchSegmentation(req, res, next);
  },
);

// POST /api/images/segmentation/trigger-batch - Alternative URL for the same functionality
// @ts-ignore // TS2769: No overload matches this call.
router.post(
  '/images/segmentation/trigger-batch',
  authMiddleware,
  validate(triggerBatchWithPrioritySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Redirect to the main implementation
    return handleBatchSegmentation(req, res, next);
  },
);

// Shared handler function for batch segmentation
async function handleBatchSegmentation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
    imagesCheckResult.rows.forEach((row) => foundImagesMap.set(row.id, { storage_path: row.storage_path }));

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
          pool.query("UPDATE images SET status = 'queued', updated_at = NOW() WHERE id = $1", [imageId]),
        );
        segmentationPromises.push(
          pool.query(
            `INSERT INTO segmentation_results (image_id, status, parameters) VALUES ($1, 'queued', $2)
                          ON CONFLICT (image_id) DO UPDATE SET status = 'queued', parameters = $2, updated_at = NOW()`,
            [imageId, combinedParameters], // Použijeme kompletní parametry
          ),
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

// PUT /api/images/:id/segmentation - Update segmentation result (e.g., after manual edit or completion)
// This might be called by the segmentation service itself upon completion, or by the frontend after editing.
// @ts-ignore // TS2769: No overload matches this call.
router.put(
  '/images/:id/segmentation',
  authMiddleware,
  validate(updateSegmentationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId; // Used for permission check
    const imageId = req.params.id;
    const { result_data, status, parameters } = req.body; // Expecting segmentation result and status

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }
    if (!status || !['completed', 'failed'].includes(status)) {
      res.status(400).json({
        message: 'Invalid status provided. Must be completed or failed.',
      });
      return;
    }
    if (status === 'completed' && !result_data) {
      res.status(400).json({ message: 'Result data is required for completed status' });
      return;
    }

    try {
      // Verify user has access to the image
      const imageCheck = await pool.query(
        'SELECT i.id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
        [imageId, userId],
      );
      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found or access denied' });
        return;
      }

      // Update segmentation result and status
      const updateResult = await pool.query(
        `UPDATE segmentation_results
             SET result_data = $1, status = $2, parameters = COALESCE($3, parameters), updated_at = NOW()
             WHERE image_id = $4
             RETURNING *`,
        [result_data || null, status, parameters, imageId],
      );

      // Also update the main image status
      await pool.query('UPDATE images SET status = $1, updated_at = NOW() WHERE id = $2', [status, imageId]);

      if (updateResult.rows.length === 0) {
        // This might happen if the segmentation_results record didn't exist yet for some reason
        // Maybe try an INSERT ON CONFLICT here instead or handle it differently?
        res.status(404).json({ message: 'Segmentation record not found for image' });
        return;
      }

      res.status(200).json(updateResult.rows[0]);
    } catch (error) {
      console.error('Error updating segmentation result:', error);
      next(error);
    }
  },
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
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

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
  },
);

// PUT /api/projects/:projectId/images/:imageId/segmentations - Update segmentation results for an image in a project
// @ts-ignore // TS2769: No overload matches this call.
router.put(
  '/projects/:projectId/images/:imageId/segmentations',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId, imageId } = req.params;
    const segmentationData = req.body; // Expecting segmentation data with polygons

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user has access to the project
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

      if (projectCheck.rows.length === 0) {
        res.status(404).json({ message: 'Project not found or access denied' });
        return;
      }

      // Verify image belongs to the project using its UUID
      const imageCheck = await pool.query('SELECT id FROM images WHERE id = $1 AND project_id = $2', [
        imageId,
        projectId,
      ]);

      if (imageCheck.rows.length === 0) {
        res.status(404).json({ message: 'Image not found in this project' });
        return;
      }

      // Use the actual image ID from the database for the segmentation lookup (which is just imageId now)
      const actualImageId = imageId; // Directly use the validated imageId

      // Check if segmentation result exists
      const checkResult = await pool.query('SELECT id FROM segmentation_results WHERE image_id = $1', [actualImageId]);

      let result;
      if (checkResult.rows.length === 0) {
        // Create new segmentation result
        result = await pool.query(
          `INSERT INTO segmentation_results (image_id, status, result_data, updated_at)
                 VALUES ($1, 'completed', $2, NOW())
                 RETURNING *`,
          [actualImageId, segmentationData],
        );
      } else {
        // Update existing segmentation result
        result = await pool.query(
          `UPDATE segmentation_results
                 SET result_data = $1, status = 'completed', updated_at = NOW()
                 WHERE image_id = $2
                 RETURNING *`,
          [segmentationData, actualImageId],
        );
      }

      // Update image status
      await pool.query("UPDATE images SET status = 'completed', updated_at = NOW() WHERE id = $1", [actualImageId]);

      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating segmentation results:', error);
      next(error);
    }
  },
);

// GET /api/segmentation/queue - Get current segmentation queue status
// @ts-ignore // TS2769: No overload matches this call.
router.get('/queue', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
});

// GET /api/queue-status - Get global segmentation queue status
// @ts-ignore // TS2769: No overload matches this call.
router.get('/queue-status', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ message: 'Authentication error' });
    return;
  }

  try {
    // Get global queue status
    const queueQuery = `
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
                COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
                COUNT(*) AS total_count
            FROM segmentation_queue
            WHERE user_id = $1
        `;
    const queueResult = await pool.query(queueQuery, [userId]);
    const queueStats = queueResult.rows[0] || {
      pending_count: 0,
      processing_count: 0,
      completed_count: 0,
      failed_count: 0,
      total_count: 0,
    };

    // Get global image segmentation status
    const imageStatsQuery = `
            SELECT
                COUNT(*) FILTER (WHERE i.status = 'pending') AS pending_count,
                COUNT(*) FILTER (WHERE i.status = 'processing') AS processing_count,
                COUNT(*) FILTER (WHERE i.status = 'completed') AS completed_count,
                COUNT(*) FILTER (WHERE i.status = 'failed') AS failed_count,
                COUNT(*) AS total_count
            FROM images i
            JOIN projects p ON i.project_id = p.id
            WHERE p.user_id = $1
        `;
    const imageStatsResult = await pool.query(imageStatsQuery, [userId]);
    const imageStats = imageStatsResult.rows[0] || {
      pending_count: 0,
      processing_count: 0,
      completed_count: 0,
      failed_count: 0,
      total_count: 0,
    };

    res.json({
      status: 'success',
      queue: queueStats,
      images: imageStats,
      globalQueueStatus: getSegmentationQueueStatus(),
    });
  } catch (error) {
    console.error('Error fetching global queue status:', error);
    next(error);
  }
});

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
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

      if (projectCheck.rows.length === 0) {
        res.status(404).json({ message: 'Project not found or access denied' });
        return;
      }

      // Get queue status for this project
      const queueQuery = `
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
                COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
                COUNT(*) AS total_count
            FROM segmentation_queue
            WHERE project_id = $1
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
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
                COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
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
  },
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
  },
);

// GET /api/segmentation/job/:jobId - Get details of a specific segmentation job
// @ts-ignore // TS2769: No overload matches this call.
router.get('/job/:jobId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // TODO: Implement logic - verify job access, query job details
    res.json({ message: 'Placeholder: Get job details' });
  } catch (error) {
    next(error);
  }
});

/* // Commented out route due to missing schema import
// POST /api/segmentation/job - Create a new segmentation job
// @ts-ignore // TS2769: No overload matches this call.
router.post('/job', authMiddleware, validate(createSegmentationJobSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log('POST /api/segmentation/job called');
    res.status(501).json({ message: 'Not Implemented' });
});
*/

// DELETE /api/segmentation/job/:jobId - Delete a segmentation job
// @ts-ignore // Keep ignore for now
router.delete(
  '/job/:jobId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // ... handler code ...
  },
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
            SELECT i.id, i.file_path, i.project_id
            FROM images i
            JOIN projects p ON i.project_id = p.id
            WHERE i.id = $1 AND (p.user_id = $2 OR p.is_public = true)
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

      // Set high priority for resegmentation (5 out of 10)
      const priority = 5;

      // Add parameters for resegmentation
      const parameters = {
        model_type: 'resunet',
        force_resegment: true,
        // Add any other parameters needed for resegmentation
      };

      // Trigger the segmentation task with high priority
      await triggerSegmentationTask(imageId, image.file_path, parameters, priority);

      // Return success response
      res.status(200).json({
        message: 'Resegmentation started successfully',
        imageId,
        status: 'queued',
      });
    } catch (error) {
      console.error('Error triggering resegmentation:', error);
      next(error);
    }
  },
);

// Fetch all polygons for a specific image
// @ts-ignore // TS2769
router.get('/:imageId/polygons', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { imageId } = req.params;
  // ... existing code ...
});

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
  },
);

// Clear all polygons for a specific image
// @ts-ignore // TS2769
router.delete('/:imageId/polygons', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { imageId } = req.params;
  // ... existing code ...
});

// POST /api/segmentations/batch - Alternative endpoint for batch segmentation
router.post(
  '/batch',
  authMiddleware,
  validate(triggerBatchWithPrioritySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    logger.info('Batch segmentation via /api/segmentations/batch', { 
      imageCount: req.body.imageIds?.length || 0 
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
      imageCount: requestedImageIds?.length || 0 
    });

    if (!userId) {
      res.status(401).json({ message: 'Authentication error' });
      return;
    }

    try {
      // Verify user has access to the project
      const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

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
        ...otherParams
      };

      // Call the batch segmentation handler
      return handleBatchSegmentation(req, res, next);
    } catch (error) {
      logger.error('Error triggering project batch segmentation:', error);
      next(error);
    }
  }
);

export default router;
