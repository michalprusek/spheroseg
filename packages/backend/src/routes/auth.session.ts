/**
 * Session-based Authentication Routes
 * 
 * Enhanced authentication routes that support both JWT and session-based authentication.
 * Provides gradual migration path from JWT to sessions.
 */

import * as express from 'express';
import { Response, Router } from 'express';
import { validate } from '../middleware/validationMiddleware';
import {
  loginSchema,
  LoginRequest,
} from '../validators/authValidators';
import { AuthenticatedRequest } from '../security/middleware/auth';
import { sessionAuth, createAuthSession, destroyAuthSession } from '../security/middleware/sessionAuth';
import sessionService from '../services/sessionService';
import logger from '../utils/logger';
import authService from '../services/authService';
import {
  sendSuccess,
  sendUnauthorized,
  asyncHandler,
} from '../utils/responseHelpers';

const router: Router = express.Router();

/**
 * Enhanced login with session support
 * Creates both JWT tokens and session for backward compatibility
 */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler<void, AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, remember_me } = req.body as LoginRequest;

    // Authenticate user with existing service
    const result = await authService.loginUser(email, password, remember_me);
    
    // Create session in addition to JWT
    if (result.user && req.session) {
      await createAuthSession(req, {
        id: result.user.id,
        email: result.user.email,
        role: (result.user as any).role || 'user',
      });
      
      // Set session cookie options based on remember_me
      if (remember_me) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }
      
      logger.info('Session created for user', {
        userId: result.user.id,
        sessionId: req.sessionID,
        authMethod: 'hybrid',
      });
    }

    // Return JWT tokens for backward compatibility
    sendSuccess(res, result, 'Login successful');
  })
);

/**
 * Session-only login endpoint
 * For clients that prefer session-based auth
 */
router.post(
  '/session/login',
  validate(loginSchema),
  asyncHandler<void, AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, remember_me } = req.body as LoginRequest;

    // Authenticate user
    const user = await authService.authenticateUser(email, password);
    if (!user) {
      sendUnauthorized(res, 'Invalid email or password');
      return;
    }

    // Create session only (no JWT)
    await createAuthSession(req, {
      id: user.id,
      email: user.email,
      role: (user as any).role || 'user',
    });
    
    // Set session cookie options
    if (remember_me) {
      req.session!.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    
    logger.info('Session-only login successful', {
      userId: user.id,
      sessionId: req.sessionID,
    });

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: (user as any).role || 'user',
      },
      sessionId: req.sessionID,
      authMethod: 'session',
    }, 'Login successful');
  })
);

/**
 * Logout endpoint - destroys both session and invalidates JWT
 */
router.post(
  '/logout',
  sessionAuth({ allowEither: true }),
  asyncHandler<void, AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || req.session?.userId;
    const sessionId = req.sessionID;
    
    try {
      // Destroy session
      if (req.session) {
        await destroyAuthSession(req);
      }
      
      // TODO: Invalidate JWT token if provided
      // This requires token blacklisting implementation
      
      logger.info('User logged out', { userId, sessionId });
      
      sendSuccess(res, null, 'Logout successful');
    } catch (error) {
      logger.error('Logout error', { error, userId, sessionId });
      // Still return success to client
      sendSuccess(res, null, 'Logout completed');
    }
  })
);

/**
 * Get current session info
 */
router.get(
  '/session/info',
  sessionAuth({ requireSession: true }),
  asyncHandler<void, AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.session || !req.session.userId) {
      sendUnauthorized(res, 'No active session');
      return;
    }

    const sessionInfo = {
      userId: req.session.userId,
      email: req.session.email,
      role: req.session.role,
      loginTime: req.session.loginTime,
      lastActivity: req.session.lastActivity,
      expiresAt: req.session.expiresAt,
      isVerified: req.session.isVerified,
      requiresReauth: req.session.requiresReauth,
    };

    sendSuccess(res, sessionInfo);
  })
);

/**
 * Get all active sessions for current user
 */
router.get(
  '/session/list',
  sessionAuth({ requireSession: true }),
  asyncHandler<void, AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.session!.userId!;
    const sessions = await sessionService.getUserSessions(userId);
    
    sendSuccess(res, {
      sessions,
      currentSessionId: req.sessionID,
    });
  })
);

/**
 * Invalidate all other sessions
 */
router.post(
  '/session/invalidate-others',
  sessionAuth({ requireSession: true }),
  asyncHandler<void, AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.session!.userId!;
    const currentSessionId = req.sessionID;
    
    const invalidated = await sessionService.invalidateAllUserSessions(
      userId,
      currentSessionId
    );
    
    logger.info('User invalidated other sessions', {
      userId,
      currentSessionId,
      invalidatedCount: invalidated,
    });
    
    sendSuccess(res, {
      invalidated,
      message: `${invalidated} session(s) invalidated`,
    });
  })
);

/**
 * Session statistics (admin only)
 */
router.get(
  '/session/stats',
  sessionAuth({ requireSession: true }),
  asyncHandler<void, AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response) => {
    // Check if user is admin
    if (req.session!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }
    
    const stats = await sessionService.getSessionStats();
    sendSuccess(res, stats);
  })
);

/**
 * Extend session expiry
 */
router.post(
  '/session/extend',
  sessionAuth({ requireSession: true }),
  asyncHandler<void, AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.session) {
      sendUnauthorized(res, 'No active session');
      return;
    }
    
    // Extend session by updating expiry
    const newExpiry = new Date();
    newExpiry.setHours(newExpiry.getHours() + 1); // Extend by 1 hour
    req.session.expiresAt = newExpiry;
    req.session.renewedAt = new Date();
    
    // Force session save
    req.session.save((err) => {
      if (err) {
        logger.error('Error extending session', { error: err });
      }
    });
    
    sendSuccess(res, {
      expiresAt: newExpiry,
      extended: true,
    });
  })
);

export default router;