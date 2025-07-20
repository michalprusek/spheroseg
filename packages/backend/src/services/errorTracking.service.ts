/**
 * Enhanced Error Tracking and Alerting Service
 * 
 * Provides comprehensive error tracking, aggregation, and alerting capabilities:
 * - Real-time error collection and analysis
 * - Error pattern detection and anomaly identification
 * - Multi-channel alerting (email, Slack, webhook)
 * - Error correlation and root cause analysis
 * - Automated error categorization and prioritization
 * - Performance impact analysis
 * - Error trend analysis and reporting
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import pool from '../db';
import logger from '../utils/logger';
import { ApiError, ErrorContext } from '../utils/ApiError.enhanced';
import { unifiedRegistry } from '../monitoring/unified';
import { Counter, Gauge, Histogram } from 'prom-client';
import NodeCache from 'node-cache';
import { PIISanitizer } from '../utils/piiSanitizer';
import ERROR_TRACKING_CONFIG from '../config/errorTracking.config';

export interface ErrorTrackingConfig {
  enableRealTimeAlerts: boolean;
  enableErrorAggregation: boolean;
  enablePatternDetection: boolean;
  enableCorrelationAnalysis: boolean;
  alertThresholds: {
    errorRatePerMinute: number;
    criticalErrorsPerHour: number;
    uniqueErrorsPerHour: number;
    errorSpike: {
      threshold: number; // percentage increase
      timeWindow: number; // minutes
    };
  };
  retentionPeriods: {
    errorLogs: number; // days
    errorStats: number; // days
    alertHistory: number; // days
  };
  alertChannels: {
    email: {
      enabled: boolean;
      recipients: string[];
      throttleMinutes: number;
    };
    slack: {
      enabled: boolean;
      webhookUrl?: string;
      channel?: string;
      throttleMinutes: number;
    };
    webhook: {
      enabled: boolean;
      urls: string[];
      throttleMinutes: number;
    };
  };
}

export interface ErrorEntry {
  id: string;
  code: string;
  message: string;
  statusCode: number;
  category: 'authentication' | 'validation' | 'permission' | 'business' | 'external' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: ErrorContext;
  details?: any;
  fingerprint: string; // For error grouping
  timestamp: Date;
  userId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  stack?: string;
  originalError?: string;
  resolved: boolean;
  occurrenceCount: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
}

export interface ErrorPattern {
  id: string;
  fingerprint: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  occurrences: number;
  affectedUsers: number;
  firstSeen: Date;
  lastSeen: Date;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercent: number;
  relatedPatterns: string[];
  suggestedActions: string[];
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ErrorAlert {
  id: string;
  type: 'error_rate' | 'critical_error' | 'new_pattern' | 'error_spike' | 'service_degradation';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  details: {
    errorCount?: number;
    errorRate?: number;
    affectedUsers?: number;
    timeWindow?: number;
    patterns?: string[];
    recommendations?: string[];
  };
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  channels: string[];
  retryCount: number;
  lastRetry?: Date;
}

export interface ErrorInsight {
  id: string;
  type: 'correlation' | 'trend' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  timestamp: Date;
  relatedErrors: string[];
  actionable: boolean;
  actions?: string[];
}

export interface ErrorSummary {
  totalErrors: number;
  errorRate: number; // errors per minute
  criticalErrors: number;
  uniquePatterns: number;
  affectedUsers: number;
  topCategories: Array<{ category: string; count: number; percentage: number }>;
  topPatterns: ErrorPattern[];
  recentTrends: {
    last15Minutes: number;
    last1Hour: number;
    last24Hours: number;
    trend: 'improving' | 'stable' | 'degrading';
  };
  serviceHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

class ErrorTrackingService extends EventEmitter {
  private redis: Redis;
  private config: ErrorTrackingConfig;
  private errorCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
  private patternCache = new NodeCache({ stdTTL: 1800 }); // 30 minutes
  private alertThrottleCache = new NodeCache({ stdTTL: 0 }); // Custom TTL per alert
  
  // Prometheus metrics
  private errorCounter: Counter<string>;
  private errorRateGauge: Gauge<string>;
  private errorPatternsGauge: Gauge<string>;
  private alertCounter: Counter<string>;
  private errorSeverityGauge: Gauge<string>;
  private responseTimeImpactHistogram: Histogram<string>;

  constructor(redis: Redis, config: Partial<ErrorTrackingConfig> = {}) {
    super();
    this.redis = redis;
    
    this.config = {
      enableRealTimeAlerts: true,
      enableErrorAggregation: true,
      enablePatternDetection: true,
      enableCorrelationAnalysis: true,
      alertThresholds: {
        errorRatePerMinute: 10,
        criticalErrorsPerHour: 5,
        uniqueErrorsPerHour: 20,
        errorSpike: {
          threshold: 200, // 200% increase
          timeWindow: 15, // 15 minutes
        },
      },
      retentionPeriods: {
        errorLogs: 30,
        errorStats: 90,
        alertHistory: 30,
      },
      alertChannels: {
        email: {
          enabled: false,
          recipients: [],
          throttleMinutes: 60,
        },
        slack: {
          enabled: false,
          throttleMinutes: 30,
        },
        webhook: {
          enabled: false,
          urls: [],
          throttleMinutes: 15,
        },
      },
      ...config,
    };

    this.initializeMetrics();
    this.startPeriodicProcessing();
    this.setupEventListeners();
  }

  private initializeMetrics(): void {
    this.errorCounter = new Counter({
      name: 'spheroseg_errors_total',
      help: 'Total number of errors by category and severity',
      labelNames: ['category', 'severity', 'code'],
      registers: [unifiedRegistry],
    });

    this.errorRateGauge = new Gauge({
      name: 'spheroseg_error_rate_per_minute',
      help: 'Current error rate per minute',
      registers: [unifiedRegistry],
    });

    this.errorPatternsGauge = new Gauge({
      name: 'spheroseg_error_patterns_active',
      help: 'Number of active error patterns',
      labelNames: ['severity'],
      registers: [unifiedRegistry],
    });

    this.alertCounter = new Counter({
      name: 'spheroseg_error_alerts_total',
      help: 'Total number of error alerts generated',
      labelNames: ['type', 'severity'],
      registers: [unifiedRegistry],
    });

    this.errorSeverityGauge = new Gauge({
      name: 'spheroseg_error_severity_score',
      help: 'Overall error severity score (0-100)',
      registers: [unifiedRegistry],
    });

    this.responseTimeImpactHistogram = new Histogram({
      name: 'spheroseg_error_response_time_impact_seconds',
      help: 'Response time impact when errors occur',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [unifiedRegistry],
    });
  }

  public async trackError(
    error: ApiError | Error,
    context?: ErrorContext,
    additionalData?: any
  ): Promise<string> {
    try {
      const errorEntry = await this.createErrorEntry(error, context, additionalData);
      
      // Store in database
      await this.storeErrorEntry(errorEntry);
      
      // Update metrics
      this.updateMetrics(errorEntry);
      
      // Process for patterns and alerts
      if (this.config.enablePatternDetection) {
        await this.detectAndUpdatePatterns(errorEntry);
      }
      
      if (this.config.enableRealTimeAlerts) {
        await this.checkAlertConditions(errorEntry);
      }
      
      // Emit event for real-time processing
      this.emit('errorTracked', errorEntry);
      
      return errorEntry.id;
    } catch (trackingError) {
      logger.error('Error tracking failed', {
        error: trackingError instanceof Error ? trackingError.message : 'Unknown error',
        originalError: error.message,
        context,
      });
      return '';
    }
  }

  private async createErrorEntry(
    error: ApiError | Error,
    context?: ErrorContext,
    additionalData?: any
  ): Promise<ErrorEntry> {
    const isApiError = error instanceof ApiError;
    const timestamp = new Date();
    
    // Generate fingerprint for error grouping
    const fingerprint = this.generateErrorFingerprint(error, context);
    
    // Determine category and severity
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);
    
    const errorEntry: ErrorEntry = {
      id: `error_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
      code: isApiError ? error.code : error.name,
      message: error.message,
      statusCode: isApiError ? error.statusCode : 500,
      category,
      severity,
      context,
      details: additionalData,
      fingerprint,
      timestamp,
      userId: context?.userId,
      requestId: context?.requestId,
      userAgent: context?.metadata?.userAgent,
      ip: context?.metadata?.ip,
      stack: error.stack,
      originalError: isApiError && error.originalError ? error.originalError.message : undefined,
      resolved: false,
      occurrenceCount: 1,
      firstOccurrence: timestamp,
      lastOccurrence: timestamp,
    };

    return errorEntry;
  }

  private generateErrorFingerprint(error: ApiError | Error, context?: ErrorContext): string {
    // Create a unique fingerprint for grouping similar errors
    const components = [
      error.name || 'Error',
      (error as ApiError).code || 'unknown',
      this.normalizeStackTrace(error.stack),
      context?.action || '',
      context?.resource || '',
    ];

    return require('crypto')
      .createHash('md5')
      .update(components.join('|'))
      .digest('hex');
  }

  private normalizeStackTrace(stack?: string): string {
    if (!stack) return '';
    
    // Remove line numbers and file paths to group similar errors
    return stack
      .split('\n')[0] // Take only the first line
      .replace(/:\d+:\d+/g, '') // Remove line:column numbers
      .replace(/\/.*\//g, '/') // Remove specific file paths
      .trim();
  }

  private categorizeError(error: ApiError | Error): ErrorEntry['category'] {
    if (error instanceof ApiError) {
      if (error.code.startsWith('AUTH_')) return 'authentication';
      if (error.code.startsWith('VALIDATION_')) return 'validation';
      if (error.code.startsWith('PERMISSION_')) return 'permission';
      if (error.code.startsWith('BUSINESS_')) return 'business';
      if (error.code.startsWith('EXTERNAL_')) return 'external';
      if (error.code.startsWith('SYSTEM_')) return 'system';
    }

    // Fallback categorization based on error name/message
    const message = error.message.toLowerCase();
    if (message.includes('unauthorized') || message.includes('forbidden')) return 'permission';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('not found')) return 'business';
    if (message.includes('timeout') || message.includes('connection')) return 'external';
    
    return 'system';
  }

  private determineSeverity(error: ApiError | Error, category: string): ErrorEntry['severity'] {
    if (error instanceof ApiError) {
      if (error.statusCode >= 500) return 'critical';
      if (error.statusCode >= 400) {
        if (category === 'authentication' || category === 'permission') return 'high';
        if (category === 'validation') return 'medium';
        return 'medium';
      }
      return 'low';
    }

    // For non-API errors, assume high severity
    return 'high';
  }

  private async storeErrorEntry(errorEntry: ErrorEntry): Promise<void> {
    try {
      // Store in PostgreSQL
      await pool.query(`
        INSERT INTO error_logs (
          id, code, message, status_code, category, severity,
          context, details, fingerprint, timestamp, user_id, request_id,
          user_agent, ip, stack, original_error, resolved
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (fingerprint) DO UPDATE SET
          last_occurrence = $10,
          occurrence_count = error_logs.occurrence_count + 1,
          context = $7,
          details = $8
      `, [
        errorEntry.id,
        errorEntry.code,
        errorEntry.message,
        errorEntry.statusCode,
        errorEntry.category,
        errorEntry.severity,
        JSON.stringify(errorEntry.context),
        JSON.stringify(errorEntry.details),
        errorEntry.fingerprint,
        errorEntry.timestamp,
        errorEntry.userId,
        errorEntry.requestId,
        errorEntry.userAgent,
        errorEntry.ip,
        errorEntry.stack,
        errorEntry.originalError,
        errorEntry.resolved,
      ]);

      // Store in Redis for fast access
      const key = `error_entry:${errorEntry.id}`;
      await this.redis.setex(key, 86400, JSON.stringify(errorEntry)); // 24 hours TTL

      // Update error pattern cache
      const patternKey = `error_pattern:${errorEntry.fingerprint}`;
      await this.redis.hincrby(patternKey, 'count', 1);
      await this.redis.hset(patternKey, 'last_seen', errorEntry.timestamp.toISOString());
      await this.redis.expire(patternKey, 86400 * 7); // 7 days TTL

    } catch (error) {
      logger.error('Failed to store error entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorEntry: errorEntry.id,
      });
      throw error;
    }
  }

  private updateMetrics(errorEntry: ErrorEntry): void {
    // Update Prometheus metrics
    this.errorCounter.inc({
      category: errorEntry.category,
      severity: errorEntry.severity,
      code: errorEntry.code,
    });

    // Update severity score
    const severityScore = this.calculateSeverityScore(errorEntry.severity);
    this.errorSeverityGauge.set(severityScore);
  }

  private calculateSeverityScore(severity: string): number {
    const scores = { low: 25, medium: 50, high: 75, critical: 100 };
    return scores[severity as keyof typeof scores] || 50;
  }

  private async detectAndUpdatePatterns(errorEntry: ErrorEntry): Promise<void> {
    try {
      const pattern = await this.getOrCreateErrorPattern(errorEntry);
      
      if (pattern) {
        // Update pattern statistics
        pattern.occurrences++;
        pattern.lastSeen = errorEntry.timestamp;
        
        // Calculate trend
        await this.updatePatternTrend(pattern);
        
        // Store updated pattern
        await this.storeErrorPattern(pattern);
        
        // Check if this is a new critical pattern
        if (pattern.severity === 'critical' && pattern.occurrences === 1) {
          await this.generateAlert({
            type: 'new_pattern',
            severity: 'critical',
            title: 'New Critical Error Pattern Detected',
            description: `A new critical error pattern has been detected: ${pattern.title}`,
            details: {
              patterns: [pattern.id],
              recommendations: pattern.suggestedActions,
            },
          });
        }
      }
    } catch (error) {
      logger.error('Failed to detect error patterns', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorEntry: errorEntry.id,
      });
    }
  }

  private async getOrCreateErrorPattern(errorEntry: ErrorEntry): Promise<ErrorPattern | null> {
    try {
      // Check if pattern already exists
      let pattern = this.patternCache.get<ErrorPattern>(errorEntry.fingerprint);
      
      if (!pattern) {
        // Try to load from database
        const result = await pool.query(`
          SELECT * FROM error_patterns WHERE fingerprint = $1
        `, [errorEntry.fingerprint]);
        
        if (result.rows.length > 0) {
          pattern = this.mapRowToErrorPattern(result.rows[0]);
          this.patternCache.set(errorEntry.fingerprint, pattern);
        } else {
          // Create new pattern
          pattern = await this.createNewErrorPattern(errorEntry);
        }
      }
      
      return pattern;
    } catch (error) {
      logger.error('Failed to get or create error pattern', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fingerprint: errorEntry.fingerprint,
      });
      return null;
    }
  }

  private async createNewErrorPattern(errorEntry: ErrorEntry): Promise<ErrorPattern> {
    const pattern: ErrorPattern = {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fingerprint: errorEntry.fingerprint,
      category: errorEntry.category,
      severity: errorEntry.severity,
      title: this.generatePatternTitle(errorEntry),
      description: this.generatePatternDescription(errorEntry),
      occurrences: 1,
      affectedUsers: errorEntry.userId ? 1 : 0,
      firstSeen: errorEntry.timestamp,
      lastSeen: errorEntry.timestamp,
      trend: 'stable',
      trendPercent: 0,
      relatedPatterns: [],
      suggestedActions: this.generateSuggestedActions(errorEntry),
      resolved: false,
    };

    await this.storeErrorPattern(pattern);
    this.patternCache.set(errorEntry.fingerprint, pattern);
    
    return pattern;
  }

  private generatePatternTitle(errorEntry: ErrorEntry): string {
    return `${errorEntry.category.charAt(0).toUpperCase() + errorEntry.category.slice(1)} Error: ${errorEntry.code}`;
  }

  private generatePatternDescription(errorEntry: ErrorEntry): string {
    return `${errorEntry.message} (Status: ${errorEntry.statusCode})`;
  }

  private generateSuggestedActions(errorEntry: ErrorEntry): string[] {
    const actions: string[] = [];
    
    switch (errorEntry.category) {
      case 'authentication':
        actions.push('Check authentication flow and token validation');
        actions.push('Review session management configuration');
        break;
      case 'validation':
        actions.push('Review input validation rules');
        actions.push('Check API documentation for required fields');
        break;
      case 'permission':
        actions.push('Review user permissions and role assignments');
        actions.push('Check authorization middleware configuration');
        break;
      case 'business':
        actions.push('Review business logic and state validation');
        actions.push('Check prerequisite conditions');
        break;
      case 'external':
        actions.push('Check external service availability');
        actions.push('Review timeout and retry configurations');
        break;
      case 'system':
        actions.push('Check system resources and performance');
        actions.push('Review error handling and recovery mechanisms');
        break;
    }
    
    if (errorEntry.severity === 'critical') {
      actions.unshift('Immediate investigation required');
    }
    
    return actions;
  }

  private async updatePatternTrend(pattern: ErrorPattern): Promise<void> {
    try {
      // Get historical data for trend calculation
      const result = await pool.query(`
        SELECT DATE_TRUNC('hour', timestamp) as hour, COUNT(*) as count
        FROM error_logs
        WHERE fingerprint = $1 
          AND timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour DESC
        LIMIT 24
      `, [pattern.fingerprint]);

      if (result.rows.length >= 2) {
        const recent = result.rows.slice(0, 6).reduce((sum, row) => sum + parseInt(row.count), 0);
        const previous = result.rows.slice(6, 12).reduce((sum, row) => sum + parseInt(row.count), 0);
        
        if (previous > 0) {
          const changePercent = ((recent - previous) / previous) * 100;
          
          if (changePercent > 20) {
            pattern.trend = 'increasing';
            pattern.trendPercent = changePercent;
          } else if (changePercent < -20) {
            pattern.trend = 'decreasing';
            pattern.trendPercent = Math.abs(changePercent);
          } else {
            pattern.trend = 'stable';
            pattern.trendPercent = Math.abs(changePercent);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to update pattern trend', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patternId: pattern.id,
      });
    }
  }

  private async storeErrorPattern(pattern: ErrorPattern): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO error_patterns (
          id, fingerprint, category, severity, title, description,
          occurrences, affected_users, first_seen, last_seen,
          trend, trend_percent, related_patterns, suggested_actions, resolved
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (fingerprint) DO UPDATE SET
          occurrences = $7,
          affected_users = $8,
          last_seen = $10,
          trend = $11,
          trend_percent = $12,
          suggested_actions = $14
      `, [
        pattern.id,
        pattern.fingerprint,
        pattern.category,
        pattern.severity,
        pattern.title,
        pattern.description,
        pattern.occurrences,
        pattern.affectedUsers,
        pattern.firstSeen,
        pattern.lastSeen,
        pattern.trend,
        pattern.trendPercent,
        JSON.stringify(pattern.relatedPatterns),
        JSON.stringify(pattern.suggestedActions),
        pattern.resolved,
      ]);

      // Update metrics
      this.errorPatternsGauge.set(
        { severity: pattern.severity },
        pattern.occurrences
      );
      
    } catch (error) {
      logger.error('Failed to store error pattern', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patternId: pattern.id,
      });
    }
  }

  private mapRowToErrorPattern(row: any): ErrorPattern {
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      category: row.category,
      severity: row.severity,
      title: row.title,
      description: row.description,
      occurrences: row.occurrences,
      affectedUsers: row.affected_users,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      trend: row.trend,
      trendPercent: row.trend_percent,
      relatedPatterns: JSON.parse(row.related_patterns || '[]'),
      suggestedActions: JSON.parse(row.suggested_actions || '[]'),
      resolved: row.resolved,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
    };
  }

  private async checkAlertConditions(errorEntry: ErrorEntry): Promise<void> {
    try {
      // Check error rate threshold
      await this.checkErrorRateAlert();
      
      // Check critical error threshold
      if (errorEntry.severity === 'critical') {
        await this.checkCriticalErrorAlert();
      }
      
      // Check error spike
      await this.checkErrorSpikeAlert();
      
    } catch (error) {
      logger.error('Failed to check alert conditions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorEntry: errorEntry.id,
      });
    }
  }

  private async checkErrorRateAlert(): Promise<void> {
    const errorRate = await this.calculateCurrentErrorRate();
    
    if (errorRate > this.config.alertThresholds.errorRatePerMinute) {
      await this.generateAlert({
        type: 'error_rate',
        severity: 'warning',
        title: 'High Error Rate Detected',
        description: `Error rate has exceeded threshold: ${errorRate}/min`,
        details: {
          errorRate,
          recommendations: [
            'Check system health and resource utilization',
            'Review recent deployments for potential issues',
            'Monitor error patterns for specific failure points',
          ],
        },
      });
    }
  }

  private async checkCriticalErrorAlert(): Promise<void> {
    const criticalErrors = await this.getCriticalErrorCount(1); // Last hour
    
    if (criticalErrors > this.config.alertThresholds.criticalErrorsPerHour) {
      await this.generateAlert({
        type: 'critical_error',
        severity: 'critical',
        title: 'Multiple Critical Errors Detected',
        description: `${criticalErrors} critical errors in the last hour`,
        details: {
          errorCount: criticalErrors,
          recommendations: [
            'Immediate investigation required',
            'Check system health and dependencies',
            'Review error patterns and affected services',
          ],
        },
      });
    }
  }

  private async checkErrorSpikeAlert(): Promise<void> {
    const { threshold, timeWindow } = this.config.alertThresholds.errorSpike;
    const currentErrors = await this.getErrorCount(timeWindow);
    const previousErrors = await this.getErrorCount(timeWindow, timeWindow);
    
    if (previousErrors > 0) {
      const increasePercent = ((currentErrors - previousErrors) / previousErrors) * 100;
      
      if (increasePercent >= threshold) {
        await this.generateAlert({
          type: 'error_spike',
          severity: 'critical',
          title: 'Error Spike Detected',
          description: `Error count increased by ${increasePercent.toFixed(1)}% in ${timeWindow} minutes`,
          details: {
            errorCount: currentErrors,
            timeWindow,
            recommendations: [
              'Check for system overload or resource constraints',
              'Review recent changes or deployments',
              'Monitor dependent services for issues',
            ],
          },
        });
      }
    }
  }

  private async calculateCurrentErrorRate(): Promise<number> {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM error_logs
        WHERE timestamp > NOW() - INTERVAL '1 minute'
      `);
      
      return parseInt(result.rows[0]?.count || '0');
    } catch (error) {
      logger.error('Failed to calculate error rate', { error });
      return 0;
    }
  }

  private async getCriticalErrorCount(hours: number): Promise<number> {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM error_logs
        WHERE severity = 'critical' 
          AND timestamp > NOW() - INTERVAL '${hours} hours'
      `);
      
      return parseInt(result.rows[0]?.count || '0');
    } catch (error) {
      logger.error('Failed to get critical error count', { error });
      return 0;
    }
  }

  private async getErrorCount(windowMinutes: number, offsetMinutes: number = 0): Promise<number> {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM error_logs
        WHERE timestamp > NOW() - INTERVAL '${windowMinutes + offsetMinutes} minutes'
          AND timestamp <= NOW() - INTERVAL '${offsetMinutes} minutes'
      `);
      
      return parseInt(result.rows[0]?.count || '0');
    } catch (error) {
      logger.error('Failed to get error count', { error });
      return 0;
    }
  }

  private async generateAlert(alertData: Partial<ErrorAlert>): Promise<void> {
    const alert: ErrorAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: alertData.type || 'error_rate',
      severity: alertData.severity || 'warning',
      title: alertData.title || 'Error Alert',
      description: alertData.description || 'An error condition has been detected',
      details: alertData.details || {},
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      channels: [],
      retryCount: 0,
      ...alertData,
    };

    // Check throttling
    const throttleKey = `alert_throttle:${alert.type}:${alert.severity}`;
    if (this.alertThrottleCache.has(throttleKey)) {
      return; // Alert is throttled
    }

    try {
      // Store alert
      await this.storeAlert(alert);
      
      // Send notifications
      await this.sendAlertNotifications(alert);
      
      // Update metrics
      this.alertCounter.inc({
        type: alert.type,
        severity: alert.severity,
      });
      
      // Set throttling
      const throttleMinutes = this.getThrottleMinutes(alert.type);
      this.alertThrottleCache.set(throttleKey, true, throttleMinutes * 60);
      
      // Emit event
      this.emit('alertGenerated', alert);
      
      logger.info('Error alert generated', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
      });
      
    } catch (error) {
      logger.error('Failed to generate alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alert: alert.id,
      });
    }
  }

  private getThrottleMinutes(alertType: string): number {
    const defaultThrottle = 30;
    
    switch (alertType) {
      case 'error_rate': return this.config.alertChannels.email.throttleMinutes;
      case 'critical_error': return this.config.alertChannels.slack.throttleMinutes;
      case 'error_spike': return this.config.alertChannels.webhook.throttleMinutes;
      default: return defaultThrottle;
    }
  }

  private async storeAlert(alert: ErrorAlert): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO error_alerts (
          id, type, severity, title, description, details,
          timestamp, acknowledged, resolved, channels, retry_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        alert.id,
        alert.type,
        alert.severity,
        alert.title,
        alert.description,
        JSON.stringify(alert.details),
        alert.timestamp,
        alert.acknowledged,
        alert.resolved,
        JSON.stringify(alert.channels),
        alert.retryCount,
      ]);
    } catch (error) {
      logger.error('Failed to store alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId: alert.id,
      });
    }
  }

  private async sendAlertNotifications(alert: ErrorAlert): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.config.alertChannels.email.enabled) {
      promises.push(this.sendEmailAlert(alert));
    }
    
    if (this.config.alertChannels.slack.enabled) {
      promises.push(this.sendSlackAlert(alert));
    }
    
    if (this.config.alertChannels.webhook.enabled) {
      promises.push(this.sendWebhookAlert(alert));
    }
    
    await Promise.allSettled(promises);
  }

  private async sendEmailAlert(alert: ErrorAlert): Promise<void> {
    // Email implementation would go here
    // For now, just log that we would send an email
    logger.info('Would send email alert', {
      alertId: alert.id,
      recipients: this.config.alertChannels.email.recipients,
    });
  }

  private async sendSlackAlert(alert: ErrorAlert): Promise<void> {
    // Slack implementation would go here
    // For now, just log that we would send a Slack message
    logger.info('Would send Slack alert', {
      alertId: alert.id,
      channel: this.config.alertChannels.slack.channel,
    });
  }

  private async sendWebhookAlert(alert: ErrorAlert): Promise<void> {
    // Webhook implementation would go here
    // For now, just log that we would send webhook notifications
    logger.info('Would send webhook alert', {
      alertId: alert.id,
      urls: this.config.alertChannels.webhook.urls,
    });
  }

  public async getErrorSummary(timeRange: number = 3600): Promise<ErrorSummary> {
    try {
      const endTime = Date.now();
      const startTime = endTime - (timeRange * 1000);
      
      // Get total error count
      const totalResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM error_logs
        WHERE timestamp > $1
      `, [new Date(startTime)]);
      
      const totalErrors = parseInt(totalResult.rows[0]?.total || '0');
      const errorRate = totalErrors / (timeRange / 60); // errors per minute
      
      // Get critical errors
      const criticalResult = await pool.query(`
        SELECT COUNT(*) as critical
        FROM error_logs
        WHERE timestamp > $1 AND severity = 'critical'
      `, [new Date(startTime)]);
      
      const criticalErrors = parseInt(criticalResult.rows[0]?.critical || '0');
      
      // Get unique patterns
      const patternsResult = await pool.query(`
        SELECT COUNT(DISTINCT fingerprint) as patterns
        FROM error_logs
        WHERE timestamp > $1
      `, [new Date(startTime)]);
      
      const uniquePatterns = parseInt(patternsResult.rows[0]?.patterns || '0');
      
      // Get affected users
      const usersResult = await pool.query(`
        SELECT COUNT(DISTINCT user_id) as users
        FROM error_logs
        WHERE timestamp > $1 AND user_id IS NOT NULL
      `, [new Date(startTime)]);
      
      const affectedUsers = parseInt(usersResult.rows[0]?.users || '0');
      
      // Get top categories
      const categoriesResult = await pool.query(`
        SELECT category, COUNT(*) as count
        FROM error_logs
        WHERE timestamp > $1
        GROUP BY category
        ORDER BY count DESC
        LIMIT 5
      `, [new Date(startTime)]);
      
      const topCategories = categoriesResult.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count),
        percentage: totalErrors > 0 ? (parseInt(row.count) / totalErrors) * 100 : 0,
      }));
      
      // Get top patterns
      const topPatternsResult = await pool.query(`
        SELECT * FROM error_patterns
        WHERE last_seen > $1
        ORDER BY occurrences DESC
        LIMIT 5
      `, [new Date(startTime)]);
      
      const topPatterns = topPatternsResult.rows.map(row => this.mapRowToErrorPattern(row));
      
      // Calculate trends
      const trends = await this.calculateErrorTrends();
      
      // Calculate service health
      const serviceHealth = this.calculateServiceHealth(errorRate, criticalErrors, totalErrors);
      
      return {
        totalErrors,
        errorRate,
        criticalErrors,
        uniquePatterns,
        affectedUsers,
        topCategories,
        topPatterns,
        recentTrends: trends,
        serviceHealth,
      };
      
    } catch (error) {
      logger.error('Failed to get error summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Return empty summary on error
      return {
        totalErrors: 0,
        errorRate: 0,
        criticalErrors: 0,
        uniquePatterns: 0,
        affectedUsers: 0,
        topCategories: [],
        topPatterns: [],
        recentTrends: {
          last15Minutes: 0,
          last1Hour: 0,
          last24Hours: 0,
          trend: 'stable',
        },
        serviceHealth: 'fair',
      };
    }
  }

  private async calculateErrorTrends(): Promise<ErrorSummary['recentTrends']> {
    try {
      const [last15Min, last1Hour, last24Hours] = await Promise.all([
        this.getErrorCount(15),
        this.getErrorCount(60),
        this.getErrorCount(24 * 60),
      ]);
      
      // Determine trend based on recent vs historical
      const prevHour = await this.getErrorCount(60, 60);
      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      
      if (prevHour > 0) {
        const change = ((last1Hour - prevHour) / prevHour) * 100;
        if (change > 20) trend = 'degrading';
        else if (change < -20) trend = 'improving';
      }
      
      return {
        last15Minutes: last15Min,
        last1Hour: last1Hour,
        last24Hours: last24Hours,
        trend,
      };
    } catch (error) {
      return {
        last15Minutes: 0,
        last1Hour: 0,
        last24Hours: 0,
        trend: 'stable',
      };
    }
  }

  private calculateServiceHealth(
    errorRate: number,
    criticalErrors: number,
    totalErrors: number
  ): ErrorSummary['serviceHealth'] {
    let score = 100;
    
    // Deduct for error rate
    if (errorRate > 1) score -= 20;
    if (errorRate > 5) score -= 30;
    if (errorRate > 10) score -= 40;
    
    // Deduct for critical errors
    if (criticalErrors > 0) score -= 15;
    if (criticalErrors > 5) score -= 25;
    if (criticalErrors > 10) score -= 35;
    
    // Deduct for high total error count
    if (totalErrors > 100) score -= 10;
    if (totalErrors > 500) score -= 20;
    
    score = Math.max(0, score);
    
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  private startPeriodicProcessing(): void {
    // Update error rates every minute
    setInterval(async () => {
      try {
        const errorRate = await this.calculateCurrentErrorRate();
        this.errorRateGauge.set(errorRate);
      } catch (error) {
        logger.error('Failed to update error rate metrics', { error });
      }
    }, 60000);

    // Cleanup old data daily
    setInterval(async () => {
      await this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  private async cleanupOldData(): Promise<void> {
    try {
      const { errorLogs, errorStats, alertHistory } = this.config.retentionPeriods;
      
      // Cleanup old error logs
      await pool.query(`
        DELETE FROM error_logs
        WHERE timestamp < NOW() - INTERVAL '${errorLogs} days'
      `);
      
      // Cleanup old patterns
      await pool.query(`
        DELETE FROM error_patterns
        WHERE last_seen < NOW() - INTERVAL '${errorStats} days'
      `);
      
      // Cleanup old alerts
      await pool.query(`
        DELETE FROM error_alerts
        WHERE timestamp < NOW() - INTERVAL '${alertHistory} days'
      `);
      
      logger.info('Cleaned up old error tracking data', {
        errorLogsDays: errorLogs,
        errorStatsDays: errorStats,
        alertHistoryDays: alertHistory,
      });
      
    } catch (error) {
      logger.error('Failed to cleanup old data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private setupEventListeners(): void {
    this.on('errorTracked', (errorEntry: ErrorEntry) => {
      logger.debug('Error tracked', {
        id: errorEntry.id,
        code: errorEntry.code,
        category: errorEntry.category,
        severity: errorEntry.severity,
      });
    });

    this.on('alertGenerated', (alert: ErrorAlert) => {
      logger.info('Alert generated', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
      });
    });
  }

  public async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        UPDATE error_alerts
        SET acknowledged = true, acknowledged_at = NOW(), acknowledged_by = $2
        WHERE id = $1 AND acknowledged = false
      `, [alertId, userId]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to acknowledge alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId,
        userId,
      });
      return false;
    }
  }

  public async resolveAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        UPDATE error_alerts
        SET resolved = true, resolved_at = NOW(), resolved_by = $2
        WHERE id = $1 AND resolved = false
      `, [alertId, userId]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to resolve alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId,
        userId,
      });
      return false;
    }
  }

  public async getActiveAlerts(): Promise<ErrorAlert[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM error_alerts
        WHERE resolved = false
        ORDER BY timestamp DESC
        LIMIT 50
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        title: row.title,
        description: row.description,
        details: JSON.parse(row.details || '{}'),
        timestamp: row.timestamp,
        acknowledged: row.acknowledged,
        acknowledgedAt: row.acknowledged_at,
        acknowledgedBy: row.acknowledged_by,
        resolved: row.resolved,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
        channels: JSON.parse(row.channels || '[]'),
        retryCount: row.retry_count,
        lastRetry: row.last_retry,
      }));
    } catch (error) {
      logger.error('Failed to get active alerts', { error });
      return [];
    }
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down error tracking service');
    this.removeAllListeners();
  }
}

export default ErrorTrackingService;