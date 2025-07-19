/**
 * Tests for Advanced Cache Manager
 */

import { Redis } from 'ioredis';
import { CacheManager, initializeCacheManager } from '../advancedCacheManager';

// Mock dependencies
jest.mock('ioredis');
jest.mock('../logger');
jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock zlib for compression tests
jest.mock('zlib', () => ({
  gzip: jest.fn((_data, callback) => callback(null, Buffer.from('compressed'))),
  gunzip: jest.fn((_data, callback) => callback(null, Buffer.from(JSON.stringify({ test: 'data' })))),
}));

describe('Advanced Cache Manager', () => {
  let redis: jest.Mocked<Redis>;
  let pubClient: jest.Mocked<Redis>;
  let subClient: jest.Mocked<Redis>;
  let cacheManager: CacheManager;
  
  beforeEach(() => {
    // Create mock Redis instances
    redis = new Redis() as jest.Mocked<Redis>;
    pubClient = new Redis() as jest.Mocked<Redis>;
    subClient = new Redis() as jest.Mocked<Redis>;
    
    // Mock Redis methods
    redis.duplicate = jest.fn()
      .mockReturnValueOnce(pubClient)
      .mockReturnValueOnce(subClient);
    
    redis.get = jest.fn().mockResolvedValue(null);
    redis.set = jest.fn().mockResolvedValue('OK');
    redis.setex = jest.fn().mockResolvedValue('OK');
    redis.del = jest.fn().mockResolvedValue(1);
    redis.scan = jest.fn().mockResolvedValue(['0', []]);
    redis.sadd = jest.fn().mockResolvedValue(1);
    redis.smembers = jest.fn().mockResolvedValue([]);
    redis.expire = jest.fn().mockResolvedValue(1);
    redis.keys = jest.fn().mockResolvedValue([]);
    
    pubClient.publish = jest.fn().mockResolvedValue(1);
    subClient.subscribe = jest.fn().mockResolvedValue('OK');
    subClient.on = jest.fn();
    
    // Initialize cache manager
    cacheManager = initializeCacheManager(redis);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    cacheManager.stopAll();
  });
  
  describe('Cache Registration', () => {
    it('should register a cache configuration', () => {
      const config = {
        name: 'test-cache',
        ttl: 3600,
        warmOnStartup: false,
      };
      
      expect(() => cacheManager.registerCache(config)).not.toThrow();
    });
    
    it('should register cache with warming function', () => {
      const config = {
        name: 'test-cache',
        ttl: 3600,
        warmOnStartup: true,
      };
      
      const warmingFunction = jest.fn().mockResolvedValue(new Map());
      
      expect(() => cacheManager.registerCache(config, warmingFunction)).not.toThrow();
    });
    
    it('should register cache with invalidation handler', () => {
      const config = {
        name: 'test-cache',
        ttl: 3600,
        warmOnStartup: false,
      };
      
      const invalidationHandler = jest.fn();
      
      expect(() => cacheManager.registerCache(config, undefined, invalidationHandler)).not.toThrow();
    });
  });
  
  describe('Cache Operations', () => {
    beforeEach(() => {
      cacheManager.registerCache({
        name: 'test-cache',
        ttl: 3600,
        warmOnStartup: false,
        compressionThreshold: 100,
      });
    });
    
    describe('get', () => {
      it('should return null for cache miss', async () => {
        redis.get.mockResolvedValue(null);
        
        const result = await cacheManager.get('test-cache', 'key1');
        
        expect(result).toBeNull();
        expect(redis.get).toHaveBeenCalledWith('cache:test-cache:key1');
      });
      
      it('should return cached value for cache hit', async () => {
        const cachedItem = {
          value: { test: 'data' },
          compressed: false,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          accessCount: 0,
          lastAccessed: new Date(),
        };
        
        redis.get.mockResolvedValue(JSON.stringify(cachedItem));
        
        const result = await cacheManager.get('test-cache', 'key1');
        
        expect(result).toEqual({ test: 'data' });
      });
      
      it('should handle compressed values', async () => {
        const cachedItem = {
          value: 'compressed-base64',
          compressed: true,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          accessCount: 0,
          lastAccessed: new Date(),
        };
        
        redis.get.mockResolvedValue(JSON.stringify(cachedItem));
        
        const result = await cacheManager.get('test-cache', 'key1');
        
        expect(result).toEqual({ test: 'data' });
      });
      
      it('should delete expired items', async () => {
        const cachedItem = {
          value: { test: 'data' },
          compressed: false,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() - 1000), // Expired
          accessCount: 0,
          lastAccessed: new Date(),
        };
        
        redis.get.mockResolvedValue(JSON.stringify(cachedItem));
        
        const result = await cacheManager.get('test-cache', 'key1');
        
        expect(result).toBeNull();
        expect(redis.del).toHaveBeenCalledWith('cache:test-cache:key1');
      });
    });
    
    describe('set', () => {
      it('should set value in cache', async () => {
        await cacheManager.set('test-cache', 'key1', { test: 'data' });
        
        expect(redis.setex).toHaveBeenCalledWith(
          'cache:test-cache:key1',
          3600,
          expect.stringContaining('"value":{"test":"data"}')
        );
      });
      
      it('should compress large values', async () => {
        const largeData = { data: 'x'.repeat(200) };
        
        await cacheManager.set('test-cache', 'key1', largeData);
        
        expect(redis.setex).toHaveBeenCalledWith(
          'cache:test-cache:key1',
          3600,
          expect.stringContaining('"compressed":true')
        );
      });
      
      it('should handle tags', async () => {
        await cacheManager.set('test-cache', 'key1', { test: 'data' }, ['tag1', 'tag2']);
        
        expect(redis.sadd).toHaveBeenCalledWith('cache:tag:tag1', 'cache:test-cache:key1');
        expect(redis.sadd).toHaveBeenCalledWith('cache:tag:tag2', 'cache:test-cache:key1');
      });
    });
    
    describe('delete', () => {
      it('should delete item from cache', async () => {
        await cacheManager.delete('test-cache', 'key1');
        
        expect(redis.del).toHaveBeenCalledWith('cache:test-cache:key1');
      });
    });
  });
  
  describe('Cache Invalidation', () => {
    beforeEach(() => {
      cacheManager.registerCache({
        name: 'test-cache',
        ttl: 3600,
        warmOnStartup: false,
      });
    });
    
    it('should invalidate by pattern', async () => {
      redis.scan.mockResolvedValueOnce(['1', ['cache:test-cache:key1', 'cache:test-cache:key2']])
        .mockResolvedValueOnce(['0', ['cache:test-cache:key3']]);
      
      const count = await cacheManager.invalidate('test');
      
      expect(count).toBe(3);
      expect(redis.del).toHaveBeenCalledWith(
        'cache:test-cache:key1',
        'cache:test-cache:key2',
        'cache:test-cache:key3'
      );
    });
    
    it('should broadcast invalidation to other instances', async () => {
      redis.scan.mockResolvedValue(['0', ['cache:test-cache:key1']]);
      
      await cacheManager.invalidate('test', true);
      
      expect(pubClient.publish).toHaveBeenCalledWith(
        'cache:invalidation',
        expect.stringContaining('"pattern":"test"')
      );
    });
    
    it('should invalidate by tags', async () => {
      redis.smembers.mockResolvedValueOnce(['cache:test-cache:key1', 'cache:test-cache:key2'])
        .mockResolvedValueOnce(['cache:test-cache:key3']);
      
      const count = await cacheManager.invalidateByTags(['tag1', 'tag2']);
      
      expect(count).toBe(3);
      expect(redis.del).toHaveBeenCalledWith(
        'cache:test-cache:key1',
        'cache:test-cache:key2',
        'cache:test-cache:key3'
      );
    });
  });
  
  describe('Cache Warming', () => {
    it('should warm cache on demand', async () => {
      const warmingData = new Map([
        ['key1', { data: 'value1' }],
        ['key2', { data: 'value2' }],
      ]);
      
      const warmingFunction = jest.fn().mockResolvedValue(warmingData);
      
      cacheManager.registerCache(
        {
          name: 'test-cache',
          ttl: 3600,
          warmOnStartup: false,
        },
        warmingFunction
      );
      
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      const result = await cacheManager.warmCache('test-cache');
      
      expect(result.itemsWarmed).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(warmingFunction).toHaveBeenCalled();
    });
    
    it('should prevent concurrent warming with lock', async () => {
      const warmingFunction = jest.fn().mockResolvedValue(new Map());
      
      cacheManager.registerCache(
        {
          name: 'test-cache',
          ttl: 3600,
          warmOnStartup: false,
        },
        warmingFunction
      );
      
      // First call acquires lock
      redis.set.mockImplementationOnce(async (key, value, mode) => {
        if (key.includes('warming:lock:') && mode === 'NX') return 'OK';
        return 'OK';
      });
      
      // Second call fails to acquire lock
      redis.set.mockImplementationOnce(async (key, value, mode) => {
        if (key.includes('warming:lock:') && mode === 'NX') return null;
        return 'OK';
      });
      
      const result1Promise = cacheManager.warmCache('test-cache');
      const result2 = await cacheManager.warmCache('test-cache');
      
      expect(result2.errors).toContain('Warming already in progress');
      expect(result2.itemsWarmed).toBe(0);
    });
    
    it('should warm all caches configured for startup', async () => {
      const warmingFunction1 = jest.fn().mockResolvedValue(new Map([['k1', 'v1']]));
      const warmingFunction2 = jest.fn().mockResolvedValue(new Map([['k2', 'v2']]));
      
      cacheManager.registerCache(
        {
          name: 'cache1',
          ttl: 3600,
          warmOnStartup: true,
        },
        warmingFunction1
      );
      
      cacheManager.registerCache(
        {
          name: 'cache2',
          ttl: 3600,
          warmOnStartup: true,
        },
        warmingFunction2
      );
      
      cacheManager.registerCache({
        name: 'cache3',
        ttl: 3600,
        warmOnStartup: false, // Should not be warmed
      });
      
      redis.set.mockImplementation(async (key, value, mode) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      const results = await cacheManager.warmAllCaches();
      
      expect(results).toHaveLength(2);
      expect(warmingFunction1).toHaveBeenCalled();
      expect(warmingFunction2).toHaveBeenCalled();
    });
  });
  
  describe('Cache Statistics', () => {
    beforeEach(() => {
      cacheManager.registerCache({
        name: 'test-cache',
        ttl: 3600,
        warmOnStartup: false,
      });
    });
    
    it('should track cache hits and misses', async () => {
      // Miss
      redis.get.mockResolvedValueOnce(null);
      await cacheManager.get('test-cache', 'key1');
      
      // Hit
      const cachedItem = {
        value: { test: 'data' },
        compressed: false,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        accessCount: 0,
        lastAccessed: new Date(),
      };
      redis.get.mockResolvedValueOnce(JSON.stringify(cachedItem));
      await cacheManager.get('test-cache', 'key2');
      
      const stats = await cacheManager.getCacheStats('test-cache');
      const cacheStats = stats.get('test-cache');
      
      expect(cacheStats?.hits).toBe(1);
      expect(cacheStats?.misses).toBe(1);
      expect(cacheStats?.hitRate).toBe(0.5);
    });
  });
  
  describe('Cache Clearing', () => {
    beforeEach(() => {
      cacheManager.registerCache({
        name: 'test-cache',
        ttl: 3600,
        warmOnStartup: false,
      });
    });
    
    it('should clear all items from a cache', async () => {
      redis.scan.mockResolvedValue(['0', [
        'cache:test-cache:key1',
        'cache:test-cache:key2',
        'cache:test-cache:key3',
      ]]);
      
      const count = await cacheManager.clearCache('test-cache');
      
      expect(count).toBe(3);
      expect(redis.del).toHaveBeenCalledWith(
        'cache:test-cache:key1',
        'cache:test-cache:key2',
        'cache:test-cache:key3'
      );
    });
  });
  
  describe('Invalidation Listener', () => {
    it('should process invalidation messages from other instances', () => {
      // Get the message handler
      const messageHandler = subClient.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      expect(messageHandler).toBeDefined();
      
      // Mock invalidate method
      const invalidateSpy = jest.spyOn(cacheManager, 'invalidate').mockResolvedValue(0);
      
      // Simulate receiving a message
      messageHandler('cache:invalidation', JSON.stringify({
        pattern: 'test:*',
        timestamp: new Date(),
        source: 'other-instance',
      }));
      
      // Should call invalidate without broadcasting
      expect(invalidateSpy).toHaveBeenCalledWith('test:*', false);
    });
    
    it('should not process own invalidation messages', () => {
      process.env['INSTANCE_ID'] = 'test-instance';
      
      const messageHandler = subClient.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      const invalidateSpy = jest.spyOn(cacheManager, 'invalidate').mockResolvedValue(0);
      
      messageHandler('cache:invalidation', JSON.stringify({
        pattern: 'test:*',
        timestamp: new Date(),
        source: 'test-instance',
      }));
      
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('Event Emission', () => {
    beforeEach(() => {
      cacheManager.registerCache({
        name: 'test-cache',
        ttl: 3600,
        warmOnStartup: false,
      });
    });
    
    it('should emit itemSet event', async () => {
      const listener = jest.fn();
      cacheManager.on('itemSet', listener);
      
      await cacheManager.set('test-cache', 'key1', { test: 'data' });
      
      expect(listener).toHaveBeenCalledWith({
        cache: 'test-cache',
        key: 'key1',
        compressed: false,
      });
    });
    
    it('should emit itemDeleted event', async () => {
      const listener = jest.fn();
      cacheManager.on('itemDeleted', listener);
      
      await cacheManager.delete('test-cache', 'key1');
      
      expect(listener).toHaveBeenCalledWith({
        cache: 'test-cache',
        key: 'key1',
      });
    });
    
    it('should emit invalidated event', async () => {
      const listener = jest.fn();
      cacheManager.on('invalidated', listener);
      
      redis.scan.mockResolvedValue(['0', ['cache:test-cache:key1']]);
      
      await cacheManager.invalidate('test');
      
      expect(listener).toHaveBeenCalledWith({
        pattern: 'test',
        keysDeleted: 1,
      });
    });
    
    it('should emit cacheWarmed event', async () => {
      const listener = jest.fn();
      cacheManager.on('cacheWarmed', listener);
      
      cacheManager.registerCache(
        {
          name: 'warm-cache',
          ttl: 3600,
          warmOnStartup: false,
        },
        async () => new Map([['k1', 'v1']])
      );
      
      redis.set.mockImplementation(async (key, value, mode) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      await cacheManager.warmCache('warm-cache');
      
      expect(listener).toHaveBeenCalledWith({
        cacheName: 'warm-cache',
        itemsWarmed: 1,
        duration: expect.any(Number),
      });
    });
  });
});