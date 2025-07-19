/**
 * Session Configuration
 * 
 * Configures express-session with Redis store for production-ready
 * session management with proper security settings.
 */

import session from 'express-session';
import RedisStore from 'connect-redis';
import { getRedis } from './redis';
import config from './index';
import logger from '../utils/logger';
import crypto from 'crypto';

// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
    role?: string;
    loginTime?: Date;
    lastActivity?: Date;
    fingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
    // CSRF token
    csrfSecret?: string;
    // Security flags
    isVerified?: boolean;
    requiresReauth?: boolean;
    // Session metadata
    createdAt?: Date;
    renewedAt?: Date;
    expiresAt?: Date;
  }
}

// Session configuration options
export interface SessionConfig {
  name: string;
  secret: string;
  resave: boolean;
  saveUninitialized: boolean;
  rolling: boolean;
  cookie: session.CookieOptions;
  store?: session.Store;
  genid?: (req: any) => string;
  unset?: 'destroy' | 'keep';
}

/**
 * Generate secure session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create session configuration
 */
export function createSessionConfig(): SessionConfig {
  const isProduction = config.isProduction;
  const sessionSecret = config.auth.sessionSecret || config.auth.jwtSecret;

  if (!sessionSecret) {
    throw new Error('Session secret is required for session management');
  }

  // Base session configuration
  const sessionConfig: SessionConfig = {
    name: 'spheroseg.sid', // Custom session name (not default 'connect.sid')
    secret: sessionSecret,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    rolling: true, // Reset expiry on activity
    cookie: {
      secure: isProduction || config.auth.secureCookies, // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: config.auth.sessionTimeout * 1000, // Convert to milliseconds
      sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
      domain: undefined, // Let browser handle domain
      path: '/', // Available throughout site
    },
    genid: generateSessionId,
    unset: 'destroy', // Destroy session on unset
  };

  // Add Redis store if available
  const redisClient = getRedis();
  if (redisClient) {
    try {
      sessionConfig.store = new RedisStore({
        client: redisClient as any,
        prefix: 'spheroseg:sess:',
        ttl: config.auth.sessionTimeout, // TTL in seconds
        disableTouch: false, // Enable touch to reset TTL
        serializer: {
          stringify: JSON.stringify,
          parse: JSON.parse,
        },
      });

      logger.info('Session store configured with Redis');
    } catch (error) {
      logger.error('Failed to configure Redis session store', { error });
      // Fall back to memory store (default)
    }
  } else {
    logger.warn('Redis not available, using memory store for sessions (not recommended for production)');
  }

  return sessionConfig;
}

/**
 * Session security middleware
 * Adds additional security checks and session management
 */
export function sessionSecurityMiddleware(req: any, res: any, next: any) {
  if (!req.session) {
    return next();
  }

  // Set session metadata on first use
  if (!req.session.createdAt) {
    req.session.createdAt = new Date();
    req.session.fingerprint = generateSessionFingerprint(req);
    req.session.ipAddress = getClientIp(req);
    req.session.userAgent = req.get('user-agent');
  }

  // Update last activity
  req.session.lastActivity = new Date();

  // Check session validity
  if (req.session.userId) {
    // Verify fingerprint hasn't changed (potential session hijacking)
    const currentFingerprint = generateSessionFingerprint(req);
    if (req.session.fingerprint && req.session.fingerprint !== currentFingerprint) {
      logger.warn('Session fingerprint mismatch detected', {
        userId: req.session.userId,
        sessionId: req.sessionID,
        originalIp: req.session.ipAddress,
        currentIp: getClientIp(req),
      });
      
      // Mark session as requiring re-authentication
      req.session.requiresReauth = true;
    }

    // Check for session timeout
    const lastActivity = req.session.lastActivity ? new Date(req.session.lastActivity) : new Date();
    const now = new Date();
    const idleTime = now.getTime() - lastActivity.getTime();
    const maxIdleTime = config.auth.sessionTimeout * 1000;

    if (idleTime > maxIdleTime) {
      logger.info('Session timeout due to inactivity', {
        userId: req.session.userId,
        sessionId: req.sessionID,
        idleMinutes: Math.floor(idleTime / 60000),
      });
      
      req.session.destroy((err: any) => {
        if (err) {
          logger.error('Error destroying timed out session', { error: err });
        }
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_TIMEOUT',
          message: 'Session has expired due to inactivity',
        },
      });
    }
  }

  next();
}

/**
 * Generate session fingerprint based on client characteristics
 */
function generateSessionFingerprint(req: any): string {
  const components = [
    req.get('user-agent') || '',
    req.get('accept-language') || '',
    req.get('accept-encoding') || '',
    // Don't include IP as it might change (mobile networks)
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Get client IP address handling proxies
 */
function getClientIp(req: any): string {
  // Handle various proxy headers
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return req.get('x-real-ip') || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Session cleanup job
 * Removes expired sessions from Redis
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const redisClient = getRedis();
  if (!redisClient) {
    return;
  }

  try {
    const sessionPrefix = 'spheroseg:sess:*';
    const keys = await redisClient.keys(sessionPrefix);
    
    let cleaned = 0;
    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      // TTL -2 means key doesn't exist, -1 means no expiry set
      if (ttl === -2 || ttl === 0) {
        await redisClient.del(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired sessions`);
    }
  } catch (error) {
    logger.error('Error cleaning up expired sessions', { error });
  }
}

/**
 * Create session for user after authentication
 */
export function createUserSession(req: any, user: { id: string; email: string; role?: string }) {
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.role = user.role || 'user';
  req.session.loginTime = new Date();
  req.session.isVerified = true;
  req.session.requiresReauth = false;
  
  // Security metadata
  req.session.fingerprint = generateSessionFingerprint(req);
  req.session.ipAddress = getClientIp(req);
  req.session.userAgent = req.get('user-agent');
  
  // Session lifecycle
  req.session.createdAt = new Date();
  req.session.renewedAt = new Date();
  req.session.lastActivity = new Date();
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + config.auth.sessionTimeout);
  req.session.expiresAt = expiresAt;
  
  logger.info('User session created', {
    userId: user.id,
    sessionId: req.sessionID,
    ipAddress: req.session.ipAddress,
  });
}

/**
 * Destroy user session
 */
export async function destroyUserSession(req: any): Promise<void> {
  const sessionId = req.sessionID;
  const userId = req.session?.userId;
  
  return new Promise((resolve, reject) => {
    req.session.destroy((err: any) => {
      if (err) {
        logger.error('Error destroying session', { error: err, sessionId, userId });
        reject(err);
      } else {
        logger.info('User session destroyed', { sessionId, userId });
        resolve();
      }
    });
  });
}

/**
 * Refresh session expiry
 */
export function refreshSessionExpiry(req: any) {
  if (!req.session || !req.session.userId) {
    return;
  }
  
  req.session.renewedAt = new Date();
  req.session.lastActivity = new Date();
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + config.auth.sessionTimeout);
  req.session.expiresAt = expiresAt;
  
  // Session.touch() is automatically called due to rolling: true
}

// Export session middleware creator
export default function createSessionMiddleware() {
  const sessionConfig = createSessionConfig();
  return session(sessionConfig);
}