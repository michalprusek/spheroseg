/**
 * Development Authentication Middleware
 * Provides automatic authentication for development environment
 * This simplifies testing by bypassing the need for login
 */
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Define the structure of the user payload
export interface UserPayload {
  userId: string;
  email: string;
  role?: string;
}

// Extend the Express Request interface to include the user property
export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

/**
 * Development middleware that automatically authenticates requests
 * This uses a predefined development user account with admin privileges
 * to simplify testing and development
 */
const devAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  logger.debug('Using development authentication mode');

  // Attach development user info to request with valid UUID
  req.user = {
    userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Fixed UUID for development user
    email: 'dev@example.com',
    role: 'admin',
  };

  next();
};

export default devAuthMiddleware;
