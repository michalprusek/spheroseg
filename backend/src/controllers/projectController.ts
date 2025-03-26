import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createProject,
  getProjectById,
  getUserProjects,
  updateProject,
  deleteProject
} from '../services/projectService';
import { AppError } from '../middleware/errorHandler';

// Schema for project creation validation
const projectCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional()
});

// Schema for project update validation
const projectUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional()
});

/**
 * Create a new project
 */
export const create = async (req: Request, res: Response) => {
  // Validate request body
  const result = projectCreateSchema.safeParse(req.body);
  
  if (!result.success) {
    throw new AppError(result.error.message, 400);
  }
  
  // Create project
  const userId = req.user!.id;
  const { title, description } = result.data;
  const project = await createProject(userId, title, description);
  
  return res.status(201).json({
    status: 'success',
    data: project
  });
};

/**
 * Get a project by ID
 */
export const getOne = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  
  const project = await getProjectById(id, userId);
  
  return res.status(200).json({
    status: 'success',
    data: project
  });
};

/**
 * Get all projects for the authenticated user
 */
export const getAll = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  const projects = await getUserProjects(userId);
  
  return res.status(200).json({
    status: 'success',
    data: projects
  });
};

/**
 * Update a project
 */
export const update = async (req: Request, res: Response) => {
  // Validate request body
  const result = projectUpdateSchema.safeParse(req.body);
  
  if (!result.success) {
    throw new AppError(result.error.message, 400);
  }
  
  // Update project
  const { id } = req.params;
  const userId = req.user!.id;
  const { title, description } = result.data;
  
  const updatedProject = await updateProject(id, userId, title, description);
  
  return res.status(200).json({
    status: 'success',
    data: updatedProject
  });
};

/**
 * Delete a project
 */
export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  
  const result = await deleteProject(id, userId);
  
  return res.status(200).json({
    status: 'success',
    data: result
  });
}; 