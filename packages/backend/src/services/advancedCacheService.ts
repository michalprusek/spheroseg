/**
 * Advanced Cache Service
 *
 * Multi-layer caching system with intelligent cache warming,
 * invalidation strategies, and performance optimization
 */

import Redis from 'ioredis';
import logger from '../utils/logger';
import { Pool } from 'pg';

// Cache layers and TTL strategies
const CACHE_STRATEGIES = {
  // Hot data - frequently accessed
  HOT: {
    memory: { ttl: 60, maxItems: 1000 },
    redis: { ttl: 300, compression: false },
    warmup: true,
  },
  // Warm data - moderately accessed
  WARM: {
    memory: { ttl: 30, maxItems: 500 },
    redis: { ttl: 600, compression: true },
    warmup: false,
  },
  // Cold data - rarely accessed
  COLD: {
    memory: { ttl: 0, maxItems: 0 }, // No memory cache
    redis: { ttl: 1800, compression: true },
    warmup: false,
  },
  // Static data - doesn't change often
  STATIC: {
    memory: { ttl: 300, maxItems: 200 },
    redis: { ttl: 3600, compression: true },
    warmup: true,
  },
} as const;

interface CacheItem<T> {
  data: T;
  timestamp: number;
  hits: number;
  strategy: keyof typeof CACHE_STRATEGIES;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
  redisConnected: boolean;
  lastCleanup: number;
}

