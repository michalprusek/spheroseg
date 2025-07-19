/**
 * Performance Monitoring Middleware
 *
 * This middleware tracks request duration, memory usage, and other performance metrics
 * for API endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import config from '../config';

// Define performance thresholds
const PERFORMANCE_THRESHOLDS = {
  // Request duration thresholds in milliseconds
  duration: {
    warn: 1000, // 1 second
    error: 3000, // 3 seconds
  },
  // Memory usage thresholds in bytes
  memory: {
    warn: 100 * 1024 * 1024, // 100 MB
    error: 500 * 1024 * 1024, // 500 MB
  },
};

/**
 * Get current memory usage
 */
const getMemoryUsage = () => {
  const memoryUsage = process.memoryUsage();
  return {
    rss: memoryUsage.rss, // Resident Set Size - total memory allocated for the process
    heapTotal: memoryUsage.heapTotal, // Total size of the allocated heap
    heapUsed: memoryUsage.heapUsed, // Actual memory used during execution
    external: memoryUsage.external, // Memory used by C++ objects bound to JavaScript objects
  };
};

/**
 * Format memory size for logging
 */
const formatMemorySize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
};

/**
 * Performance monitoring middleware
 */
export const performanceMonitoring = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip performance monitoring in test environment
    if (config.isTest) {
      return next();
    }

    // Record start time
    const startTime = process.hrtime();
    const startMemory = getMemoryUsage();

    // Add response listener
    res.on('finish', () => {
      // Calculate request duration
      const hrTime = process.hrtime(startTime);
      const durationMs = hrTime[0] * 1000 + hrTime[1] / 1000000;

      // Get current memory usage
      const endMemory = getMemoryUsage();

      // Calculate memory difference
      const memoryDiff = {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
      };

      // Determine log level based on thresholds
      let logLevel = 'info';
      if (
        durationMs > PERFORMANCE_THRESHOLDS.duration.error ||
        endMemory.heapUsed > PERFORMANCE_THRESHOLDS.memory.error
      ) {
        logLevel = 'error';
      } else if (
        durationMs > PERFORMANCE_THRESHOLDS.duration.warn ||
        endMemory.heapUsed > PERFORMANCE_THRESHOLDS.memory.warn
      ) {
        logLevel = 'warn';
      }

      // Create performance metrics
      const performanceMetrics = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: {
          ms: durationMs,
          formatted: `${durationMs.toFixed(2)} ms`,
        },
        memory: {
          current: {
            heapUsed: endMemory.heapUsed,
            heapTotal: endMemory.heapTotal,
            rss: endMemory.rss,
            external: endMemory.external,
            formattedHeapUsed: formatMemorySize(endMemory.heapUsed),
          },
          diff: {
            heapUsed: memoryDiff.heapUsed,
            heapTotal: memoryDiff.heapTotal,
            rss: memoryDiff.rss,
            external: memoryDiff.external,
            formattedHeapUsed: formatMemorySize(memoryDiff.heapUsed),
          },
        },
      };

      // Log performance metrics
      if (logLevel === 'error') {
        logger.error('Performance issue detected', performanceMetrics);
      } else if (logLevel === 'warn') {
        logger.warn('Performance warning', performanceMetrics);
      } else {
        logger.info('Request performance', performanceMetrics);
      }

      // Add performance metrics to response headers if in development
      // Only set headers if they haven't been sent yet
      if (config.isDevelopment && !res.headersSent) {
        try {
          res.set('X-Response-Time', `${durationMs.toFixed(2)} ms`);
          res.set('X-Memory-Usage', formatMemorySize(endMemory.heapUsed));
        } catch (error) {
          // Ignore errors when setting headers after they've been sent
          logger.debug('Could not set performance headers', { error });
        }
      }
    });

    next();
  };
};

/**
 * Apply performance monitoring to the application
 */
export const applyPerformanceMonitoring = (app: unknown) => {
  app.use(performanceMonitoring());
  logger.info('Performance monitoring middleware applied');
};

export default performanceMonitoring;
