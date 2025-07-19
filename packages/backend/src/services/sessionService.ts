/**
 * Session Service
 * 
 * Handles session management operations including:
 * - Session validation
 * - Session store management
 * - Concurrent session control
 * - Session analytics
 */

import { getRedis } from '../config/redis';
import logger from '../utils/logger';
import { SessionData } from 'express-session';

export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  uniqueUsers: number;
  averageSessionDuration: number;
}

class SessionService {
  private readonly sessionPrefix = 'spheroseg:sess:';
  private readonly userSessionPrefix = 'spheroseg:user:sessions:';
  private readonly sessionStatsKey = 'spheroseg:session:stats';

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const redis = getRedis();
    if (!redis) {
      return [];
    }

    try {
      const sessionIds = await redis.smembers(`${this.userSessionPrefix}${userId}`);
      const sessions: SessionInfo[] = [];

      for (const sessionId of sessionIds) {
        const sessionData = await redis.get(`${this.sessionPrefix}${sessionId}`);
        if (sessionData) {
          try {
            const data = JSON.parse(sessionData);
            sessions.push({
              sessionId,
              userId: data.userId,
              createdAt: new Date(data.createdAt),
              lastActivity: new Date(data.lastActivity),
              ipAddress: data.ipAddress || 'unknown',
              userAgent: data.userAgent || 'unknown',
              isActive: this.isSessionActive(data),
            });
          } catch (parseError) {
            logger.error('Error parsing session data', { sessionId, error: parseError });
          }
        }
      }

      return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    } catch (error) {
      logger.error('Error getting user sessions', { userId, error });
      return [];
    }
  }

  /**
   * Track user session
   */
  async trackUserSession(userId: string, sessionId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      return;
    }

    try {
      await redis.sadd(`${this.userSessionPrefix}${userId}`, sessionId);
      
      // Set expiry on the user session set (7 days)
      await redis.expire(`${this.userSessionPrefix}${userId}`, 604800);
      
      logger.debug('User session tracked', { userId, sessionId });
    } catch (error) {
      logger.error('Error tracking user session', { userId, sessionId, error });
    }
  }

  /**
   * Remove user session tracking
   */
  async untrackUserSession(userId: string, sessionId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      return;
    }

    try {
      await redis.srem(`${this.userSessionPrefix}${userId}`, sessionId);
      logger.debug('User session untracked', { userId, sessionId });
    } catch (error) {
      logger.error('Error untracking user session', { userId, sessionId, error });
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const redis = getRedis();
    if (!redis) {
      return 0;
    }

    try {
      const sessions = await this.getUserSessions(userId);
      let invalidated = 0;

      for (const session of sessions) {
        if (session.sessionId !== exceptSessionId) {
          const deleted = await redis.del(`${this.sessionPrefix}${session.sessionId}`);
          if (deleted) {
            invalidated++;
          }
        }
      }

      // Clear the user session set if no exception
      if (!exceptSessionId) {
        await redis.del(`${this.userSessionPrefix}${userId}`);
      } else {
        // Keep only the exception session
        await redis.del(`${this.userSessionPrefix}${userId}`);
        await redis.sadd(`${this.userSessionPrefix}${userId}`, exceptSessionId);
      }

      logger.info('User sessions invalidated', { userId, invalidated, exceptSessionId });
      return invalidated;
    } catch (error) {
      logger.error('Error invalidating user sessions', { userId, error });
      return 0;
    }
  }

  /**
   * Check if session is active
   */
  private isSessionActive(sessionData: any): boolean {
    if (!sessionData.lastActivity) {
      return false;
    }

    const lastActivity = new Date(sessionData.lastActivity);
    const now = new Date();
    const idleTime = now.getTime() - lastActivity.getTime();
    const maxIdleTime = 3600000; // 1 hour default

    return idleTime < maxIdleTime;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const redis = getRedis();
    if (!redis) {
      return null;
    }

    try {
      const sessionData = await redis.get(`${this.sessionPrefix}${sessionId}`);
      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      logger.error('Error getting session', { sessionId, error });
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    try {
      const currentData = await this.getSession(sessionId);
      if (!currentData) {
        return false;
      }

      const updatedData = {
        ...currentData,
        ...updates,
        lastActivity: new Date(),
      };

      const ttl = await redis.ttl(`${this.sessionPrefix}${sessionId}`);
      await redis.setex(
        `${this.sessionPrefix}${sessionId}`,
        ttl > 0 ? ttl : 3600,
        JSON.stringify(updatedData)
      );

      return true;
    } catch (error) {
      logger.error('Error updating session', { sessionId, error });
      return false;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<SessionStats> {
    const redis = getRedis();
    if (!redis) {
      return {
        totalSessions: 0,
        activeSessions: 0,
        uniqueUsers: 0,
        averageSessionDuration: 0,
      };
    }

    try {
      const sessionKeys = await redis.keys(`${this.sessionPrefix}*`);
      const userIds = new Set<string>();
      let activeSessions = 0;
      let totalDuration = 0;
      let sessionCount = 0;

      for (const key of sessionKeys) {
        const sessionData = await redis.get(key);
        if (sessionData) {
          try {
            const data = JSON.parse(sessionData);
            if (data.userId) {
              userIds.add(data.userId);
            }
            if (this.isSessionActive(data)) {
              activeSessions++;
            }
            if (data.createdAt && data.lastActivity) {
              const duration = new Date(data.lastActivity).getTime() - new Date(data.createdAt).getTime();
              totalDuration += duration;
              sessionCount++;
            }
          } catch (parseError) {
            // Skip invalid session data
          }
        }
      }

      return {
        totalSessions: sessionKeys.length,
        activeSessions,
        uniqueUsers: userIds.size,
        averageSessionDuration: sessionCount > 0 ? totalDuration / sessionCount : 0,
      };
    } catch (error) {
      logger.error('Error getting session stats', { error });
      return {
        totalSessions: 0,
        activeSessions: 0,
        uniqueUsers: 0,
        averageSessionDuration: 0,
      };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const redis = getRedis();
    if (!redis) {
      return 0;
    }

    try {
      const sessionKeys = await redis.keys(`${this.sessionPrefix}*`);
      let cleaned = 0;

      for (const key of sessionKeys) {
        const ttl = await redis.ttl(key);
        if (ttl === -2 || ttl === 0) {
          // Extract session ID and user ID for cleanup
          const sessionData = await redis.get(key);
          if (sessionData) {
            try {
              const data = JSON.parse(sessionData);
              if (data.userId) {
                const sessionId = key.replace(this.sessionPrefix, '');
                await this.untrackUserSession(data.userId, sessionId);
              }
            } catch (parseError) {
              // Skip if can't parse
            }
          }
          
          await redis.del(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired sessions`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Error cleaning up expired sessions', { error });
      return 0;
    }
  }

  /**
   * Enforce session limits per user
   */
  async enforceSessionLimit(userId: string, maxSessions: number = 5): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    if (sessions.length > maxSessions) {
      // Sort by last activity and remove oldest sessions
      const sessionsToRemove = sessions
        .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())
        .slice(0, sessions.length - maxSessions);
      
      for (const session of sessionsToRemove) {
        await this.invalidateAllUserSessions(userId, session.sessionId);
      }
      
      logger.info('Enforced session limit', {
        userId,
        maxSessions,
        removed: sessionsToRemove.length,
      });
    }
  }

  /**
   * Migrate JWT sessions to Redis sessions
   */
  async migrateJwtToSession(
    userId: string,
    sessionId: string,
    tokenData: any
  ): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      return;
    }

    try {
      const sessionData: SessionData = {
        userId,
        email: tokenData.email,
        role: tokenData.role,
        loginTime: new Date(),
        lastActivity: new Date(),
        createdAt: new Date(),
        isVerified: true,
        requiresReauth: false,
      };

      const ttl = 3600; // 1 hour default
      await redis.setex(
        `${this.sessionPrefix}${sessionId}`,
        ttl,
        JSON.stringify(sessionData)
      );

      await this.trackUserSession(userId, sessionId);
      
      logger.info('JWT migrated to session', { userId, sessionId });
    } catch (error) {
      logger.error('Error migrating JWT to session', { userId, sessionId, error });
    }
  }
}

// Export singleton instance
export default new SessionService();