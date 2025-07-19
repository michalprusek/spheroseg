/**
 * Cache Strategies and Patterns
 * 
 * Implements various caching strategies for different use cases
 */

import { CacheManager } from './advancedCacheManager';
import { pool } from '../db';
import logger from './logger';
import crypto from 'crypto';

export interface CacheStrategy {
  name: string;
  execute<T>(key: string, fetchFunction: () => Promise<T>, options?: any): Promise<T>;
}

/**
 * Cache-Aside (Lazy Loading) Strategy
 * Most common pattern - check cache first, fetch if miss
 */
export class CacheAsideStrategy implements CacheStrategy {
  name = 'cache-aside';
  
  constructor(
    private cacheManager: CacheManager,
    private cacheName: string
  ) {}
  
  async execute<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.cacheManager.get<T>(this.cacheName, key);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch from source
    const data = await fetchFunction();
    
    // Store in cache
    await this.cacheManager.set(this.cacheName, key, data, options?.tags);
    
    return data;
  }
}

/**
 * Write-Through Strategy
 * Write to cache and database simultaneously
 */
export class WriteThroughStrategy implements CacheStrategy {
  name = 'write-through';
  
  constructor(
    private cacheManager: CacheManager,
    private cacheName: string
  ) {}
  
  async execute<T>(
    key: string,
    writeFunction: () => Promise<T>,
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    // Write to database
    const data = await writeFunction();
    
    // Write to cache
    await this.cacheManager.set(this.cacheName, key, data, options?.tags);
    
    return data;
  }
}

/**
 * Write-Behind (Write-Back) Strategy
 * Write to cache immediately, sync to database later
 */
export class WriteBehindStrategy implements CacheStrategy {
  name = 'write-behind';
  private writeQueue: Map<string, { data: any; timestamp: Date }> = new Map();
  private flushInterval: NodeJS.Timeout;
  
  constructor(
    private cacheManager: CacheManager,
    private cacheName: string,
    private flushIntervalMs: number = 5000
  ) {
    this.startFlushTimer();
  }
  
  async execute<T>(
    key: string,
    data: T,
    options?: { 
      writeFunction?: (key: string, data: T) => Promise<void>;
      tags?: string[] 
    }
  ): Promise<T> {
    // Write to cache immediately
    await this.cacheManager.set(this.cacheName, key, data, options?.tags);
    
    // Queue for database write
    if (options?.writeFunction) {
      this.writeQueue.set(key, {
        data,
        timestamp: new Date(),
      });
    }
    
    return data;
  }
  
  private startFlushTimer(): void {
    this.flushInterval = setInterval(async () => {
      await this.flush();
    }, this.flushIntervalMs);
  }
  
  async flush(): Promise<void> {
    if (this.writeQueue.size === 0) return;
    
    const itemsToWrite = Array.from(this.writeQueue.entries());
    this.writeQueue.clear();
    
    for (const [key, { data }] of itemsToWrite) {
      try {
        // In real implementation, this would call the actual write function
        logger.debug('Write-behind flush', { key, cacheName: this.cacheName });
      } catch (error) {
        logger.error('Write-behind flush failed', { key, error });
        // Could re-queue or handle error
      }
    }
  }
  
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}

/**
 * Refresh-Ahead Strategy
 * Proactively refresh cache before expiration
 */
export class RefreshAheadStrategy implements CacheStrategy {
  name = 'refresh-ahead';
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    private cacheManager: CacheManager,
    private cacheName: string,
    private refreshRatio: number = 0.8 // Refresh when 80% of TTL has passed
  ) {}
  
  async execute<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    // Try cache first
    const cached = await this.cacheManager.get<T>(this.cacheName, key);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch and cache
    const data = await fetchFunction();
    await this.cacheManager.set(this.cacheName, key, data, options?.tags);
    
    // Schedule refresh
    const config = await this.cacheManager['configs'].get(this.cacheName);
    if (config) {
      const refreshTime = config.ttl * this.refreshRatio * 1000;
      
      // Clear existing timer
      const existingTimer = this.refreshTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new timer
      const timer = setTimeout(async () => {
        try {
          const refreshedData = await fetchFunction();
          await this.cacheManager.set(this.cacheName, key, refreshedData, options?.tags);
          logger.debug('Cache refreshed ahead', { cacheName: this.cacheName, key });
        } catch (error) {
          logger.error('Refresh-ahead failed', { cacheName: this.cacheName, key, error });
        }
        this.refreshTimers.delete(key);
      }, refreshTime);
      
      this.refreshTimers.set(key, timer);
    }
    
    return data;
  }
  
  stop(): void {
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();
  }
}

