/**
 * Static file caching middleware
 * Adds cache headers to static assets for better performance
 */

import { Request, Response, NextFunction } from 'express';

export const staticCacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path.toLowerCase();
  
  // Set cache headers based on file type
  if (path.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
    // Images - cache for 30 days
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  } else if (path.match(/\.(css|js|mjs)$/)) {
    // CSS and JS - cache for 1 year (versioned by hash)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (path.match(/\.(woff|woff2|ttf|otf|eot)$/)) {
    // Fonts - cache for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (path.match(/\.(json)$/)) {
    // JSON files - no cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  
  // Add ETag support
  res.setHeader('ETag', `"${req.path}-${Date.now()}"`);
  
  next();
};