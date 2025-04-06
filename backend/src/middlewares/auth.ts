import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import jwt from 'jsonwebtoken';
import { config } from '@config/app';
import { query } from '@db/connection';

// Extend Express Request type to include user
// This is already defined in auth/middleware.ts, so we don't need to redefine it here

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header missing' });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Token missing' });
      return;
    }

    const decoded = jwt.verify(token, config.auth.jwtSecret) as {
      id: string;
      email: string;
    };

    // Get user from database to ensure they still exist
    const users = await query<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [decoded.id]
    );

    if (users.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Attach user to request
    req.user = users[0];
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    next(error);
  }
};

export const optionalAuthJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, config.auth.jwtSecret) as {
      id: string;
      email: string;
    };

    // Get user from database
    const users = await query<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [decoded.id]
    );

    if (users.length > 0) {
      req.user = users[0];
    }

    next();
  } catch (error) {
    // For optional auth, just continue if token is invalid
    next();
  }
};
