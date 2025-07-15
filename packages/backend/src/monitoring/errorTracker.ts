/**
 * Enhanced Error Tracking System
 * 
 * Provides comprehensive error tracking with metrics, alerting, and analysis
 */

import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Gauge } from 'prom-client';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import config from '../config';
import { unifiedRegistry } from './unified';

// Error tracking metrics
const errorCounter = new Counter({
  name: 'spheroseg_errors_total',
  help: 'Total number of errors by type and severity',
  labelNames: ['error_type', 'error_code', 'severity', 'route', 'method'],
  registers: [unifiedRegistry],
});

const errorRateHistogram = new Histogram({
  name: 'spheroseg_error_rate',
  help: 'Error rate over time windows',
  labelNames: ['time_window', 'error_type'],
  buckets: [0, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0],
  registers: [unifiedRegistry],
});

const errorRecoveryTimeHistogram = new Histogram({
  name: 'spheroseg_error_recovery_time_seconds',
  help: 'Time to recover from errors',
  labelNames: ['error_type', 'recovery_method'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
  registers: [unifiedRegistry],
});

const activeErrorsGauge = new Gauge({
  name: 'spheroseg_active_errors',
  help: 'Number of currently active/unresolved errors',
  labelNames: ['error_type', 'severity'],
  registers: [unifiedRegistry],
});

// Error tracking interfaces
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  route?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  timestamp: number;
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorPattern {
  id: string;
  pattern: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers: Set<string>;
  resolution?: string;
}

export interface ErrorAlert {
  id: string;
  type: 'threshold' | 'spike' | 'pattern' | 'critical';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  metadata: Record<string, any>;
}

// Error tracking class
class ErrorTracker {
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private recentErrors: ErrorContext[] = [];
  private activeErrors: Map<string, ErrorContext> = new Map();
  private errorAlerts: ErrorAlert[] = [];
  private readonly maxRecentErrors = 1000;
  private readonly maxErrorPatterns = 100;
  private readonly errorThresholds = {
    low: 10,      // 10 errors/minute
    medium: 50,   // 50 errors/minute
    high: 100,    // 100 errors/minute
    critical: 200, // 200 errors/minute
  };

  /**
   * Track an error occurrence
   */
  public trackError(
    error: Error | ApiError,
    context: Partial<ErrorContext> = {}
  ): void {
    const errorContext: ErrorContext = {
      requestId: context.requestId || this.generateRequestId(),
      userId: context.userId,
      sessionId: context.sessionId,
      route: context.route,
      method: context.method,
      userAgent: context.userAgent,
      ip: context.ip,
      timestamp: Date.now(),
      stackTrace: error.stack,
      additionalData: context.additionalData,
    };

    // Update metrics
    this.updateMetrics(error, errorContext);
    
    // Track error patterns
    this.trackErrorPattern(error, errorContext);
    
    // Store recent error
    this.storeRecentError(errorContext);
    
    // Check for alerts
    this.checkForAlerts(error, errorContext);
    
    // Log error with enhanced context
    this.logError(error, errorContext);
  }

  /**
   * Mark an error as resolved
   */
  public resolveError(
    errorId: string,
    recoveryMethod: string = 'manual'
  ): void {
    const error = this.activeErrors.get(errorId);
    if (error) {
      const recoveryTime = (Date.now() - error.timestamp) / 1000;
      
      errorRecoveryTimeHistogram
        .labels('generic', recoveryMethod)
        .observe(recoveryTime);
      
      this.activeErrors.delete(errorId);
      
      // Update active errors gauge
      activeErrorsGauge.dec();
      
      logger.info('Error resolved', {
        errorId,
        recoveryMethod,
        recoveryTime,
      });
    }
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): {
    totalErrors: number;
    activeErrors: number;
    errorPatterns: ErrorPattern[];
    recentAlerts: ErrorAlert[];
    topErrors: Array<{ pattern: string; count: number }>;
  } {
    const topErrors = Array.from(this.errorPatterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(pattern => ({
        pattern: pattern.pattern,
        count: pattern.count,
      }));

    return {
      totalErrors: this.recentErrors.length,
      activeErrors: this.activeErrors.size,
      errorPatterns: Array.from(this.errorPatterns.values()),
      recentAlerts: this.errorAlerts.slice(-10),
      topErrors,
    };
  }

  /**
   * Get health status based on error patterns
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const now = Date.now();
    const recentErrors = this.recentErrors.filter(
      error => now - error.timestamp < 60000 // Last minute
    );

    const errorRate = recentErrors.length;
    const criticalErrors = this.errorAlerts.filter(
      alert => alert.severity === 'critical' && now - alert.timestamp < 300000 // Last 5 minutes
    ).length;

    let status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    let score: number;
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (criticalErrors > 0) {
      status = 'critical';
      score = 0;
      issues.push(`${criticalErrors} critical errors in last 5 minutes`);
      recommendations.push('Immediate intervention required');
    } else if (errorRate > this.errorThresholds.high) {
      status = 'unhealthy';
      score = 25;
      issues.push(`High error rate: ${errorRate} errors/minute`);
      recommendations.push('Investigate error causes and implement fixes');
    } else if (errorRate > this.errorThresholds.medium) {
      status = 'degraded';
      score = 50;
      issues.push(`Elevated error rate: ${errorRate} errors/minute`);
      recommendations.push('Monitor closely and consider preventive measures');
    } else if (errorRate > this.errorThresholds.low) {
      status = 'degraded';
      score = 75;
      issues.push(`Moderate error rate: ${errorRate} errors/minute`);
      recommendations.push('Review error patterns for optimization opportunities');
    } else {
      status = 'healthy';
      score = 100;
    }

    return { status, score, issues, recommendations };
  }

  /**
   * Clear old data to prevent memory leaks
   */
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up recent errors
    this.recentErrors = this.recentErrors.filter(
      error => now - error.timestamp < maxAge
    );

    // Clean up old error patterns
    for (const [key, pattern] of this.errorPatterns.entries()) {
      if (now - pattern.lastSeen > maxAge) {
        this.errorPatterns.delete(key);
      }
    }

    // Clean up old alerts
    this.errorAlerts = this.errorAlerts.filter(
      alert => now - alert.timestamp < maxAge
    );
  }

  private updateMetrics(error: Error | ApiError, context: ErrorContext): void {
    const errorType = error.constructor.name;
    const errorCode = error instanceof ApiError ? error.code : 'UNKNOWN';
    const severity = this.determineErrorSeverity(error);
    const route = context.route || 'unknown';
    const method = context.method || 'unknown';

    errorCounter.labels(errorType, errorCode, severity, route, method).inc();
    activeErrorsGauge.labels(errorType, severity).inc();
  }

  private trackErrorPattern(error: Error | ApiError, context: ErrorContext): void {
    const patternKey = this.generatePatternKey(error, context);
    
    if (this.errorPatterns.has(patternKey)) {
      const pattern = this.errorPatterns.get(patternKey)!;
      pattern.count++;
      pattern.lastSeen = Date.now();
      if (context.userId) {
        pattern.affectedUsers.add(context.userId);
      }
    } else {
      if (this.errorPatterns.size >= this.maxErrorPatterns) {
        // Remove oldest pattern
        const oldestPattern = Array.from(this.errorPatterns.entries())
          .sort(([, a], [, b]) => a.lastSeen - b.lastSeen)[0];
        this.errorPatterns.delete(oldestPattern[0]);
      }

      const pattern: ErrorPattern = {
        id: this.generatePatternId(),
        pattern: patternKey,
        count: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        severity: this.determineErrorSeverity(error),
        affectedUsers: new Set(context.userId ? [context.userId] : []),
      };

      this.errorPatterns.set(patternKey, pattern);
    }
  }

  private storeRecentError(context: ErrorContext): void {
    this.recentErrors.push(context);
    
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.shift();
    }

    // Store in active errors if it's a serious error
    if (context.route) {
      this.activeErrors.set(context.requestId!, context);
    }
  }

  private checkForAlerts(error: Error | ApiError, context: ErrorContext): void {
    const now = Date.now();
    const recentErrors = this.recentErrors.filter(
      e => now - e.timestamp < 60000 // Last minute
    );

    // Check for error rate spike
    if (recentErrors.length > this.errorThresholds.high) {
      this.createAlert({
        type: 'spike',
        message: `High error rate detected: ${recentErrors.length} errors in last minute`,
        severity: 'high',
        metadata: {
          errorCount: recentErrors.length,
          threshold: this.errorThresholds.high,
        },
      });
    }

    // Check for critical errors
    if (error instanceof ApiError && error.statusCode >= 500) {
      this.createAlert({
        type: 'critical',
        message: `Critical error: ${error.message}`,
        severity: 'critical',
        metadata: {
          errorCode: error.code,
          statusCode: error.statusCode,
          route: context.route,
        },
      });
    }
  }

  private createAlert(alert: Omit<ErrorAlert, 'id' | 'timestamp'>): void {
    const newAlert: ErrorAlert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      ...alert,
    };

    this.errorAlerts.push(newAlert);
    
    // Keep only recent alerts
    if (this.errorAlerts.length > 100) {
      this.errorAlerts.shift();
    }

    logger.warn('Error alert created', newAlert);
  }

  private logError(error: Error | ApiError, context: ErrorContext): void {
    const logData = {
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorCode: error instanceof ApiError ? error.code : undefined,
      statusCode: error instanceof ApiError ? error.statusCode : undefined,
      context,
      severity: this.determineErrorSeverity(error),
    };

    if (error instanceof ApiError && error.statusCode >= 500) {
      logger.error('Server error tracked', logData);
    } else {
      logger.warn('Error tracked', logData);
    }
  }

  private determineErrorSeverity(error: Error | ApiError): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof ApiError) {
      if (error.statusCode >= 500) return 'critical';
      if (error.statusCode >= 400) return 'medium';
      return 'low';
    }
    
    if (error.name === 'ValidationError') return 'low';
    if (error.name === 'UnauthorizedError') return 'medium';
    
    return 'high';
  }

  private generatePatternKey(error: Error | ApiError, context: ErrorContext): string {
    const errorType = error.constructor.name;
    const route = context.route || 'unknown';
    const method = context.method || 'unknown';
    
    return `${errorType}:${route}:${method}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generatePatternId(): string {
    return `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Create singleton instance
export const errorTracker = new ErrorTracker();

// Cleanup job - run every hour
setInterval(() => {
  errorTracker.cleanup();
}, 60 * 60 * 1000);

/**
 * Enhanced error tracking middleware
 */
export const errorTrackingMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const context: Partial<ErrorContext> = {
    requestId: req.headers['x-request-id'] as string || req.requestId,
    userId: (req as any).user?.userId,
    route: req.route?.path || req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    additionalData: {
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
    },
  };

  errorTracker.trackError(err, context);
  next(err);
};

/**
 * Error metrics endpoint
 */
export const getErrorMetrics = () => {
  return {
    stats: errorTracker.getErrorStats(),
    health: errorTracker.getHealthStatus(),
  };
};