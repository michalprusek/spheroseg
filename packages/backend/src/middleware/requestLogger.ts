/**
 * Enhanced Request Logger Middleware
 *
 * Provides detailed request/response logging with performance metrics
 * and error tracking for better observability.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import config from '../config';

interface RequestMetrics {
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  userId?: string;
  statusCode?: number;
  responseTime?: number;
  contentLength?: number;
  error?: any;
}

/**
 * Enhanced request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const originalEnd = res.end;
  const originalJson = res.json;

  // Capture request details
  const userAgent = req.get('User-Agent');
  const userId = (req as any).user?.id;
  const requestMetrics: RequestMetrics = {
    method: req.method,
    url: req.originalUrl || req.url,
    ...(userAgent && { userAgent }),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    ...(userId && { userId }),
  };

  // Override res.end to capture response details
  res.end = function (chunk?: any, encoding?: any) {
    res.end = originalEnd;
    const responseTime = Date.now() - startTime;

    requestMetrics.statusCode = res.statusCode;
    requestMetrics.responseTime = responseTime;
    const contentLengthHeader = res.get('Content-Length');
    if (contentLengthHeader) {
      requestMetrics.contentLength = parseInt(contentLengthHeader);
    }

    // Log the request based on status code
    logRequest(requestMetrics);

    return originalEnd.call(this, chunk, encoding);
  };

  // Override res.json to capture JSON responses
  res.json = function (obj?: any) {
    res.json = originalJson;

    // Capture error details if it's an error response
    if (res.statusCode >= 400 && obj?.error) {
      requestMetrics.error = {
        code: obj.error,
        message: obj.message,
      };
    }

    return originalJson.call(this, obj);
  };

  next();
};

/**
 * Log request details based on response status
 */
function logRequest(metrics: RequestMetrics) {
  const { statusCode, responseTime, method, url, error } = metrics;

  // Skip health check logging in production unless there's an error
  if (!config.isDevelopment && url === '/health' && statusCode! < 400) {
    return;
  }

  const baseLog = {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    ip: metrics.ip,
    userAgent: metrics.userAgent,
    userId: metrics.userId,
    contentLength: metrics.contentLength,
  };

  // Log level based on status code and response time
  if (statusCode! >= 500) {
    logger.error('Server Error Response', { ...baseLog, error });
  } else if (statusCode! >= 400) {
    logger.warn('Client Error Response', { ...baseLog, error });
  } else if (responseTime! > 5000) {
    logger.warn('Slow Response', { ...baseLog, threshold: '5000ms' });
  } else if (responseTime! > 1000) {
    logger.info('Request Completed (Slow)', baseLog);
  } else {
    logger.info('Request Completed', baseLog);
  }

  // Log performance metrics for monitoring
  if (config.monitoring?.metricsEnabled) {
    logger.debug('Performance Metrics', {
      metric: 'http_request',
      method,
      url: sanitizeUrl(url),
      statusCode,
      responseTime,
      userId: metrics.userId || 'anonymous',
    });
  }
}

/**
 * Sanitize URL for logging (remove sensitive data)
 */
function sanitizeUrl(url: string): string {
  try {
    // Remove query parameters that might contain sensitive data
    const urlObj = new URL(url, 'http://localhost');

    // Remove sensitive query parameters
    const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth'];
    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });

    return urlObj.pathname + urlObj.search;
  } catch {
    // Fallback for invalid URLs
    return url.split('?')[0] || url; // Just return pathname
  }
}
