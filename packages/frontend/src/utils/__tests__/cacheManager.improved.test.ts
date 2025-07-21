/**
 * Enhanced Cache Manager Tests with Full Type Safety
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies with proper types
vi.mock('@/utils/logging/unifiedLogger', () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
  return {
    createLogger: () => mockLogger,
  };
});

vi.mock('@/services/unifiedCacheService', () => ({
  default: {
    invalidate: vi.fn(),
  },
}));

vi.mock('@/utils/indexedDBService', () => ({
  deleteProjectImages: vi.fn(),
}));

import {
  clearProjectImageCache,
  clearAllCaches,
  getCacheStats,
  cleanExpiredCache,
  CacheOperationError,
  CACHE_CONFIG,
} from '../cacheManager.improved';
import unifiedCacheService from '@/services/unifiedCacheService';
import { deleteProjectImages } from '@/utils/indexedDBService';
import { createLogger } from '@/utils/logging/unifiedLogger';

// Get mocked instances
const mockLogger = createLogger('test');
const mockUnifiedCacheService = vi.mocked(unifiedCacheService);
const mockIndexedDBService = { deleteProjectImages: vi.mocked(deleteProjectImages) };

// Test factories
function createMockLocalStorageItem(key: string, value: any): void {
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function createExpiredCacheItem(data: any, expiresInMs: number = -1000): string {
  return JSON.stringify({
    data,
    timestamp: Date.now() - 10000,
    version: '1.0.0',
    expiresAt: Date.now() + expiresInMs,
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
      // Test empty string
      const emptyResult = await clearProjectImageCache('');
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toBeInstanceOf(CacheOperationError);
      expect(emptyResult.error?.message).toContain('Invalid projectId');

      // Test path traversal attempt - should succeed after sanitization to 'etcpasswd'
      const pathResult = await clearProjectImageCache('../../etc/passwd');
      expect(pathResult.success).toBe(true); // Sanitized to 'etcpasswd', which is valid
      expect(pathResult.stats?.localStorageKeys).toBe(0); // No keys to remove

      // Test script injection attempt - sanitizes to 'scriptalert1script' which is valid
      const scriptResult = await clearProjectImageCache('<script>alert(1)</script>');
      expect(scriptResult.success).toBe(true); // Sanitized to valid ID
      expect(scriptResult.stats?.localStorageKeys).toBe(0); // No keys to remove
      
      // Test all special characters - should fail because it sanitizes to empty string  
      const specialResult = await clearProjectImageCache('!@#$%^&*()');
      expect(specialResult.success).toBe(false);
      expect(specialResult.error).toBeInstanceOf(CacheOperationError);
      expect(specialResult.error?.message).toContain('Invalid projectId after sanitization');
      
      // Test null and undefined separately as they might not be string
      const nullResult = await clearProjectImageCache(null as any);
      expect(nullResult.success).toBe(false);
      expect(nullResult.error).toBeInstanceOf(CacheOperationError);
      
      const undefinedResult = await clearProjectImageCache(undefined as any);
      expect(undefinedResult.success).toBe(false);
      expect(undefinedResult.error).toBeInstanceOf(CacheOperationError);
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
      expect(result.stats?.clearedItems).toBe(4); // 2 localStorage + 1 unifiedCache + 1 indexedDB

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

      // Mock unified cache failure after retries
      mockUnifiedCacheService.invalidate.mockRejectedValue(new Error('Cache service error'));

      createMockLocalStorageItem(`spheroseg_images_${projectId}`, 'data');

      const result = await clearProjectImageCache(projectId);

      expect(result.success).toBe(false); // Implementation returns false when any operation fails
      expect(result.error).toBeInstanceOf(CacheOperationError);
      expect(result.error?.message).toContain('Failed to clear unified cache');
      expect(result.stats?.localStorageKeys).toBe(1);
      expect(result.stats?.clearedItems).toBe(2); // 1 localStorage + 1 indexedDB

      // localStorage should still be cleared
      expect(localStorage.getItem(`spheroseg_images_${projectId}`)).toBeNull();
      
      // Verify retry was attempted
      expect(mockUnifiedCacheService.invalidate).toHaveBeenCalledTimes(3); // 3 retries
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
        { name: 'db2', version: 1 },
      ];
      Object.defineProperty(global.indexedDB, 'databases', {
        value: vi.fn().mockResolvedValue(mockDatabases),
        writable: true,
        configurable: true
      });
      Object.defineProperty(global.indexedDB, 'deleteDatabase', {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true
      });

      const result = await clearAllCaches();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        localStorageKeys: 2,
        sessionStorageKeys: 1,
        indexedDBDatabases: ['db1', 'db2'],
        clearedItems: 5,
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
      Object.defineProperty(global.indexedDB, 'databases', {
        value: vi.fn().mockRejectedValue(new Error('IndexedDB error')),
        writable: true,
        configurable: true
      });

      const result = await clearAllCaches();

      expect(result.success).toBe(false); // Implementation returns false when any operation fails
      expect(result.error).toBeInstanceOf(CacheOperationError);
      expect(result.error?.message).toContain('Failed to enumerate IndexedDB databases');
      expect(result.data?.localStorageKeys).toBe(1);
      expect(localStorage.length).toBe(0); // Should still clear localStorage
    });

    it('should track performance metrics', async () => {
      // Create some test data to clear
      createMockLocalStorageItem('test-key', 'value');
      
      // Mock IndexedDB to succeed
      Object.defineProperty(global.indexedDB, 'databases', {
        value: vi.fn().mockResolvedValue([]),
        writable: true,
        configurable: true
      });
      
      // Clear all mocks before the test
      vi.mocked(mockLogger.info).mockClear();
      
      const result = await clearAllCaches();

      // Verify the result is successful
      expect(result.success).toBe(true);
      
      // Verify performance logging - the logger should have been called with the performance message
      expect(mockLogger.info).toHaveBeenCalled();
      const infoLogs = vi.mocked(mockLogger.info).mock.calls;
      const hasPerformanceLog = infoLogs.some(
        (call) => {
          const [message] = call;
          return typeof message === 'string' && 
                 (message.includes('cleared all caches in') || 
                  message.includes('Successfully cleared all caches'));
        }
      );
      expect(hasPerformanceLog).toBe(true);
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
        clearedItems: 0,
      });
    });
  });

  describe('cleanExpiredCache', () => {
    it('should remove expired cache items', async () => {
      const projectId = 'test-project';

      // Create expired and valid items
      createMockLocalStorageItem(
        `spheroseg_images_${projectId}_expired`,
        createExpiredCacheItem({ data: 'old' }, -1000),
      );
      createMockLocalStorageItem(`spheroseg_images_${projectId}_valid`, createExpiredCacheItem({ data: 'new' }, 10000));
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
      const projectIds = Array.from({ length: 10 }, (_, i) => `project${i}`);

      // Create data for each project
      projectIds.forEach((id) => {
        createMockLocalStorageItem(`spheroseg_images_${id}`, 'data');
      });

      // Clear all projects concurrently
      const results = await Promise.all(projectIds.map((id) => clearProjectImageCache(id)));

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Ensure all localStorage items were cleared
      projectIds.forEach((id) => {
        expect(localStorage.getItem(`spheroseg_images_${id}`)).toBeNull();
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should clear large cache within acceptable time', async () => {
      // Create large cache
      for (let i = 0; i < 1000; i++) {
        createMockLocalStorageItem(`test-key-${i}`, 'x'.repeat(100));
      }

      // Mock IndexedDB to succeed
      Object.defineProperty(global.indexedDB, 'databases', {
        value: vi.fn().mockResolvedValue([]),
        writable: true,
        configurable: true
      });

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
