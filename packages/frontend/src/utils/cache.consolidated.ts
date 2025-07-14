/**
 * Consolidated Cache Manager for SpheroSeg Application
 * 
 * Combines the best features from both cache manager implementations:
 * - LRU cache for memory management
 * - Type safety with proper interfaces
 * - Performance monitoring
 * - Retry logic
 * - Error handling
 * - Multiple storage backend support
 */

import { createLogger } from '@/utils/logging/unifiedLogger';
import { LRUCache } from './lruCache';

const logger = createLogger('CacheManager');

// Types
export interface CacheStats {
  localStorageKeys: number;
  sessionStorageKeys: number;
  indexedDBDatabases: string[];
  clearedItems: number;
  memoryUsage?: {
    usedMB: number;
    limitMB: number;
    percentage: number;
  };
}

export interface CacheConfig {
  version: string;
  maxSizeBytes: number;
  expirationMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface CachedItem<T = any> {
  data: T;
  timestamp: number;
  version: string;
  size?: number;
}

export interface CacheOperationResult {
  success: boolean;
  itemsCleared?: number;
  errors?: Error[];
  duration?: number;
}

// Cache configuration
const CACHE_CONFIG: CacheConfig = {
  version: '1.0.0',
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  expirationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  retryAttempts: 3,
  retryDelayMs: 100
};

// Custom error class
export class CacheOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CacheOperationError';
  }
}

// Memory cache with LRU eviction
const memoryCache = new LRUCache<string, CachedItem>(100);

/**
 * Validate and sanitize project ID
 */
function validateProjectId(projectId: string): string {
  if (!projectId || typeof projectId !== 'string') {
    throw new CacheOperationError('Invalid projectId', 'validation');
  }
  
  // Sanitize projectId to prevent injection attacks
  const sanitizedId = projectId.replace(/[^a-zA-Z0-9-_]/g, '');
  
  if (sanitizedId.length === 0) {
    throw new CacheOperationError('Invalid projectId after sanitization', 'validation');
  }
  
  // Remove 'project-' prefix if present
  return sanitizedId.startsWith('project-') ? sanitizedId.substring(8) : sanitizedId;
}

/**
 * Get item from cache with fallback to multiple storage backends
 */
export async function getCachedItem<T>(key: string): Promise<T | null> {
  const startTime = performance.now();
  
  try {
    // Check memory cache first
    const memoryItem = memoryCache.get(key);
    if (memoryItem && !isExpired(memoryItem)) {
      logger.debug(`Memory cache hit for key: ${key}`);
      return memoryItem.data;
    }

    // Check localStorage
    const localItem = localStorage.getItem(key);
    if (localItem) {
      try {
        const parsed: CachedItem<T> = JSON.parse(localItem);
        if (!isExpired(parsed)) {
          // Update memory cache
          memoryCache.set(key, parsed);
          logger.debug(`LocalStorage cache hit for key: ${key}`);
          return parsed.data;
        }
      } catch (error) {
        logger.warn(`Failed to parse localStorage item: ${key}`, error);
      }
    }

    // Check IndexedDB
    const idbItem = await getFromIndexedDB<T>(key);
    if (idbItem && !isExpired(idbItem)) {
      // Update higher-level caches
      memoryCache.set(key, idbItem);
      setCachedItem(key, idbItem.data, { skipIDB: true });
      logger.debug(`IndexedDB cache hit for key: ${key}`);
      return idbItem.data;
    }

    return null;
  } catch (error) {
    logger.error(`Error getting cached item: ${key}`, error);
    return null;
  } finally {
    const duration = performance.now() - startTime;
    if (duration > 100) {
      logger.warn(`Slow cache read: ${key} took ${duration}ms`);
    }
  }
}

/**
 * Set item in cache with multiple storage backends
 */
