/**
 * Session Cleanup Job
 * 
 * Scheduled job to clean up expired sessions from Redis
 */

import cron from 'node-cron';
import logger from '../utils/logger';
import sessionService from '../services/sessionService';
import { cleanupExpiredSessions } from '../config/session';

/**
 * Start session cleanup job
 * Runs every hour to clean up expired sessions
 */
export function startSessionCleanupJob(): cron.ScheduledTask {
  const task = cron.schedule('0 * * * *', async () => {
    logger.info('Starting session cleanup job');
    
    try {
      // Clean up expired sessions using session service
      const serviceCleanedCount = await sessionService.cleanupExpiredSessions();
      
      // Also run the config cleanup (for any orphaned sessions)
      await cleanupExpiredSessions();
      
      logger.info('Session cleanup job completed', {
        cleanedSessions: serviceCleanedCount,
      });
    } catch (error) {
      logger.error('Session cleanup job failed', { error });
    }
  }, {
    scheduled: false, // Don't start automatically
  });

  logger.info('Session cleanup job configured (runs every hour)');
  
  return task;
}

/**
 * Start session statistics reporting job
 * Runs daily to report session statistics
 */
export function startSessionStatsJob(): cron.ScheduledTask {
  const task = cron.schedule('0 0 * * *', async () => {
    logger.info('Starting session statistics job');
    
    try {
      const stats = await sessionService.getSessionStats();
      
      logger.info('Session statistics report', {
        ...stats,
        averageSessionDurationMinutes: Math.floor(stats.averageSessionDuration / 60000),
      });
    } catch (error) {
      logger.error('Session statistics job failed', { error });
    }
  }, {
    scheduled: false, // Don't start automatically
  });

  logger.info('Session statistics job configured (runs daily at midnight)');
  
  return task;
}