import express, { Request, Response, Router, NextFunction } from 'express';
import pool from '@/db';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware';
import { triggerSegmentationTask, getSegmentationQueueStatus } from '../services/segmentationService';
import { validate } from '../middleware/validationMiddleware';
import { z } from 'zod';
import {
    getSegmentationSchema,
    triggerSegmentationSchema,
    updateSegmentationSchema,
    // createSegmentationJobSchema // Commented out as it seems missing from validator file
} from '../validators/segmentationValidators';

const router: Router = express.Router();

// --- Validation Schema for Batch Trigger ---
const triggerBatchSchema = z.object({
    body: z.object({
        imageIds: z.array(z.string().uuid("Invalid image ID format in array")).min(1, "At least one image ID is required"),
    }),
});
// -----------------------------------------

// GET /api/images/:id/segmentation - Get segmentation result for an image
// @ts-ignore // TS2769: No overload matches this call.
router.get('/images/:id/segmentation', authMiddleware, validate(getSegmentationSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
            [imageId, userId]
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
                    polygons: []
                },
                polygons: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
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
});

// GET /api/projects/:projectId/segmentations/:imageId - Get segmentation results for an image in a project
// @ts-ignore // TS2769: No overload matches this call.
router.get('/projects/:projectId/segmentations/:imageId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId, imageId } = req.params;

    if (!userId) {
        res.status(401).json({ message: 'Authentication error' });
        return;
    }

    try {
        // Verify user has access to the project
        const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);

        if (projectCheck.rows.length === 0) {
            res.status(404).json({ message: 'Project not found or access denied' });
            return;
        }

        // Verify image belongs to the project using its UUID
        const imageCheck = await pool.query('SELECT id FROM images WHERE id = $1 AND project_id = $2', [imageId, projectId]);

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
                    polygons: []
                },
                polygons: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
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
});

// --- Validation Schema for Single Image Segmentation with Priority ---
const triggerSingleWithPrioritySchema = z.object({
    body: z.object({
        parameters: z.object({}).passthrough().optional(),
        priority: z.number().int().min(0).max(10).optional().default(1),
    }),
});

// POST /api/images/:id/segmentation - Trigger segmentation process for an image
// @ts-ignore // TS2769: No overload matches this call.
router.post('/images/:id/segmentation', authMiddleware, validate(triggerSingleWithPrioritySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

        // Update image status to 'processing' in the database
        await pool.query("UPDATE images SET status = 'processing', updated_at = NOW() WHERE id = $1", [imageId]);
        // Also update or create segmentation_results entry
        await pool.query(
             `INSERT INTO segmentation_results (image_id, status, parameters)
              VALUES ($1, 'processing', $2)
              ON CONFLICT (image_id) DO UPDATE SET status = 'processing', parameters = $2, updated_at = NOW()`,
             [imageId, { ...segmentationParams, priority }]
        );

        // Trigger the actual segmentation task asynchronously with priority
        // No need to await, the service handles status updates internally
        triggerSegmentationTask(imageId, imagePath, segmentationParams, priority);

        // Get current queue status
        const queueStatus = getSegmentationQueueStatus();

        res.status(202).json({
            message: 'Segmentation process started',
            queueStatus
        });
    } catch (error) {
        console.error('Error triggering segmentation:', error);
         // Attempt to revert status if triggering failed
        try {
            await pool.query("UPDATE images SET status = 'failed', updated_at = NOW() WHERE id = $1", [imageId]);
            await pool.query("UPDATE segmentation_results SET status = 'failed', updated_at = NOW() WHERE image_id = $1", [imageId]);
        } catch (revertError) {
            console.error('Failed to revert status after trigger error:', revertError);
        }
        next(error);
    }
});

// --- Validation Schema for Batch Trigger with Priority ---
const triggerBatchWithPrioritySchema = z.object({
    body: z.object({
        imageIds: z.array(z.string().uuid("Invalid image ID format in array")).min(1, "At least one image ID is required"),
        priority: z.number().int().min(0).max(10).optional().default(1),
        model_type: z.string().optional(),
    }).passthrough(), // Povolíme další parametry pro segmentaci
});