export async function setCachedItem<T>(
  key: string, 
  data: T, 
  options: { 
    expirationMs?: number; 
    skipIDB?: boolean;
    skipMemory?: boolean;
  } = {}
): Promise<void> {
  const cachedItem: CachedItem<T> = {
    data,
    timestamp: Date.now(),
    version: CACHE_CONFIG.version,
    size: estimateSize(data)
  };

  // Update memory cache
  if (!options.skipMemory) {
    memoryCache.set(key, cachedItem);
  }

  // Update localStorage with size check
  try {
    const serialized = JSON.stringify(cachedItem);
    if (serialized.length < 1024 * 1024) { // 1MB limit for localStorage items
      localStorage.setItem(key, serialized);
    }
  } catch (error) {
    logger.warn(`Failed to save to localStorage: ${key}`, error);
  }

  // Update IndexedDB for larger items
  if (!options.skipIDB && cachedItem.size && cachedItem.size > 1024) {
    await saveToIndexedDB(key, cachedItem);
  }
}

/**
 * Clear all image-related caches for a specific project
 */
export async function clearProjectImageCache(projectId: string): Promise<CacheOperationResult> {
  const startTime = performance.now();
  const cleanProjectId = validateProjectId(projectId);
  
  logger.info(`Clearing image cache for project: ${cleanProjectId}`);
  
  const result: CacheOperationResult = {
    success: true,
    itemsCleared: 0,
    errors: []
  };
  
  try {
    // Clear localStorage entries
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes(`spheroseg_images_${cleanProjectId}`) ||
        key.includes(`spheroseg_uploaded_images_${cleanProjectId}`) ||
        key.includes(`project-images:${cleanProjectId}`) ||
        key.includes(`image_status_${cleanProjectId}`)
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        result.itemsCleared!++;
        logger.debug(`Removed localStorage key: ${key}`);
      } catch (error) {
        result.errors!.push(error as Error);
      }
    });
    
    // Clear memory cache entries
    const memoryCacheKeys = memoryCache.getKeysByUsage();
    memoryCacheKeys.forEach(key => {
      if (key.includes(cleanProjectId)) {
        memoryCache.delete(key);
        result.itemsCleared!++;
      }
    });
    
    // Clear from unified cache service
    try {
      const { default: cacheService } = await import('@/services/unifiedCacheService');
      await cacheService.invalidate([`project-${cleanProjectId}`, 'images']);
      logger.debug('Cleared unified cache service entries');
    } catch (error) {
      logger.warn('Failed to clear unified cache service', error);
      result.errors!.push(error as Error);
    }
    
    // Clear IndexedDB entries
    try {
      await clearIndexedDBForProject(cleanProjectId);
      logger.debug('Cleared IndexedDB entries');
    } catch (error) {
      logger.warn('Failed to clear IndexedDB', error);
      result.errors!.push(error as Error);
    }
    
    // Dispatch cache cleared event
    window.dispatchEvent(new CustomEvent('cache-cleared', {
      detail: { projectId: cleanProjectId }
    }));
    
  } catch (error) {
    logger.error('Error clearing project image cache', error);
    result.success = false;
    result.errors!.push(error as Error);
  } finally {
    result.duration = performance.now() - startTime;
    logger.info(`Cache clear completed in ${result.duration}ms`, result);
  }
  
  return result;
}

/**
 * Clear cache for specific image
 */
export function cleanImageFromAllStorages(imageId: string): void {
  const keysToRemove: string[] = [];
  
  // Clear from localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(imageId)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    logger.debug(`Removed localStorage key for image ${imageId}: ${key}`);
  });
  
  // Clear from sessionStorage
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.includes(imageId)) {
      sessionStorage.removeItem(key);
      logger.debug(`Removed sessionStorage key for image ${imageId}: ${key}`);
    }
  }
  
  // Clear from memory cache
  const memoryCacheKeys = memoryCache.getKeysByUsage();
  memoryCacheKeys.forEach(key => {
    if (key.includes(imageId)) {
      memoryCache.delete(key);
    }
  });
  
  // Dispatch event for other components
  window.dispatchEvent(new CustomEvent('image-cache-cleared', {
    detail: { imageId }
  }));
}

