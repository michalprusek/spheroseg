import express, { Response, Router, NextFunction } from 'express';
import { getPool } from '../db';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import { validate } from '../middleware/validationMiddleware';
import {
  listProjectsSchema,
  createProjectSchema,
  projectIdSchema,
  deleteProjectSchema,
  updateProjectSchema,
} from '../validators/projectValidators';
import logger from '../utils/logger';
import * as projectService from '../services/projectService';
import { cacheControl, combineCacheStrategies } from '../middleware/cache';
import cacheService from '../services/cacheService';

const router: Router = express.Router();

/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List user projects
 *     description: |
 *       Retrieve all projects owned by the authenticated user.
 *       Supports pagination and optional inclusion of shared projects.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of projects to return
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *           example: 20
 *       - name: offset
 *         in: query
 *         description: Number of projects to skip for pagination
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *           example: 0
 *       - name: includeShared
 *         in: query
 *         description: Whether to include projects shared with the user
 *         schema:
 *           type: boolean
 *           default: true
 *           example: true
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 total:
 *                   type: integer
 *                   description: Total number of projects available
 *                   example: 15
 *                 limit:
 *                   type: integer
 *                   example: 20
 *                 offset:
 *                   type: integer
 *                   example: 0
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 */
// @ts-expect-error - Router middleware type mismatch with validate function
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

/**
 * @openapi
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create new project
 *     description: |
 *       Create a new project for organizing images and segmentation tasks.
 *       The project will be owned by the authenticated user.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Project title
 *                 example: "Cell Analysis Project"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional project description
 *                 example: "Analysis of cancer cell morphology"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional tags for project categorization
 *                 example: ["cancer", "research", "morphology"]
 *               public:
 *                 type: boolean
 *                 description: Whether the project is publicly visible
 *                 default: false
 *                 example: false
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error - invalid input data
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error or database schema error
 */
// @ts-expect-error - Router middleware type mismatch with validate function
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

/**
 * @openapi
 * /projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project by ID
 *     description: |
 *       Retrieve a specific project by its ID. Special case: passing "new" as the ID
 *       returns a template for creating a new project.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID or "new" for template
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Project retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized - authentication required
 *       404:
 *         description: Project not found or user doesn't have access
 *       500:
 *         description: Internal server error or database schema error
 */
// @ts-expect-error - Router middleware type mismatch with validate function
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

/**
 * @openapi
 * /projects/{projectId}:
 *   put:
 *     tags: [Projects]
 *     summary: Update project
 *     description: |
 *       Update project information. Only the project owner can update the project.
 *       Fields not provided in the request will remain unchanged.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID to update
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Updated project title
 *                 example: "Updated Project Name"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Updated project description
 *                 example: "Updated project description"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated tags for project categorization
 *                 example: ["cancer", "research", "updated"]
 *               public:
 *                 type: boolean
 *                 description: Updated public visibility setting
 *                 example: true
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error or no valid fields to update
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - user is not the project owner
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
// @ts-expect-error - Router middleware type mismatch with validate function
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

      // Use projectService to check access (ownership or sharing)
      const projectService = await import('../services/projectService');
      const project = await projectService.getProjectById(getPool(), projectId, userId);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found or access denied' });
      }
      
      // Check if user has edit permission (owner or shared with 'edit' permission)
      const hasEditPermission = project.is_owner || project.permission === 'edit';
      if (!hasEditPermission) {
        return res.status(403).json({ message: "You need 'edit' or 'owner' permission to update this project" });
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
        projectId,
      });
      next(error);
    }
  }
);

/**
 * @openapi
 * /projects/{projectId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete project
 *     description: |
 *       Delete a project and all associated images and data.
 *       Only the project owner can delete the project. This action is irreversible.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID to delete
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       204:
 *         description: Project deleted successfully
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - user is not the project owner
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
// @ts-expect-error - Router middleware type mismatch with validate function
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

/**
 * @openapi
 * /projects/{projectId}/images:
 *   get:
 *     tags: [Projects, Images]
 *     summary: List images in project
 *     description: |
 *       Retrieve all images in a specific project with their segmentation status.
 *       Only the project owner can access the images.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID to get images from
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Images retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Image'
 *                 total:
 *                   type: integer
 *                   description: Total number of images in the project
 *                   example: 25
 *       401:
 *         description: Unauthorized - authentication required
 *       404:
 *         description: Project not found or access denied
 *       500:
 *         description: Internal server error
 */
// @ts-expect-error - Router middleware type mismatch with validate function
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

      // Verify user has access to the project (check both ownership and shared access)
      const project = await projectService.getProjectById(getPool(), projectId, userId);

      if (!project) {
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