/**
 * Multi-Level Cache Strategy
 * Uses both in-memory and Redis cache
 */
export class MultiLevelCacheStrategy implements CacheStrategy {
  name = 'multi-level';
  private memoryCache: Map<string, { data: any; expires: Date }> = new Map();
  private maxMemoryItems: number = 1000;
  
  constructor(
    private cacheManager: CacheManager,
    private cacheName: string,
    private memoryTTL: number = 60 // Memory cache TTL in seconds
  ) {}
  
  async execute<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    // Check L1 (memory) cache
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && memoryItem.expires > new Date()) {
      return memoryItem.data;
    }
    
    // Check L2 (Redis) cache
    const cached = await this.cacheManager.get<T>(this.cacheName, key);
    if (cached !== null) {
      // Store in L1
      this.setMemoryCache(key, cached);
      return cached;
    }
    
    // Fetch from source
    const data = await fetchFunction();
    
    // Store in both levels
    await this.cacheManager.set(this.cacheName, key, data, options?.tags);
    this.setMemoryCache(key, data);
    
    return data;
  }
  
  private setMemoryCache(key: string, data: any): void {
    // Implement simple LRU eviction
    if (this.memoryCache.size >= this.maxMemoryItems) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, {
      data,
      expires: new Date(Date.now() + this.memoryTTL * 1000),
    });
  }
  
  clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

/**
 * Circuit Breaker Cache Strategy
 * Returns stale cache on failure
 */
export class CircuitBreakerCacheStrategy implements CacheStrategy {
  name = 'circuit-breaker';
  private failures: Map<string, number> = new Map();
  private circuitOpen: Map<string, Date> = new Map();
  
  constructor(
    private cacheManager: CacheManager,
    private cacheName: string,
    private failureThreshold: number = 3,
    private resetTimeMs: number = 30000
  ) {}
  
  async execute<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options?: { ttl?: number; tags?: string[]; staleTTL?: number }
  ): Promise<T> {
    // Check if circuit is open
    const openUntil = this.circuitOpen.get(key);
    if (openUntil && openUntil > new Date()) {
      // Try to return stale cache
      const stale = await this.getStaleCache<T>(key);
      if (stale !== null) {
        logger.warn('Circuit open, returning stale cache', { key });
        return stale;
      }
      throw new Error('Circuit breaker open and no cache available');
    }
    
    try {
      // Try normal cache-aside
      const cached = await this.cacheManager.get<T>(this.cacheName, key);
      if (cached !== null) {
        return cached;
      }
      
      // Fetch from source
      const data = await fetchFunction();
      
      // Store in cache
      await this.cacheManager.set(this.cacheName, key, data, options?.tags);
      
      // Also store as stale cache with longer TTL
      if (options?.staleTTL) {
        await this.cacheManager.set(
          `${this.cacheName}_stale`,
          key,
          data,
          options.tags
        );
      }
      
      // Reset failures on success
      this.failures.delete(key);
      
      return data;
    } catch (error) {
      // Increment failure count
      const failureCount = (this.failures.get(key) || 0) + 1;
      this.failures.set(key, failureCount);
      
      // Open circuit if threshold reached
      if (failureCount >= this.failureThreshold) {
        this.circuitOpen.set(key, new Date(Date.now() + this.resetTimeMs));
        this.failures.delete(key);
        logger.error('Circuit breaker opened', { key, failures: failureCount });
      }
      
      // Try to return stale cache
      const stale = await this.getStaleCache<T>(key);
      if (stale !== null) {
        logger.warn('Returning stale cache due to failure', { key });
        return stale;
      }
      
      throw error;
    }
  }
  
  private async getStaleCache<T>(key: string): Promise<T | null> {
    return await this.cacheManager.get<T>(`${this.cacheName}_stale`, key);
  }
}

