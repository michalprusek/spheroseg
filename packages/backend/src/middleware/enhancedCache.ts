import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

/**
 * Enhanced caching middleware for optimal static resource delivery
 */

interface CacheOptions {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  immutable?: boolean;
  mustRevalidate?: boolean;
}

/**
 * Generate ETag based on file stats and content
 */
export function generateETag(stats: fs.Stats, content?: Buffer): string {
  const hash = crypto.createHash('md5');
  hash.update(stats.size.toString());
  hash.update(stats.mtime.toISOString());
  if (content) {
    hash.update(content);
  }
  return `W/"${hash.digest('hex')}"`;
}

/**
 * Determine cache policy based on file type
 */
export function getCachePolicyByFileType(filePath: string): CacheOptions {
  const ext = path.extname(filePath).toLowerCase();

  // Immutable assets (with hash in filename)
  if (filePath.match(/\.[a-f0-9]{8,}\./)) {
    return {
      maxAge: 31536000, // 1 year
      immutable: true,
    };
  }

  // Image files
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'].includes(ext)) {
    return {
      maxAge: 86400 * 7, // 1 week
      sMaxAge: 86400 * 30, // 1 month on CDN
      staleWhileRevalidate: 86400, // 1 day
    };
  }

  // Font files
  if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) {
    return {
      maxAge: 86400 * 30, // 1 month
      immutable: true,
    };
  }

  // CSS and JS files (without hash)
  if (['.css', '.js'].includes(ext)) {
    return {
      maxAge: 3600, // 1 hour
      staleWhileRevalidate: 86400, // 1 day
      mustRevalidate: true,
    };
  }

  // HTML files
  if (['.html', '.htm'].includes(ext)) {
    return {
      maxAge: 0,
      sMaxAge: 300, // 5 minutes on CDN
      mustRevalidate: true,
    };
  }

  // JSON and API responses
  if (ext === '.json') {
    return {
      maxAge: 300, // 5 minutes
      staleWhileRevalidate: 60,
    };
  }

  // Default policy
  return {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 300, // 5 minutes
  };
}

/**
 * Build Cache-Control header from options
 */
export function buildCacheControlHeader(options: CacheOptions): string {
  const directives: string[] = [];

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  if (options.immutable) {
    directives.push('immutable');
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  // Add public directive for cacheable content
  if (options.maxAge && options.maxAge > 0) {
    directives.push('public');
  } else {
    directives.push('no-cache');
  }

  return directives.join(', ');
}

/**
 * Express middleware for static file caching
 */
export function staticCacheMiddleware(staticDir: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only handle GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const filePath = path.join(staticDir, req.path);

    // Check if file exists
    try {
      const stats = await fs.promises.stat(filePath);

      if (!stats.isFile()) {
        return next();
      }

      // Set cache headers based on file type
      const cachePolicy = getCachePolicyByFileType(filePath);
      res.set('Cache-Control', buildCacheControlHeader(cachePolicy));

      // Add ETag
      const etag = generateETag(stats);
      res.set('ETag', etag);

      // Check If-None-Match
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      // Check If-Modified-Since
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince) {
        const ifModifiedSinceDate = new Date(ifModifiedSince);
        if (stats.mtime <= ifModifiedSinceDate) {
          return res.status(304).end();
        }
      }

      // Set Last-Modified
      res.set('Last-Modified', stats.mtime.toUTCString());

      // Add security headers for certain file types
      if (path.extname(filePath) === '.svg') {
        res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      }

      // Continue to next middleware (express.static will serve the file)
      next();
    } catch (error) {
      // File doesn't exist, continue to next middleware
      next();
    }
  };
}

/**
 * API response caching middleware
 */
export function apiCacheMiddleware(defaultMaxAge: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip non-GET requests
    if (req.method !== 'GET') {
      res.set('Cache-Control', 'no-store');
      return next();
    }

    // Cache successful responses
    const originalJson = res.json;
    res.json = function (data: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const isPrivate = !!req.headers.authorization;
        const maxAge = res.locals.cacheMaxAge || defaultMaxAge;

        res.set({
          'Cache-Control': `${isPrivate ? 'private' : 'public'}, max-age=${maxAge}, stale-while-revalidate=60`,
          Vary: 'Accept-Encoding, Authorization',
        });

        // Generate ETag from response data
        const content = JSON.stringify(data);
        const etag = `W/"${crypto.createHash('md5').update(content).digest('hex')}"`;
        res.set('ETag', etag);

        // Check If-None-Match
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
      } else {
        // Don't cache error responses
        res.set('Cache-Control', 'no-store');
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Image-specific caching middleware
 */
export function imageCacheMiddleware() {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Set optimal cache headers for images
    res.set({
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400', // 1 week, 1 day SWR
      Vary: 'Accept-Encoding',
      'X-Content-Type-Options': 'nosniff',
    });
    next();
  };
}

/**
 * Middleware to set custom cache max age for specific routes
 */
export function setCacheMaxAge(seconds: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.cacheMaxAge = seconds;
    next();
  };
}

// Export all utilities
export default {
  staticCacheMiddleware,
  apiCacheMiddleware,
  imageCacheMiddleware,
  setCacheMaxAge,
  generateETag,
  getCachePolicyByFileType,
  buildCacheControlHeader,
};