// POST /api/segmentation/trigger-batch - Trigger segmentation for multiple images
// @ts-ignore // TS2769: No overload matches this call.
router.post('/segmentation/trigger-batch', authMiddleware, validate(triggerBatchWithPrioritySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Main implementation
    return handleBatchSegmentation(req, res, next);
});

// POST /api/images/segmentation/trigger-batch - Alternative URL for the same functionality
// @ts-ignore // TS2769: No overload matches this call.
router.post('/images/segmentation/trigger-batch', authMiddleware, validate(triggerBatchWithPrioritySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Redirect to the main implementation
    return handleBatchSegmentation(req, res, next);
});

// Shared handler function for batch segmentation
async function handleBatchSegmentation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const userId = req.user?.userId;
    const { imageIds, priority = 1, ...otherParams } = req.body; // Validated by middleware + extrahujeme další parametry

    if (!userId) {
        res.status(401).json({ message: 'Authentication error' });
        return;
    }

    let successfullyTriggered: string[] = [];
    let failedToTrigger: { id: string, reason: string }[] = [];

    try {
        // Verify ownership and get paths for all requested images in one query
        const imagesCheckQuery = `
            SELECT i.id, i.storage_path
            FROM images i
            JOIN projects p ON i.project_id = p.id
            WHERE i.id = ANY($1::uuid[]) AND p.user_id = $2;
        `;
        const imagesCheckResult = await pool.query(imagesCheckQuery, [imageIds, userId]);

        const foundImagesMap = new Map<string, { storage_path: string }>();
        imagesCheckResult.rows.forEach(row => foundImagesMap.set(row.id, { storage_path: row.storage_path }));

        const segmentationPromises: Promise<any>[] = [];

        for (const imageId of imageIds) {
            const imageData = foundImagesMap.get(imageId);
            if (imageData) {
                // Update status in DB
                segmentationPromises.push(
                    pool.query("UPDATE images SET status = 'processing', updated_at = NOW() WHERE id = $1", [imageId])
                );
                segmentationPromises.push(
                    pool.query(
                         `INSERT INTO segmentation_results (image_id, status, parameters) VALUES ($1, 'processing', $2)
                          ON CONFLICT (image_id) DO UPDATE SET status = 'processing', parameters = $2, updated_at = NOW()`,
                         [imageId, { priority }] // Include priority in parameters
                    )
                );
                // Trigger task asynchronously with priority and other parameters
                const segmentationParameters = { ...otherParams, priority };
                triggerSegmentationTask(imageId, imageData.storage_path, segmentationParameters, priority);
                successfullyTriggered.push(imageId);
            } else {
                failedToTrigger.push({ id: imageId, reason: 'Not found or access denied' });
            }
        }

        // Wait for all DB updates to finish (optional, but safer)
        await Promise.all(segmentationPromises);

        // Get current queue status
        const queueStatus = getSegmentationQueueStatus();

        res.status(202).json({
            message: `Segmentation triggered for ${successfullyTriggered.length} image(s).`,
            triggered: successfullyTriggered,
            failed: failedToTrigger,
            queueStatus
        });
    } catch (error) {
        console.error('Error triggering batch segmentation:', error);
        next(error);
    }
}

// PUT /api/images/:id/segmentation - Update segmentation result (e.g., after manual edit or completion)
// This might be called by the segmentation service itself upon completion, or by the frontend after editing.
// @ts-ignore // TS2769: No overload matches this call.
router.put('/images/:id/segmentation', authMiddleware, validate(updateSegmentationSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId; // Used for permission check
    const imageId = req.params.id;
    const { result_data, status, parameters } = req.body; // Expecting segmentation result and status

    if (!userId) {
        res.status(401).json({ message: 'Authentication error' });
        return;
    }
    if (!status || !['completed', 'failed'].includes(status)) {
        res.status(400).json({ message: 'Invalid status provided. Must be completed or failed.' });
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
            [imageId, userId]
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
            [result_data || null, status, parameters, imageId]
        );

        // Also update the main image status
        await pool.query("UPDATE images SET status = $1, updated_at = NOW() WHERE id = $2", [status, imageId]);

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
});

