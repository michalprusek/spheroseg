/**
 * Consolidated Authentication & Authorization Middleware
 * 
 * This module consolidates all auth-related middleware:
 * - JWT token verification
 * - User authentication
 * - Role-based authorization  
 * - Socket.IO authentication
 * - Development authentication bypass
 */

import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import tokenService, { TokenType } from '../../services/tokenService';
import pool from '../../db';
import config from '../../config';
import logger from '../../utils/logger';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

export interface UserPayload {
  userId: string;
  email: string;
  type?: TokenType;
  role?: string;
  // Enhanced JWT security fields
  tokenId?: string;
  fingerprint?: string;
  tokenVersion?: number;
}

export interface TokenMetadata {
  issuedAt: Date;
  expiresAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
  tokenMetadata?: TokenMetadata;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

export interface AuthenticatedSocket extends Socket {
  user?: UserPayload;
}

// =============================================================================
// JWT TOKEN VERIFICATION
// =============================================================================

/**
 * Extract and verify JWT token from request
 */
const extractAndVerifyToken = async (
  authHeader: string | undefined,
  tokenType: TokenType = TokenType.ACCESS
): Promise<{ user: UserPayload; metadata: TokenMetadata }> => {
  if (!authHeader) {
    throw new Error('Authorization header missing');
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Invalid authorization header format', {
      headerLength: authHeader.length,
      headerPrefix: authHeader.substring(0, 20),
      startsWithBearer: authHeader.startsWith('Bearer '),
      headerValue: authHeader
    });
    throw new Error('Invalid authorization header format');
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const payload = await tokenService.verifyToken(token, tokenType);
    
    const user: UserPayload = {
      userId: payload.userId,
      email: payload.email,
      type: payload.type,
      tokenId: payload.jti,
      fingerprint: payload.fingerprint,
      tokenVersion: payload.tokenVersion
    };

    const metadata: TokenMetadata = {
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000)
    };

    return { user, metadata };
  } catch (error) {
    logger.warn('Token verification failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenType 
    });
    throw new Error('Invalid or expired token');
  }
};

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

/**
 * Main authentication middleware - verifies JWT tokens
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { user, metadata } = await extractAndVerifyToken(
      req.headers.authorization,
      TokenType.ACCESS
    );

    req.user = user;
    req.tokenMetadata = metadata;

    logger.debug('User authenticated successfully', { 
      userId: user.userId,
      email: user.email 
    });

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    
    res.status(401).json({
      success: false,
      message,
      error: 'AUTHENTICATION_REQUIRED'
    });
  }
};

/**
 * Optional authentication middleware - attaches user if token exists
 */
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.headers.authorization) {
    return next();
  }

  try {
    const { user, metadata } = await extractAndVerifyToken(
      req.headers.authorization,
      TokenType.ACCESS
    );

    req.user = user;
    req.tokenMetadata = metadata;

    logger.debug('Optional authentication successful', { 
      userId: user.userId 
    });
  } catch (error) {
    logger.debug('Optional authentication failed, continuing without user', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  next();
};

// =============================================================================
// AUTHORIZATION MIDDLEWARE
// =============================================================================

/**
 * Check if user has admin role
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      error: 'NOT_AUTHENTICATED'
    });
  }

  try {
    // Fetch current role from database for accuracy
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }

    if (result.rows[0].role !== 'admin') {
      logger.warn('Non-admin user attempted to access admin resource', {
        userId: req.user.userId,
        email: req.user.email,
        role: result.rows[0].role,
        url: req.url
      });

      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    logger.debug('Admin authorization successful', { 
      userId: req.user.userId 
    });

    next();
  } catch (error) {
    logger.error('Admin authorization check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.userId
    });

    res.status(500).json({
      success: false,
      message: 'Authorization check failed',
      error: 'AUTHORIZATION_ERROR'
    });
  }
};

/**
 * Check if user account is approved
 */
export const requireApproved = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'NOT_AUTHENTICATED'
    });
  }

  try {
    // Check approval status from database
    const result = await pool.query(
      'SELECT is_approved FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }

    if (!result.rows[0].is_approved) {
      logger.warn('Unapproved user attempted to access restricted resource', {
        userId: req.user.userId,
        email: req.user.email,
        url: req.url
      });

      return res.status(403).json({
        success: false,
        message: 'Account not approved',
        error: 'ACCOUNT_NOT_APPROVED'
      });
    }

    logger.debug('User approval check successful', { 
      userId: req.user.userId 
    });

    next();
  } catch (error) {
    logger.error('Approval check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.userId
    });

    res.status(500).json({
      success: false,
      message: 'Approval check failed',
      error: 'AUTHORIZATION_ERROR'
    });
  }
};

