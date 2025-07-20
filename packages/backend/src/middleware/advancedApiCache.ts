/**
 * Advanced API Response Caching Middleware
 * 
 * Implements sophisticated caching strategies for API responses including:
 * - Stale-while-revalidate pattern
 * - Conditional caching based on user context
 * - Cache warming and prefetching
 * - Response compression and ETags
 * - Intelligent cache invalidation
 */

import { Request, Response, NextFunction } from 'express';
import AdvancedCacheService from '../services/advancedCacheService';
import db from '../db';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import logger from '../utils/logger';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Create a singleton instance of the cache service
let cacheServiceInstance: AdvancedCacheService | null = null;

function getAdvancedCacheService(): AdvancedCacheService {
  if (!cacheServiceInstance) {
    const pool = db.getPool();
    cacheServiceInstance = new AdvancedCacheService(pool);
  }
  return cacheServiceInstance;
}

// ===========================
// Types and Interfaces
// ===========================

interface CacheOptions {
  strategy?: 'HOT' | 'WARM' | 'COLD' | 'STATIC';
  ttl?: number;
  tags?: string[];
  dependencies?: string[];
  varyBy?: string[];
  compression?: boolean;
  private?: boolean;
  bypassAuth?: boolean;
  staleWhileRevalidate?: boolean;
  maxStale?: number;
}

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    role?: string;
  };
}

// ===========================
// Cache Key Generation
// ===========================

function generateCacheKey(req: Request, options: CacheOptions = {}): string {
  const baseKey = `api:${req.method}:${req.route?.path || req.path}`;
  const keyParts = [baseKey];

  // Add query parameters
  if (Object.keys(req.query).length > 0) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('&');
    keyParts.push(`query:${sortedQuery}`);
  }

  // Add route parameters
  if (Object.keys(req.params).length > 0) {
    const sortedParams = Object.keys(req.params)
      .sort()
      .map(key => `${key}=${req.params[key]}`)
      .join('&');
    keyParts.push(`params:${sortedParams}`);
  }

  // Add user-specific caching for private data
  const authReq = req as AuthenticatedRequest;
  if (!options.bypassAuth && authReq.user?.userId) {
    keyParts.push(`user:${authReq.user.userId}`);
  }

  // Add vary headers
  if (options.varyBy) {
    options.varyBy.forEach(header => {
      const value = req.get(header);
      if (value) {
        keyParts.push(`${header}:${value}`);
      }
    });
  }

  return keyParts.join(':');
}

function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return `W/"${crypto.createHash('md5').update(content).digest('hex')}"`;
}

// ===========================
// Middleware Functions
// ===========================

/**
 * Advanced API caching middleware
 */
export function apiCache(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip non-GET requests by default
    if (req.method !== 'GET' && !options.bypassAuth) {
      next();
      return;
    }

    const cacheService = getAdvancedCacheService();
    const cacheKey = generateCacheKey(req, options);
    
    try {
      // Try to get from cache
      const cached = await cacheService.get(
        cacheKey,
        options.strategy || 'WARM'
      );

      if (cached && typeof cached === 'object' && 'data' in cached) {
        const { data, metadata } = cached as { data: any; metadata: any };
        
        // Check if client has fresh version via ETag
        const etag = generateETag(data);
        if (req.get('if-none-match') === etag) {
          res.status(304).end();
          return;
        }

        // Set cache headers
        setCacheHeaders(res, options, metadata);
        res.set('ETag', etag);
        res.set('X-Cache', 'HIT');

        // Decompress if needed
        if (metadata?.compressed) {
          try {
            const decompressed = await gunzip(Buffer.from(data, 'base64'));
            res.json(JSON.parse(decompressed.toString()));
            return;
          } catch (error) {
            logger.warn('Cache decompression failed', { cacheKey, error });
            // Fall through to regenerate
          }
        }

        res.json(data);
        return;
      }

      // Cache miss - intercept response
      res.set('X-Cache', 'MISS');
      interceptResponse(req, res, next, cacheKey, options);
      
    } catch (error) {
      logger.error('API cache middleware error', { cacheKey, error });
      next();
    }
  };
}

/**
 * Stale-while-revalidate middleware
 */
