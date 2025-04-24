import express, { Response, Router, NextFunction } from 'express';
import pool from '../db';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware';
import { validate } from '../middleware/validationMiddleware';
import {
    listProjectsSchema,
    createProjectSchema,
    projectIdSchema,
    duplicateProjectSchema
} from '../validators/projectValidators';

const router: Router = express.Router();

// GET /api/projects - List projects for the current user
// @ts-ignore
router.get('/', authMiddleware, validate(listProjectsSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { limit, offset } = req.query as unknown as { limit: number; offset: number };

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
        const projectsResult = await pool.query(`
            SELECT
                p.*,
                (SELECT COUNT(*) FROM images i WHERE i.project_id = p.id) as image_count,
                (SELECT thumbnail_path FROM images i WHERE i.project_id = p.id ORDER BY i.created_at DESC LIMIT 1) as thumbnail_url
            FROM projects p
            WHERE p.user_id = $1
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3;
        `, [userId, limit, offset]);

        // Query to get total count of projects for pagination
        const totalResult = await pool.query('SELECT COUNT(*) FROM projects WHERE user_id = $1', [userId]);
        const totalProjects = parseInt(totalResult.rows[0].count, 10);

        res.status(200).json({
            projects: projectsResult.rows,
            total: totalProjects
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/projects - Create a new project
// @ts-ignore
router.post('/', authMiddleware, validate(createProjectSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { title, description } = req.body;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
        const newProjectResult = await pool.query(
            'INSERT INTO projects (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
            [userId, title, description || null]
        );
        res.status(201).json(newProjectResult.rows[0]);
    } catch (error) {
        next(error);
    }
});

// GET /api/projects/:id - Get a specific project by ID
// @ts-ignore
router.get('/:id', authMiddleware, validate(projectIdSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: projectId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
        const projectResult = await pool.query(
            'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, userId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found or access denied' });
        }

        res.status(200).json(projectResult.rows[0]);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/projects/:id - Delete a project by ID
// @ts-ignore
router.delete('/:id', authMiddleware, validate(projectIdSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: projectId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
        // Verify the user owns the project before deleting
        const deleteResult = await pool.query(
            'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
            [projectId, userId]
        );

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: 'Project not found or access denied' });
        }

        // Note: Associated images and segmentation results should be deleted automatically
        // due to ON DELETE CASCADE constraint defined in the schema.
        // If local file storage is used, those files need to be deleted separately.
        // TODO: Implement file deletion logic if storing files locally.

        res.status(204).send(); // No content on successful deletion
    } catch (error) {
        next(error);
    }
});

// POST /api/projects/:id/duplicate - Duplicate a project
// @ts-ignore
router.post('/:id/duplicate', authMiddleware, validate(duplicateProjectSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: originalProjectId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    const client = await pool.connect(); // Use a client for transaction

    try {
        await client.query('BEGIN');

        // 1. Fetch original project data
        const projectRes = await client.query(
            'SELECT title, description FROM projects WHERE id = $1 AND user_id = $2',
            [originalProjectId, userId]
        );
        if (projectRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Original project not found or access denied' });
        }
        const originalProject = projectRes.rows[0];

        // 2. Create new project entry
        const newProjectTitle = `${originalProject.title} (Copy)`;
        const newProjectRes = await client.query(
            'INSERT INTO projects (user_id, title, description) VALUES ($1, $2, $3) RETURNING id, title',
            [userId, newProjectTitle, originalProject.description]
        );
        const newProject = newProjectRes.rows[0];

        // 3. Fetch images from the original project
        const imagesRes = await client.query(
            'SELECT name, storage_path, thumbnail_path, width, height, metadata FROM images WHERE project_id = $1',
            [originalProjectId]
        );
        const originalImages = imagesRes.rows;

        // 4. Duplicate images and results (if any)
        if (originalImages.length > 0) {
            for (const img of originalImages) {
                 // TODO: Implement actual file duplication for storage_path and thumbnail_path
                 // For now, just copy the paths - this assumes paths are relative or reusable.
                 // A robust solution needs to copy files in the storage system.
                 const newStoragePath = img.storage_path; // Placeholder: Needs actual copy
                 const newThumbnailPath = img.thumbnail_path; // Placeholder: Needs actual copy

                // Insert new image record
                const newImageRes = await client.query(
                    `INSERT INTO images (project_id, user_id, name, storage_path, thumbnail_path, width, height, metadata, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING id`,
                    [newProject.id, userId, img.name, newStoragePath, newThumbnailPath, img.width, img.height, img.metadata]
                );
                // Duplicating segmentation results is likely not desired, keep new images as pending.
            }
        }

        await client.query('COMMIT');
        res.status(201).json(newProject); // Return the newly created project info

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

export default router;