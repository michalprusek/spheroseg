import express, { Response, Router, NextFunction } from 'express';
import { getPool } from '../db';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import { validate } from '../middleware/validationMiddleware';
import {
  listProjectsSchema,
  createProjectSchema,
  projectIdSchema,
  deleteProjectSchema,
  duplicateProjectSchema,
  updateProjectSchema,
} from '../validators/projectValidators';
import logger from '../utils/logger';
import * as projectService from '../services/projectService';
import { cacheControl, combineCacheStrategies } from '../middleware/cache';
import cacheService from '../services/cacheService';

const router: Router = express.Router();

// GET /api/projects - List projects for the current user
// @ts-ignore
router.get(
  '/',
  authMiddleware,
  combineCacheStrategies(cacheControl.short, cacheControl.etag),
  validate(listProjectsSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const {
      limit = 10,
      offset = 0,
      includeShared = true,
    } = req.query as unknown as {
      limit: number;
      offset: number;
      includeShared: boolean;
    };

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Processing projects list request', {
        userId,
        limit,
        offset,
        includeShared,
      });

      // First check if the projects table exists
      const projectsTableCheck = await getPool().query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'projects'
            )
        `);

      const projectsTableExists = projectsTableCheck.rows[0].exists;
      if (!projectsTableExists) {
        logger.warn('Projects table does not exist in database');
        return res.status(200).json({
          projects: [],
          total: 0,
        });
      }

      // Try to get from cache first
      const cacheKey = `project_list:${userId}:${limit}:${offset}:${includeShared}`;
      const cached = await cacheService.get<{ projects: any[]; total: number }>(cacheKey);

      if (cached) {
        logger.debug('Returning cached project list', { userId, limit, offset });
        return res.status(200).json(cached);
      }

      // Get projects using the service
      const result = await projectService.getUserProjects(
        getPool(),
        userId,
        limit,
        offset,
        includeShared
      );

      logger.info('Projects fetched successfully', {
        count: result.projects.length,
        total: result.total,
      });

      // Cache the result
      await cacheService.set(cacheKey, result, 60); // 1 minute TTL

      res.status(200).json({
        projects: result.projects,
        total: result.total,
      });
    } catch (error) {
      logger.error('Error fetching projects', { error });
      next(error);
    }
  }
);

// POST /api/projects - Create a new project
// @ts-ignore
router.post(
  '/',
  authMiddleware,
  validate(createProjectSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { title, description } = req.body;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Processing create project request', { userId, title });

      // First check if the projects table exists
      const projectsTableCheck = await getPool().query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'projects'
            )
        `);

      const projectsTableExists = projectsTableCheck.rows[0].exists;
      if (!projectsTableExists) {
        logger.warn('Projects table does not exist in database');
        return res.status(500).json({
          message: 'Database schema error - projects table missing',
          error: 'SCHEMA_ERROR',
        });
      }

      // Check required columns exist in projects table
      const requiredColumns = ['user_id', 'title', 'description'];
      const missingColumns = [];

      for (const column of requiredColumns) {
        const columnCheck = await getPool().query(
          `
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'projects'
                    AND column_name = $1
                )
            `,
          [column]
        );

        if (!columnCheck.rows[0].exists) {
          missingColumns.push(column);
        }
      }

      if (missingColumns.length > 0) {
        logger.warn('Missing required columns in projects table', {
          missingColumns,
        });
        return res.status(500).json({
          message: `Database schema error - missing columns: ${missingColumns.join(', ')}`,
          error: 'SCHEMA_ERROR',
        });
      }

      // Extract optional fields from request body
      const { tags, public: isPublic } = req.body;

      // Log the raw request body for debugging
      logger.debug('Raw project creation request body', {
        body: req.body,
        title,
        description,
        userId,
      });

      logger.debug('Creating new project using service', {
        title,
        userId,
        tags,
        isPublic,
      });
      const newProject = await projectService.createProject(getPool(), {
        title,
        description,
        userId,
        tags,
        public: isPublic,
      });

      logger.info('Project created successfully', {
        projectId: newProject.id,
        title: newProject.title,
        description: newProject.description,
      });

      // Log the full project object for debugging
      logger.debug('Created project details', { project: newProject });

      res.status(201).json(newProject);
    } catch (error) {
      logger.error('Error creating project', {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
        title,
        userId,
      });
      next(error);
    }
  }
);

