/**
 * Cache Service Test Suite
 * 
 * This suite tests the critical Redis cache functionality including
 * basic operations, TTL management, pattern operations, statistics tracking,
 * error handling, and performance features.
 */

// Mock dependencies BEFORE imports
jest.mock('../../utils/logger', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    http: jest.fn(),
    silly: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockLogger,
    createLogger: jest.fn().mockReturnValue(mockLogger),
  };
});

jest.mock('../../config/redis', () => ({
  getRedis: jest.fn(),
  isRedisAvailable: jest.fn(),
}));

import { cacheService, CACHE_PREFIXES, CACHE_TTL } from '../cacheService';
import { getRedis, isRedisAvailable } from '../../config/redis';

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
  mget: jest.fn(),
  pipeline: jest.fn(() => ({
    setex: jest.fn(),
    set: jest.fn(),
    exec: jest.fn(),
  })),
  incr: jest.fn(),
  incrby: jest.fn(),
  decr: jest.fn(),
  decrby: jest.fn(),
  flushdb: jest.fn(),
  keys: jest.fn(),
  info: jest.fn(),
  dbsize: jest.fn(),
  ping: jest.fn(),
};

// Mock Redis configuration
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;
const mockIsRedisAvailable = isRedisAvailable as jest.MockedFunction<typeof isRedisAvailable>;

