/**
 * CSRF Protection Middleware
 * This middleware adds CSRF protection to the application
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Redis } from 'ioredis';

/**
 * CSRF configuration options
 */
export interface CSRFOptions {
  /** Cookie name for the CSRF token */
  cookie?: string;
  /** HTTP header name for the CSRF token */
  header?: string;
  /** Whether to ignore GET, HEAD, OPTIONS requests */
  ignoreMethods?: string[];
  /** Cookie options */
  cookieOptions?: {
    /** Whether the cookie is HTTP only */
    httpOnly?: boolean;
    /** Whether the cookie is secure */
    secure?: boolean;
    /** Cookie same site policy */
    sameSite?: boolean | 'lax' | 'strict' | 'none';
    /** Cookie path */
    path?: string;
    /** Cookie domain */
    domain?: string;
    /** Cookie max age in milliseconds */
    maxAge?: number;
  };
  /** Redis client for distributed token storage */
  redis?: Redis;
  /** Key prefix for Redis */
  keyPrefix?: string;
  /** Token expiry time in seconds */
  tokenExpiry?: number;
  /** Whether to use double submit cookie pattern */
  useDoubleSubmit?: boolean;
}

/**
 * Default CSRF options
 */
const defaultOptions: CSRFOptions = {
  cookie: 'XSRF-TOKEN',
  header: 'X-XSRF-TOKEN',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  cookieOptions: {
    httpOnly: false, // Must be false to be accessible by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  keyPrefix: 'csrf:',
  tokenExpiry: 24 * 60 * 60, // 24 hours
  useDoubleSubmit: true,
};

/**
 * Generate a random CSRF token
 * @returns A random token
 */
const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF protection middleware
 * @param options CSRF configuration options
 * @returns Express middleware function
 */
export const csrfMiddleware = (options: CSRFOptions = {}) => {
  const opts = { ...defaultOptions, ...options };
  
  // In-memory token store if Redis is not provided
  const tokenStore: Record<string, { token: string; expires: number }> = {};
  
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF check for ignored methods
    if (opts.ignoreMethods!.includes(req.method)) {
      // Generate and set CSRF token for GET requests
      if (req.method === 'GET') {
        const token = generateToken();
        const userId = (req as any).user?.id || 'anonymous';
        const key = `${opts.keyPrefix}${userId}`;
        
        // Store token
        if (opts.redis) {
          await opts.redis.set(key, token, 'EX', opts.tokenExpiry!);
        } else {
          tokenStore[key] = {
            token,
            expires: Date.now() + (opts.tokenExpiry! * 1000),
          };
        }
        
        // Set CSRF cookie
        res.cookie(opts.cookie!, token, opts.cookieOptions);
        
        // Make token available to templates
        res.locals.csrfToken = token;
      }
      
      return next();
    }
    
    // Get token from request header or body
    const token = req.headers[opts.header!.toLowerCase()] as string || 
                  req.body._csrf || 
                  req.query._csrf as string;
    
    if (!token) {
      return res.status(403).json({
        error: 'CSRF token missing',
      });
    }
    
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const key = `${opts.keyPrefix}${userId}`;
      let storedToken: string | null = null;
      
      // Get stored token
      if (opts.redis) {
        storedToken = await opts.redis.get(key);
      } else {
        const stored = tokenStore[key];
        if (stored && stored.expires > Date.now()) {
          storedToken = stored.token;
        }
      }
      
      // If using double submit cookie pattern, also check the cookie
      if (opts.useDoubleSubmit) {
        const cookieToken = req.cookies[opts.cookie!];
        
        if (!cookieToken || cookieToken !== token) {
          return res.status(403).json({
            error: 'CSRF token invalid',
          });
        }
      }
      
      // Verify token
      if (!storedToken || storedToken !== token) {
        return res.status(403).json({
          error: 'CSRF token invalid',
        });
      }
      
      // Generate a new token for the next request
      const newToken = generateToken();
      
      // Store new token
      if (opts.redis) {
        await opts.redis.set(key, newToken, 'EX', opts.tokenExpiry!);
      } else {
        tokenStore[key] = {
          token: newToken,
          expires: Date.now() + (opts.tokenExpiry! * 1000),
        };
      }
      
      // Set new CSRF cookie
      res.cookie(opts.cookie!, newToken, opts.cookieOptions);
      
      // Make token available to templates
      res.locals.csrfToken = newToken;
      
      next();
    } catch (error) {
      console.error('CSRF error:', error);
      return res.status(403).json({
        error: 'CSRF token validation failed',
      });
    }
  };
};

/**
 * Factory function to create CSRF middleware for different environments
 * @param env Environment name
 * @returns CSRF middleware configured for the specified environment
 */
export const createCSRFMiddleware = (env: string) => {
  switch (env) {
    case 'development':
      return csrfMiddleware({
        cookieOptions: {
          secure: false,
          sameSite: 'lax',
        },
      });
    
    case 'production':
      return csrfMiddleware({
        cookieOptions: {
          secure: true,
          sameSite: 'strict',
          path: '/',
          maxAge: 12 * 60 * 60 * 1000, // 12 hours (shorter expiry)
          httpOnly: false, // Must be accessible by JavaScript
        },
        tokenExpiry: 12 * 60 * 60, // 12 hours
        useDoubleSubmit: true,
      });
    
    default:
      return csrfMiddleware();
  }
};

export default createCSRFMiddleware;
