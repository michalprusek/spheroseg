/**
 * Tests for AdvancedCacheService
 * 
 * Tests multi-layer caching, cache warming, invalidation strategies,
 * and performance optimization features
 */

import { AdvancedCacheService } from '../advancedCacheService';
import Redis from 'ioredis';
import { Pool } from 'pg';

// Mock Redis
jest.mock('ioredis');
const MockRedis = jest.mocked(Redis);

// Mock logger
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
} as unknown as Pool;

describe('AdvancedCacheService', () => {
  let cacheService: AdvancedCacheService;
  let mockRedisInstance: any;
  let mockLogger: any;

  beforeAll(() => {
    jest.useFakeTimers();
    mockLogger = require('../../utils/logger').default;
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Redis mock
    mockRedisInstance = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      pipeline: jest.fn(() => ({
        get: jest.fn().mockReturnThis(),
        setex: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      })),
      quit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };
    
    MockRedis.mockImplementation(() => mockRedisInstance);
    
    // Create service instance
    cacheService = new AdvancedCacheService(mockPool);
    
    // Trigger Redis connect event
    const connectHandler = mockRedisInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'connect'
    )?.[1];
    if (connectHandler) {
      connectHandler();
    }
  });

  afterEach(() => {
    cacheService.shutdown();
  });

  describe('Multi-layer Caching', () => {
    it('should cache in memory and Redis with HOT strategy', async () => {
      const key = 'test:hot:key';
      const value = { data: 'hot data' };
      
      await cacheService.set(key, value, 'HOT');
      
      // Should be in memory cache
      const memoryResult = await cacheService.getFromMemory(key);
      expect(memoryResult).toEqual(value);
      
      // Should also be in Redis
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        key,
        300, // HOT strategy Redis TTL
        JSON.stringify({
          data: value,
          timestamp: expect.any(Number),
          hits: 0,
          strategy: 'HOT'
        })
      );
    });

    it('should not cache in memory for COLD strategy', async () => {
      const key = 'test:cold:key';
      const value = { data: 'cold data' };
      
      await cacheService.set(key, value, 'COLD');
      
      // Should NOT be in memory cache
      const memoryResult = await cacheService.getFromMemory(key);
      expect(memoryResult).toBeNull();
      
      // Should be in Redis with compression
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        key,
        1800, // COLD strategy Redis TTL
        expect.any(String)
      );
    });

    it('should retrieve from memory first, then Redis', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      
      // Set in cache
      await cacheService.set(key, value, 'HOT');
      
      // Mock Redis to ensure memory is used first
      mockRedisInstance.get.mockResolvedValue(null);
      
      // Get should return from memory
      const result = await cacheService.get(key);
      expect(result).toEqual(value);
      expect(mockRedisInstance.get).not.toHaveBeenCalled();
    });

    it('should fall back to Redis when not in memory', async () => {
      const key = 'test:key';
      const cachedData = {
        data: { value: 'from redis' },
        timestamp: Date.now(),
        hits: 5,
        strategy: 'WARM'
      };
      
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(cachedData));
      
      const result = await cacheService.get(key);
      expect(result).toEqual(cachedData.data);
      expect(mockRedisInstance.get).toHaveBeenCalledWith(key);
    });
  });

  describe('Cache Strategies', () => {
    it('should apply different TTLs based on strategy', async () => {
      const strategies = ['HOT', 'WARM', 'COLD', 'STATIC'] as const;
      const expectedTTLs = [300, 600, 1800, 3600];
      
      for (let i = 0; i < strategies.length; i++) {
        await cacheService.set(`key:${i}`, { data: i }, strategies[i]);
      }
      
      expectedTTLs.forEach((ttl, index) => {
        expect(mockRedisInstance.setex).toHaveBeenCalledWith(
          `key:${index}`,
          ttl,
          expect.any(String)
        );
      });
    });

    it('should respect memory limits per strategy', async () => {
      // HOT strategy has maxItems: 1000
      // Fill up the cache
      for (let i = 0; i < 1100; i++) {
        await cacheService.set(`hot:${i}`, { data: i }, 'HOT');
      }
      
      // Trigger cleanup
      jest.advanceTimersByTime(60000);
      
      // Should have evicted oldest items
      const metrics = cacheService.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate single key', async () => {
      const key = 'test:key';
      await cacheService.set(key, { data: 'test' }, 'HOT');
      
      await cacheService.invalidate(key);
      
      const result = await cacheService.get(key);
      expect(result).toBeNull();
      expect(mockRedisInstance.del).toHaveBeenCalledWith(key);
    });

    it('should invalidate by pattern', async () => {
      // Set multiple keys
      await cacheService.set('user:1:profile', { name: 'User 1' }, 'HOT');
      await cacheService.set('user:1:settings', { theme: 'dark' }, 'HOT');
      await cacheService.set('user:2:profile', { name: 'User 2' }, 'HOT');
      
      // Mock Redis pattern matching
      mockRedisInstance.pipeline.mockReturnValue({
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });
      
      await cacheService.invalidatePattern('user:1:*');
      
      // Should remove matching keys from memory
      expect(await cacheService.getFromMemory('user:1:profile')).toBeNull();
      expect(await cacheService.getFromMemory('user:1:settings')).toBeNull();
      expect(await cacheService.getFromMemory('user:2:profile')).not.toBeNull();
    });

    it('should invalidate related data', async () => {
      // Set related data
      await cacheService.set('project:123:info', { name: 'Project' }, 'HOT');
      await cacheService.set('project:123:images', ['img1', 'img2'], 'HOT');
      await cacheService.set('user:456:projects', ['123', '789'], 'HOT');
      
      await cacheService.invalidateRelated('project', '123');
      
      // Project data should be invalidated
      expect(await cacheService.getFromMemory('project:123:info')).toBeNull();
      expect(await cacheService.getFromMemory('project:123:images')).toBeNull();
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache with frequently accessed data', async () => {
      // Mock database query for popular items
      mockPool.query.mockResolvedValue({
        rows: [
          { key: 'popular:1', data: { views: 1000 } },
          { key: 'popular:2', data: { views: 800 } }
        ]
      });
      
      await cacheService.warmCache();
      
      // Should query for popular data
      expect(mockPool.query).toHaveBeenCalled();
      
      // Should cache the results
      expect(await cacheService.getFromMemory('popular:1')).toEqual({ views: 1000 });
      expect(await cacheService.getFromMemory('popular:2')).toEqual({ views: 800 });
    });

    it('should run warmup task periodically', () => {
      const warmSpy = jest.spyOn(cacheService, 'warmCache');
      
      // Fast-forward 5 minutes (warmup interval)
      jest.advanceTimersByTime(300000);
      
      expect(warmSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Optimization', () => {
    it('should track cache hit/miss ratio', async () => {
      const key = 'test:key';
      
      // Miss
      mockRedisInstance.get.mockResolvedValue(null);
      await cacheService.get(key);
      
      // Hit
      await cacheService.set(key, { data: 'test' }, 'HOT');
      await cacheService.get(key);
      
      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      
      const hitRate = cacheService.getHitRate();
      expect(hitRate).toBe(0.5); // 50% hit rate
    });

    it('should batch Redis operations', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = [{ a: 1 }, { b: 2 }, { c: 3 }];
      
      // Batch set
      await cacheService.mset(
        keys.map((key, i) => ({ key, value: values[i], strategy: 'HOT' }))
      );
      
      expect(mockRedisInstance.pipeline).toHaveBeenCalled();
      
      // Batch get
      mockRedisInstance.mget.mockResolvedValue(
        values.map(v => JSON.stringify({
          data: v,
          timestamp: Date.now(),
          hits: 0,
          strategy: 'HOT'
        }))
      );
      
      const results = await cacheService.mget(keys);
      expect(results).toEqual(values);
    });

    it('should handle compression for large payloads', async () => {
      const largeData = {
        data: 'x'.repeat(10000) // Large string
      };
      
      await cacheService.set('large:key', largeData, 'WARM');
      
      // WARM strategy uses compression
      const setCall = mockRedisInstance.setex.mock.calls[0];
      const serialized = setCall[2];
      
      // Should be compressed (smaller than original)
      expect(serialized.length).toBeLessThan(JSON.stringify(largeData).length);
    });
  });

  describe('Memory Management', () => {
    it('should clean up expired items periodically', () => {
      // Add expired items to memory cache
      const expiredItem = {
        data: { test: true },
        timestamp: Date.now() - 120000, // 2 minutes old
        hits: 0,
        strategy: 'HOT' as const
      };
      (cacheService as any).memoryCache.set('expired:key', expiredItem);
      
      // Add valid item
      const validItem = {
        data: { test: true },
        timestamp: Date.now(),
        hits: 0,
        strategy: 'HOT' as const
      };
      (cacheService as any).memoryCache.set('valid:key', validItem);
      
      // Trigger cleanup
      jest.advanceTimersByTime(60000);
      
      // Expired item should be removed
      expect((cacheService as any).memoryCache.has('expired:key')).toBe(false);
      expect((cacheService as any).memoryCache.has('valid:key')).toBe(true);
      
      const metrics = cacheService.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
    });

    it('should estimate memory usage', () => {
      // Add items to cache
      for (let i = 0; i < 100; i++) {
        (cacheService as any).memoryCache.set(`key:${i}`, {
          data: { index: i, text: 'x'.repeat(100) },
          timestamp: Date.now(),
          hits: 0,
          strategy: 'HOT'
        });
      }
      
      const metrics = cacheService.getMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Simulate Redis error
      mockRedisInstance.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await cacheService.get('test:key');
      
      // Should return null and log error
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Redis get error',
        expect.objectContaining({ error: 'Redis connection failed' })
      );
    });

    it('should continue working with memory cache when Redis is down', async () => {
      // Mark Redis as disconnected
      (cacheService as any).isRedisConnected = false;
      
      const key = 'test:key';
      const value = { data: 'test' };
      
      // Should still work with memory cache
      await cacheService.set(key, value, 'HOT');
      const result = await cacheService.get(key);
      
      expect(result).toEqual(value);
      expect(mockRedisInstance.setex).not.toHaveBeenCalled();
    });
  });

  describe('Cache Export/Import', () => {
    it('should export cache snapshot', () => {
      // Add items to cache
      (cacheService as any).memoryCache.set('key1', {
        data: { a: 1 },
        timestamp: Date.now(),
        hits: 5,
        strategy: 'HOT'
      });
      
      const snapshot = cacheService.exportSnapshot();
      
      expect(snapshot).toHaveProperty('version');
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('entries');
      expect(snapshot.entries).toHaveLength(1);
    });

    it('should import cache snapshot', () => {
      const snapshot = {
        version: '1.0',
        timestamp: Date.now(),
        entries: [
          {
            key: 'imported:key',
            value: {
              data: { imported: true },
              timestamp: Date.now(),
              hits: 10,
              strategy: 'STATIC' as const
            }
          }
        ]
      };
      
      cacheService.importSnapshot(snapshot);
      
      const result = cacheService.getFromMemory('imported:key');
      expect(result).toEqual({ imported: true });
    });
  });
});