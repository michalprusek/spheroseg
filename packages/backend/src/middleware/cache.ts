import { Request, Response, NextFunction } from 'express';

/**
 * Cache control middleware for GET endpoints
 * Applies appropriate cache headers based on resource type
 */
export const cacheControl = {
  // No cache for dynamic data
  noCache: (_req: Request, res: Response, next: NextFunction) => {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    next();
  },

  // Short cache for frequently updated data (5 minutes)
  short: (_req: Request, res: Response, next: NextFunction) => {
    res.set({
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      'Vary': 'Accept-Encoding, Authorization'
    });
    next();
  },

  // Medium cache for semi-static data (1 hour)
  medium: (_req: Request, res: Response, next: NextFunction) => {
    res.set({
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      'Vary': 'Accept-Encoding, Authorization'
    });
    next();
  },

  // Long cache for static resources (1 day)
  long: (_req: Request, res: Response, next: NextFunction) => {
    res.set({
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'Vary': 'Accept-Encoding'
    });
    next();
  },

  // Immutable cache for versioned assets (1 year)
  immutable: (_req: Request, res: Response, next: NextFunction) => {
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Vary': 'Accept-Encoding'
    });
    next();
  },

  // Conditional cache based on authentication
  conditional: (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization) {
      // Private cache for authenticated requests
      res.set({
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
        'Vary': 'Accept-Encoding, Authorization'
      });
    } else {
      // Public cache for non-authenticated requests
      res.set({
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=120',
        'Vary': 'Accept-Encoding'
      });
    }
    next();
  },

  // ETag support for conditional requests
  etag: (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data: any) {
      // Generate simple ETag based on content
      if (data && typeof data === 'string' || Buffer.isBuffer(data)) {
        const etag = `"${Buffer.from(data).length}-${Date.now()}"`;
        res.set('ETag', etag);
        
        // Check if client has matching ETag
        if (req.headers['if-none-match'] === etag) {
          res.status(304).end();
          return res;
        }
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  }
};

/**
 * Helper to combine multiple cache strategies
 */
export const combineCacheStrategies = (...strategies: Array<(req: Request, res: Response, next: NextFunction) => void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;
    
    const runNext = () => {
      if (index < strategies.length) {
        const strategy = strategies[index++];
        strategy(req, res, runNext);
      } else {
        next();
      }
    };
    
    runNext();
  };
};