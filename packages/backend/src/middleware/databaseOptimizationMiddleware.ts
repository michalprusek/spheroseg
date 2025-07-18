/**
 * Database Optimization Middleware
 *
 * Middleware for integrating database optimization service with Express routes
 * Provides automatic caching, performance monitoring, and optimization
 */

import { Request, Response, NextFunction } from 'express';
import { getPool } from '../db';
import DatabaseOptimizationService from '../services/databaseOptimizationService';
import logger from '../utils/logger';

// Global optimization service instance
let optimizationService: DatabaseOptimizationService | null = null;

/**
 * Initialize optimization service
 */
export function initializeOptimizationService(): DatabaseOptimizationService {
  if (!optimizationService) {
    const pool = getPool();
    optimizationService = new DatabaseOptimizationService(pool, {
      enableQueryCache: true,
      enablePreparedStatements: true,
      cacheStrategy: 'moderate',
      monitoringEnabled: true,
      maxConnections: 20,
      queryTimeout: 30000,
    });

    logger.info('Database optimization service initialized');
  }

  return optimizationService;
}

/**
 * Get optimization service instance
 */
export function getOptimizationService(): DatabaseOptimizationService | null {
  return optimizationService;
}

/**
 * Middleware to add optimization service to request
 */
export function addOptimizationService(req: Request, res: Response, next: NextFunction): void {
  const service = getOptimizationService();
  if (service) {
    (req as any).optimizationService = service;
  }
  next();
}

/**
 * Middleware for automatic cache invalidation on data changes
 */
export function cacheInvalidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalSend = res.send;
  const method = req.method;
  const path = req.path;

  // Override res.send to capture successful responses
  res.send = function (body?: any) {
    const statusCode = res.statusCode;

    // Only invalidate cache on successful data modifications
    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    ) {
      // Determine what type of data was modified based on the path
      const service = getOptimizationService();
      if (service) {
        invalidateCacheBasedOnPath(service, path, req, statusCode);
      }
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Invalidate cache based on request path and type
 */
async function invalidateCacheBasedOnPath(
  service: DatabaseOptimizationService,
  path: string,
  req: Request,
  statusCode: number
): Promise<void> {
  try {
    // Extract IDs from path and body
    const pathSegments = path.split('/').filter(Boolean);

    if (path.includes('/projects')) {
      if (req.method === 'POST' && statusCode === 201) {
        // New project created - invalidate user's project list
        const userId = (req as any).user?.userId;
        if (userId) {
          await service.invalidateRelatedCaches('user', userId);
          logger.debug('Cache invalidated for new project', { userId, path });
        }
      } else if (req.method === 'DELETE' && pathSegments.length >= 3) {
        // Project deleted
        const projectId = pathSegments[2];
        await service.invalidateRelatedCaches('project', projectId);
        logger.debug('Cache invalidated for deleted project', { projectId, path });
      } else if (['PUT', 'PATCH'].includes(req.method) && pathSegments.length >= 3) {
        // Project updated
        const projectId = pathSegments[2];
        await service.invalidateRelatedCaches('project', projectId);
        logger.debug('Cache invalidated for updated project', { projectId, path });
      }
    }

    if (path.includes('/images')) {
      if (req.method === 'POST' && statusCode === 201) {
        // New image uploaded
        const projectId = req.body?.project_id || req.params?.projectId;
        if (projectId) {
          await service.invalidateRelatedCaches('project', projectId);
          logger.debug('Cache invalidated for new image', { projectId, path });
        }
      } else if (req.method === 'DELETE' && pathSegments.length >= 3) {
        // Image deleted
        const imageId = pathSegments[2];
        await service.invalidateRelatedCaches('image', imageId);
        logger.debug('Cache invalidated for deleted image', { imageId, path });
      } else if (['PUT', 'PATCH'].includes(req.method) && pathSegments.length >= 3) {
        // Image updated (e.g., segmentation status changed)
        const imageId = pathSegments[2];
        await service.invalidateRelatedCaches('image', imageId);
        logger.debug('Cache invalidated for updated image', { imageId, path });
      }
    }

    if (path.includes('/segmentation')) {
      // Segmentation results changed
      const imageId = req.body?.image_id || req.params?.imageId;
      if (imageId) {
        await service.invalidateRelatedCaches('image', imageId);
        logger.debug('Cache invalidated for segmentation update', { imageId, path });
      }
    }

    if (path.includes('/users') || path.includes('/profile')) {
      // User data changed
      const userId = (req as any).user?.userId || req.params?.userId;
      if (userId) {
        await service.invalidateRelatedCaches('user', userId);
        logger.debug('Cache invalidated for user update', { userId, path });
      }
    }
  } catch (error) {
    logger.error('Cache invalidation error', { path, error });
  }
}

/**
 * Middleware for performance monitoring
 */
export function performanceMonitoringMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;

  const originalSend = res.send;

  res.send = function (body?: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method,
        path,
        duration,
        statusCode,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.userId,
      });
    }

    // Log request metrics
    logger.debug('Request completed', {
      method,
      path,
      duration,
      statusCode,
    });

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Middleware for query optimization hints
 */
