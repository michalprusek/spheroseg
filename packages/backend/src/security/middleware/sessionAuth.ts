/**
 * Session-based Authentication Middleware
 * 
 * Provides session authentication as an alternative or complement to JWT.
 * Supports hybrid authentication where either session or JWT is valid.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import sessionService from '../../services/sessionService';
import logger from '../../utils/logger';
import config from '../../config';

export interface SessionAuthOptions {
  requireSession?: boolean;
  requireJwt?: boolean;
  allowEither?: boolean;
  enforceSessionLimit?: boolean;
  maxSessions?: number;
}

/**
 * Session authentication middleware
 * Can be used standalone or with JWT authentication
 */
export function sessionAuth(options: SessionAuthOptions = {}) {
  const {
    requireSession = true,
    requireJwt = false,
    allowEither = true,
    enforceSessionLimit = true,
    maxSessions = 5,
  } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let isAuthenticated = false;
      let authMethod: 'session' | 'jwt' | null = null;

      // Check session authentication
      if (req.session && req.session.userId) {
        // Validate session hasn't been marked for re-auth
        if (req.session.requiresReauth) {
          logger.warn('Session requires re-authentication', {
            userId: req.session.userId,
            sessionId: req.sessionID,
          });
          
          if (requireSession && !allowEither) {
            return res.status(401).json({
              success: false,
              error: {
                code: 'REAUTH_REQUIRED',
                message: 'Re-authentication required',
              },
            });
          }
        } else {
          // Session is valid
          req.user = {
            userId: req.session.userId,
            email: req.session.email || '',
            role: req.session.role,
          };
          
          isAuthenticated = true;
          authMethod = 'session';
          
          // Track session activity
          await sessionService.trackUserSession(req.session.userId, req.sessionID);
          
          // Enforce session limit if enabled
          if (enforceSessionLimit) {
            await sessionService.enforceSessionLimit(req.session.userId, maxSessions);
          }
        }
      }

      // Check JWT authentication if session not found or if both are allowed
      if (!isAuthenticated && req.user && req.user.userId) {
        // JWT was already validated by previous middleware
        isAuthenticated = true;
        authMethod = 'jwt';
        
        // Optionally create a session from JWT
        if (config.auth.useKeyRotation && req.session && !req.session.userId) {
          // Migrate JWT to session for better security
          await sessionService.migrateJwtToSession(
            req.user.userId,
            req.sessionID,
            req.user
          );
          
          // Update session
          req.session.userId = req.user.userId;
          req.session.email = req.user.email;
          req.session.role = req.user.role;
          req.session.loginTime = new Date();
          req.session.isVerified = true;
        }
      }

      // Validate authentication based on requirements
      if (requireSession && authMethod !== 'session') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_REQUIRED',
            message: 'Session authentication required',
          },
        });
      }

      if (requireJwt && authMethod !== 'jwt') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'JWT_REQUIRED',
            message: 'JWT authentication required',
          },
        });
      }

      if (!isAuthenticated && (requireSession || requireJwt)) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
      }

      // Add authentication method to request
      (req as any).authMethod = authMethod;

      next();
    } catch (error) {
      logger.error('Session authentication error', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication error occurred',
        },
      });
    }
  };
}

/**
 * Require active session middleware
 * Stricter than sessionAuth - requires valid, active session
 */
export function requireActiveSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_SESSION',
        message: 'No active session found',
      },
    });
  }

  if (req.session.requiresReauth) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'REAUTH_REQUIRED',
        message: 'Re-authentication required',
      },
    });
  }

  // Check session expiry
  if (req.session.expiresAt) {
    const expiresAt = new Date(req.session.expiresAt);
    if (expiresAt < new Date()) {
      logger.info('Session expired', {
        userId: req.session.userId,
        sessionId: req.sessionID,
        expiredAt: expiresAt,
      });
      
      req.session.destroy((err) => {
        if (err) {
          logger.error('Error destroying expired session', { error: err });
        }
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
        },
      });
    }
  }

  next();
}

/**
 * Create session after successful authentication
 */
export async function createAuthSession(
  req: AuthenticatedRequest,
  user: { id: string; email: string; role?: string }
): Promise<void> {
  if (!req.session) {
    throw new Error('Session middleware not initialized');
  }

  // Create session
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.role = user.role || 'user';
  req.session.loginTime = new Date();
  req.session.lastActivity = new Date();
  req.session.isVerified = true;
  req.session.requiresReauth = false;
  
  // Security metadata
  req.session.fingerprint = generateFingerprint(req);
  req.session.ipAddress = getClientIp(req);
  req.session.userAgent = req.get('user-agent');
  
  // Session lifecycle
  req.session.createdAt = new Date();
  req.session.renewedAt = new Date();
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + config.auth.sessionTimeout);
  req.session.expiresAt = expiresAt;

  // Track session
  await sessionService.trackUserSession(user.id, req.sessionID);
  
  // Enforce session limit
  await sessionService.enforceSessionLimit(user.id);

  logger.info('Authentication session created', {
    userId: user.id,
    sessionId: req.sessionID,
    authMethod: 'session',
  });
}

/**
 * Destroy authentication session
 */
export async function destroyAuthSession(req: AuthenticatedRequest): Promise<void> {
  if (!req.session) {
    return;
  }

  const sessionId = req.sessionID;
  const userId = req.session.userId;

  if (userId) {
    await sessionService.untrackUserSession(userId, sessionId);
  }

  return new Promise((resolve, reject) => {
    req.session!.destroy((err) => {
      if (err) {
        logger.error('Error destroying session', { error: err, sessionId, userId });
        reject(err);
      } else {
        logger.info('Authentication session destroyed', { sessionId, userId });
        res.clearCookie('spheroseg.sid');
        resolve();
      }
    });
  });
}

/**
 * Generate session fingerprint
 */
function generateFingerprint(req: AuthenticatedRequest): string {
  const crypto = require('crypto');
  const components = [
    req.get('user-agent') || '',
    req.get('accept-language') || '',
    req.get('accept-encoding') || '',
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Get client IP address
 */
function getClientIp(req: AuthenticatedRequest): string {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return req.get('x-real-ip') || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
}

// Consolidated auth middleware that supports both JWT and sessions
export function authenticateUser(options: SessionAuthOptions = {}) {
  return sessionAuth({
    requireSession: false,
    requireJwt: false,
    allowEither: true,
    ...options,
  });
}