/**
 * Check if user owns the resource
 */
export const requireResourceOwnership = (resourceIdParam: string = 'id') => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED'
      });
    }

    const resourceId = req.params[resourceIdParam];
    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: `Resource ID parameter '${resourceIdParam}' is required`,
        error: 'MISSING_RESOURCE_ID'
      });
    }

    try {
      // Check if user owns the resource (implementation depends on resource type)
      // This is a generic implementation - you might need specific queries for different resources
      const result = await pool.query(
        'SELECT user_id FROM projects WHERE id = $1 UNION SELECT user_id FROM images WHERE id = $1',
        [resourceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found',
          error: 'RESOURCE_NOT_FOUND'
        });
      }

      if (result.rows[0].user_id !== req.user.userId) {
        logger.warn('User attempted to access resource they do not own', {
          userId: req.user.userId,
          resourceId,
          resourceOwner: result.rows[0].user_id,
          url: req.url
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied - you do not own this resource',
          error: 'RESOURCE_ACCESS_DENIED'
        });
      }

      logger.debug('Resource ownership check successful', {
        userId: req.user.userId,
        resourceId
      });

      next();
    } catch (error) {
      logger.error('Resource ownership check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user.userId,
        resourceId
      });

      res.status(500).json({
        success: false,
        message: 'Ownership check failed',
        error: 'AUTHORIZATION_ERROR'
      });
    }
  };
};

// =============================================================================
// SOCKET.IO AUTHENTICATION
// =============================================================================

/**
 * Socket.IO authentication middleware
 */
export const authenticateSocket = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const payload = await tokenService.verifyToken(token, TokenType.ACCESS);
    
    socket.user = {
      userId: payload.userId,
      email: payload.email,
      type: payload.type,
      tokenId: payload.jti,
      fingerprint: payload.fingerprint,
      tokenVersion: payload.tokenVersion
    };

    logger.debug('Socket authentication successful', {
      userId: socket.user.userId,
      socketId: socket.id
    });

    next();
  } catch (error) {
    logger.warn('Socket authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      socketId: socket.id
    });

    next(new Error('Invalid or expired token'));
  }
};

// =============================================================================
// DEVELOPMENT MIDDLEWARE
// =============================================================================

/**
 * Development authentication bypass (ONLY for development environment)
 */
export const devAuthenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      message: 'Development middleware not available in production',
      error: 'DEV_MIDDLEWARE_BLOCKED'
    });
  }

  // Create a mock development user
  req.user = {
    userId: 'dev-user-id',
    email: 'dev@example.com',
    type: TokenType.ACCESS,
    role: 'admin'
  };

  req.tokenMetadata = {
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };

  logger.warn('Development authentication bypass used', {
    userId: req.user.userId,
    url: req.url
  });

  next();
};

// =============================================================================
// COMBINED MIDDLEWARE FACTORIES
// =============================================================================

/**
 * Create authentication middleware with authorization checks
 */
export const createAuthMiddleware = (options: {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireApproved?: boolean;
  requireOwnership?: string;
} = {}) => {
  const middlewares: Array<(req: AuthenticatedRequest, res: Response, next: NextFunction) => void> = [];

  // Add authentication
  if (options.requireAuth !== false) {
    middlewares.push(authenticate);
  } else {
    middlewares.push(optionalAuthenticate);
  }

  // Add authorization checks
  if (options.requireAdmin) {
    middlewares.push(requireAdmin);
  }

  if (options.requireApproved) {
    middlewares.push(requireApproved);
  }

  if (options.requireOwnership) {
    middlewares.push(requireResourceOwnership(options.requireOwnership));
  }

  return middlewares;
};

// =============================================================================
// EXPORTS
// =============================================================================

// Legacy exports for backward compatibility
export default authenticate;
export const authMiddleware = authenticate;
export const optionalAuthMiddleware = optionalAuthenticate;
export const isAdmin = requireAdmin;
export const isUserApproved = requireApproved;
export const socketAuthMiddleware = authenticateSocket;
export const devAuthMiddleware = devAuthenticate;

// New consolidated exports
export {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
  requireApproved,
  requireResourceOwnership,
  authenticateSocket,
  devAuthenticate,
  createAuthMiddleware
};