/**
 * Distributed Lock Cache Strategy
 * Prevents cache stampede
 */
export class DistributedLockCacheStrategy implements CacheStrategy {
  name = 'distributed-lock';
  
  constructor(
    private cacheManager: CacheManager,
    private cacheName: string,
    private lockTTL: number = 10 // Lock TTL in seconds
  ) {}
  
  async execute<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    // Try cache first
    const cached = await this.cacheManager.get<T>(this.cacheName, key);
    if (cached !== null) {
      return cached;
    }
    
    // Try to acquire lock
    const lockKey = `lock:${this.cacheName}:${key}`;
    const lockId = crypto.randomBytes(16).toString('hex');
    const redis = this.cacheManager['redis'];
    
    const lockAcquired = await redis.set(
      lockKey,
      lockId,
      'NX',
      'EX',
      this.lockTTL
    );
    
    if (lockAcquired === 'OK') {
      try {
        // Double-check cache (might have been populated while waiting)
        const cachedAgain = await this.cacheManager.get<T>(this.cacheName, key);
        if (cachedAgain !== null) {
          return cachedAgain;
        }
        
        // Fetch and cache
        const data = await fetchFunction();
        await this.cacheManager.set(this.cacheName, key, data, options?.tags);
        
        return data;
      } finally {
        // Release lock only if we own it
        const currentLock = await redis.get(lockKey);
        if (currentLock === lockId) {
          await redis.del(lockKey);
        }
      }
    } else {
      // Lock not acquired, wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try cache again
      const cachedAfterWait = await this.cacheManager.get<T>(this.cacheName, key);
      if (cachedAfterWait !== null) {
        return cachedAfterWait;
      }
      
      // If still no cache, wait a bit more and fetch anyway
      await new Promise(resolve => setTimeout(resolve, 500));
      const data = await fetchFunction();
      
      // Try to cache (might fail if another process did it)
      try {
        await this.cacheManager.set(this.cacheName, key, data, options?.tags);
      } catch (error) {
        // Ignore cache set errors
      }
      
      return data;
    }
  }
}

/**
 * Factory for creating cache strategies
 */
export class CacheStrategyFactory {
  private strategies: Map<string, CacheStrategy> = new Map();
  
  constructor(private cacheManager: CacheManager) {}
  
  createStrategy(
    type: 'cache-aside' | 'write-through' | 'write-behind' | 'refresh-ahead' | 
          'multi-level' | 'circuit-breaker' | 'distributed-lock',
    cacheName: string,
    options?: any
  ): CacheStrategy {
    const key = `${type}:${cacheName}`;
    
    if (this.strategies.has(key)) {
      return this.strategies.get(key)!;
    }
    
    let strategy: CacheStrategy;
    
    switch (type) {
      case 'cache-aside':
        strategy = new CacheAsideStrategy(this.cacheManager, cacheName);
        break;
      
      case 'write-through':
        strategy = new WriteThroughStrategy(this.cacheManager, cacheName);
        break;
      
      case 'write-behind':
        strategy = new WriteBehindStrategy(
          this.cacheManager,
          cacheName,
          options?.flushIntervalMs
        );
        break;
      
      case 'refresh-ahead':
        strategy = new RefreshAheadStrategy(
          this.cacheManager,
          cacheName,
          options?.refreshRatio
        );
        break;
      
      case 'multi-level':
        strategy = new MultiLevelCacheStrategy(
          this.cacheManager,
          cacheName,
          options?.memoryTTL
        );
        break;
      
      case 'circuit-breaker':
        strategy = new CircuitBreakerCacheStrategy(
          this.cacheManager,
          cacheName,
          options?.failureThreshold,
          options?.resetTimeMs
        );
        break;
      
      case 'distributed-lock':
        strategy = new DistributedLockCacheStrategy(
          this.cacheManager,
          cacheName,
          options?.lockTTL
        );
        break;
      
      default:
        throw new Error(`Unknown cache strategy: ${type}`);
    }
    
    this.strategies.set(key, strategy);
    return strategy;
  }
  
  stopAll(): void {
    for (const strategy of this.strategies.values()) {
      if ('stop' in strategy && typeof strategy.stop === 'function') {
        strategy.stop();
      }
    }
  }
}