// PUT /api/projects/:projectId/images/:imageId/segmentations - Update segmentation results for an image in a project
// @ts-ignore // TS2769: No overload matches this call.
router.put('/projects/:projectId/images/:imageId/segmentations', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId, imageId } = req.params;
    const segmentationData = req.body; // Expecting segmentation data with polygons

    if (!userId) {
        res.status(401).json({ message: 'Authentication error' });
        return;
    }

    try {
        // Verify user has access to the project
        const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);

        if (projectCheck.rows.length === 0) {
            res.status(404).json({ message: 'Project not found or access denied' });
            return;
        }

        // Verify image belongs to the project using its UUID
        const imageCheck = await pool.query('SELECT id FROM images WHERE id = $1 AND project_id = $2', [imageId, projectId]);

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
                [actualImageId, segmentationData]
            );
        } else {
            // Update existing segmentation result
            result = await pool.query(
                `UPDATE segmentation_results
                 SET result_data = $1, status = 'completed', updated_at = NOW()
                 WHERE image_id = $2
                 RETURNING *`,
                [segmentationData, actualImageId]
            );
        }

        // Update image status
        await pool.query("UPDATE images SET status = 'completed', updated_at = NOW() WHERE id = $1", [actualImageId]);

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating segmentation results:', error);
        next(error);
    }
});

// GET /api/segmentation/queue - Get current segmentation queue status
// @ts-ignore // TS2769: No overload matches this call.
router.get('/queue', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const queueStatus = getSegmentationQueueStatus();
        res.json({
            status: 'success',
            data: queueStatus
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/mock-queue-status - Get mock queue status for development
// @ts-ignore // TS2769: No overload matches this call.
router.get('/mock-queue-status', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

        // Return mock data
        res.json({
            queueLength: 2,
            runningTasks: [mockImageId1, mockImageId2],
            queuedTasks: ['323e4567-e89b-12d3-a456-426614174002', '423e4567-e89b-12d3-a456-426614174003'],
            processingImages: [
                { id: mockImageId1, name: 'Sample Image 1', projectId: 'project-123' },
                { id: mockImageId2, name: 'Sample Image 2', projectId: 'project-456' }
            ]
        });
    } catch (error) {
        console.error('Error fetching mock queue status:', error);
        next(error);
    }
});

// GET /api/segmentation/jobs/:projectId - Get segmentation jobs for a project
// @ts-ignore // TS2769: No overload matches this call.
router.get('/jobs/:projectId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // TODO: Implement logic - verify project access, query jobs
        res.json({ message: "Placeholder: Get jobs for project" });
    } catch (error) {
        next(error);
    }
});

// GET /api/segmentation/job/:jobId - Get details of a specific segmentation job
// @ts-ignore // TS2769: No overload matches this call.
router.get('/job/:jobId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // TODO: Implement logic - verify job access, query job details
        res.json({ message: "Placeholder: Get job details" });
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
router.delete('/job/:jobId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // ... handler code ...
});

// Fetch all polygons for a specific image
// @ts-ignore // TS2769
router.get('/:imageId/polygons', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const { imageId } = req.params;
    // ... existing code ...
});

// Save or update polygons for a specific image
// @ts-ignore // TS2769
router.post('/:imageId/polygons', authMiddleware, /* validatePolygonData, */ async (req: AuthenticatedRequest, res: Response) => { // TODO: Uncomment validatePolygonData when implemented
    const { imageId } = req.params;
    const { polygons } = req.body;
// ... existing code ...
});

// Clear all polygons for a specific image
// @ts-ignore // TS2769
router.delete('/:imageId/polygons', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const { imageId } = req.params;
// ... existing code ...
});

export default router;