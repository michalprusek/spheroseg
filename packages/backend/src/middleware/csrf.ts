/**
 * CSRF Protection Middleware
 *
 * Implements Cross-Site Request Forgery protection using the double-submit cookie pattern
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { securityConfig } from '../config/security';
import logger from '../utils/logger';

interface CSRFRequest extends Request {
  csrfToken?: () => string;
}

// Store for CSRF tokens (in production, use Redis or session store)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of csrfTokens.entries()) {
    if (value.expires < now) {
      csrfTokens.delete(key);
    }
  }
}, 300000); // Clean every 5 minutes

/**
 * Generate a new CSRF token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Get or create CSRF token for a session
 */
function getOrCreateToken(sessionId: string): string {
  const existing = csrfTokens.get(sessionId);
  const now = Date.now();

  if (existing && existing.expires > now) {
    return existing.token;
  }

  const token = generateToken();
  const expires = now + 3600000; // 1 hour
  csrfTokens.set(sessionId, { token, expires });

  return token;
}

/**
 * Validate CSRF token
 */
function validateToken(sessionId: string, providedToken: string): boolean {
  const stored = csrfTokens.get(sessionId);

  if (!stored || stored.expires < Date.now()) {
    return false;
  }

  // Constant-time comparison
  return crypto.timingSafeEqual(Buffer.from(stored.token), Buffer.from(providedToken));
}

/**
 * CSRF protection middleware
 */
export function csrfProtection(req: CSRFRequest, res: Response, next: NextFunction): void {
  // Skip CSRF protection if disabled
  if (!securityConfig.csrf.enabled) {
    return next();
  }

  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Add CSRF token function for GET requests
    req.csrfToken = () => {
      const sessionId = req.sessionID || req.ip || 'anonymous';
      return getOrCreateToken(sessionId);
    };
    return next();
  }

  // Get session ID (use sessionID if available, otherwise use IP)
  const sessionId = req.sessionID || req.ip || 'anonymous';

  // Get token from request
  const token =
    (req.headers[securityConfig.csrf.headerName.toLowerCase()] as string) ||
    req.body[securityConfig.csrf.paramName] ||
    (req.query[securityConfig.csrf.paramName] as string);

  if (!token) {
    logger.warn('CSRF token missing', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    res.status(403).json({
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING',
    });
    return;
  }

  // Validate token
  if (!validateToken(sessionId, token as string)) {
    logger.warn('Invalid CSRF token', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID',
    });
    return;
  }

  // Token is valid, proceed
  next();
}

/**
 * Middleware to set CSRF token cookie
 */
export function csrfCookie(req: CSRFRequest, res: Response, next: NextFunction): void {
  if (!securityConfig.csrf.enabled) {
    return next();
  }

  // Skip if cookie already set
  if (req.cookies && req.cookies[securityConfig.csrf.cookieName]) {
    return next();
  }

  // Generate token
  const sessionId = req.sessionID || req.ip || 'anonymous';
  const token = getOrCreateToken(sessionId);

  // Set cookie
  res.cookie(securityConfig.csrf.cookieName, token, {
    httpOnly: securityConfig.csrf.cookie.httpOnly,
    secure: securityConfig.csrf.cookie.secure,
    sameSite: securityConfig.csrf.cookie.sameSite,
    maxAge: 3600000, // 1 hour
  });

  next();
}

/**
 * Get CSRF token endpoint
 */
export function csrfTokenEndpoint(req: CSRFRequest, res: Response): void {
  const sessionId = req.sessionID || req.ip || 'anonymous';
  const token = getOrCreateToken(sessionId);

  res.json({ csrfToken: token });
}

export default csrfProtection;