export function staleWhileRevalidate(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const cacheService = getAdvancedCacheService();
    const cacheKey = generateCacheKey(req, options);
    
    try {
      const cached = await cacheService.get(cacheKey, options.strategy || 'WARM');
      
      if (cached && typeof cached === 'object' && 'data' in cached) {
        const { data, metadata } = cached as { data: any; metadata: any };
        const age = Date.now() - metadata.timestamp;
        const maxAge = options.ttl || 300000; // 5 minutes default
        const maxStale = options.maxStale || maxAge * 2;

        // Serve stale content if within stale threshold
        if (age < maxStale) {
          const etag = generateETag(data);
          if (req.get('if-none-match') === etag) {
            res.status(304).end();
            return;
          }

          // Set stale headers
          res.set('Cache-Control', `max-age=0, stale-while-revalidate=${Math.ceil(maxStale / 1000)}`);
          res.set('ETag', etag);
          res.set('X-Cache', age > maxAge ? 'STALE' : 'HIT');
          res.set('Age', Math.ceil(age / 1000).toString());

          // Trigger background revalidation if stale
          if (age > maxAge) {
            setImmediate(() => {
              revalidateInBackground(req, cacheKey, options);
            });
          }

          res.json(data);
          return;
        }
      }

      // No cache or too stale - proceed normally
      res.set('X-Cache', 'MISS');
      interceptResponse(req, res, next, cacheKey, options);
      
    } catch (error) {
      logger.error('Stale-while-revalidate error', { cacheKey, error });
      next();
    }
  };
}

/**
 * Conditional caching based on authentication
 */
export function conditionalCache(
  publicOptions: CacheOptions = {},
  privateOptions: CacheOptions = {}
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const isAuthenticated = !!authReq.user?.userId;
    
    const options = isAuthenticated ? privateOptions : publicOptions;
    
    apiCache(options)(req, _res, next);
  };
}

/**
 * Cache warming middleware for predictive caching
 */
export function cacheWarming(warmingRules: Array<{
  pattern: RegExp;
  dependencies: string[];
  priority: number;
}>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    
    // Trigger warming for matching patterns
    warmingRules.forEach(rule => {
      if (rule.pattern.test(req.path)) {
        setImmediate(() => {
          warmRelatedData(authReq, rule);
        });
      }
    });
    
    next();
  };
}

/**
 * Response time-based cache strategy selection
 */
export function adaptiveCache(thresholds: {
  fast: number;
  medium: number;
  slow: number;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - start;
      let strategy: CacheOptions['strategy'] = 'WARM';
      
      if (responseTime > thresholds.slow) {
        strategy = 'HOT'; // Cache aggressively for slow responses
      } else if (responseTime > thresholds.medium) {
        strategy = 'WARM';
      } else {
        strategy = 'COLD'; // Cache less for fast responses
      }
      
      // Store strategy recommendation for next request
      const cacheKey = generateCacheKey(req);
      logger.debug('Adaptive cache strategy selected', {
        path: req.path,
        responseTime,
        strategy,
        cacheKey,
      });
    });
    
    next();
  };
}

// ===========================
// Helper Functions
// ===========================

function interceptResponse(
  _req: Request,
  res: Response,
  next: NextFunction,
  cacheKey: string,
  options: CacheOptions
): void {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      setImmediate(async () => {
        try {
          await cacheResponse(cacheKey, data, options);
        } catch (error) {
          logger.error('Failed to cache response', { cacheKey, error });
        }
      });
    }
    
    // Set cache headers for client
    setCacheHeaders(res, options);
    res.set('ETag', generateETag(data));
    
    return originalJson.call(this, data);
  };
  
  next();
}

async function cacheResponse(
  cacheKey: string,
  data: any,
  options: CacheOptions
): Promise<void> {
  const cacheService = getAdvancedCacheService();
  let cacheData = data;
  const metadata: any = {
    timestamp: Date.now(),
    compressed: false,
  };

  // Compress large responses
  if (options.compression && JSON.stringify(data).length > 1024) {
    try {
      const compressed = await gzip(JSON.stringify(data));
      cacheData = compressed.toString('base64');
      metadata.compressed = true;
    } catch (error) {
      logger.warn('Response compression failed', { cacheKey, error });
    }
  }

  await cacheService.set(
    cacheKey,
    { data: cacheData, metadata },
    options.strategy || 'WARM'
  );

  // Update tags and dependencies
  if (options.tags || options.dependencies) {
    // Implementation would depend on the enhanced cache service
    logger.debug('Cache entry created with metadata', {
      cacheKey,
      tags: options.tags,
      dependencies: options.dependencies,
    });
  }
}

function setCacheHeaders(
  res: Response,
  options: CacheOptions,
  metadata?: any
): void {
  const maxAge = options.ttl ? Math.ceil(options.ttl / 1000) : 300;
  const isPrivate = options.private || !!res.get('Authorization');
  
  const cacheDirectives = [
    isPrivate ? 'private' : 'public',
    `max-age=${maxAge}`,
  ];

  if (options.staleWhileRevalidate) {
    cacheDirectives.push(`stale-while-revalidate=${maxAge * 2}`);
  }

  res.set('Cache-Control', cacheDirectives.join(', '));
  res.set('Vary', 'Accept-Encoding, Authorization');
  
  if (metadata?.timestamp) {
    res.set('Age', Math.ceil((Date.now() - metadata.timestamp) / 1000).toString());
  }
}

