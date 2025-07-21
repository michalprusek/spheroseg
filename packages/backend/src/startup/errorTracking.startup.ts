/**
 * Error Tracking Service Startup Module
 * 
 * Initializes and configures the enhanced error tracking and alerting system
 * during application startup. Handles service initialization, alert handlers,
 * and integration with existing error handling middleware.
 */

import { Redis } from 'ioredis';
import { ErrorTrackingService } from '../services/errorTracking.service';
import { pool } from '../db';
import logger from '../utils/logger';

let errorTrackingService: ErrorTrackingService | null = null;

/**
 * Initialize the error tracking service with Redis client
 */
export async function initializeErrorTracking(redisClient: Redis): Promise<ErrorTrackingService> {
  if (errorTrackingService) {
    logger.warn('Error tracking service already initialized');
    return errorTrackingService;
  }

  try {
    // Verify database tables exist
    await verifyDatabaseTables();

    // Create service instance
    errorTrackingService = new ErrorTrackingService(redisClient);

    // Setup alert handlers
    await setupAlertHandlers(errorTrackingService);

    // Setup event listeners
    setupEventListeners(errorTrackingService);

    // Perform initial cleanup
    await performInitialCleanup(errorTrackingService);

    logger.info('Error tracking service initialized successfully', {
      timestamp: new Date().toISOString(),
      redisConnection: redisClient.status,
    });

    return errorTrackingService;
  } catch (error) {
    logger.error('Failed to initialize error tracking service', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Get the initialized error tracking service
 */
export function getErrorTrackingService(): ErrorTrackingService {
  if (!errorTrackingService) {
    throw new Error('Error tracking service not initialized. Call initializeErrorTracking() first.');
  }
  return errorTrackingService;
}

/**
 * Verify that required database tables exist
 */
async function verifyDatabaseTables(): Promise<void> {
  const requiredTables = ['error_logs', 'error_patterns', 'error_alerts', 'error_insights'];
  
  for (const table of requiredTables) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);

      if (!result.rows[0].exists) {
        throw new Error(`Required table '${table}' does not exist. Please run database migrations.`);
      }
    } catch (error) {
      logger.error(`Failed to verify table '${table}'`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  logger.info('All required error tracking tables verified');
}

/**
 * Setup alert handlers for different notification channels
 */
async function setupAlertHandlers(service: ErrorTrackingService): Promise<void> {
  // Email alert handler
  service.registerAlertHandler(async (alert) => {
    try {
      if (alert.severity === 'critical') {
        // In a real implementation, this would send an email
        logger.warn('CRITICAL ALERT - Email notification required', {
          alertId: alert.id,
          metric: alert.metric,
          message: alert.message,
          value: alert.value,
          timestamp: alert.timestamp,
        });
      }
    } catch (error) {
      logger.error('Email alert handler failed', { alert, error });
    }
  });

  // Slack alert handler
  service.registerAlertHandler(async (alert) => {
    try {
      if (alert.severity === 'critical' || alert.type === 'anomaly') {
        // In a real implementation, this would send to Slack
        logger.warn('ALERT - Slack notification required', {
          alertId: alert.id,
          metric: alert.metric,
          severity: alert.severity,
          type: alert.type,
          message: alert.message,
          timestamp: alert.timestamp,
        });
      }
    } catch (error) {
      logger.error('Slack alert handler failed', { alert, error });
    }
  });

  // Database alert handler (store in alerts table)
  service.registerAlertHandler(async (alert) => {
    try {
      // This is handled automatically by the ErrorTrackingService
      // but we can add additional database logging here if needed
      logger.info('Alert stored in database', {
        alertId: alert.id,
        metric: alert.metric,
        severity: alert.severity,
      });
    } catch (error) {
      logger.error('Database alert handler failed', { alert, error });
    }
  });

  logger.info('Error tracking alert handlers configured');
}

/**
 * Setup event listeners for error tracking events
 */
function setupEventListeners(service: ErrorTrackingService): void {
  // Listen for error tracking events
  service.on('errorTracked', (errorEntry) => {
    logger.debug('Error tracked', {
      id: errorEntry.id,
      fingerprint: errorEntry.fingerprint,
      severity: errorEntry.severity,
      category: errorEntry.category,
    });
  });

  service.on('patternDetected', (pattern) => {
    logger.info('Error pattern detected', {
      fingerprint: pattern.fingerprint,
      count: pattern.count,
      trend: pattern.trend,
      firstSeen: pattern.firstSeen,
      lastSeen: pattern.lastSeen,
    });
  });

  service.on('anomalyDetected', (anomaly) => {
    logger.warn('Error anomaly detected', {
      fingerprint: anomaly.fingerprint,
      anomalyScore: anomaly.anomalyScore,
      threshold: anomaly.threshold,
      description: anomaly.description,
    });
  });

  service.on('alertTriggered', (alert) => {
    logger.warn('Error alert triggered', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      metric: alert.metric,
      message: alert.message,
    });
  });

  service.on('insightGenerated', (insight) => {
    logger.info('Error insight generated', {
      insightId: insight.id,
      type: insight.type,
      confidence: insight.confidence,
      description: insight.description,
    });
  });

  logger.info('Error tracking event listeners configured');
}

/**
 * Perform initial cleanup of old data
 */
async function performInitialCleanup(service: ErrorTrackingService): Promise<void> {
  try {
    // Clean up old error logs (older than 30 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    await pool.query(`
      DELETE FROM error_logs 
      WHERE created_at < $1
    `, [cutoffDate]);

    // Clean up old alerts (older than 7 days and acknowledged)
    const alertCutoffDate = new Date();
    alertCutoffDate.setDate(alertCutoffDate.getDate() - 7);

    await pool.query(`
      DELETE FROM error_alerts 
      WHERE created_at < $1 
      AND acknowledged = true
    `, [alertCutoffDate]);

    // Clean up expired insights
    await pool.query(`
      DELETE FROM error_insights 
      WHERE expires_at < NOW()
    `);

    logger.info('Initial error tracking cleanup completed', {
      errorLogCutoff: cutoffDate.toISOString(),
      alertCutoff: alertCutoffDate.toISOString(),
    });
  } catch (error) {
    logger.warn('Initial cleanup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - this is not critical for startup
  }
}

/**
 * Shutdown the error tracking service gracefully
 */
export function shutdownErrorTracking(): void {
  if (errorTrackingService) {
    try {
      // Remove all listeners
      errorTrackingService.removeAllListeners();
      
      logger.info('Error tracking service shutdown completed');
      errorTrackingService = null;
    } catch (error) {
      logger.error('Error during error tracking service shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Health check for error tracking service
 */
export async function checkErrorTrackingHealth(): Promise<{
  healthy: boolean;
  status: string;
  details?: any;
}> {
  if (!errorTrackingService) {
    return {
      healthy: false,
      status: 'Service not initialized',
    };
  }

  try {
    // Test Redis connection
    const redis = (errorTrackingService as any).redis;
    await redis.ping();

    // Test database connection
    await pool.query('SELECT 1');

    // Check recent activity
    const recentErrors = await pool.query(`
      SELECT COUNT(*) as count 
      FROM error_logs 
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    const activeAlerts = await pool.query(`
      SELECT COUNT(*) as count 
      FROM error_alerts 
      WHERE acknowledged = false 
      AND resolved = false
    `);

    return {
      healthy: true,
      status: 'Service running normally',
      details: {
        recentErrors: parseInt(recentErrors.rows[0].count),
        activeAlerts: parseInt(activeAlerts.rows[0].count),
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      healthy: false,
      status: 'Service health check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

export default {
  initializeErrorTracking,
  getErrorTrackingService,
  shutdownErrorTracking,
  checkErrorTrackingHealth,
};