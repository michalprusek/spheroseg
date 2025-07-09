/**
 * Project Duplication Routes
 *
 * Provides endpoints for initiating and monitoring project duplication
 */

import express, { Response, Router, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import { validate } from '../middleware/validationMiddleware';
import pool from '../db';
import logger from '../utils/logger';

// Create a router
const router: Router = express.Router();

// Import validators
import { duplicateProjectSchema } from '../validators/projectValidators';

// Define schema for getting duplication tasks
const getDuplicationsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 0)),
  }),
});

// Define schema for getting a specific duplication task
const getDuplicationSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Invalid task ID format'),
  }),
});

// Define schema for canceling a duplication task
const cancelDuplicationSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Invalid task ID format'),
  }),
});

// POST /api/duplication - Initiate a new duplication
router.post(
  '/',
  authMiddleware,
  validate(duplicateProjectSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: originalProjectId } = req.params;
    const { newTitle, copyFiles = true, copySegmentations = false, resetStatus = true } = req.body;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Processing project duplication request', {
        userId,
        originalProjectId,
        newTitle,
      });

      // First check if the projects table exists
      const projectsTableCheck = await pool.query(`
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

      // Check if the duplication tasks table exists
      const tasksTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'project_duplication_tasks'
      )
    `);

      const tasksTableExists = tasksTableCheck.rows[0].exists;
      if (!tasksTableExists) {
        logger.warn(
          'Project duplication tasks table does not exist, fallback to synchronous duplication'
        );

        // Import the duplication service
        const projectDuplicationService = await import('../services/projectDuplicationService');

        // Verify the source project exists and belongs to the user
        const projectCheck = await pool.query(
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

        // Duplicate the project synchronously
        const newProject = await projectDuplicationService.duplicateProject(
          pool,
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

        logger.info('Project duplicated successfully (synchronous)', {
          originalProjectId,
          newProjectId: newProject.id,
          newTitle,
        });

        return res.status(201).json(newProject);
      }

      // Verify the source project exists and belongs to the user
      const projectCheck = await pool.query(
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

      // Import the duplication queue service
      const projectDuplicationQueueService = await import(
        '../services/projectDuplicationQueueService'
      );

      // Trigger an asynchronous duplication
      const taskId = await projectDuplicationQueueService.default.triggerProjectDuplication(
        pool,
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
      res.status(202).json({
        taskId,
        status: 'pending',
        originalProjectId,
        message: 'Project duplication started. Monitor progress using the duplication task API.',
      });
    } catch (error) {
      logger.error('Error initiating project duplication', {
        error,
        originalProjectId,
        userId,
        newTitle,
      });
      next(error);
    }
  }
);

// GET /api/duplication - List duplication tasks for the current user
router.get(
  '/',
  authMiddleware,
  validate(getDuplicationsSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { limit = 10, offset = 0 } = req.query as unknown as {
      limit: number;
      offset: number;
    };

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Fetching duplication tasks for user', {
        userId,
        limit,
        offset,
      });

      // Check if the duplication tasks table exists
      const tasksTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'project_duplication_tasks'
      )
    `);

      const tasksTableExists = tasksTableCheck.rows[0].exists;
      if (!tasksTableExists) {
        logger.warn('Project duplication tasks table does not exist');
        return res.status(200).json({
          tasks: [],
          total: 0,
        });
      }

      // Import the duplication queue service
      const projectDuplicationQueueService = await import(
        '../services/projectDuplicationQueueService'
      );

      // Get tasks for the user
      const tasks = await projectDuplicationQueueService.default.getDuplicationTasks(pool, userId);

      // Get total count for pagination
      const countQuery = `
      SELECT COUNT(*) as count 
      FROM project_duplication_tasks 
      WHERE user_id = $1
    `;
      const countResult = await pool.query(countQuery, [userId]);
      const totalTasks = parseInt(countResult.rows[0].count, 10);

      // Return tasks with pagination info
      res.status(200).json({
        tasks: tasks.slice(offset, offset + limit),
        total: totalTasks,
        limit,
        offset,
      });
    } catch (error) {
      logger.error('Error fetching duplication tasks', { error, userId });
      next(error);
    }
  }
);

// GET /api/duplication/:taskId - Get a specific duplication task
router.get(
  '/:taskId',
  authMiddleware,
  validate(getDuplicationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { taskId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Fetching duplication task', { userId, taskId });

      // Check if the duplication tasks table exists
      const tasksTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'project_duplication_tasks'
      )
    `);

      const tasksTableExists = tasksTableCheck.rows[0].exists;
      if (!tasksTableExists) {
        logger.warn('Project duplication tasks table does not exist');
        return res.status(404).json({ message: 'Task not found - tasks table missing' });
      }

      // Import the duplication queue service
      const projectDuplicationQueueService = await import(
        '../services/projectDuplicationQueueService'
      );

      // Get the task
      const task = await projectDuplicationQueueService.default.getDuplicationTask(
        pool,
        taskId,
        userId
      );

      if (!task) {
        logger.info('Duplication task not found or not authorized', {
          userId,
          taskId,
        });
        return res.status(404).json({ message: 'Task not found or access denied' });
      }

      // Return the task
      res.status(200).json(task);
    } catch (error) {
      logger.error('Error fetching duplication task', {
        error,
        userId,
        taskId,
      });
      next(error);
    }
  }
);

// DELETE /api/duplication/:taskId - Cancel a duplication task
router.delete(
  '/:taskId',
  authMiddleware,
  validate(cancelDuplicationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { taskId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Authentication error' });

    try {
      logger.info('Cancelling duplication task', { userId, taskId });

      // Check if the duplication tasks table exists
      const tasksTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'project_duplication_tasks'
      )
    `);

      const tasksTableExists = tasksTableCheck.rows[0].exists;
      if (!tasksTableExists) {
        logger.warn('Project duplication tasks table does not exist');
        return res.status(404).json({ message: 'Task not found - tasks table missing' });
      }

      // Import the duplication queue service
      const projectDuplicationQueueService = await import(
        '../services/projectDuplicationQueueService'
      );

      // Cancel the task
      const cancelled = await projectDuplicationQueueService.default.cancelDuplicationTask(
        pool,
        taskId,
        userId
      );

      if (!cancelled) {
        logger.info('Failed to cancel duplication task', { userId, taskId });
        return res.status(400).json({ message: 'Task could not be cancelled' });
      }

      // Return success
      res.status(204).send();
    } catch (error) {
      logger.error('Error cancelling duplication task', {
        error,
        userId,
        taskId,
      });
      next(error);
    }
  }
);

export default router;