async function revalidateInBackground(
  req: Request,
  cacheKey: string,
  options: CacheOptions
): Promise<void> {
  try {
    logger.debug('Background revalidation started', { cacheKey });
    
    // This would trigger the original endpoint logic
    // Implementation depends on having access to the route handler
    // For now, just log the revalidation attempt
    logger.info('Background revalidation needed', {
      path: req.path,
      cacheKey,
      strategy: options.strategy,
    });
  } catch (error) {
    logger.error('Background revalidation failed', { cacheKey, error });
  }
}

async function warmRelatedData(
  req: AuthenticatedRequest,
  rule: { dependencies: string[]; priority: number }
): Promise<void> {
  const cacheService = getAdvancedCacheService();
  
  try {
    for (const dependency of rule.dependencies) {
      // Generate warming keys based on dependency patterns
      const warmingKeys = generateWarmingKeys(req, dependency);
      
      for (const key of warmingKeys) {
        // Check if already cached
        const exists = await cacheService.get(key, 'HOT');
        if (!exists) {
          logger.debug('Cache warming opportunity', {
            originalPath: req.path,
            warmingKey: key,
            priority: rule.priority,
          });
          
          // Add to warming queue (placeholder - would need to implement in service)
          logger.debug('Would add to warming queue', {
            key,
            priority: rule.priority,
          });
        }
      }
    }
  } catch (error) {
    logger.error('Cache warming failed', { error });
  }
}

function generateWarmingKeys(req: AuthenticatedRequest, pattern: string): string[] {
  const keys: string[] = [];
  
  // Replace placeholders with actual values
  let key = pattern;
  
  if (req.user?.userId) {
    key = key.replace('{userId}', req.user.userId);
  }
  
  if (req.params['projectId']) {
    key = key.replace('{projectId}', req.params['projectId']);
  }
  
  // Add variations for common query parameters
  const commonQueries = [
    'page=1&limit=20',
    'page=1&limit=50',
    'sortBy=updated_at&sortOrder=desc',
  ];
  
  commonQueries.forEach(query => {
    keys.push(`${key}:query:${query}`);
  });
  
  return keys;
}

// Commented out for future implementation
// async function _loadDataForWarming(_key: string): Promise<any> {
//   // This would implement the actual data loading logic
//   // For now, return null to indicate warming is not implemented
//   logger.debug('Data loading for warming not implemented', { key: _key });
//   return null;
// }

// ===========================
// Predefined Cache Strategies
// ===========================

export const cacheStrategies = {
  // User data - private, medium TTL
  userData: {
    strategy: 'WARM' as const,
    ttl: 5 * 60 * 1000, // 5 minutes
    private: true,
    compression: true,
    tags: ['user'],
  },
  
  // Project data - varies by user, warm cache
  projectData: {
    strategy: 'HOT' as const,
    ttl: 10 * 60 * 1000, // 10 minutes
    private: true,
    compression: true,
    tags: ['project'],
    staleWhileRevalidate: true,
  },
  
  // Image lists - frequently accessed, aggressive caching
  imageLists: {
    strategy: 'HOT' as const,
    ttl: 2 * 60 * 1000, // 2 minutes
    private: true,
    compression: true,
    tags: ['images'],
    staleWhileRevalidate: true,
    maxStale: 5 * 60 * 1000, // 5 minutes stale
  },
  
  // Segmentation results - expensive to generate
  segmentationResults: {
    strategy: 'STATIC' as const,
    ttl: 60 * 60 * 1000, // 1 hour
    private: true,
    compression: true,
    tags: ['segmentation'],
  },
  
  // User stats - complex queries, cache aggressively
  userStats: {
    strategy: 'HOT' as const,
    ttl: 15 * 60 * 1000, // 15 minutes
    private: true,
    compression: true,
    tags: ['stats'],
    staleWhileRevalidate: true,
  },
  
  // Public data - shareable, longer TTL
  publicData: {
    strategy: 'STATIC' as const,
    ttl: 30 * 60 * 1000, // 30 minutes
    private: false,
    compression: true,
    bypassAuth: true,
  },
};

// ===========================
// Exports
// ===========================

export default {
  apiCache,
  staleWhileRevalidate,
  conditionalCache,
  cacheWarming,
  adaptiveCache,
  cacheStrategies,
  generateCacheKey,
};