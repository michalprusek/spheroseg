/**
 * Performance Tracking Middleware
 *
 * Automatically tracks API endpoint performance metrics including
 * response times, status codes, and request counts.
 */

import { Request, Response, NextFunction } from 'express';
import performanceMonitor from '../services/performanceMonitor';
import logger from '../utils/logger';

/**
 * Middleware to track API performance metrics
 */
export function trackAPIPerformance() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip tracking for static assets and health checks
    if (
      req.path.includes('/static/') ||
      req.path.includes('/assets/') ||
      req.path === '/health' ||
      req.path === '/metrics'
    ) {
      return next();
    }

    const startTime = Date.now();
    const method = req.method;
    const endpoint = req.route?.path || req.path;

    // Override res.end to capture when response is complete
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      // Restore original end function
      res.end = originalEnd;

      // Calculate response time
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Record the metric
      try {
        performanceMonitor.recordAPIMetric(endpoint, method, statusCode, responseTime);

        // Log slow requests
        if (responseTime > 1000) {
          logger.warn('Slow API response', {
            endpoint,
            method,
            statusCode,
            responseTime,
            query: req.query,
            params: req.params,
          });
        }
      } catch (error) {
        logger.error('Error recording API metric', { error });
      }

      // Call original end function
      return originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Middleware to add X-Response-Time header
 */
export function addResponseTimeHeader() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();

    // Override res.end to add header before sending
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      // Calculate response time in milliseconds
      const endTime = process.hrtime.bigint();
      const responseTime = Number((endTime - startTime) / 1000000n);

      // Add header if not already sent
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${responseTime}ms`);
      }

      // Call original end function
      res.end = originalEnd;
      return originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Middleware to track memory usage for specific endpoints
 */
export function trackMemoryUsage(endpoints: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only track specified endpoints or all if none specified
    if (endpoints.length > 0 && !endpoints.includes(req.path)) {
      return next();
    }

    const startMemory = process.memoryUsage();

    // Override res.end to capture memory after request
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      res.end = originalEnd;

      const endMemory = process.memoryUsage();
      const memoryDelta = {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        rss: endMemory.rss - startMemory.rss,
      };

      // Record significant memory increases
      if (memoryDelta.heapUsed > 10 * 1024 * 1024) {
        // 10MB
        performanceMonitor.recordMetric('memory', 'heap_increase', memoryDelta.heapUsed, {
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
        });

        logger.warn('Significant memory increase detected', {
          endpoint: req.path,
          memoryDelta,
          memoryDeltaMB: {
            heapUsed: (memoryDelta.heapUsed / 1024 / 1024).toFixed(2),
            heapTotal: (memoryDelta.heapTotal / 1024 / 1024).toFixed(2),
          },
        });
      }

      return originalEnd.apply(res, args);
    };

    next();
  };
}

export default {
  trackAPIPerformance,
  addResponseTimeHeader,
  trackMemoryUsage,
};
