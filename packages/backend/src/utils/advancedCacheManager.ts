/**
 * Advanced Cache Management System
 * 
 * Provides cache warming, invalidation patterns, and intelligent caching strategies
 * for optimal performance and data consistency.
 */

import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import logger from './logger';
import { pool } from '../db';
import { performanceMonitor } from '../middleware/performanceMonitor';

export interface CacheConfig {
  name: string;
  ttl: number; // Time to live in seconds
  warmOnStartup: boolean;
  warmingInterval?: number; // Minutes between warming cycles
  invalidationPatterns?: string[];
  dependencies?: string[]; // Other caches that depend on this one
  maxMemory?: number; // Max memory in MB for this cache
  compressionThreshold?: number; // Compress values larger than this (bytes)
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  itemCount: number;
  lastWarmed?: Date;
  lastInvalidated?: Date;
}

export interface WarmingResult {
  cacheName: string;
  itemsWarmed: number;
  duration: number;
  errors: string[];
  timestamp: Date;
}

interface CacheItem<T> {
  value: T;
  compressed: boolean;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  tags?: string[];
}

type WarmingFunction = () => Promise<Map<string, any>>;
type InvalidationHandler = (pattern: string, keys: string[]) => Promise<void>;

export class CacheManager extends EventEmitter {
  private redis: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private configs: Map<string, CacheConfig> = new Map();
  private warmingFunctions: Map<string, WarmingFunction> = new Map();
  private warmingJobs: Map<string, cron.ScheduledTask> = new Map();
  private invalidationHandlers: Map<string, InvalidationHandler> = new Map();
  private stats: Map<string, CacheStats> = new Map();
  
  private readonly CACHE_PREFIX = 'cache:';
  private readonly STATS_PREFIX = 'stats:cache:';
  private readonly WARMING_LOCK_PREFIX = 'warming:lock:';
  private readonly INVALIDATION_CHANNEL = 'cache:invalidation';
  
  constructor(redisClient: Redis) {
    super();
    this.redis = redisClient;
    this.pubClient = redisClient.duplicate();
    this.subClient = redisClient.duplicate();
    
    this.setupInvalidationListener();
    this.startStatsCollection();
  }

  /**
   * Register a cache configuration
   */
  public registerCache(
    config: CacheConfig,
    warmingFunction?: WarmingFunction,
    invalidationHandler?: InvalidationHandler
  ): void {
    this.configs.set(config.name, config);
    
    if (warmingFunction) {
      this.warmingFunctions.set(config.name, warmingFunction);
    }
    
    if (invalidationHandler) {
      this.invalidationHandlers.set(config.name, invalidationHandler);
    }
    
    // Initialize stats
    this.stats.set(config.name, {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      itemCount: 0,
    });
    
    // Schedule warming if configured
    if (config.warmingInterval) {
      const cronPattern = `*/${config.warmingInterval} * * * *`; // Every N minutes
      const job = cron.schedule(cronPattern, async () => {
        await this.warmCache(config.name);
      }, { scheduled: false });
      
      this.warmingJobs.set(config.name, job);
      job.start();
    }
    
    logger.info('Cache registered', {
      cache: config.name,
      ttl: config.ttl,
      warmOnStartup: config.warmOnStartup,
      warmingInterval: config.warmingInterval,
    });
  }

  /**
   * Get item from cache with automatic stats tracking
   */
  public async get<T>(cacheName: string, key: string): Promise<T | null> {
    const config = this.configs.get(cacheName);
    if (!config) {
      throw new Error(`Cache ${cacheName} not registered`);
    }
    
    const fullKey = `${this.CACHE_PREFIX}${cacheName}:${key}`;
    const data = await this.redis.get(fullKey);
    
    if (!data) {
      this.recordMiss(cacheName);
      return null;
    }
    
    try {
      const item: CacheItem<T> = JSON.parse(data);
      
      // Check expiration
      if (new Date(item.expiresAt) < new Date()) {
        await this.redis.del(fullKey);
        this.recordMiss(cacheName);
        return null;
      }
      
      // Update access stats
      item.accessCount++;
      item.lastAccessed = new Date();
      await this.redis.setex(
        fullKey,
        config.ttl,
        JSON.stringify(item)
      );
      
      this.recordHit(cacheName);
      
      // Decompress if needed
      if (item.compressed && typeof item.value === 'string') {
        const zlib = await import('zlib');
        const decompressed = await new Promise<string>((resolve, reject) => {
          zlib.gunzip(Buffer.from(item.value as any, 'base64'), (err, result) => {
            if (err) reject(err);
            else resolve(result.toString());
          });
        });
        return JSON.parse(decompressed);
      }
      
      return item.value;
    } catch (error) {
      logger.error('Cache get error', { cache: cacheName, key, error });
      this.recordMiss(cacheName);
      return null;
    }
  }