// GET /api/projects/:id - Get a specific project by ID, or return a project template for "new"
// @ts-ignore
router.get(
  '/:id',
  authMiddleware,
  combineCacheStrategies(cacheControl.short, cacheControl.etag),
  validate(projectIdSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: projectId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Processing get project request', { userId, projectId });

      // Special case for "new" to return an empty project template
      if (projectId === 'new') {
        logger.debug('Returning new project template');
        // Return a template for a new project
        return res.status(200).json({
          id: 'new',
          title: '',
          description: '',
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          image_count: 0,
          thumbnail_url: null,
        });
      }

      // First check if the projects table exists
      const projectsTableCheck = await getPool().query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'projects'
            )
        `);

      const projectsTableExists = projectsTableCheck.rows[0].exists;
      if (!projectsTableExists) {
        logger.warn('Projects table does not exist in database');
        return res.status(404).json({
          message: 'Project not found - projects table missing',
          error: 'NOT_FOUND',
        });
      }

      // Try to get from cache first
      const cachedProject = await cacheService.getCachedProject(projectId);

      if (cachedProject) {
        // Verify user has access even for cached project
        if (cachedProject.user_id !== userId && !cachedProject.is_shared) {
          return res.status(404).json({ message: 'Project not found or access denied' });
        }
        logger.debug('Returning cached project', { projectId });
        return res.status(200).json(cachedProject);
      }

      // Get project using the service
      const project = await projectService.getProjectById(getPool(), projectId, userId);

      if (!project) {
        logger.info('Project not found or access denied', {
          projectId,
          userId,
        });
        return res.status(404).json({ message: 'Project not found or access denied' });
      }

      logger.info('Project fetched successfully', {
        projectId,
        title: project.title,
        isOwner: project.is_owner,
      });

      // Cache the project
      await cacheService.cacheProject(projectId, project);

      return res.status(200).json(project);
    } catch (error) {
      logger.error('Error fetching project', { error, projectId, userId });
      next(error);
    }
  }
);

// PUT /api/projects/:id - Update a project by ID
// @ts-ignore
router.put(
  '/:id',
  authMiddleware,
  validate(updateProjectSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: projectId } = req.params;
    const updates = req.body;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Processing update project request', { userId, projectId, updates });

      // Check project ownership
      const ownershipCheck = await getPool().query(
        'SELECT user_id FROM projects WHERE id = $1',
        [projectId]
      );

      if (ownershipCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (ownershipCheck.rows[0].user_id !== userId) {
        return res.status(403).json({ message: 'Not authorized to update this project' });
      }

      // Update the project
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      if (updates.title !== undefined) {
        updateFields.push(`title = $${paramCount++}`);
        values.push(updates.title);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }

      if (updates.tags !== undefined) {
        updateFields.push(`tags = $${paramCount++}`);
        values.push(updates.tags);
      }

      if (updates.public !== undefined) {
        updateFields.push(`public = $${paramCount++}`);
        values.push(updates.public);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(projectId);

      const updateQuery = `
        UPDATE projects 
        SET ${updateFields.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const result = await getPool().query(updateQuery, values);

      // Clear cache for the project
      await cacheService.invalidateProject(projectId);

      logger.info('Project updated successfully', { projectId });
      res.json(result.rows[0]);
    } catch (error: any) {
      logger.error('Error updating project', { 
        error: error?.message || error, 
        stack: error?.stack,
        projectId 
      });
      next(error);
    }
  }
);

