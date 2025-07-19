/**
 * Redis Cache Service
 *
 * Provides a centralized caching layer for frequently accessed data
 * to improve performance and reduce database load.
 * 
 * Features:
 * - Automatic serialization/deserialization
 * - TTL management
 * - Pattern-based operations
 * - Cache statistics
 * - Graceful fallback when Redis is unavailable
 */

import { getRedis, isRedisAvailable } from '../config/redis';
import logger from '../utils/logger';
import crypto from 'crypto';
import type {
  User,
  SegmentationResult,
  Project,
  Image,
  QueueStatus,
  ProjectStats,
} from '@spheroseg/types';

// Cache key prefixes for different data types
export const CACHE_PREFIXES = {
  PROJECT: 'project:',
  PROJECT_LIST: 'project_list:',
  IMAGE: 'image:',
  IMAGE_LIST: 'image_list:',
  USER: 'user:',
  USER_STATS: 'user:stats:',
  USER_PROFILE: 'user:profile:',
  SEGMENTATION_RESULT: 'seg_result:',
  QUEUE_STATUS: 'queue_status:',
  PROJECT_STATS: 'project_stats:',
  ANALYTICS: 'analytics:',
  RATE_LIMIT: 'rate:limit:',
  SESSION: 'session:',
  CSRF_TOKEN: 'csrf:token:',
  CELL_DATA: 'cell:data:',
} as const;

// Default TTL values (in seconds)
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 3600, // 1 hour
  LONG: 86400, // 24 hours
  VERY_LONG: 604800, // 7 days
  // Specific TTLs for backwards compatibility
  PROJECT: 300, // 5 minutes
  PROJECT_LIST: 60, // 1 minute
  IMAGE: 300, // 5 minutes
  IMAGE_LIST: 60, // 1 minute
  USER: 600, // 10 minutes
  SEGMENTATION_RESULT: 3600, // 1 hour (results don't change)
  QUEUE_STATUS: 5, // 5 seconds (near real-time)
  PROJECT_STATS: 120, // 2 minutes
} as const;

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  evictions: number;
}

class CacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    evictions: 0,
  };

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) {
      return null;
    }

    try {
      const value = await redis.get(key);
      
      if (value === null) {
        this.stats.misses++;
        logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      this.stats.hits++;
      logger.debug(`Cache hit for key: ${key}`);
      
      // Parse JSON if possible
      try {
        return JSON.parse(value) as T;
      } catch {
        // Return as string if not JSON
        return value as T;
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    try {
      // Serialize value
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      
      logger.debug(`Cache set for key: ${key}, TTL: ${ttl || 'none'}`);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    try {
      const result = await redis.del(key);
      logger.debug(`Cache delete for key: ${key}, deleted: ${result}`);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * Delete value from cache (backward compatibility)
   */
  async del(key: string | string[]): Promise<number> {
    const redis = getRedis();
    if (!redis) {
      return 0;
    }

    try {
      const keys = Array.isArray(key) ? key : [key];
      return await redis.del(...keys);
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error', { key, error });
      return 0;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const redis = getRedis();
    if (!redis) {
      return 0;
    }

    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await redis.del(...keys);
      logger.debug(`Cache delete pattern: ${pattern}, deleted: ${result} keys`);
      this.stats.evictions += result;
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Delete all keys matching a pattern (backward compatibility)
   */
  async delPattern(pattern: string): Promise<number> {
    return this.deletePattern(pattern);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    try {
      const result = await redis.exists(key);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    const redis = getRedis();
    if (!redis) {
      return -1;
    }

    try {
      return await redis.ttl(key);
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache TTL error', { key, error });
      return -1;
    }
  }

  /**
   * Set expiration on existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    try {
      const result = await redis.expire(key, seconds);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache expire error', { key, error });
      return false;
    }
  }

  /**
   * Get multiple values by keys
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const redis = getRedis();
    if (!redis || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await redis.mget(...keys);
      
      return values.map((value, index) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mget error', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(items: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    const redis = getRedis();
    if (!redis || items.length === 0) {
      return false;
    }

    const pipeline = redis.pipeline();
    
    try {
      for (const { key, value, ttl } of items) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        
        if (ttl) {
          pipeline.setex(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      
      await pipeline.exec();
      logger.debug(`Cache mset for ${items.length} items`);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mset error', { error });
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string, amount = 1): Promise<number> {
    const redis = getRedis();
    if (!redis) {
      return 0;
    }

    try {
      if (amount === 1) {
        return await redis.incr(key);
      } else {
        return await redis.incrby(key, amount);
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache incr error', { key, error });
      return 0;
    }
  }

  /**
   * Decrement a counter
   */
  async decr(key: string, amount = 1): Promise<number> {
    const redis = getRedis();
    if (!redis) {
      return 0;
    }

    try {
      if (amount === 1) {
        return await redis.decr(key);
      } else {
        return await redis.decrby(key, amount);
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache decr error', { key, error });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async flushAll(): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      return;
    }

    try {
      await redis.flushdb();
      logger.warn('Cache flushed!');
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache flush error', { error });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      evictions: 0,
    };
  }

  /**
   * Generate cache key with prefix
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return prefix + parts.join(':');
  }

  /**
   * Hash a complex object to use as cache key part
   */
  hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  /**
   * Cache wrapper for async functions
   */
  async cached<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn();

    // Cache the result
    await this.set(key, result, ttl);

    return result;
  }

  /**
   * Invalidate related cache entries
   */
  async invalidateRelated(entityType: string, entityId: string | number): Promise<void> {
    const patterns: string[] = [];

    switch (entityType) {
      case 'user':
        patterns.push(
          `${CACHE_PREFIXES.USER_STATS}${entityId}`,
          `${CACHE_PREFIXES.USER_PROFILE}${entityId}`,
          `${CACHE_PREFIXES.PROJECT_LIST}${entityId}:*`
        );
        break;
      
      case 'project':
        patterns.push(
          `${CACHE_PREFIXES.PROJECT}${entityId}`,
          `${CACHE_PREFIXES.PROJECT_LIST}*:*`,
          `${CACHE_PREFIXES.IMAGE_LIST}${entityId}:*`,
          `${CACHE_PREFIXES.PROJECT_STATS}${entityId}`
        );
        break;
      
      case 'image':
        patterns.push(
          `${CACHE_PREFIXES.IMAGE}${entityId}`,
          `${CACHE_PREFIXES.IMAGE_LIST}*:*`,
          `${CACHE_PREFIXES.SEGMENTATION_RESULT}${entityId}`
        );
        break;
      
      case 'segmentation':
        patterns.push(
          `${CACHE_PREFIXES.SEGMENTATION_RESULT}${entityId}`,
          `${CACHE_PREFIXES.CELL_DATA}${entityId}:*`
        );
        break;
    }

    // Delete all matching patterns
    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }

    logger.info(`Invalidated cache for ${entityType}:${entityId}`);
  }

  // Specific cache methods for different data types (backward compatibility)

  /**
   * Cache project data
   */
  async cacheProject(projectId: string, projectData: Project): Promise<void> {
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
    await this.invalidateRelated('project', projectId);
  }

  /**
   * Cache image list
   */
  async cacheImageList(
    projectId: string,
    page: number,
    limit: number,
    images: Image[]
  ): Promise<void> {
    const key = `${CACHE_PREFIXES.IMAGE_LIST}${projectId}:${page}:${limit}`;
    await this.set(key, images, CACHE_TTL.IMAGE_LIST);
  }

  /**
   * Get cached image list
   */
  async getCachedImageList(
    projectId: string,
    page: number,
    limit: number
  ): Promise<Image[] | null> {
    const key = `${CACHE_PREFIXES.IMAGE_LIST}${projectId}:${page}:${limit}`;
    return await this.get(key);
  }

  /**
   * Invalidate image list cache for a project
   */
  async invalidateImageList(projectId: string): Promise<void> {
    await this.deletePattern(`${CACHE_PREFIXES.IMAGE_LIST}${projectId}:*`);
  }

  /**
   * Cache user data
   */
  async cacheUser(userId: string, userData: User): Promise<void> {
    const key = `${CACHE_PREFIXES.USER}${userId}`;
    await this.set(key, userData, CACHE_TTL.USER);
  }

  /**
   * Get cached user data
   */
  async getCachedUser(userId: string): Promise<User | null> {
    const key = `${CACHE_PREFIXES.USER}${userId}`;
    return await this.get(key);
  }

  /**
   * Cache segmentation result
   */
  async cacheSegmentationResult(imageId: string, result: SegmentationResult): Promise<void> {
    const key = `${CACHE_PREFIXES.SEGMENTATION_RESULT}${imageId}`;
    await this.set(key, result, CACHE_TTL.SEGMENTATION_RESULT);
  }

  /**
   * Get cached segmentation result
   */
  async getCachedSegmentationResult(imageId: string): Promise<SegmentationResult | null> {
    const key = `${CACHE_PREFIXES.SEGMENTATION_RESULT}${imageId}`;
    return await this.get(key);
  }

  /**
   * Cache queue status
   */
  async cacheQueueStatus(projectId: string, status: QueueStatus): Promise<void> {
    const key = `${CACHE_PREFIXES.QUEUE_STATUS}${projectId}`;
    await this.set(key, status, CACHE_TTL.QUEUE_STATUS);
  }

  /**
   * Get cached queue status
   */
  async getCachedQueueStatus(projectId: string): Promise<QueueStatus | null> {
    const key = `${CACHE_PREFIXES.QUEUE_STATUS}${projectId}`;
    return await this.get(key);
  }

  /**
   * Cache project statistics
   */
  async cacheProjectStats(projectId: string, stats: ProjectStats): Promise<void> {
    const key = `${CACHE_PREFIXES.PROJECT_STATS}${projectId}`;
    await this.set(key, stats, CACHE_TTL.PROJECT_STATS);
  }

  /**
   * Get cached project statistics
   */
  async getCachedProjectStats(projectId: string): Promise<ProjectStats | null> {
    const key = `${CACHE_PREFIXES.PROJECT_STATS}${projectId}`;
    return await this.get(key);
  }

  /**
   * Cache user stats
   */
  async cacheUserStats(userId: string, stats: any): Promise<void> {
    const key = `${CACHE_PREFIXES.USER_STATS}${userId}`;
    await this.set(key, stats, CACHE_TTL.MEDIUM);
  }

  /**
   * Get cached user stats
   */
  async getCachedUserStats(userId: string): Promise<any | null> {
    const key = `${CACHE_PREFIXES.USER_STATS}${userId}`;
    return await this.get(key);
  }

  /**
   * Cache image metadata
   */
  async cacheImageMetadata(imageId: string, metadata: any): Promise<void> {
    const key = `${CACHE_PREFIXES.IMAGE}${imageId}`;
    await this.set(key, metadata, CACHE_TTL.IMAGE);
  }

  /**
   * Get cached image metadata
   */
  async getCachedImageMetadata(imageId: string): Promise<any | null> {
    const key = `${CACHE_PREFIXES.IMAGE}${imageId}`;
    return await this.get(key);
  }

  /**
   * Check if cache is available
   */
  async isAvailable(): Promise<boolean> {
    return await isRedisAvailable();
  }

  /**
   * Check if Redis is available and healthy
   */
  async isHealthy(): Promise<boolean> {
    return await isRedisAvailable();
  }

  /**
   * Get extended cache statistics
   */
  async getExtendedStats(): Promise<any> {
    const redis = getRedis();
    if (!redis) {
      return { 
        available: false,
        local: this.getStats()
      };
    }

    try {
      const info = await redis.info('stats');
      const dbSize = await redis.dbsize();
      
      // Parse Redis stats
      const redisStats = this.parseRedisStats(info);
      
      // Calculate hit rate
      const hitRate = redisStats.keyspace_hits && redisStats.keyspace_misses
        ? (redisStats.keyspace_hits / (redisStats.keyspace_hits + redisStats.keyspace_misses)) * 100
        : 0;

      return {
        available: true,
        dbSize,
        redis: {
          hits: redisStats.keyspace_hits || 0,
          misses: redisStats.keyspace_misses || 0,
          hitRate,
          evictedKeys: redisStats.evicted_keys || 0,
          expiredKeys: redisStats.expired_keys || 0,
        },
        local: this.getStats(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get extended cache stats', { error });
      return { 
        available: false, 
        error: error.message,
        local: this.getStats()
      };
    }
  }

  /**
   * Parse Redis info string to extract statistics
   */
  private parseRedisStats(info: string): Record<string, number> {
    const stats: Record<string, number> = {};
    const lines = info.split('\r\n');

    lines.forEach((line) => {
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
  async ping(): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    try {
      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error });
      return false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;
