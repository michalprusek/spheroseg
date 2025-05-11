import { Request, Response, NextFunction } from 'express';
import { performanceMonitoring } from '../lib/monitoring';

/**
 * Middleware to track API response times
 */
export function performanceMonitoringMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip monitoring for metrics endpoint to avoid circular reporting
    if (req.path === '/api/metrics') {
      return next();
    }

    // Record start time
    const startTime = Date.now();

    // Track response
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      // Calculate duration
      const duration = Date.now() - startTime;

      // Get route path (use route pattern if available, otherwise use path)
      const route = req.route?.path || req.path;

      // Get user ID if available
      const userId = (req.user as any)?.id;

      // Record metric
      performanceMonitoring.recordApiResponseTimeMetric(route, req.method, res.statusCode, duration, userId);

      // Call original end method
      return originalEnd.apply(this, args);
    };

    next();
  };
}
