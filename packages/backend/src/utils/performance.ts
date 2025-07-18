/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for monitoring application performance,
 * memory usage, and detecting potential bottlenecks.
 */

import logger from './logger';

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    usage: number; // percentage
    external: number;
  };
  cpu: {
    usage: number; // percentage
  };
  uptime: number;
  timestamp: string;
}

/**
 * Get current memory usage metrics
 */
export const getMemoryMetrics = () => {
  const memUsage = process.memoryUsage();

  return {
    used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100), // %
    external: Math.round(memUsage.external / 1024 / 1024), // MB
  };
};

/**
 * Get CPU usage (approximation based on process.cpuUsage)
 */
export const getCpuMetrics = () => {
  const cpuUsage = process.cpuUsage();
  const total = cpuUsage.user + cpuUsage.system;
  const uptime = process.uptime() * 1000000; // Convert to microseconds

  return {
    usage: Math.round((total / uptime) * 100),
  };
};

/**
 * Get comprehensive performance metrics
 */
export const getPerformanceMetrics = (): PerformanceMetrics => {
  return {
    memory: getMemoryMetrics(),
    cpu: getCpuMetrics(),
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
};

/**
 * Performance monitoring middleware
 */
let lastMetrics: PerformanceMetrics | null = null;
let metricsInterval: ReturnType<typeof setInterval> | null = null;

export const startPerformanceMonitoring = (intervalMs: number = 60000) => {
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }

  metricsInterval = setInterval(() => {
    const metrics = getPerformanceMetrics();

    // Log warning if memory usage is high
    if (metrics.memory.usage > 85) {
      logger.warn('High memory usage detected', {
        usage: `${metrics.memory.usage}%`,
        used: `${metrics.memory.used}MB`,
        total: `${metrics.memory.total}MB`,
      });
    }

    // Log performance metrics for monitoring
    logger.debug('Performance Metrics', {
      metric: 'system_performance',
      ...metrics,
    });

    lastMetrics = metrics;
  }, intervalMs);

  logger.info('Performance monitoring started', {
    interval: `${intervalMs}ms`,
  });
};

export const stopPerformanceMonitoring = () => {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
    logger.info('Performance monitoring stopped');
  }
};

export const getLastMetrics = () => lastMetrics;

/**
 * Function execution timer
 */
export const measureExecutionTime = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Slow function execution', {
        function: name,
        duration: `${duration}ms`,
      });
    } else {
      logger.debug('Function execution completed', {
        function: name,
        duration: `${duration}ms`,
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Function execution failed', {
      function: name,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Decorator for measuring method execution time
 */
export function measureTime(
  target: unknown,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (this: unknown, ...args: unknown[]) {
    const className = (target as { constructor: { name: string } }).constructor.name;
    const methodName = `${className}.${propertyName}`;

    return measureExecutionTime(methodName, () => originalMethod.apply(this, args));
  };

  return descriptor;
}
