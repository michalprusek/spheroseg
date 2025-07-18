/**
 * Static file caching middleware
 * Adds cache headers to static assets for better performance
 */

import { Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import path from 'path';

// Cache for ETags to avoid repeated file stats
const etagCache = new Map<string, { etag: string; mtime: number }>();

export const staticCacheMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const urlPath = req.path.toLowerCase();

  // Set cache headers based on file type
  if (urlPath.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
    // Images - cache for 30 days
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  } else if (urlPath.match(/\.(css|js|mjs)$/)) {
    // CSS and JS - cache for 1 year (versioned by hash)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (urlPath.match(/\.(woff|woff2|ttf|otf|eot)$/)) {
    // Fonts - cache for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (urlPath.match(/\.(json)$/)) {
    // JSON files - no cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  // Add proper ETag support based on file content
  // Note: In production, this would be handled by the static file middleware
  // This is a fallback for development
  if (process.env.NODE_ENV === 'development') {
    try {
      // Construct the file path (configurable static root)
      const staticRoot = process.env.STATIC_ROOT || path.join(process.cwd(), 'public');
      const filePath = path.join(staticRoot, req.path);

      // Check cache first
      const cached = etagCache.get(filePath);
      if (cached) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtime.getTime() === cached.mtime) {
            res.setHeader('ETag', cached.etag);
            next();
            return;
          }
        } catch {
          // File might have been deleted
          etagCache.delete(filePath);
        }
      }

      // Generate ETag based on file stats
      try {
        const stats = await fs.stat(filePath);
        const etag = `"${stats.size}-${stats.mtime.getTime()}"`;

        // Cache the ETag
        etagCache.set(filePath, { etag, mtime: stats.mtime.getTime() });

        res.setHeader('ETag', etag);
      } catch {
        // File doesn't exist - no ETag
      }
    } catch (error) {
      // Silently ignore errors - ETag is optional
    }
  }

  next();
};