// Get the mocked logger
import logger from '../../utils/logger';
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Cache Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default setup - Redis is available
    mockGetRedis.mockReturnValue(mockRedis as any);
    mockIsRedisAvailable.mockResolvedValue(true);
    
    // Reset cache stats
    cacheService.resetStats();
  });

  describe('Basic Operations', () => {
    describe('get', () => {
      it('should return parsed JSON value when key exists', async () => {
        const testData = { id: '1', name: 'test' };
        mockRedis.get.mockResolvedValue(JSON.stringify(testData));

        const result = await cacheService.get('test:key');

        expect(result).toEqual(testData);
        expect(mockRedis.get).toHaveBeenCalledWith('test:key');
      });

      it('should return string value when not JSON', async () => {
        mockRedis.get.mockResolvedValue('simple-string');

        const result = await cacheService.get('test:key');

        expect(result).toBe('simple-string');
      });

      it('should return null when key does not exist', async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await cacheService.get('test:key');

        expect(result).toBeNull();
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

        const result = await cacheService.get('test:key');

        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache get error',
          expect.objectContaining({
            key: 'test:key',
            error: expect.any(Error),
          })
        );
      });

      it('should return null when Redis is unavailable', async () => {
        mockGetRedis.mockReturnValue(null);

        const result = await cacheService.get('test:key');

        expect(result).toBeNull();
      });

      it('should track cache statistics', async () => {
        // Cache hit
        mockRedis.get.mockResolvedValueOnce('{"value": "hit"}');
        await cacheService.get('test:hit');

        // Cache miss
        mockRedis.get.mockResolvedValueOnce(null);
        await cacheService.get('test:miss');

        const stats = cacheService.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
      });
    });

    describe('set', () => {
      it('should set string value without TTL', async () => {
        mockRedis.set.mockResolvedValue('OK');

        const result = await cacheService.set('test:key', 'test-value');

        expect(result).toBe(true);
        expect(mockRedis.set).toHaveBeenCalledWith('test:key', 'test-value');
      });

      it('should set JSON value with TTL', async () => {
        const testData = { id: '1', name: 'test' };
        mockRedis.setex.mockResolvedValue('OK');

        const result = await cacheService.set('test:key', testData, 300);

        expect(result).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'test:key',
          300,
          JSON.stringify(testData)
        );
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

        const result = await cacheService.set('test:key', 'value');

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache set error',
          expect.objectContaining({
            key: 'test:key',
            error: expect.any(Error),
          })
        );
      });

      it('should return false when Redis is unavailable', async () => {
        mockGetRedis.mockReturnValue(null);

        const result = await cacheService.set('test:key', 'value');

        expect(result).toBe(false);
      });
    });

    describe('delete', () => {
      it('should delete existing key', async () => {
        mockRedis.del.mockResolvedValue(1);

        const result = await cacheService.delete('test:key');

        expect(result).toBe(true);
        expect(mockRedis.del).toHaveBeenCalledWith('test:key');
      });

      it('should return false when key does not exist', async () => {
        mockRedis.del.mockResolvedValue(0);

        const result = await cacheService.delete('test:key');

        expect(result).toBe(false);
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));

        const result = await cacheService.delete('test:key');

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache delete error',
          expect.objectContaining({
            key: 'test:key',
            error: expect.any(Error),
          })
        );
      });
    });
  });

  describe('Advanced Operations', () => {
    describe('exists', () => {
      it('should return true when key exists', async () => {
        mockRedis.exists.mockResolvedValue(1);

        const result = await cacheService.exists('test:key');

        expect(result).toBe(true);
        expect(mockRedis.exists).toHaveBeenCalledWith('test:key');
      });

      it('should return false when key does not exist', async () => {
        mockRedis.exists.mockResolvedValue(0);

        const result = await cacheService.exists('test:key');

        expect(result).toBe(false);
      });
    });

    describe('ttl', () => {
      it('should return remaining TTL for key', async () => {
        mockRedis.ttl.mockResolvedValue(300);

        const result = await cacheService.ttl('test:key');

        expect(result).toBe(300);
        expect(mockRedis.ttl).toHaveBeenCalledWith('test:key');
      });

      it('should return -1 when Redis is unavailable', async () => {
        mockGetRedis.mockReturnValue(null);

        const result = await cacheService.ttl('test:key');

        expect(result).toBe(-1);
      });
    });

    describe('expire', () => {
      it('should set expiration on existing key', async () => {
        mockRedis.expire.mockResolvedValue(1);

        const result = await cacheService.expire('test:key', 600);

        expect(result).toBe(true);
        expect(mockRedis.expire).toHaveBeenCalledWith('test:key', 600);
      });

      it('should return false when key does not exist', async () => {
        mockRedis.expire.mockResolvedValue(0);

        const result = await cacheService.expire('test:key', 600);

        expect(result).toBe(false);
      });
    });

    describe('deletePattern', () => {
      it('should delete keys matching pattern', async () => {
        mockRedis.keys.mockResolvedValue(['test:1', 'test:2', 'test:3']);
        mockRedis.del.mockResolvedValue(3);

        const result = await cacheService.deletePattern('test:*');

        expect(result).toBe(3);
        expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
        expect(mockRedis.del).toHaveBeenCalledWith('test:1', 'test:2', 'test:3');
      });

      it('should return 0 when no keys match pattern', async () => {
        mockRedis.keys.mockResolvedValue([]);

        const result = await cacheService.deletePattern('test:*');

        expect(result).toBe(0);
        expect(mockRedis.del).not.toHaveBeenCalled();
      });

      it('should track evictions in statistics', async () => {
        mockRedis.keys.mockResolvedValue(['test:1', 'test:2']);
        mockRedis.del.mockResolvedValue(2);

        await cacheService.deletePattern('test:*');

        const stats = cacheService.getStats();
        expect(stats.evictions).toBe(2);
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('mget', () => {
      it('should get multiple values by keys', async () => {
        const values = ['{"id": "1"}', null, 'simple-string'];
        mockRedis.mget.mockResolvedValue(values);

        const result = await cacheService.mget(['key1', 'key2', 'key3']);

        expect(result).toEqual([{ id: '1' }, null, 'simple-string']);
        expect(mockRedis.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
      });

      it('should return array of nulls when Redis is unavailable', async () => {
        mockGetRedis.mockReturnValue(null);

        const result = await cacheService.mget(['key1', 'key2']);

        expect(result).toEqual([null, null]);
      });

      it('should track cache statistics for bulk operations', async () => {
        mockRedis.mget.mockResolvedValue(['value1', null, 'value3']);

        await cacheService.mget(['key1', 'key2', 'key3']);

        const stats = cacheService.getStats();
        expect(stats.hits).toBe(2); // key1 and key3
        expect(stats.misses).toBe(1); // key2
      });
    });

    describe('mset', () => {
      it('should set multiple key-value pairs', async () => {
        const mockPipeline = {
          setex: jest.fn(),
          set: jest.fn(),
          exec: jest.fn().mockResolvedValue([]),
        };
        mockRedis.pipeline.mockReturnValue(mockPipeline);

        const items = [
          { key: 'key1', value: 'value1', ttl: 300 },
          { key: 'key2', value: { data: 'test' } },
        ];

        const result = await cacheService.mset(items);

        expect(result).toBe(true);
        expect(mockPipeline.setex).toHaveBeenCalledWith('key1', 300, 'value1');
        expect(mockPipeline.set).toHaveBeenCalledWith('key2', '{"data":"test"}');
        expect(mockPipeline.exec).toHaveBeenCalled();
      });

      it('should return false when no items provided', async () => {
        const result = await cacheService.mset([]);

        expect(result).toBe(false);
      });
    });
  });

  describe('Counter Operations', () => {
    describe('incr', () => {
      it('should increment counter by 1', async () => {
        mockRedis.incr.mockResolvedValue(5);

        const result = await cacheService.incr('counter:key');

        expect(result).toBe(5);
        expect(mockRedis.incr).toHaveBeenCalledWith('counter:key');
      });

      it('should increment counter by specified amount', async () => {
        mockRedis.incrby.mockResolvedValue(10);

        const result = await cacheService.incr('counter:key', 5);

        expect(result).toBe(10);
        expect(mockRedis.incrby).toHaveBeenCalledWith('counter:key', 5);
      });
    });

    describe('decr', () => {
      it('should decrement counter by 1', async () => {
        mockRedis.decr.mockResolvedValue(3);

        const result = await cacheService.decr('counter:key');

        expect(result).toBe(3);
        expect(mockRedis.decr).toHaveBeenCalledWith('counter:key');
      });

      it('should decrement counter by specified amount', async () => {
        mockRedis.decrby.mockResolvedValue(0);

        const result = await cacheService.decr('counter:key', 3);

        expect(result).toBe(0);
        expect(mockRedis.decrby).toHaveBeenCalledWith('counter:key', 3);
      });
    });
  });

  describe('Utility Methods', () => {
    describe('generateKey', () => {
      it('should generate cache key with prefix', () => {
        const key = cacheService.generateKey(CACHE_PREFIXES.USER, '123', 'profile');

        expect(key).toBe('user:123:profile');
      });

      it('should handle numbers in key parts', () => {
        const key = cacheService.generateKey(CACHE_PREFIXES.PROJECT, 456, 'stats');

        expect(key).toBe('project:456:stats');
      });
    });

    describe('hashObject', () => {
      it('should generate consistent hash for same object', () => {
        const obj = { userId: '123', type: 'stats', date: '2024-01-01' };

        const hash1 = cacheService.hashObject(obj);
        const hash2 = cacheService.hashObject(obj);

        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[a-f0-9]{8}$/);
      });

      it('should generate different hashes for different objects', () => {
        const obj1 = { userId: '123', type: 'stats' };
        const obj2 = { userId: '124', type: 'stats' };

        const hash1 = cacheService.hashObject(obj1);
        const hash2 = cacheService.hashObject(obj2);

        expect(hash1).not.toBe(hash2);
      });
    });

    describe('cached', () => {
      it('should return cached value when available', async () => {
        const cachedValue = { data: 'cached' };
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

        const fn = jest.fn().mockResolvedValue({ data: 'fresh' });
        const result = await cacheService.cached('test:key', fn, 300);

        expect(result).toEqual(cachedValue);
        expect(fn).not.toHaveBeenCalled();
      });

      it('should execute function and cache result when not cached', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.setex.mockResolvedValue('OK');

        const freshValue = { data: 'fresh' };
        const fn = jest.fn().mockResolvedValue(freshValue);

        const result = await cacheService.cached('test:key', fn, 300);

        expect(result).toEqual(freshValue);
        expect(fn).toHaveBeenCalled();
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'test:key',
          300,
          JSON.stringify(freshValue)
        );
      });
    });
  });

  describe('Invalidation Methods', () => {
    describe('invalidateRelated', () => {
      it('should invalidate user-related cache entries', async () => {
        mockRedis.keys.mockImplementation((pattern) => {
          if (pattern.includes('user:stats:')) return ['user:stats:123'];
          if (pattern.includes('user:profile:')) return ['user:profile:123'];
          if (pattern.includes('project_list:')) return ['project_list:123:page:1'];
          return [];
        });
        mockRedis.del.mockResolvedValue(1);

        await cacheService.invalidateRelated('user', '123');

        expect(mockRedis.keys).toHaveBeenCalledTimes(3);
        expect(mockRedis.del).toHaveBeenCalledTimes(3);
      });

      it('should invalidate project-related cache entries', async () => {
        mockRedis.keys.mockImplementation((pattern) => {
          if (pattern.includes('project:')) return ['project:456'];
          if (pattern.includes('project_list:')) return ['project_list:user:123'];
          if (pattern.includes('image_list:')) return ['image_list:456:page:1'];
          if (pattern.includes('project_stats:')) return ['project_stats:456'];
          return [];
        });
        mockRedis.del.mockResolvedValue(1);

        await cacheService.invalidateRelated('project', '456');

        expect(mockRedis.keys).toHaveBeenCalledTimes(4);
        expect(mockRedis.del).toHaveBeenCalledTimes(4);
      });

      it('should invalidate image-related cache entries', async () => {
        mockRedis.keys.mockImplementation((pattern) => {
          if (pattern.includes('image:')) return ['image:789'];
          if (pattern.includes('image_list:')) return ['image_list:project:456'];
          if (pattern.includes('seg_result:')) return ['seg_result:789'];
          return [];
        });
        mockRedis.del.mockResolvedValue(1);

        await cacheService.invalidateRelated('image', '789');

        expect(mockRedis.keys).toHaveBeenCalledTimes(3);
        expect(mockRedis.del).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Health and Monitoring', () => {
    describe('isAvailable', () => {
      it('should return true when Redis is available', async () => {
        mockIsRedisAvailable.mockResolvedValue(true);

        const result = await cacheService.isAvailable();

        expect(result).toBe(true);
      });

      it('should return false when Redis is unavailable', async () => {
        mockIsRedisAvailable.mockResolvedValue(false);

        const result = await cacheService.isAvailable();

        expect(result).toBe(false);
      });
    });

    describe('ping', () => {
      it('should return true when Redis responds to ping', async () => {
        mockRedis.ping.mockResolvedValue('PONG');

        const result = await cacheService.ping();

        expect(result).toBe(true);
        expect(mockRedis.ping).toHaveBeenCalled();
      });

      it('should return false when Redis ping fails', async () => {
        mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

        const result = await cacheService.ping();

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Redis ping failed',
          expect.objectContaining({ error: expect.any(Error) })
        );
      });
    });

    describe('getExtendedStats', () => {
      it('should return extended stats when Redis is available', async () => {
        const mockInfo = 'keyspace_hits:100\r\nkeyspace_misses:20\r\nevicted_keys:5\r\nexpired_keys:10';
        mockRedis.info.mockResolvedValue(mockInfo);
        mockRedis.dbsize.mockResolvedValue(50);

        const stats = await cacheService.getExtendedStats();

        expect(stats).toEqual({
          available: true,
          dbSize: 50,
          redis: {
            hits: 100,
            misses: 20,
            hitRate: 83.33333333333334, // 100/(100+20) * 100
            evictedKeys: 5,
            expiredKeys: 10,
          },
          local: expect.any(Object),
          timestamp: expect.any(String),
        });
      });

      it('should return unavailable stats when Redis is not available', async () => {
        mockGetRedis.mockReturnValue(null);

        const stats = await cacheService.getExtendedStats();

        expect(stats).toEqual({
          available: false,
          local: expect.any(Object),
        });
      });
    });
  });

  describe('Specific Cache Methods', () => {
    describe('Project Cache', () => {
      it('should cache and retrieve project data', async () => {
        const projectData = { id: '123', name: 'Test Project' };
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.get.mockResolvedValue(JSON.stringify(projectData));

        await cacheService.cacheProject('123', projectData as any);
        const result = await cacheService.getCachedProject('123');

        expect(mockRedis.setex).toHaveBeenCalledWith(
          'project:123',
          CACHE_TTL.PROJECT,
          JSON.stringify(projectData)
        );
        expect(result).toEqual(projectData);
      });
    });

    describe('User Cache', () => {
      it('should cache and retrieve user data', async () => {
        const userData = { id: '456', email: 'test@example.com' };
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.get.mockResolvedValue(JSON.stringify(userData));

        await cacheService.cacheUser('456', userData as any);
        const result = await cacheService.getCachedUser('456');

        expect(mockRedis.setex).toHaveBeenCalledWith(
          'user:456',
          CACHE_TTL.USER,
          JSON.stringify(userData)
        );
        expect(result).toEqual(userData);
      });
    });

    describe('Image List Cache', () => {
      it('should cache and retrieve image list', async () => {
        const images = [{ id: '1' }, { id: '2' }];
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.get.mockResolvedValue(JSON.stringify(images));

        await cacheService.cacheImageList('project123', 1, 20, images as any);
        const result = await cacheService.getCachedImageList('project123', 1, 20);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          'image_list:project123:1:20',
          CACHE_TTL.IMAGE_LIST,
          JSON.stringify(images)
        );
        expect(result).toEqual(images);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis unavailability gracefully', async () => {
      mockGetRedis.mockReturnValue(null);

      const getResult = await cacheService.get('test');
      const setResult = await cacheService.set('test', 'value');
      const deleteResult = await cacheService.delete('test');
      const existsResult = await cacheService.exists('test');

      expect(getResult).toBeNull();
      expect(setResult).toBe(false);
      expect(deleteResult).toBe(false);
      expect(existsResult).toBe(false);
    });

    it('should track errors in statistics', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      await cacheService.get('test');
      await cacheService.set('test', 'value');

      const stats = cacheService.getStats();
      expect(stats.errors).toBe(2);
    });

    it('should continue operation when individual Redis operations fail', async () => {
      // First operation fails, second succeeds
      mockRedis.get
        .mockRejectedValueOnce(new Error('Redis error'))
        .mockResolvedValueOnce('success');

      const result1 = await cacheService.get('test1');
      const result2 = await cacheService.get('test2');

      expect(result1).toBeNull();
      expect(result2).toBe('success');
    });
  });

  describe('Statistics Management', () => {
    it('should track all types of statistics', async () => {
      // Generate hits, misses, errors, and evictions
      mockRedis.get.mockResolvedValueOnce('hit').mockResolvedValueOnce(null);
      mockRedis.get.mockRejectedValueOnce(new Error('error'));
      mockRedis.keys.mockResolvedValueOnce(['key1', 'key2']);
      mockRedis.del.mockResolvedValueOnce(2);

      await cacheService.get('hit');
      await cacheService.get('miss');
      await cacheService.get('error');
      await cacheService.deletePattern('test:*');

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.errors).toBe(1);
      expect(stats.evictions).toBe(2);
    });

    it('should reset statistics', () => {
      // Generate some stats first
      cacheService['stats'].hits = 5;
      cacheService['stats'].misses = 3;
      cacheService['stats'].errors = 1;

      cacheService.resetStats();

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  describe('Cache Administration', () => {
    describe('flushAll', () => {
      it('should flush all cache data', async () => {
        mockRedis.flushdb.mockResolvedValue('OK');

        await cacheService.flushAll();

        expect(mockRedis.flushdb).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith('Cache flushed!');
      });

      it('should handle flush errors gracefully', async () => {
        mockRedis.flushdb.mockRejectedValue(new Error('Flush failed'));

        await cacheService.flushAll();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache flush error',
          expect.objectContaining({ error: expect.any(Error) })
        );
      });
    });
  });
});