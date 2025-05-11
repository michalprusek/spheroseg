/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user info to requests
 */
import { Request, Response, NextFunction } from 'express';
import tokenService, { TokenType } from '../services/tokenService';
import config from '../config';
import logger from '../utils/logger';

// Define the structure of the decoded user payload from JWT
export interface UserPayload {
  userId: string;
  email: string;
  type?: TokenType;
  // Enhanced JWT security fields
  tokenId?: string; // JWT ID (jti)
  fingerprint?: string; // Security fingerprint
  tokenVersion?: number; // Token format version
}

// Token metadata for additional token information
export interface TokenMetadata {
  issuedAt: Date;
  expiresAt: Date;
}

// Extend the Express Request interface to include the user property and token metadata
export interface AuthenticatedRequest extends Request {
  user?: UserPayload; // Make user optional as it's added by middleware
  tokenMetadata?: TokenMetadata; // Additional token information
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] }; // Add optional files property for Multer
}

/**
 * Enhanced middleware to verify JWT access token with additional security checks
 * @param req The Express request object
 * @param res The Express response object
 * @param next The next middleware function
 */
export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token as an access token with enhanced validation
    const decoded = tokenService.verifyToken(token, TokenType.ACCESS, {
      validateFingerprint: config.auth.tokenSecurityMode === 'strict',
      requiredIssuer: 'spheroseg-auth',
      requiredAudience: 'spheroseg-api',
    });

    // Add user data to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      type: decoded.type,
      // Add additional claims for enhanced security
      tokenId: decoded.jti,
      fingerprint: decoded.fingerprint,
      tokenVersion: decoded.version,
    };

    // Add token metadata to request for access in routes
    req.tokenMetadata = {
      issuedAt: new Date((decoded as any).iat * 1000),
      expiresAt: new Date((decoded as any).exp * 1000),
    };

    logger.debug(`User authenticated: ${req.user.userId}, ${req.user.email}`, {
      tokenId: decoded.jti,
      fingerprint: decoded.fingerprint?.substring(0, 8), // Only log part of the fingerprint for privacy
    });

    next();
  } catch (error) {
    // Special case for development - use mock user ID
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.USE_MOCK_USER === 'true' &&
      config.auth.tokenSecurityMode !== 'strict'
    ) {
      logger.warn('Using development authentication mode', { error });
      req.user = {
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Valid UUID format that matches our test user
        email: 'dev@example.com',
        type: TokenType.ACCESS,
        tokenId: 'dev-token-id',
        fingerprint: 'dev-fingerprint',
        tokenVersion: 1,
      };
      logger.debug('Using development authentication', {
        userId: req.user.userId,
      });
      next();
      return;
    }

    // Handle different error types with enhanced error details
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage === 'Token expired') {
        return res.status(401).json({
          message: 'Your session has expired. Please sign in again.',
          code: 'token_expired',
          showRefresh: true,
        });
      } else if (errorMessage === 'Invalid token') {
        return res.status(401).json({
          message: 'Invalid authentication token',
          code: 'invalid_token',
        });
      } else if (errorMessage.includes('token type')) {
        return res.status(401).json({
          message: 'Invalid token type',
          code: 'invalid_token_type',
        });
      } else if (errorMessage.includes('fingerprint')) {
        // Security error - possible token theft or replay
        logger.warn('Security warning: Token fingerprint mismatch', {
          error: errorMessage,
          ip: req.ip,
        });
        return res.status(401).json({
          message: 'Security verification failed',
          code: 'security_verification_failed',
        });
      } else if (errorMessage === 'Token not active yet') {
        return res.status(401).json({
          message: 'Token not yet valid',
          code: 'token_not_active',
        });
      }
    }

    logger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(401).json({ message: 'Authentication failed', code: 'auth_failed' });
  }
};

/**
 * Optional authentication middleware - attaches user if token is valid, but doesn't reject if no token
 * Uses enhanced token verification similar to the main authMiddleware
 */
export const optionalAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token, but that's ok - proceed without user
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token as an access token with the same enhanced validation
    const decoded = tokenService.verifyToken(token, TokenType.ACCESS, {
      validateFingerprint: config.auth.tokenSecurityMode === 'strict',
      requiredIssuer: 'spheroseg-auth',
      requiredAudience: 'spheroseg-api',
    });

    // Add user data to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      type: decoded.type,
      // Add additional claims for enhanced security
      tokenId: decoded.jti,
      fingerprint: decoded.fingerprint,
      tokenVersion: decoded.version,
    };

    // Add token metadata to request for access in routes
    req.tokenMetadata = {
      issuedAt: new Date((decoded as any).iat * 1000),
      expiresAt: new Date((decoded as any).exp * 1000),
    };

    logger.debug(`Optional auth: User authenticated: ${req.user.userId}, ${req.user.email}`, {
      tokenId: decoded.jti?.substring(0, 8),
    });
  } catch (error) {
    // Token invalid, but that's ok for optional auth
    logger.debug('Optional auth: Invalid token', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip?.substring(0, 16), // Only log part of the IP for privacy
    });
  }

  next();
};

/**
 * Role-based authorization middleware factory
 * @param roles Array of allowed roles
 */
export const authorizeRoles = (roles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // This middleware must be used after authMiddleware
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const { userId } = req.user;

      // For dev environment with specific token security mode, bypass role check
      if (process.env.NODE_ENV === 'development' && config.auth.tokenSecurityMode === 'standard') {
        logger.warn('Bypassing role check in development mode', { userId });
        next();
        return;
      }

      // In a real app, we would query the database for the user's role
      // Here's a simplified example:
      const userPool = await import('../db').then((module) => module.default);
      const result = await userPool.query('SELECT role FROM users WHERE id = $1', [userId]);

      if (result.rows.length === 0) {
        logger.warn('User not found during role check', { userId });
        return res.status(404).json({ message: 'User not found' });
      }

      const userRole = result.rows[0].role;

      // Check if user's role is in the allowed roles
      if (!roles.includes(userRole)) {
        logger.warn('Unauthorized role access attempt', {
          userId,
          userRole,
          requiredRoles: roles,
        });
        return res.status(403).json({ message: 'Unauthorized: Insufficient privileges' });
      }

      next();
    } catch (error) {
      logger.error('Error during role authorization', {
        error,
        userId: req.user.userId,
      });
      return res.status(500).json({ message: 'Authorization error' });
    }
  };
};

export default authMiddleware;
