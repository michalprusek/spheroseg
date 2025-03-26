import { Request, Response } from 'express';
import { z } from 'zod';
import { getUserProfile, updateUserProfile } from '../services/userService';
import { AppError } from '../middleware/errorHandler';

// Schema for profile update validation
const profileUpdateSchema = z.object({
  username: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().url('Invalid URL').optional(),
  preferredLanguage: z.string().optional(),
  preferredTheme: z.string().optional()
});

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const profile = await getUserProfile(userId);
  
  return res.status(200).json({
    status: 'success',
    data: profile
  });
};

/**
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response) => {
  // Validate request body
  const result = profileUpdateSchema.safeParse(req.body);
  
  if (!result.success) {
    throw new AppError(result.error.message, 400);
  }
  
  // Update profile
  const userId = req.user!.id;
  const updatedProfile = await updateUserProfile(userId, result.data);
  
  return res.status(200).json({
    status: 'success',
    data: updatedProfile
  });
}; 