/**
 * Get comprehensive cache statistics
 */
export async function getCacheStatistics(): Promise<CacheStats> {
  const stats: CacheStats = {
    localStorageKeys: 0,
    sessionStorageKeys: 0,
    indexedDBDatabases: [],
    clearedItems: 0
  };
  
  // Count localStorage keys
  stats.localStorageKeys = localStorage.length;
  
  // Count sessionStorage keys
  stats.sessionStorageKeys = sessionStorage.length;
  
  // Get IndexedDB databases
  if ('databases' in indexedDB) {
    try {
      const databases = await indexedDB.databases();
      stats.indexedDBDatabases = databases.map(db => db.name || 'unnamed');
    } catch (error) {
      logger.warn('Failed to list IndexedDB databases', error);
    }
  }
  
  // Get memory usage if available
  if (performance.memory) {
    stats.memoryUsage = {
      usedMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
      percentage: Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100)
    };
  }
  
  return stats;
}

/**
 * Clear all caches (nuclear option)
 */
export async function clearAllCaches(): Promise<CacheOperationResult> {
  const result: CacheOperationResult = {
    success: true,
    itemsCleared: 0,
    errors: []
  };
  
  try {
    // Clear localStorage
    const localStorageCount = localStorage.length;
    localStorage.clear();
    result.itemsCleared! += localStorageCount;
    
    // Clear sessionStorage
    const sessionStorageCount = sessionStorage.length;
    sessionStorage.clear();
    result.itemsCleared! += sessionStorageCount;
    
    // Clear memory cache
    const memoryCacheSize = memoryCache.size;
    memoryCache.clear();
    result.itemsCleared! += memoryCacheSize;
    
    // Clear IndexedDB
    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          await deleteDatabase(db.name);
          result.itemsCleared!++;
        }
      }
    }
    
    logger.info('All caches cleared successfully', result);
  } catch (error) {
    logger.error('Error clearing all caches', error);
    result.success = false;
    result.errors!.push(error as Error);
  }
  
  return result;
}

// Helper functions

function isExpired(item: CachedItem): boolean {
  const age = Date.now() - item.timestamp;
  return age > CACHE_CONFIG.expirationMs;
}

function estimateSize(data: any): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

async function getFromIndexedDB<T>(key: string): Promise<CachedItem<T> | null> {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(['cache'], 'readonly');
    const store = tx.objectStore('cache');
    const result = await promisifyRequest<CachedItem<T>>(store.get(key));
    db.close();
    return result;
  } catch (error) {
    logger.error('IndexedDB read error', error);
    return null;
  }
}

async function saveToIndexedDB<T>(key: string, item: CachedItem<T>): Promise<void> {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(['cache'], 'readwrite');
    const store = tx.objectStore('cache');
    await promisifyRequest(store.put(item, key));
    db.close();
  } catch (error) {
    logger.error('IndexedDB write error', error);
  }
}

async function clearIndexedDBForProject(projectId: string): Promise<void> {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(['cache'], 'readwrite');
    const store = tx.objectStore('cache');
    const keys = await promisifyRequest<string[]>(store.getAllKeys());
    
    for (const key of keys) {
      if (key.includes(projectId)) {
        await promisifyRequest(store.delete(key));
      }
    }
    
    db.close();
  } catch (error) {
    logger.error('IndexedDB clear error', error);
  }
}

async function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('spheroseg-cache', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
    };
  });
}

async function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Export all utilities
export default {
  getCachedItem,
  setCachedItem,
  clearProjectImageCache,
  cleanImageFromAllStorages,
  getCacheStatistics,
  clearAllCaches,
  validateProjectId,
  CacheOperationError,
  CACHE_CONFIG
};