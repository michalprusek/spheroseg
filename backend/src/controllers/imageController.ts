import { Request, Response } from 'express';
import { z } from 'zod';
import {
  uploadImage,
  getImageById,
  getProjectImages,
  deleteImage,
  updateSegmentationStatus
} from '../services/imageService';
import { AppError } from '../middleware/errorHandler';

/**
 * Upload an image to a project
 */
export const upload = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = req.user!.id;

  // Check if file exists
  if (!req.file) {
    throw new AppError('No image file uploaded', 400);
  }

  // Upload image
  const image = await uploadImage(userId, projectId, req.file);

  return res.status(201).json({
    status: 'success',
    data: image
  });
};

/**
 * Get an image by ID
 */
export const getOne = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const image = await getImageById(id, userId);

  return res.status(200).json({
    status: 'success',
    data: image
  });
};

/**
 * Get all images for a project
 */
export const getAll = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = req.user!.id;

  const images = await getProjectImages(projectId, userId);

  return res.status(200).json({
    status: 'success',
    data: images
  });
};

/**
 * Delete an image
 */
export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const result = await deleteImage(id, userId);

  return res.status(200).json({
    status: 'success',
    data: result
  });
};

/**
 * Update segmentation status
 */
export const updateSegmentation = async (req: Request, res: Response) => {
  // Validate request body
  const statusSchema = z.object({
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    result: z.any().optional()
  });

  const result = statusSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError('Invalid status data', 400);
  }

  const { id } = req.params;
  const { status, result: segmentationResult } = result.data;

  const updatedImage = await updateSegmentationStatus(id, status, segmentationResult);

  return res.status(200).json({
    status: 'success',
    data: updatedImage
  });
}; 