class AdvancedCacheService {
  private memoryCache = new Map<string, CacheItem<any>>();
  private redis: Redis | null = null;
  private isRedisConnected = false;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0,
    redisConnected: false,
    lastCleanup: Date.now(),
  };
  private cleanupInterval: NodeJS.Timer;
  private warmupTimer: NodeJS.Timer;

  constructor(private pool: Pool) {
    this.initializeRedis();
    this.startCleanupTask();
    this.startWarmupTask();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        // Compression for larger payloads
        compression: 'gzip',
        retryDelayOnFailover: 100,
        reconnectOnError: (err) => {
          logger.warn('Redis reconnecting on error', { error: err.message });
          return true;
        },
      });

      this.redis.on('connect', () => {
        logger.info('Advanced cache Redis connected');
        this.isRedisConnected = true;
        this.metrics.redisConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.error('Advanced cache Redis error', { error: error.message });
        this.isRedisConnected = false;
        this.metrics.redisConnected = false;
      });
    } catch (error) {
      logger.error('Failed to initialize Redis for advanced cache', { error });
    }
  }

  /**
   * Get data with multi-layer cache strategy
   */
  async get<T>(
    key: string,
    strategy: keyof typeof CACHE_STRATEGIES = 'WARM',
    fetchFunction?: () => Promise<T>
  ): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Layer 1: Memory cache
      const memoryResult = this.getFromMemory<T>(key, strategy);
      if (memoryResult !== null) {
        this.metrics.hits++;
        logger.debug('Cache hit - Memory L1', { key, strategy, time: Date.now() - startTime });
        return memoryResult;
      }

      // Layer 2: Redis cache
      const redisResult = await this.getFromRedis<T>(key, strategy);
      if (redisResult !== null) {
        // Populate memory cache for future hits
        this.setToMemory(key, redisResult, strategy);
        this.metrics.hits++;
        logger.debug('Cache hit - Redis L2', { key, strategy, time: Date.now() - startTime });
        return redisResult;
      }

      // Layer 3: Fetch from source (database)
      if (fetchFunction) {
        const freshData = await fetchFunction();
        if (freshData !== null) {
          // Populate both cache layers
          await this.setToRedis(key, freshData, strategy);
          this.setToMemory(key, freshData, strategy);
          logger.debug('Cache miss - Fetched from source', {
            key,
            strategy,
            time: Date.now() - startTime,
          });
        }
        this.metrics.misses++;
        return freshData;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      logger.error('Advanced cache get error', { key, strategy, error });
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set data in appropriate cache layers
   */
  async set<T>(
    key: string,
    data: T,
    strategy: keyof typeof CACHE_STRATEGIES = 'WARM'
  ): Promise<void> {
    try {
      const cacheStrategy = CACHE_STRATEGIES[strategy];

      // Set in Redis
      if (this.isRedisConnected && cacheStrategy.redis.ttl > 0) {
        await this.setToRedis(key, data, strategy);
      }

      // Set in memory
      if (cacheStrategy.memory.ttl > 0) {
        this.setToMemory(key, data, strategy);
      }
    } catch (error) {
      logger.error('Advanced cache set error', { key, strategy, error });
    }
  }

  /**
   * Invalidate data from all cache layers
   */
  async invalidate(key: string | string[]): Promise<void> {
    try {
      const keys = Array.isArray(key) ? key : [key];

      // Remove from memory
      keys.forEach((k) => this.memoryCache.delete(k));

      // Remove from Redis
      if (this.isRedisConnected && this.redis) {
        await this.redis.del(...keys);
      }

      logger.debug('Cache invalidated', { keys });
    } catch (error) {
      logger.error('Cache invalidation error', { key, error });
    }
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Memory cache pattern invalidation
      const memoryKeys = Array.from(this.memoryCache.keys()).filter((key) =>
        new RegExp(pattern.replace('*', '.*')).test(key)
      );
      memoryKeys.forEach((key) => this.memoryCache.delete(key));

      // Redis pattern invalidation
      if (this.isRedisConnected && this.redis) {
        const redisKeys = await this.redis.keys(pattern);
        if (redisKeys.length > 0) {
          await this.redis.del(...redisKeys);
        }
      }

      logger.debug('Cache pattern invalidated', { pattern, memoryKeys: memoryKeys.length });
    } catch (error) {
      logger.error('Cache pattern invalidation error', { pattern, error });
    }
  }

  /**
   * Get from memory cache
   */
  private getFromMemory<T>(key: string, strategy: keyof typeof CACHE_STRATEGIES): T | null {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    const cacheStrategy = CACHE_STRATEGIES[strategy];
    const now = Date.now();

    // Check TTL
    if (cacheStrategy.memory.ttl > 0 && now - item.timestamp > cacheStrategy.memory.ttl * 1000) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update hit count
    item.hits++;
    return item.data;
  }

  /**
   * Set to memory cache with LRU eviction
   */
  private setToMemory<T>(key: string, data: T, strategy: keyof typeof CACHE_STRATEGIES): void {
    const cacheStrategy = CACHE_STRATEGIES[strategy];

    if (cacheStrategy.memory.ttl === 0) return;

    // Evict if cache is full
    if (this.memoryCache.size >= cacheStrategy.memory.maxItems) {
      this.evictLRU(cacheStrategy.memory.maxItems);
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
      strategy,
    });

    this.updateMemoryUsage();
  }

  /**
   * Get from Redis cache
   */
  private async getFromRedis<T>(
    key: string,
    strategy: keyof typeof CACHE_STRATEGIES
  ): Promise<T | null> {
    if (!this.isRedisConnected || !this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      const cacheStrategy = CACHE_STRATEGIES[strategy];

      // Decompress if needed
      if (cacheStrategy.redis.compression) {
        // For now, JSON parse (compression can be added later)
        return JSON.parse(value);
      }

      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis get error', { key, error });
      return null;
    }
  }

  /**
   * Set to Redis cache
   */
  private async setToRedis<T>(
    key: string,
    data: T,
    strategy: keyof typeof CACHE_STRATEGIES
  ): Promise<void> {
    if (!this.isRedisConnected || !this.redis) return;

    try {
      const cacheStrategy = CACHE_STRATEGIES[strategy];
      const serialized = JSON.stringify(data);

      await this.redis.setex(key, cacheStrategy.redis.ttl, serialized);
    } catch (error) {
      logger.error('Redis set error', { key, error });
    }
  }

  /**
   * LRU eviction for memory cache
   */
  private evictLRU(maxItems: number): void {
    if (this.memoryCache.size <= maxItems) return;

    // Sort by last access time and hits
    const entries = Array.from(this.memoryCache.entries()).sort((a, b) => {
      const aScore = a[1].timestamp + a[1].hits * 10000; // Boost frequently accessed items
      const bScore = b[1].timestamp + b[1].hits * 10000;
      return aScore - bScore; // Oldest first
    });

    // Remove oldest entries
    const toRemove = entries.length - maxItems + Math.floor(maxItems * 0.1); // Remove 10% extra
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i][0]);
      this.metrics.evictions++;
    }

    this.updateMemoryUsage();
  }

  /**
   * Update memory usage metrics
   */
  private updateMemoryUsage(): void {
    // Rough estimate of memory usage
    this.metrics.memoryUsage = this.memoryCache.size * 1024; // Rough estimate
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      const strategy = CACHE_STRATEGIES[item.strategy];
      if (strategy.memory.ttl > 0 && now - item.timestamp > strategy.memory.ttl * 1000) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    this.metrics.lastCleanup = now;
    this.updateMemoryUsage();

    if (cleaned > 0) {
      logger.debug('Memory cache cleanup completed', { cleanedEntries: cleaned });
    }
  }

  /**
   * Start cache warming task
   */
  private startWarmupTask(): void {
    this.warmupTimer = setInterval(() => {
      this.warmupCache();
    }, 300000); // Every 5 minutes
  }

  /**
   * Warm up frequently accessed data
   */
  private async warmupCache(): Promise<void> {
    try {
      // This would be customized based on application needs
      // For now, we'll warmup user stats for active users
      logger.debug('Cache warmup task started');

      // Example: Warm up user stats for recently active users
      const activeUsersQuery = `
        SELECT DISTINCT user_id 
        FROM projects 
        WHERE updated_at > NOW() - INTERVAL '1 hour'
        LIMIT 10
      `;

      const result = await this.pool.query(activeUsersQuery);

      for (const row of result.rows) {
        const cacheKey = `user_stats:${row.user_id}`;

        // Check if not already cached
        const exists = await this.get(cacheKey, 'HOT');
        if (!exists) {
          // This would call the actual user stats service
          logger.debug('Warming up user stats', { userId: row.user_id });
        }
      }
    } catch (error) {
      logger.error('Cache warmup error', { error });
    }
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics & {
    memoryCacheSize: number;
    hitRate: number;
    memoryHitRate: number;
  } {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    // Calculate memory-specific hit rate
    const memoryHits = Array.from(this.memoryCache.values()).reduce(
      (sum, item) => sum + item.hits,
      0
    );
    const memoryHitRate = memoryHits > 0 ? (memoryHits / total) * 100 : 0;

    return {
      ...this.metrics,
      memoryCacheSize: this.memoryCache.size,
      hitRate,
      memoryHitRate,
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    try {
      // Clear memory
      this.memoryCache.clear();

      // Clear Redis
      if (this.isRedisConnected && this.redis) {
        await this.redis.flushall();
      }

      // Reset metrics
      this.metrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
        memoryUsage: 0,
        redisConnected: this.isRedisConnected,
        lastCleanup: Date.now(),
      };

      logger.info('Advanced cache cleared');
    } catch (error) {
      logger.error('Cache clear error', { error });
    }
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    try {
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      if (this.warmupTimer) {
        clearInterval(this.warmupTimer);
      }

      // Disconnect Redis
      if (this.redis && this.isRedisConnected) {
        await this.redis.quit();
      }

      logger.info('Advanced cache service shutdown');
    } catch (error) {
      logger.error('Cache shutdown error', { error });
    }
  }
}

export default AdvancedCacheService;
