/**
 * Unit Tests for Session Service
 */

import { Redis } from 'ioredis';
import sessionService from '../sessionService';
import { getRedis } from '../../config/redis';

// Mock dependencies
jest.mock('../../config/redis');
jest.mock('../../utils/logger');

describe('SessionService', () => {
  let mockRedis: jest.Mocked<Redis>;
  
  beforeEach(() => {
    mockRedis = {
      smembers: jest.fn(),
      get: jest.fn(),
      sadd: jest.fn(),
      expire: jest.fn(),
      srem: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ttl: jest.fn(),
      setex: jest.fn(),
    } as any;
    
    (getRedis as jest.Mock).mockReturnValue(mockRedis);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getUserSessions', () => {
    it('should return user sessions sorted by last activity', async () => {
      const userId = 'user123';
      const sessionIds = ['session1', 'session2'];
      
      mockRedis.smembers.mockResolvedValue(sessionIds);
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key.includes('session1')) {
          return JSON.stringify({
            userId,
            createdAt: new Date('2025-01-01'),
            lastActivity: new Date('2025-01-01T10:00:00'),
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          });
        }
        if (key.includes('session2')) {
          return JSON.stringify({
            userId,
            createdAt: new Date('2025-01-01'),
            lastActivity: new Date('2025-01-01T11:00:00'),
            ipAddress: '192.168.1.2',
            userAgent: 'Chrome/96',
          });
        }
        return null;
      });
      
      const sessions = await sessionService.getUserSessions(userId);
      
      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe('session2'); // More recent activity
      expect(sessions[1].sessionId).toBe('session1');
      expect(sessions[0].isActive).toBe(true);
    });
    
    it('should handle Redis errors gracefully', async () => {
      mockRedis.smembers.mockRejectedValue(new Error('Redis error'));
      
      const sessions = await sessionService.getUserSessions('user123');
      
      expect(sessions).toEqual([]);
    });
    
    it('should handle invalid session data', async () => {
      mockRedis.smembers.mockResolvedValue(['session1']);
      mockRedis.get.mockResolvedValue('invalid json');
      
      const sessions = await sessionService.getUserSessions('user123');
      
      expect(sessions).toEqual([]);
    });
  });
  
  describe('trackUserSession', () => {
    it('should add session to user set with expiry', async () => {
      const userId = 'user123';
      const sessionId = 'session123';
      
      await sessionService.trackUserSession(userId, sessionId);
      
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'spheroseg:user:sessions:user123',
        'session123'
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'spheroseg:user:sessions:user123',
        604800 // 7 days
      );
    });
    
    it('should handle Redis not available', async () => {
      (getRedis as jest.Mock).mockReturnValue(null);
      
      await expect(sessionService.trackUserSession('user123', 'session123'))
        .resolves.not.toThrow();
    });
  });
  
  describe('untrackUserSession', () => {
    it('should remove session from user set', async () => {
      await sessionService.untrackUserSession('user123', 'session123');
      
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'spheroseg:user:sessions:user123',
        'session123'
      );
    });
  });
  
  describe('invalidateAllUserSessions', () => {
    it('should invalidate all sessions except specified one', async () => {
      const userId = 'user123';
      const exceptSessionId = 'session2';
      
      // Mock getUserSessions
      jest.spyOn(sessionService, 'getUserSessions').mockResolvedValue([
        {
          sessionId: 'session1',
          userId,
          createdAt: new Date(),
          lastActivity: new Date(),
          ipAddress: '192.168.1.1',
          userAgent: 'Browser',
          isActive: true,
        },
        {
          sessionId: 'session2',
          userId,
          createdAt: new Date(),
          lastActivity: new Date(),
          ipAddress: '192.168.1.2',
          userAgent: 'Browser',
          isActive: true,
        },
        {
          sessionId: 'session3',
          userId,
          createdAt: new Date(),
          lastActivity: new Date(),
          ipAddress: '192.168.1.3',
          userAgent: 'Browser',
          isActive: true,
        },
      ]);
      
      mockRedis.del.mockResolvedValue(1);
      
      const invalidated = await sessionService.invalidateAllUserSessions(userId, exceptSessionId);
      
      expect(invalidated).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith('spheroseg:sess:session1');
      expect(mockRedis.del).toHaveBeenCalledWith('spheroseg:sess:session3');
      expect(mockRedis.del).not.toHaveBeenCalledWith('spheroseg:sess:session2');
      
      // Should update user session set
      expect(mockRedis.del).toHaveBeenCalledWith('spheroseg:user:sessions:user123');
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'spheroseg:user:sessions:user123',
        exceptSessionId
      );
    });
    
    it('should invalidate all sessions when no exception', async () => {
      const userId = 'user123';
      
      jest.spyOn(sessionService, 'getUserSessions').mockResolvedValue([
        {
          sessionId: 'session1',
          userId,
          createdAt: new Date(),
          lastActivity: new Date(),
          ipAddress: '192.168.1.1',
          userAgent: 'Browser',
          isActive: true,
        },
      ]);
      
      mockRedis.del.mockResolvedValue(1);
      
      await sessionService.invalidateAllUserSessions(userId);
      
      expect(mockRedis.del).toHaveBeenCalledWith('spheroseg:sess:session1');
      expect(mockRedis.del).toHaveBeenCalledWith('spheroseg:user:sessions:user123');
    });
  });
  
  describe('getSession', () => {
    it('should return parsed session data', async () => {
      const sessionData = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        createdAt: new Date(),
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));
      
      const session = await sessionService.getSession('session123');
      
      expect(session).toEqual(sessionData);
      expect(mockRedis.get).toHaveBeenCalledWith('spheroseg:sess:session123');
    });
    
    it('should return null for non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const session = await sessionService.getSession('nonexistent');
      
      expect(session).toBeNull();
    });
  });
  
  describe('updateSession', () => {
    it('should update session data with new values', async () => {
      const sessionId = 'session123';
      const currentData = {
        userId: 'user123',
        email: 'test@example.com',
        lastActivity: new Date('2025-01-01'),
      };
      
      jest.spyOn(sessionService, 'getSession').mockResolvedValue(currentData);
      mockRedis.ttl.mockResolvedValue(1800); // 30 minutes
      
      const updates = { role: 'admin' };
      const result = await sessionService.updateSession(sessionId, updates);
      
      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'spheroseg:sess:session123',
        1800,
        expect.stringContaining('"role":"admin"')
      );
    });
    
    it('should return false for non-existent session', async () => {
      jest.spyOn(sessionService, 'getSession').mockResolvedValue(null);
      
      const result = await sessionService.updateSession('nonexistent', {});
      
      expect(result).toBe(false);
    });
  });
  
  describe('getSessionStats', () => {
    it('should calculate session statistics', async () => {
      const sessionKeys = [
        'spheroseg:sess:session1',
        'spheroseg:sess:session2',
        'spheroseg:sess:session3',
      ];
      
      mockRedis.keys.mockResolvedValue(sessionKeys);
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key.includes('session1')) {
          return JSON.stringify({
            userId: 'user1',
            createdAt: new Date('2025-01-01T10:00:00'),
            lastActivity: new Date('2025-01-01T11:00:00'),
          });
        }
        if (key.includes('session2')) {
          return JSON.stringify({
            userId: 'user2',
            createdAt: new Date('2025-01-01T09:00:00'),
            lastActivity: new Date('2025-01-01T09:30:00'),
          });
        }
        if (key.includes('session3')) {
          return JSON.stringify({
            userId: 'user1',
            createdAt: new Date('2025-01-01T08:00:00'),
            lastActivity: new Date(), // Active
          });
        }
        return null;
      });
      
      const stats = await sessionService.getSessionStats();
      
      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBe(1); // Only session3 is active
      expect(stats.uniqueUsers).toBe(2); // user1 and user2
      expect(stats.averageSessionDuration).toBeGreaterThan(0);
    });
    
    it('should handle empty sessions', async () => {
      mockRedis.keys.mockResolvedValue([]);
      
      const stats = await sessionService.getSessionStats();
      
      expect(stats).toEqual({
        totalSessions: 0,
        activeSessions: 0,
        uniqueUsers: 0,
        averageSessionDuration: 0,
      });
    });
  });
  
  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', async () => {
      const sessionKeys = [
        'spheroseg:sess:session1',
        'spheroseg:sess:session2',
        'spheroseg:sess:session3',
      ];
      
      mockRedis.keys.mockResolvedValue(sessionKeys);
      mockRedis.ttl.mockImplementation(async (key: string) => {
        if (key.includes('session1')) return -2; // Expired
        if (key.includes('session2')) return 0; // Expiring
        if (key.includes('session3')) return 3600; // Valid
        return -1;
      });
      
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId: 'user123',
      }));
      
      const cleaned = await sessionService.cleanupExpiredSessions();
      
      expect(cleaned).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith('spheroseg:sess:session1');
      expect(mockRedis.del).toHaveBeenCalledWith('spheroseg:sess:session2');
      expect(mockRedis.del).not.toHaveBeenCalledWith('spheroseg:sess:session3');
    });
  });
  
  describe('enforceSessionLimit', () => {
    it('should remove oldest sessions when limit exceeded', async () => {
      const userId = 'user123';
      const maxSessions = 2;
      
      jest.spyOn(sessionService, 'getUserSessions').mockResolvedValue([
        {
          sessionId: 'session1',
          userId,
          createdAt: new Date(),
          lastActivity: new Date('2025-01-01T08:00:00'), // Oldest
          ipAddress: '192.168.1.1',
          userAgent: 'Browser',
          isActive: true,
        },
        {
          sessionId: 'session2',
          userId,
          createdAt: new Date(),
          lastActivity: new Date('2025-01-01T09:00:00'),
          ipAddress: '192.168.1.2',
          userAgent: 'Browser',
          isActive: true,
        },
        {
          sessionId: 'session3',
          userId,
          createdAt: new Date(),
          lastActivity: new Date('2025-01-01T10:00:00'), // Newest
          ipAddress: '192.168.1.3',
          userAgent: 'Browser',
          isActive: true,
        },
      ]);
      
      jest.spyOn(sessionService, 'invalidateAllUserSessions').mockResolvedValue(1);
      
      await sessionService.enforceSessionLimit(userId, maxSessions);
      
      expect(sessionService.invalidateAllUserSessions).toHaveBeenCalledWith(userId, 'session1');
    });
    
    it('should not remove sessions when under limit', async () => {
      jest.spyOn(sessionService, 'getUserSessions').mockResolvedValue([
        {
          sessionId: 'session1',
          userId: 'user123',
          createdAt: new Date(),
          lastActivity: new Date(),
          ipAddress: '192.168.1.1',
          userAgent: 'Browser',
          isActive: true,
        },
      ]);
      
      jest.spyOn(sessionService, 'invalidateAllUserSessions');
      
      await sessionService.enforceSessionLimit('user123', 5);
      
      expect(sessionService.invalidateAllUserSessions).not.toHaveBeenCalled();
    });
  });
  
  describe('migrateJwtToSession', () => {
    it('should create session from JWT data', async () => {
      const userId = 'user123';
      const sessionId = 'session123';
      const tokenData = {
        email: 'test@example.com',
        role: 'user',
      };
      
      await sessionService.migrateJwtToSession(userId, sessionId, tokenData);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'spheroseg:sess:session123',
        3600,
        expect.stringContaining('"email":"test@example.com"')
      );
      
      // Should also track the session
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'spheroseg:user:sessions:user123',
        sessionId
      );
    });
  });
});