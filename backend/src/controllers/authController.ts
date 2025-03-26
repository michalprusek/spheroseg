import { Request, Response } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, changePassword } from '../services/userService';
import { AppError } from '../middleware/errorHandler';

// Schema for registration validation
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long')
});

// Schema for login validation
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
});

// Schema for password change validation
const passwordChangeSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long')
});

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response) => {
  // Validate request body
  const result = registerSchema.safeParse(req.body);
  
  if (!result.success) {
    throw new AppError(result.error.message, 400);
  }
  
  // Register user
  const { email, password } = result.data;
  const userData = await registerUser(email, password);
  
  // Send response
  return res.status(201).json({
    status: 'success',
    data: {
      user: userData.user,
      token: userData.token
    }
  });
};

/**
 * Login a user
 */
export const login = async (req: Request, res: Response) => {
  // Validate request body
  const result = loginSchema.safeParse(req.body);
  
  if (!result.success) {
    throw new AppError(result.error.message, 400);
  }
  
  // Login user
  const { email, password } = result.data;
  const userData = await loginUser(email, password);
  
  // Send response
  return res.status(200).json({
    status: 'success',
    data: {
      user: userData.user,
      token: userData.token
    }
  });
};

/**
 * Change user password
 */
export const updatePassword = async (req: Request, res: Response) => {
  // Validate request body
  const result = passwordChangeSchema.safeParse(req.body);
  
  if (!result.success) {
    throw new AppError(result.error.message, 400);
  }
  
  // Change password
  const { currentPassword, newPassword } = result.data;
  const response = await changePassword(req.user!.id, currentPassword, newPassword);
  
  // Send response
  return res.status(200).json({
    status: 'success',
    data: response
  });
}; 