export function queryOptimizationHints(req: Request, res: Response, next: NextFunction): void {
  // Add optimization hints to request for use by route handlers
  (req as any).optimizationHints = {
    // Suggest caching for GET requests
    shouldCache: req.method === 'GET',

    // Suggest prepared statements for complex queries
    usePreparedStatements: true,

    // Cache strategy based on request type
    cacheStrategy: determineCacheStrategy(req),

    // Enable pagination for list endpoints
    enablePagination: req.path.includes('/list') || req.query.page !== undefined,
  };

  next();
}

/**
 * Determine appropriate cache strategy based on request
 */
function determineCacheStrategy(req: Request): 'HOT' | 'WARM' | 'COLD' | 'STATIC' {
  const path = req.path;

  // Hot data - frequently accessed
  if (path.includes('/stats') || path.includes('/dashboard')) {
    return 'HOT';
  }

  // Static data - rarely changes
  if (path.includes('/config') || path.includes('/settings')) {
    return 'STATIC';
  }

  // Cold data - rarely accessed
  if (path.includes('/export') || path.includes('/backup')) {
    return 'COLD';
  }

  // Default to warm
  return 'WARM';
}

/**
 * Middleware to handle optimization service errors gracefully
 */
export function optimizationErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error.message.includes('optimization') || error.message.includes('cache')) {
    logger.error('Optimization service error', {
      error: error.message,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.userId,
    });

    // Don't fail the request due to optimization errors
    // Just log the error and continue without optimization
    next();
  } else {
    next(error);
  }
}

/**
 * Middleware to add cache headers for optimized responses
 */
export function optimizedCacheHeaders(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET') {
    const hints = (req as any).optimizationHints;
    const strategy = hints?.cacheStrategy || 'WARM';

    // Set appropriate cache headers based on strategy
    switch (strategy) {
      case 'HOT':
        res.set('Cache-Control', 'public, max-age=60'); // 1 minute
        break;
      case 'STATIC':
        res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
        break;
      case 'WARM':
        res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
        break;
      case 'COLD':
        res.set('Cache-Control', 'public, max-age=1800'); // 30 minutes
        break;
    }

    // Add ETag for better caching
    if (hints?.shouldCache) {
      res.set('ETag', `"${Date.now()}"`);
    }
  }

  next();
}

/**
 * Cleanup function for graceful shutdown
 */
export async function shutdownOptimizationService(): Promise<void> {
  if (optimizationService) {
    await optimizationService.shutdown();
    optimizationService = null;
    logger.info('Database optimization service shutdown completed');
  }
}

// Express middleware declarations for TypeScript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      optimizationService?: DatabaseOptimizationService;
      optimizationHints?: {
        shouldCache: boolean;
        usePreparedStatements: boolean;
        cacheStrategy: 'HOT' | 'WARM' | 'COLD' | 'STATIC';
        enablePagination: boolean;
      };
    }
  }
}

export default {
  initializeOptimizationService,
  getOptimizationService,
  addOptimizationService,
  cacheInvalidationMiddleware,
  performanceMonitoringMiddleware,
  queryOptimizationHints,
  optimizationErrorHandler,
  optimizedCacheHeaders,
  shutdownOptimizationService,
};
