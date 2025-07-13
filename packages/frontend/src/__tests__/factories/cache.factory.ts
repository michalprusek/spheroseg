/**
 * Cache Test Factory
 * 
 * Provides factory functions for creating test data
 */

import type { CachedItem, CacheStats } from '@/utils/types/cache.types';

export function createMockCacheEntry<T = any>(overrides: Partial<CachedItem<T>> = {}): CachedItem<T> {
  return {
    data: {} as T,
    timestamp: Date.now(),
    version: '1.0.0',
    expiresAt: Date.now() + 3600000, // 1 hour
    ...overrides
  };
}

export function createMockCacheStats(overrides: Partial<CacheStats> = {}): CacheStats {
  return {
    localStorageKeys: 0,
    sessionStorageKeys: 0,
    indexedDBDatabases: [],
    clearedItems: 0,
    ...overrides
  };
}

export function createExpiredCacheEntry<T = any>(
  data: T,
  expiredMs: number = 1000
): CachedItem<T> {
  return {
    data,
    timestamp: Date.now() - expiredMs - 1000,
    version: '1.0.0',
    expiresAt: Date.now() - expiredMs
  };
}

export function createProjectCacheKeys(projectId: string, count: number = 5): string[] {
  return Array.from({ length: count }, (_, i) => 
    `spheroseg_images_${projectId}_${i}`
  );
}

export function setupMockLocalStorage(entries: Record<string, any>): void {
  localStorage.clear();
  Object.entries(entries).forEach(([key, value]) => {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
}