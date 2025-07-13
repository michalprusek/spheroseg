import { Request, Response, NextFunction } from 'express';
import { cdnConfig, shouldUseCDN } from '../config/cdn.config';
import { getCDNService } from '../services/cdnService';
import logger from '../utils/logger';

// Middleware to add CDN URL helper to response locals
export function cdnUrlMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add CDN URL helper to response locals
  res.locals.getCDNUrl = (path: string, options?: any) => {
    const cdnService = getCDNService();
    return cdnService.getUrl(path, options);
  };

  // Add helper to determine if CDN is enabled
  res.locals.cdnEnabled = shouldUseCDN();

  next();
}

// Middleware to set appropriate cache headers for CDN
export function cdnCacheHeaders(req: Request, res: Response, next: NextFunction) {
  // Only apply if CDN is enabled
  if (!shouldUseCDN()) {
    return next();
  }

  // Store original send function
  const originalSend = res.send;
  const originalJson = res.json;
  const originalSendFile = res.sendFile;

  // Override send to add CDN headers
  res.send = function(data: any) {
    setCDNHeaders(req, res);
    return originalSend.call(this, data);
  };

  res.json = function(data: any) {
    setCDNHeaders(req, res);
    return originalJson.call(this, data);
  };

  res.sendFile = function(path: string, options?: any, callback?: any) {
    setCDNHeaders(req, res);
    return originalSendFile.call(this, path, options, callback);
  };

  next();
}

// Middleware to handle CDN purge requests
export async function cdnPurgeMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if this is a purge request
  if (req.method !== 'POST' || !req.path.startsWith('/api/cdn/purge')) {
    return next();
  }

  // Check admin permissions
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const { paths, patterns } = req.body;
    const cdnService = getCDNService();

    let success = false;
    if (paths && Array.isArray(paths)) {
      success = await cdnService.invalidate(paths);
    } else if (patterns && Array.isArray(patterns)) {
      success = await cdnService.purgeCache(patterns);
    } else {
      // Purge everything
      success = await cdnService.purgeCache();
    }

    if (success) {
      logger.info('CDN cache purged', { paths, patterns, user: req.user.email });
      res.json({ success: true, message: 'CDN cache purged successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to purge CDN cache' });
    }
  } catch (error: any) {
    logger.error('CDN purge error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Middleware to rewrite asset URLs in JSON responses
export function cdnRewriteMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!shouldUseCDN()) {
    return next();
  }

  // Only rewrite for JSON responses
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Rewrite URLs in the response data
    const rewritten = rewriteUrls(data);
    return originalJson.call(this, rewritten);
  };

  next();
}

// Helper function to set CDN headers
function setCDNHeaders(req: Request, res: Response) {
  // Skip if headers already sent
  if (res.headersSent) return;

  // Add custom CDN headers
  Object.entries(cdnConfig.customHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Add Vary header for proper caching
  const existingVary = res.getHeader('Vary') as string || '';
  const varyHeaders = new Set(existingVary.split(',').map(h => h.trim()).filter(Boolean));
  varyHeaders.add('Accept-Encoding');
  varyHeaders.add('Accept');
  res.setHeader('Vary', Array.from(varyHeaders).join(', '));

  // Add timing header
  res.setHeader('X-CDN-Cache-Control', 'true');

  // Set surrogate control for CDN
  if (cdnConfig.provider === 'cloudflare') {
    res.setHeader('Cloudflare-CDN-Cache-Control', res.getHeader('Cache-Control') || 'public, max-age=3600');
  } else if (cdnConfig.provider === 'cloudfront') {
    res.setHeader('Surrogate-Control', res.getHeader('Cache-Control') || 'public, max-age=3600');
  }
}

// Helper function to recursively rewrite URLs in data
function rewriteUrls(data: any): any {
  if (!data) return data;

  const cdnService = getCDNService();

  // Handle string
  if (typeof data === 'string') {
    // Check if it's an asset URL that should be rewritten
    if (isAssetUrl(data)) {
      return cdnService.getUrl(data);
    }
    return data;
  }

  // Handle array
  if (Array.isArray(data)) {
    return data.map(item => rewriteUrls(item));
  }

  // Handle object
  if (typeof data === 'object') {
    const rewritten: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Special handling for known URL fields
      if (isUrlField(key) && typeof value === 'string' && isAssetUrl(value)) {
        rewritten[key] = cdnService.getUrl(value);
      } else {
        rewritten[key] = rewriteUrls(value);
      }
    }
    
    return rewritten;
  }

  return data;
}

// Check if a string is an asset URL that should be CDN-ified
function isAssetUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Check if it's a relative URL starting with known asset paths
  return url.startsWith('/assets/') || 
         url.startsWith('/uploads/') ||
         url.startsWith('/static/') ||
         url.includes('/dist/assets/');
}

// Check if a field name typically contains URLs
function isUrlField(fieldName: string): boolean {
  const urlFields = [
    'url', 'imageUrl', 'thumbnailUrl', 'downloadUrl', 
    'avatar', 'logo', 'icon', 'src', 'href',
    'image', 'thumbnail', 'preview', 'poster',
    'storage_path', 'file_path', 'asset_url'
  ];
  
  const lowerFieldName = fieldName.toLowerCase();
  return urlFields.some(field => lowerFieldName.includes(field));
}

// Middleware to handle CDN origin requests
export function cdnOriginMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add headers for CDN origin requests
  if (req.get('X-CDN-Request') || req.get('User-Agent')?.includes('Amazon CloudFront')) {
    // Indicate this is an origin response
    res.setHeader('X-Origin-Response', 'true');
    
    // Add cache tags for intelligent purging
    if (req.path.startsWith('/uploads/')) {
      const projectId = req.path.split('/')[2];
      if (projectId) {
        res.setHeader('Cache-Tag', `project-${projectId}`);
      }
    }
  }

  next();
}

// Export all middleware
export const cdnMiddleware = {
  url: cdnUrlMiddleware,
  cache: cdnCacheHeaders,
  purge: cdnPurgeMiddleware,
  rewrite: cdnRewriteMiddleware,
  origin: cdnOriginMiddleware,
};