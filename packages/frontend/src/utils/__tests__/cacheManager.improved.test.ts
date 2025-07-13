/**
 * Enhanced Cache Manager Tests with Full Type Safety
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { 
  clearProjectImageCache, 
  clearAllCaches, 
  getCacheStats,
  cleanExpiredCache,
  CacheOperationError,
  CACHE_CONFIG
} from '../cacheManager.improved';
import type { CacheStats, CacheOperationResult } from '../types/cache.types';

// Type-safe mocks
const mockUnifiedCacheService = {
  invalidate: vi.fn<[string[]], Promise<void>>()
};

const mockIndexedDBService = {
  deleteProjectImages: vi.fn<[string], Promise<void>>()
};

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};

// Mock dependencies with proper types
vi.mock('@/services/unifiedCacheService', () => ({
  default: mockUnifiedCacheService
}));

vi.mock('@/utils/indexedDBService', () => ({
  deleteProjectImages: mockIndexedDBService.deleteProjectImages
}));

vi.mock('@/utils/logging/unifiedLogger', () => ({
  createLogger: () => mockLogger
}));

// Test factories
function createMockLocalStorageItem(key: string, value: any): void {
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function createExpiredCacheItem(data: any, expiresInMs: number = -1000): string {
  return JSON.stringify({
    data,
    timestamp: Date.now() - 10000,
    version: '1.0.0',
    expiresAt: Date.now() + expiresInMs
  });
}

describe('Enhanced Cache Manager', () => {
  beforeEach(() => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset all mocks with proper types
    vi.clearAllMocks();
    mockUnifiedCacheService.invalidate.mockResolvedValue(undefined);
    mockIndexedDBService.deleteProjectImages.mockResolvedValue(undefined);
  });

  describe('clearProjectImageCache', () => {
    it('should validate and sanitize project ID', async () => {
      const invalidIds = ['', null, undefined, '../../etc/passwd', '<script>alert(1)</script>'];
      
      for (const id of invalidIds) {
        const result = await clearProjectImageCache(id as string);
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(CacheOperationError);
        expect(result.error?.message).toContain('Invalid projectId');
      }
    });

    it('should clear project-specific caches and return operation result', async () => {
      const projectId = 'test-project-123';
      
      // Setup test data
      createMockLocalStorageItem(`spheroseg_images_${projectId}`, ['image1', 'image2']);
      createMockLocalStorageItem(`project-images:${projectId}`, { cached: true });
      createMockLocalStorageItem('unrelated-key', 'should-remain');

      const result = await clearProjectImageCache(projectId);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.stats?.localStorageKeys).toBe(2);
      expect(result.stats?.clearedItems).toBe(3); // 2 localStorage + 1 unifiedCache
      
      // Verify specific keys were removed
      expect(localStorage.getItem(`spheroseg_images_${projectId}`)).toBeNull();
      expect(localStorage.getItem(`project-images:${projectId}`)).toBeNull();
      expect(localStorage.getItem('unrelated-key')).toBe('should-remain');
      
      // Verify service calls with correct types
      expect(mockUnifiedCacheService.invalidate).toHaveBeenCalledWith([`project-${projectId}`, 'images']);
      expect(mockIndexedDBService.deleteProjectImages).toHaveBeenCalledWith(projectId);
    });

    it('should handle partial failures gracefully', async () => {
      const projectId = 'test-project-456';
      
      // Mock unified cache failure
      mockUnifiedCacheService.invalidate.mockRejectedValueOnce(new Error('Cache service error'));
      
      createMockLocalStorageItem(`spheroseg_images_${projectId}`, 'data');

      const result = await clearProjectImageCache(projectId);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CacheOperationError);
      expect(result.error?.operation).toBe('unifiedCache');
      expect(result.stats?.localStorageKeys).toBe(1);
      
      // localStorage should still be cleared
      expect(localStorage.getItem(`spheroseg_images_${projectId}`)).toBeNull();
    });

    it('should handle async iteration for large localStorage', async () => {
      const projectId = 'test-project-789';
      
      // Create many keys to test async iteration
      for (let i = 0; i < 150; i++) {
        if (i < 50) {
          createMockLocalStorageItem(`spheroseg_images_${projectId}_${i}`, 'data');
        } else {
          createMockLocalStorageItem(`other_key_${i}`, 'data');
        }
      }

      const result = await clearProjectImageCache(projectId);

      expect(result.success).toBe(true);
      expect(result.stats?.localStorageKeys).toBe(50);
      
      // Verify only project keys were removed
      for (let i = 0; i < 150; i++) {
        if (i < 50) {
          expect(localStorage.getItem(`spheroseg_images_${projectId}_${i}`)).toBeNull();
        } else {
          expect(localStorage.getItem(`other_key_${i}`)).toBe('data');
        }
      }
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all storage types and return comprehensive stats', async () => {
      // Setup test data
      createMockLocalStorageItem('key1', 'value1');
      createMockLocalStorageItem('key2', 'value2');
      sessionStorage.setItem('session1', 'value1');
      
      // Mock IndexedDB
      const mockDatabases = [
        { name: 'db1', version: 1 },
        { name: 'db2', version: 1 }
      ];
      global.indexedDB.databases = vi.fn().mockResolvedValue(mockDatabases);
      global.indexedDB.deleteDatabase = vi.fn().mockResolvedValue(undefined);

      const result = await clearAllCaches();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        localStorageKeys: 2,
        sessionStorageKeys: 1,
        indexedDBDatabases: ['db1', 'db2'],
        clearedItems: 5
      });
      
      // Verify all storage was cleared
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledWith('db1');
      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledWith('db2');
    });

    it('should handle partial failures and continue operation', async () => {
      createMockLocalStorageItem('key1', 'value1');
      
      // Mock IndexedDB failure
      global.indexedDB.databases = vi.fn().mockRejectedValue(new Error('IndexedDB error'));

      const result = await clearAllCaches();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CacheOperationError);
      expect(result.data?.localStorageKeys).toBe(1);
      expect(localStorage.length).toBe(0); // Should still clear localStorage
    });

    it('should track performance metrics', async () => {
      const result = await clearAllCaches();
      
      // Verify performance logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Successfully cleared all caches in \d+\.\d+ms/),
        expect.any(Object)
      );
    });
  });

  describe('getCacheStats', () => {
    it('should return accurate cache statistics', () => {
      createMockLocalStorageItem('spheroseg_images_123', 'data');
      createMockLocalStorageItem('project-images:456', 'data');
      createMockLocalStorageItem('other-key', 'data');
      sessionStorage.setItem('session-key', 'data');

      const stats = getCacheStats();

      expect(stats).toMatchObject({
        localStorageKeys: 3,
        sessionStorageKeys: 1,
        indexedDBDatabases: [],
        clearedItems: 0
      });
    });
  });

  describe('cleanExpiredCache', () => {
    it('should remove expired cache items', async () => {
      const projectId = 'test-project';
      
      // Create expired and valid items
      createMockLocalStorageItem(
        `spheroseg_images_${projectId}_expired`,
        createExpiredCacheItem({ data: 'old' }, -1000)
      );
      createMockLocalStorageItem(
        `spheroseg_images_${projectId}_valid`,
        createExpiredCacheItem({ data: 'new' }, 10000)
      );
      createMockLocalStorageItem('spheroseg_invalid_json', 'not-json');

      const result = await cleanExpiredCache();

      expect(result.success).toBe(true);
      expect(result.stats?.clearedItems).toBe(2); // expired + invalid
      expect(localStorage.getItem(`spheroseg_images_${projectId}_expired`)).toBeNull();
      expect(localStorage.getItem('spheroseg_invalid_json')).toBeNull();
      expect(localStorage.getItem(`spheroseg_images_${projectId}_valid`)).not.toBeNull();
    });
  });

  describe('Retry Logic', () => {
    it('should retry operations on failure', async () => {
      const projectId = 'test-retry';
      let attempts = 0;
      
      // Fail twice, then succeed
      mockUnifiedCacheService.invalidate.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
      });

      const result = await clearProjectImageCache(projectId);

      expect(result.success).toBe(true);
      expect(mockUnifiedCacheService.invalidate).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retry attempts', async () => {
      const projectId = 'test-retry-fail';
      
      // Always fail
      mockUnifiedCacheService.invalidate.mockRejectedValue(new Error('Permanent failure'));

      const result = await clearProjectImageCache(projectId);

      expect(result.success).toBe(false);
      expect(mockUnifiedCacheService.invalidate).toHaveBeenCalledTimes(CACHE_CONFIG.retryAttempts);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent cache operations safely', async () => {
      const projectIds = Array.from({ length: 10 }, (_, i) => `project-${i}`);
      
      // Create data for each project
      projectIds.forEach(id => {
        createMockLocalStorageItem(`spheroseg_images_${id}`, 'data');
      });

      // Clear all projects concurrently
      const results = await Promise.all(
        projectIds.map(id => clearProjectImageCache(id))
      );

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(localStorage.getItem(`spheroseg_images_project-${index}`)).toBeNull();
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should clear large cache within acceptable time', async () => {
      // Create large cache
      for (let i = 0; i < 1000; i++) {
        createMockLocalStorageItem(`test-key-${i}`, 'x'.repeat(100));
      }
      
      const start = performance.now();
      const result = await clearAllCaches();
      const duration = performance.now() - start;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.data?.localStorageKeys).toBe(1000);
    });
  });

  describe('Development Mode Utilities', () => {
    it('should expose type-safe utilities on window in dev mode', () => {
      // In test environment, window.cacheManager should be defined
      expect(window.cacheManager).toBeDefined();
      expect(window.cacheManager?.version).toBe(CACHE_CONFIG.version);
      
      // Verify functions are properly typed
      expect(typeof window.cacheManager?.clearProjectImageCache).toBe('function');
      expect(typeof window.cacheManager?.clearAllCaches).toBe('function');
      expect(typeof window.cacheManager?.getCacheStats).toBe('function');
    });
  });
});