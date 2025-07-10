/**
 * Redis Cache Service
 * 
 * Provides a centralized caching layer for frequently accessed data
 * to improve performance and reduce database load.
 */

import Redis from 'ioredis';
import logger from '../utils/logger';
import config from '../config';

// Cache key prefixes for different data types
const CACHE_PREFIXES = {
  PROJECT: 'project:',
  PROJECT_LIST: 'project_list:',
  IMAGE: 'image:',
  IMAGE_LIST: 'image_list:',
  USER: 'user:',
  SEGMENTATION_RESULT: 'seg_result:',
  QUEUE_STATUS: 'queue_status:',
  PROJECT_STATS: 'project_stats:',
} as const;

// Default TTL values (in seconds)
const CACHE_TTL = {
  PROJECT: 300, // 5 minutes
  PROJECT_LIST: 60, // 1 minute
  IMAGE: 300, // 5 minutes
  IMAGE_LIST: 60, // 1 minute
  USER: 600, // 10 minutes
  SEGMENTATION_RESULT: 3600, // 1 hour (results don't change)
  QUEUE_STATUS: 5, // 5 seconds (near real-time)
  PROJECT_STATS: 120, // 2 minutes
} as const;

class CacheService {
  private redis: Redis | null = null;
  private isConnected = false;

  constructor() {
    this.connect();
  }

  /**
   * Connect to Redis
   */
  private connect(): void {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            // Only reconnect when the error contains "READONLY"
            return true;
          }
          return false;
        },
      });

      this.redis.on('connect', () => {
        logger.info('Redis cache connected');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.error('Redis cache error', { error: error.message });
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis cache connection closed');
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('Failed to connect to Redis cache', { error });
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.redis) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isConnected || !this.redis) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string | string[]): Promise<number> {
    if (!this.isConnected || !this.redis) {
      return 0;
    }

    try {
      const keys = Array.isArray(key) ? key : [key];
      return await this.redis.del(...keys);
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return 0;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.redis) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
      return 0;
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async flushAll(): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return;
    }

    try {
      await this.redis.flushall();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error', { error });
    }
  }

  // Specific cache methods for different data types

  /**
   * Cache project data
   */
  async cacheProject(projectId: string, projectData: any): Promise<void> {
    const key = `${CACHE_PREFIXES.PROJECT}${projectId}`;
    await this.set(key, projectData, CACHE_TTL.PROJECT);
  }

  /**
   * Get cached project data
   */
  async getCachedProject(projectId: string): Promise<any | null> {
    const key = `${CACHE_PREFIXES.PROJECT}${projectId}`;
    return await this.get(key);
  }

  /**
   * Invalidate project cache
   */
  async invalidateProject(projectId: string): Promise<void> {
    const keys = [
      `${CACHE_PREFIXES.PROJECT}${projectId}`,
      `${CACHE_PREFIXES.PROJECT_STATS}${projectId}`,
    ];
    await this.del(keys);
    // Also invalidate user's project list
    await this.delPattern(`${CACHE_PREFIXES.PROJECT_LIST}*`);
  }

  /**
   * Cache image list
   */
  async cacheImageList(projectId: string, page: number, limit: number, images: any[]): Promise<void> {
    const key = `${CACHE_PREFIXES.IMAGE_LIST}${projectId}:${page}:${limit}`;
    await this.set(key, images, CACHE_TTL.IMAGE_LIST);
  }

  /**
   * Get cached image list
   */
  async getCachedImageList(projectId: string, page: number, limit: number): Promise<any[] | null> {
    const key = `${CACHE_PREFIXES.IMAGE_LIST}${projectId}:${page}:${limit}`;
    return await this.get(key);
  }

  /**
   * Invalidate image list cache for a project
   */
  async invalidateImageList(projectId: string): Promise<void> {
    await this.delPattern(`${CACHE_PREFIXES.IMAGE_LIST}${projectId}:*`);
  }

  /**
   * Cache user data
   */
  async cacheUser(userId: string, userData: any): Promise<void> {
    const key = `${CACHE_PREFIXES.USER}${userId}`;
    await this.set(key, userData, CACHE_TTL.USER);
  }

  /**
   * Get cached user data
   */
  async getCachedUser(userId: string): Promise<any | null> {
    const key = `${CACHE_PREFIXES.USER}${userId}`;
    return await this.get(key);
  }

  /**
   * Cache segmentation result
   */
  async cacheSegmentationResult(imageId: string, result: any): Promise<void> {
    const key = `${CACHE_PREFIXES.SEGMENTATION_RESULT}${imageId}`;
    await this.set(key, result, CACHE_TTL.SEGMENTATION_RESULT);
  }

  /**
   * Get cached segmentation result
   */
  async getCachedSegmentationResult(imageId: string): Promise<any | null> {
    const key = `${CACHE_PREFIXES.SEGMENTATION_RESULT}${imageId}`;
    return await this.get(key);
  }

  /**
   * Cache queue status
   */
  async cacheQueueStatus(projectId: string, status: any): Promise<void> {
    const key = `${CACHE_PREFIXES.QUEUE_STATUS}${projectId}`;
    await this.set(key, status, CACHE_TTL.QUEUE_STATUS);
  }

  /**
   * Get cached queue status
   */
  async getCachedQueueStatus(projectId: string): Promise<any | null> {
    const key = `${CACHE_PREFIXES.QUEUE_STATUS}${projectId}`;
    return await this.get(key);
  }

  /**
   * Cache project statistics
   */
  async cacheProjectStats(projectId: string, stats: any): Promise<void> {
    const key = `${CACHE_PREFIXES.PROJECT_STATS}${projectId}`;
    await this.set(key, stats, CACHE_TTL.PROJECT_STATS);
  }

  /**
   * Get cached project statistics
   */
  async getCachedProjectStats(projectId: string): Promise<any | null> {
    const key = `${CACHE_PREFIXES.PROJECT_STATS}${projectId}`;
    return await this.get(key);
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.isConnected || !this.redis) {
      return { available: false };
    }

    try {
      const info = await this.redis.info('stats');
      const dbSize = await this.redis.dbsize();
      
      // Parse cache hit/miss statistics from Redis info
      const stats = this.parseRedisStats(info);
      
      return {
        available: true,
        connected: this.isConnected,
        dbSize,
        hits: stats.keyspace_hits || 0,
        misses: stats.keyspace_misses || 0,
        hitRate: stats.keyspace_hits && stats.keyspace_misses 
          ? (stats.keyspace_hits / (stats.keyspace_hits + stats.keyspace_misses)) * 100
          : 0,
        info,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      return { available: false, error: error.message };
    }
  }

  /**
   * Parse Redis info string to extract statistics
   */
  private parseRedisStats(info: string): Record<string, number> {
    const stats: Record<string, number> = {};
    const lines = info.split('\r\n');
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
          stats[key] = numValue;
        }
      }
    });
    
    return stats;
  }

  /**
   * Ping Redis to check connection
   */
  async ping(): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis not connected');
    }
    
    await this.redis.ping();
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;