// DELETE /api/projects/:id - Delete a project by ID
// @ts-ignore
router.delete(
  '/:id',
  authMiddleware,
  validate(deleteProjectSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: projectId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Processing delete project request', { userId, projectId });

      // First check if the projects table exists
      const projectsTableCheck = await getPool().query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'projects'
            )
        `);

      const projectsTableExists = projectsTableCheck.rows[0].exists;
      if (!projectsTableExists) {
        logger.warn('Projects table does not exist in database');
        return res.status(404).json({
          message: 'Project not found - projects table missing',
          error: 'NOT_FOUND',
        });
      }

      // Delete the project using the service
      await projectService.deleteProject(getPool(), projectId, userId);

      logger.info('Project deleted successfully', { projectId });

      // Invalidate cache for this project
      await cacheService.invalidateProject(projectId);

      // Return 204 No Content on successful deletion
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting project', { error, projectId, userId });

      // Handle API errors with appropriate status codes
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return res.status(error.statusCode).json({
          message: error.message,
        });
      }

      next(error);
    }
  }
);

// POST /api/projects/:id/duplicate - Duplicate a project
// @ts-ignore
router.post(
  '/:id/duplicate',
  authMiddleware,
  validate(duplicateProjectSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: originalProjectId } = req.params;
    const {
      newTitle,
      copyFiles = true,
      copySegmentations = false,
      resetStatus = true,
      async = false,
    } = req.body;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Processing duplicate project request', {
        userId,
        originalProjectId,
        newTitle,
        async,
      });

      // First check if the projects table exists
      const projectsTableCheck = await getPool().query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'projects'
            )
        `);

      const projectsTableExists = projectsTableCheck.rows[0].exists;
      if (!projectsTableExists) {
        logger.warn('Projects table does not exist in database');
        return res.status(404).json({
          message: 'Project not found - projects table missing',
          error: 'NOT_FOUND',
        });
      }

      // Verify the source project exists and belongs to the user
      const projectCheck = await getPool().query(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [originalProjectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        logger.info('Source project not found or access denied', {
          originalProjectId,
          userId,
        });
        return res.status(404).json({ message: 'Source project not found or access denied' });
      }

      // If async is true and duplication tasks table exists, process asynchronously
      if (async) {
        // Check if the duplication tasks table exists
        const tasksTableCheck = await getPool().query(`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'project_duplication_tasks'
                )
            `);

        const tasksTableExists = tasksTableCheck.rows[0].exists;
        if (tasksTableExists) {
          try {
            // Import the duplication queue service
            const projectDuplicationQueueService = await import(
              '../services/projectDuplicationQueueService'
            );

            // Trigger an asynchronous duplication
            const taskId = await projectDuplicationQueueService.default.triggerProjectDuplication(
              getPool(),
              originalProjectId,
              userId,
              {
                newTitle,
                copyFiles,
                copySegmentations,
                resetStatus,
                baseDir: process.cwd(),
              }
            );

            logger.info('Project duplication task created successfully', {
              originalProjectId,
              taskId,
              userId,
              options: { newTitle, copyFiles, copySegmentations, resetStatus },
            });

            // Return the task ID and status
            return res.status(202).json({
              taskId,
              status: 'pending',
              originalProjectId,
              message:
                'Project duplication started. Monitor progress using the duplication task API.',
            });
          } catch (queueError) {
            logger.error('Error using duplication queue service', {
              queueError,
              originalProjectId,
            });
            // Fall through to synchronous duplication if queue service fails
          }
        }
      }

      // Synchronous duplication (fallback or intentional)
      try {
        logger.debug('Loading project duplication service for synchronous duplication', {
          originalProjectId,
          newTitle,
        });

        // Import the project duplication service
        const projectDuplicationService = await import('../services/projectDuplicationService');

        // Duplicate the project using the centralized service
        const newProject = await projectDuplicationService.duplicateProject(
          getPool(),
          originalProjectId,
          userId,
          {
            newTitle,
            copyFiles,
            copySegmentations,
            resetStatus,
            baseDir: process.cwd(), // Use current working directory as base
          }
        );

        logger.info('Project duplicated successfully (synchronous)', {
          originalProjectId,
          newProjectId: newProject.id,
          newTitle,
        });

        return res.status(201).json(newProject); // Return the newly created project info
      } catch (serviceError) {
        logger.error('Project duplication service error', {
          error: serviceError,
          originalProjectId,
          newTitle,
        });

        // If service module doesn't exist, fallback to a basic project duplication
        if (
          serviceError &&
          typeof serviceError === 'object' &&
          'code' in serviceError &&
          serviceError.code === 'MODULE_NOT_FOUND'
        ) {
          logger.warn('Duplication service not found, using fallback method');

          // Basic duplicate without files - just create new project with same title
          const newProjectResult = await getPool().query(
            'INSERT INTO projects (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
            [
              userId,
              newTitle || `Copy of ${projectCheck.rows[0].title}`,
              projectCheck.rows[0].description,
            ]
          );

          logger.info('Project duplicated using fallback method', {
            newProjectId: newProjectResult.rows[0].id,
          });

          return res.status(201).json(newProjectResult.rows[0]);
        }

        throw serviceError; // Re-throw if it's not a module-not-found error
      }
    } catch (error) {
      logger.error('Error duplicating project', {
        error,
        originalProjectId,
        userId,
        newTitle,
      });
      next(error);
    }
  }
);

// GET /api/projects/:id/images - Get images for a specific project
// @ts-ignore
router.get(
  '/:id/images',
  authMiddleware,
  combineCacheStrategies(cacheControl.short, cacheControl.etag),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: projectId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Processing get project images request', { userId, projectId });

      // First check if the projects table exists
      const projectsTableCheck = await getPool().query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'projects'
        )
      `);

      const projectsTableExists = projectsTableCheck.rows[0].exists;
      if (!projectsTableExists) {
        logger.warn('Projects table does not exist in database');
        return res.status(404).json({
          message: 'Project not found - projects table missing',
          error: 'NOT_FOUND',
        });
      }

      // Verify user has access to the project
      const projectCheck = await getPool().query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        logger.info('Project not found or access denied', { projectId, userId });
        return res.status(404).json({ message: 'Project not found or access denied' });
      }

      // Check if images table exists
      const imagesTableCheck = await getPool().query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'images'
        )
      `);

      const imagesTableExists = imagesTableCheck.rows[0].exists;
      if (!imagesTableExists) {
        logger.warn('Images table does not exist in database');
        return res.status(200).json({
          images: [],
          total: 0,
        });
      }

      // Get images for this project with segmentation status
      const imagesQuery = `
        SELECT 
          i.id, i.project_id, i.name, i.storage_path, i.thumbnail_path, i.status, 
          i.created_at, i.updated_at, i.file_size, i.width, i.height, i.storage_filename,
          i.metadata,
          COALESCE(i.segmentation_status, 'without_segmentation') as "segmentationStatus",
          sr.id as segmentation_id
        FROM images i
        LEFT JOIN segmentation_results sr ON i.id = sr.image_id
        WHERE i.project_id = $1
        ORDER BY i.created_at DESC
      `;
      const imagesResult = await getPool().query(imagesQuery, [projectId]);

      logger.info('Project images fetched successfully', {
        projectId,
        count: imagesResult.rows.length,
      });

      res.status(200).json({
        images: imagesResult.rows,
        total: imagesResult.rows.length,
      });
    } catch (error) {
      logger.error('Error fetching project images', { error, projectId, userId });
      next(error);
    }
  }
);

export default router;
