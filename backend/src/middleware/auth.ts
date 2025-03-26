import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import config from '../config/config';
import { AppError } from './errorHandler';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

// Authenticate user with JWT token
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1) Get token from authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Not authenticated. Please login', 401));
    }
    
    const token = authHeader.split(' ')[1];

    // 2) Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; email: string };

    // 3) Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    // 4) Add user to request object
    req.user = {
      id: user.id,
      email: user.email
    };

    // Proceed to next middleware
    next();
  } catch (error) {
    next(new AppError('Not authenticated. Please login', 401));
  }
};

// Utility function to generate JWT token
export const generateToken = (payload: { id: string; email: string }): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
}; 