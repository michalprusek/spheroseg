import express from 'express';
import { z } from 'zod';
import { authenticateJWT } from '../auth/middleware';
import * as projectController from './controllers/project.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { checkProjectOwnership } from './middleware/ownership.middleware';

const router = express.Router();

// Validation schemas (can be used in controllers if needed)
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

// List projects
router.get('/', authenticateJWT, asyncHandler(projectController.listProjects));

// Create project
router.post('/', authenticateJWT, asyncHandler(projectController.createProject));

// Get project
router.get('/:projectId', authenticateJWT, asyncHandler(checkProjectOwnership), asyncHandler(projectController.getProject));

// Update project
router.put('/:projectId', authenticateJWT, asyncHandler(checkProjectOwnership), asyncHandler(projectController.updateProject));

// Delete project
router.delete('/:projectId', authenticateJWT, asyncHandler(checkProjectOwnership), asyncHandler(projectController.deleteProject));

// Associate file
router.post('/:projectId/files', authenticateJWT, asyncHandler(checkProjectOwnership), asyncHandler(projectController.associateFile));

// Disassociate file
router.delete('/:projectId/files/:fileId', authenticateJWT, asyncHandler(checkProjectOwnership), asyncHandler(projectController.disassociateFile));

// Segmentation endpoints
router.post('/:projectId/segmentation', authenticateJWT, asyncHandler(checkProjectOwnership), asyncHandler(projectController.startSegmentationJob));

router.get('/:projectId/segmentation/:jobId/status', authenticateJWT, asyncHandler(checkProjectOwnership), asyncHandler(projectController.getSegmentationJobStatus));

router.get('/:projectId/segmentation/:jobId/result', authenticateJWT, asyncHandler(checkProjectOwnership), asyncHandler(projectController.getSegmentationJobResult));

export default router;
