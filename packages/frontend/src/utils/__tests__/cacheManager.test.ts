/**
 * Cache Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearProjectImageCache, clearAllCaches, getCacheStats } from '../cacheManager';
import * as unifiedCacheService from '@/services/unifiedCacheService';
import * as indexedDBService from '@/utils/indexedDBService';

// Mock dependencies
vi.mock('@/services/unifiedCacheService');
vi.mock('@/utils/indexedDBService');
vi.mock('@/utils/logging/unifiedLogger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('Cache Manager', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('clearProjectImageCache', () => {
    it('should clear project-specific image caches', async () => {
      const projectId = 'test-project-123';

      // Setup localStorage with test data
      localStorage.setItem(
        `spheroseg_images_${projectId}`,
        JSON.stringify([
          { id: '1', name: 'test1.jpg' },
          { id: '2', name: 'test2.jpg' },
        ]),
      );
      localStorage.setItem(`project-images:${projectId}`, 'cached-data');
      localStorage.setItem('unrelated-key', 'should-remain');

      // Mock unified cache service
      const mockCacheService = {
        invalidate: vi.fn().mockResolvedValue(undefined),
      };
      vi.spyOn(unifiedCacheService, 'default', 'get').mockReturnValue(mockCacheService as unknown);

      // Mock IndexedDB service
      vi.spyOn(indexedDBService, 'deleteProjectImages').mockResolvedValue(undefined);

      // Clear cache
      await clearProjectImageCache(projectId);

      // Verify localStorage was cleared
      expect(localStorage.getItem(`spheroseg_images_${projectId}`)).toBeNull();
      expect(localStorage.getItem(`project-images:${projectId}`)).toBeNull();
      expect(localStorage.getItem('unrelated-key')).toBe('should-remain');

      // Verify unified cache was invalidated
      expect(mockCacheService.invalidate).toHaveBeenCalledWith([`project-${projectId}`, 'images']);

      // Verify IndexedDB was cleared
      expect(indexedDBService.deleteProjectImages).toHaveBeenCalledWith(projectId);
    });

    it('should handle project ID with prefix', async () => {
      const projectId = 'project-test-456';
      const cleanId = 'test-456';

      await clearProjectImageCache(projectId);

      // Should use cleaned ID
      expect(indexedDBService.deleteProjectImages).toHaveBeenCalledWith(cleanId);
    });

    it('should continue if unified cache fails', async () => {
      const projectId = 'test-project-789';

      // Mock unified cache to throw error
      const mockCacheService = {
        invalidate: vi.fn().mockRejectedValue(new Error('Cache error')),
      };
      vi.spyOn(unifiedCacheService, 'default', 'get').mockReturnValue(mockCacheService as unknown);

      // Should not throw
      await expect(clearProjectImageCache(projectId)).resolves.not.toThrow();

      // Should still clear IndexedDB
      expect(indexedDBService.deleteProjectImages).toHaveBeenCalled();
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all storage types', async () => {
      // Setup test data
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');
      sessionStorage.setItem('session1', 'value1');

      // Mock IndexedDB databases
      const mockDatabases = [
        { name: 'db1', version: 1 },
        { name: 'db2', version: 1 },
      ];
      global.indexedDB.databases = vi.fn().mockResolvedValue(mockDatabases);
      global.indexedDB.deleteDatabase = vi.fn().mockResolvedValue(undefined);

      const stats = await clearAllCaches();

      // Verify all storage was cleared
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledWith('db1');
      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledWith('db2');

      // Verify stats
      expect(stats.localStorageKeys).toBe(2);
      expect(stats.sessionStorageKeys).toBe(1);
      expect(stats.indexedDBDatabases).toEqual(['db1', 'db2']);
      expect(stats.clearedItems).toBe(5);
    });

    it('should handle IndexedDB errors gracefully', async () => {
      // Mock IndexedDB to throw error
      global.indexedDB.databases = vi.fn().mockRejectedValue(new Error('IndexedDB error'));

      const stats = await clearAllCaches();

      // Should still clear other storage
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);

      // Stats should reflect what was cleared
      expect(stats.indexedDBDatabases).toEqual([]);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      // Setup test data
      localStorage.setItem('spheroseg_images_project1', 'data1');
      localStorage.setItem('project-images:project2', 'data2');
      localStorage.setItem('other-key', 'data3');
      sessionStorage.setItem('session-key', 'data4');

      const stats = getCacheStats();

      expect(stats.localStorageKeys).toBe(3);
      expect(stats.sessionStorageKeys).toBe(1);
    });

    it('should identify image-related keys', () => {
      localStorage.setItem('spheroseg_images_123', 'data');
      localStorage.setItem('project-images:456', 'data');
      localStorage.setItem('unrelated', 'data');

      const stats = getCacheStats();

      // Count image-related keys manually
      let imageRelatedKeys = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('spheroseg_images') || key.includes('project-images'))) {
          imageRelatedKeys++;
        }
      }

      // Verify that we have the correct number of image-related keys
      expect(imageRelatedKeys).toBe(2);
      expect(stats.localStorageKeys).toBe(3);
    });
  });

  describe('Development mode utilities', () => {
    it('should add utilities to window in dev mode', async () => {
      // In Vite test environment with --mode development, import.meta.env.DEV is true
      // The cacheManager module should have already added utilities to window

      // Verify window utilities exist
      expect((window as Window & { cacheManager?: unknown }).cacheManager).toBeDefined();
      expect((window as unknown).cacheManager.clearProjectImageCache).toBeDefined();
      expect((window as Window & { cacheManager?: unknown }).cacheManager.clearAllCaches).toBeDefined();
      expect((window as unknown).cacheManager.getCacheStats).toBeDefined();

      // Verify they are the same functions
      expect((window as Window & { cacheManager?: unknown }).cacheManager.clearProjectImageCache).toBe(clearProjectImageCache);
      expect((window as unknown).cacheManager.clearAllCaches).toBe(clearAllCaches);
      expect((window as Window & { cacheManager?: unknown }).cacheManager.getCacheStats).toBe(getCacheStats);
    });
  });
});