  /**
   * Set item in cache with automatic compression
   */
  public async set<T>(
    cacheName: string,
    key: string,
    value: T,
    tags?: string[]
  ): Promise<void> {
    const config = this.configs.get(cacheName);
    if (!config) {
      throw new Error(`Cache ${cacheName} not registered`);
    }
    
    const fullKey = `${this.CACHE_PREFIX}${cacheName}:${key}`;
    let finalValue: any = value;
    let compressed = false;
    
    // Compress large values
    const valueStr = JSON.stringify(value);
    if (config.compressionThreshold && valueStr.length > config.compressionThreshold) {
      const zlib = await import('zlib');
      const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
        zlib.gzip(valueStr, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      finalValue = compressedBuffer.toString('base64');
      compressed = true;
    }
    
    const item: CacheItem<any> = {
      value: finalValue,
      compressed,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + config.ttl * 1000),
      accessCount: 0,
      lastAccessed: new Date(),
      tags,
    };
    
    await this.redis.setex(fullKey, config.ttl, JSON.stringify(item));
    
    // Update tags index
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        await this.redis.sadd(`${this.CACHE_PREFIX}tag:${tag}`, fullKey);
        await this.redis.expire(`${this.CACHE_PREFIX}tag:${tag}`, config.ttl);
      }
    }
    
    this.emit('itemSet', { cache: cacheName, key, compressed });
  }

  /**
   * Delete item from cache
   */
  public async delete(cacheName: string, key: string): Promise<void> {
    const fullKey = `${this.CACHE_PREFIX}${cacheName}:${key}`;
    await this.redis.del(fullKey);
    this.emit('itemDeleted', { cache: cacheName, key });
  }

  /**
   * Invalidate cache by pattern
   */
  public async invalidate(pattern: string, broadcast = true): Promise<number> {
    logger.info('Cache invalidation requested', { pattern });
    
    // Find all matching keys
    const keys = await this.scanKeys(`${this.CACHE_PREFIX}*${pattern}*`);
    
    if (keys.length > 0) {
      // Delete all matching keys
      await this.redis.del(...keys);
      
      // Broadcast invalidation to other instances
      if (broadcast) {
        await this.pubClient.publish(this.INVALIDATION_CHANNEL, JSON.stringify({
          pattern,
          timestamp: new Date(),
          source: process.env['INSTANCE_ID'] || 'unknown',
        }));
      }
      
      // Call registered invalidation handlers
      for (const [cacheName, handler] of this.invalidationHandlers) {
        const cacheKeys = keys
          .filter(k => k.startsWith(`${this.CACHE_PREFIX}${cacheName}:`))
          .map(k => k.replace(`${this.CACHE_PREFIX}${cacheName}:`, ''));
        
        if (cacheKeys.length > 0) {
          await handler(pattern, cacheKeys);
        }
      }
    }
    
    logger.info('Cache invalidated', { pattern, keysDeleted: keys.length });
    this.emit('invalidated', { pattern, keysDeleted: keys.length });
    
    return keys.length;
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    const allKeys = new Set<string>();
    
    for (const tag of tags) {
      const tagKey = `${this.CACHE_PREFIX}tag:${tag}`;
      const keys = await this.redis.smembers(tagKey);
      keys.forEach(k => allKeys.add(k));
    }
    
    if (allKeys.size > 0) {
      await this.redis.del(...Array.from(allKeys));
      
      // Clean up tag sets
      for (const tag of tags) {
        await this.redis.del(`${this.CACHE_PREFIX}tag:${tag}`);
      }
    }
    
    logger.info('Cache invalidated by tags', { tags, keysDeleted: allKeys.size });
    return allKeys.size;
  }

  /**
   * Warm cache with pre-computed data
   */
  public async warmCache(cacheName: string): Promise<WarmingResult> {
    const config = this.configs.get(cacheName);
    const warmingFunction = this.warmingFunctions.get(cacheName);
    
    if (!config || !warmingFunction) {
      throw new Error(`No warming function registered for cache ${cacheName}`);
    }
    
    // Acquire lock to prevent concurrent warming
    const lockKey = `${this.WARMING_LOCK_PREFIX}${cacheName}`;
    const lockAcquired = await this.acquireLock(lockKey, 300); // 5 minute lock
    
    if (!lockAcquired) {
      logger.warn('Cache warming already in progress', { cache: cacheName });
      return {
        cacheName,
        itemsWarmed: 0,
        duration: 0,
        errors: ['Warming already in progress'],
        timestamp: new Date(),
      };
    }
    
    const startTime = Date.now();
    const errors: string[] = [];
    let itemsWarmed = 0;
    
    try {
      logger.info('Starting cache warming', { cache: cacheName });
      
      // Get data to warm
      const dataMap = await warmingFunction();
      
      // Set all items in cache
      for (const [key, value] of dataMap) {
        try {
          await this.set(cacheName, key, value);
          itemsWarmed++;
        } catch (error) {
          errors.push(`Failed to warm key ${key}: ${error}`);
        }
      }
      
      // Update warming stats
      const stats = this.stats.get(cacheName);
      if (stats) {
        stats.lastWarmed = new Date();
        stats.itemCount = itemsWarmed;
      }
      
      const duration = Date.now() - startTime;
      
      logger.info('Cache warming completed', {
        cache: cacheName,
        itemsWarmed,
        duration,
        errors: errors.length,
      });
      
      this.emit('cacheWarmed', { cacheName, itemsWarmed, duration });
      
      return {
        cacheName,
        itemsWarmed,
        duration,
        errors,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Cache warming failed', {
        cache: cacheName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        cacheName,
        itemsWarmed,
        duration: Date.now() - startTime,
        errors,
        timestamp: new Date(),
      };
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Warm all caches configured for startup warming
   */
  public async warmAllCaches(): Promise<WarmingResult[]> {
    const results: WarmingResult[] = [];
    
    for (const [cacheName, config] of this.configs) {
      if (config.warmOnStartup && this.warmingFunctions.has(cacheName)) {
        const result = await this.warmCache(cacheName);
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(cacheName?: string): Promise<Map<string, CacheStats>> {
    if (cacheName) {
      const stats = this.stats.get(cacheName);
      if (!stats) {
        throw new Error(`Cache ${cacheName} not found`);
      }
      return new Map([[cacheName, stats]]);
    }
    
    // Update size estimates for all caches
    for (const [name, stats] of this.stats) {
      const pattern = `${this.CACHE_PREFIX}${name}:*`;
      const keys = await this.scanKeys(pattern);
      stats.itemCount = keys.length;
      
      // Estimate memory usage
      let totalSize = 0;
      for (const key of keys.slice(0, 100)) { // Sample first 100 keys
        const value = await this.redis.get(key);
        if (value) {
          totalSize += value.length;
        }
      }
      stats.size = keys.length > 0 ? (totalSize / Math.min(keys.length, 100)) * keys.length : 0;
    }
    
    return new Map(this.stats);
  }

  /**
   * Clear all items from a specific cache
   */
  public async clearCache(cacheName: string): Promise<number> {
    const pattern = `${this.CACHE_PREFIX}${cacheName}:*`;
    const keys = await this.scanKeys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    // Reset stats
    const stats = this.stats.get(cacheName);
    if (stats) {
      stats.hits = 0;
      stats.misses = 0;
      stats.hitRate = 0;
      stats.itemCount = 0;
      stats.size = 0;
      stats.lastInvalidated = new Date();
    }
    
    logger.info('Cache cleared', { cache: cacheName, itemsDeleted: keys.length });
    this.emit('cacheCleared', { cacheName, itemsDeleted: keys.length });
    
    return keys.length;
  }

  /**
   * Setup common cache configurations
   */
  public setupCommonCaches(): void {
    // User data cache
    this.registerCache(
      {
        name: 'users',
        ttl: 3600, // 1 hour
        warmOnStartup: true,
        warmingInterval: 30, // Every 30 minutes
        invalidationPatterns: ['user:*'],
        compressionThreshold: 1024,
      },
      async () => {
        // Warm active users
        const result = await pool.query(`
          SELECT id, email, name, role, organization_id
          FROM users
          WHERE active = true
          AND last_login > NOW() - INTERVAL '7 days'
        `);
        
        const dataMap = new Map();
        for (const user of result.rows) {
          dataMap.set(user.id.toString(), user);
        }
        return dataMap;
      }
    );
    
    // Image metadata cache
    this.registerCache(
      {
        name: 'images',
        ttl: 7200, // 2 hours
        warmOnStartup: false,
        warmingInterval: 60, // Every hour
        invalidationPatterns: ['image:*', 'project:*'],
        compressionThreshold: 2048,
      }
    );
    
    // Segmentation results cache
    this.registerCache(
      {
        name: 'segmentation',
        ttl: 86400, // 24 hours
        warmOnStartup: false,
        invalidationPatterns: ['segmentation:*'],
        compressionThreshold: 5120,
      }
    );
    
    // Project statistics cache
    this.registerCache(
      {
        name: 'projectStats',
        ttl: 1800, // 30 minutes
        warmOnStartup: true,
        warmingInterval: 15, // Every 15 minutes
        invalidationPatterns: ['project:*', 'stats:*'],
      },
      async () => {
        // Warm project statistics
        const result = await pool.query(`
          SELECT 
            p.id,
            p.name,
            COUNT(DISTINCT i.id) as image_count,
            COUNT(DISTINCT c.id) as cell_count,
            COALESCE(SUM(i.file_size), 0) as total_size
          FROM projects p
          LEFT JOIN images i ON i.project_id = p.id
          LEFT JOIN cells c ON c.image_id = i.id
          WHERE p.deleted_at IS NULL
          GROUP BY p.id, p.name
        `);
        
        const dataMap = new Map();
        for (const stats of result.rows) {
          dataMap.set(stats.id.toString(), stats);
        }
        return dataMap;
      }
    );
  }

  /**
   * Stop all cache operations
   */
  public stopAll(): void {
    // Stop all warming jobs
    for (const job of this.warmingJobs.values()) {
      job.stop();
    }
    this.warmingJobs.clear();
    
    // Close Redis connections
    this.pubClient.disconnect();
    this.subClient.disconnect();
  }

  // Private helper methods
  
  private setupInvalidationListener(): void {
    this.subClient.subscribe(this.INVALIDATION_CHANNEL);
    
    this.subClient.on('message', async (channel, message) => {
      if (channel === this.INVALIDATION_CHANNEL) {
        try {
          const data = JSON.parse(message);
          
          // Don't process our own invalidations
          if (data.source === process.env['INSTANCE_ID']) {
            return;
          }
          
          // Invalidate locally without broadcasting
          await this.invalidate(data.pattern, false);
        } catch (error) {
          logger.error('Failed to process invalidation message', { error });
        }
      }
    });
  }
  
  private startStatsCollection(): void {
    // Periodically save stats to Redis
    setInterval(async () => {
      for (const [cacheName, stats] of this.stats) {
        const key = `${this.STATS_PREFIX}${cacheName}`;
        await this.redis.setex(key, 3600, JSON.stringify(stats));
      }
    }, 60000); // Every minute
  }
  
  private recordHit(cacheName: string): void {
    const stats = this.stats.get(cacheName);
    if (stats) {
      stats.hits++;
      stats.hitRate = stats.hits / (stats.hits + stats.misses);
    }
  }
  
  private recordMiss(cacheName: string): void {
    const stats = this.stats.get(cacheName);
    if (stats) {
      stats.misses++;
      stats.hitRate = stats.hits / (stats.hits + stats.misses);
    }
  }
  
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const [newCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      keys.push(...batch);
      cursor = newCursor;
    } while (cursor !== '0');
    
    return keys;
  }
  
  private async acquireLock(key: string, ttl: number): Promise<boolean> {
    const result = await this.redis.set(key, '1', 'NX', 'EX', ttl);
    return result === 'OK';
  }
  
  private async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

// Export singleton instance
let cacheManager: CacheManager | null = null;

export function initializeCacheManager(redisClient: Redis): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager(redisClient);
  }
  return cacheManager;
}

export function getCacheManager(): CacheManager {
  if (!cacheManager) {
    throw new Error('Cache manager not initialized');
  }
  return cacheManager;
}

export default {
  initializeCacheManager,
  getCacheManager,
};