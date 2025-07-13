/**
 * Enhanced Cache Manager for SpheroSeg Application
 * 
 * Provides robust utilities to manage various caches with proper error handling,
 * performance monitoring, retry logic, and type safety.
 */

import { createLogger } from '@/utils/logging/unifiedLogger';
import type { 
  CacheStats, 
  CacheOperationResult, 
  CacheConfig,
  CachedItem 
} from './types/cache.types';

const logger = createLogger('CacheManager');

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
  
  return sanitizedId;
}

/**
 * Clear all image-related cache for a specific project with proper error handling
 */
export async function clearProjectImageCache(projectId: string): Promise<CacheOperationResult> {
  const errors: Error[] = [];
  const stats: Partial<CacheStats> = {
    localStorageKeys: 0,
    clearedItems: 0
  };
  
  const startTime = performance.now();
  
  try {
    const sanitizedId = validateProjectId(projectId);
    const cleanProjectId = sanitizedId.startsWith('project-') ? 
      sanitizedId.substring(8) : sanitizedId;
    
    logger.info(`Clearing image cache for project: ${cleanProjectId}`);
    
    // Clear localStorage entries with async iteration
    const keysToRemove = await getProjectCacheKeys(cleanProjectId);
    
    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
        stats.localStorageKeys = (stats.localStorageKeys || 0) + 1;
        stats.clearedItems = (stats.clearedItems || 0) + 1;
        logger.debug(`Removed localStorage key: ${key}`);
      } catch (error) {
        errors.push(new CacheOperationError(
          `Failed to remove key: ${key}`,
          'localStorage',
          error as Error
        ));
      }
    }
    
    // Clear unified cache service entries with retry
    try {
      await retryOperation(async () => {
        const { default: cacheService } = await import('@/services/unifiedCacheService');
        await cacheService.invalidate([`project-${cleanProjectId}`, 'images']);
      });
      logger.debug('Cleared unified cache service entries');
      stats.clearedItems = (stats.clearedItems || 0) + 1;
    } catch (error) {
      errors.push(new CacheOperationError(
        'Failed to clear unified cache',
        'unifiedCache',
        error as Error
      ));
    }
    
    // Clear IndexedDB entries
    try {
      const { deleteProjectImages } = await import('@/utils/indexedDBService');
      await deleteProjectImages(cleanProjectId);
      logger.debug('Cleared IndexedDB entries');
      stats.clearedItems = (stats.clearedItems || 0) + 1;
    } catch (error) {
      errors.push(new CacheOperationError(
        'Failed to clear IndexedDB',
        'indexedDB',
        error as Error
      ));
    }
    
    const duration = performance.now() - startTime;
    const success = errors.length === 0;
    
    if (success) {
      logger.info(`Successfully cleared image cache for project: ${cleanProjectId} in ${duration.toFixed(2)}ms`);
    } else {
      logger.warn(`Partially cleared cache for project: ${cleanProjectId} in ${duration.toFixed(2)}ms`, { errors });
    }
    
    return {
      success,
      error: errors.length > 0 ? errors[0] : undefined,
      stats
    };
  } catch (error) {
    logger.error('Error clearing project image cache:', error);
    return {
      success: false,
      error: error as Error
    };
  }
}

/**
 * Get all cache keys for a project with async iteration
 */
async function getProjectCacheKeys(projectId: string): Promise<string[]> {
  const keys: string[] = [];
  const totalKeys = localStorage.length;
  
  for (let i = 0; i < totalKeys; i++) {
    // Yield to UI thread periodically
    if (i % 100 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    const key = localStorage.key(i);
    if (key && shouldRemoveKey(key, projectId)) {
      keys.push(key);
    }
  }
  
  return keys;
}

/**
 * Check if a key should be removed for a project
 */
function shouldRemoveKey(key: string, projectId: string): boolean {
  return key.includes(`spheroseg_images_${projectId}`) ||
         key.includes(`spheroseg_uploaded_images_${projectId}`) ||
         key.includes(`project-images:${projectId}`);
}

/**
 * Clear all caches in the application with comprehensive error handling
 */
export async function clearAllCaches(): Promise<CacheOperationResult<CacheStats>> {
  logger.info('Clearing all application caches');
  const errors: Error[] = [];
  const stats: CacheStats = {
    localStorageKeys: 0,
    sessionStorageKeys: 0,
    indexedDBDatabases: [],
    clearedItems: 0
  };
  
  const startTime = performance.now();
  
  try {
    // Check storage quota before clearing
    await checkStorageQuota();
    
    // Clear localStorage with size tracking
    const localStorageSize = await estimateStorageSize('localStorage');
    stats.localStorageKeys = localStorage.length;
    
    try {
      localStorage.clear();
      stats.clearedItems += stats.localStorageKeys;
      logger.debug(`Cleared ${stats.localStorageKeys} localStorage keys (${formatBytes(localStorageSize)})`);
    } catch (error) {
      errors.push(new CacheOperationError(
        'Failed to clear localStorage',
        'localStorage',
        error as Error
      ));
    }
    
    // Clear sessionStorage
    stats.sessionStorageKeys = sessionStorage.length;
    
    try {
      sessionStorage.clear();
      stats.clearedItems += stats.sessionStorageKeys;
      logger.debug(`Cleared ${stats.sessionStorageKeys} sessionStorage keys`);
    } catch (error) {
      errors.push(new CacheOperationError(
        'Failed to clear sessionStorage',
        'sessionStorage',
        error as Error
      ));
    }
    
    // Clear all IndexedDB databases
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            try {
              await indexedDB.deleteDatabase(db.name);
              stats.indexedDBDatabases.push(db.name);
              stats.clearedItems++;
              logger.debug(`Deleted IndexedDB database: ${db.name}`);
            } catch (dbError) {
              errors.push(new CacheOperationError(
                `Failed to delete database: ${db.name}`,
                'indexedDB',
                dbError as Error
              ));
            }
          }
        }
      } catch (error) {
        errors.push(new CacheOperationError(
          'Failed to enumerate IndexedDB databases',
          'indexedDB',
          error as Error
        ));
      }
    }
    
    const duration = performance.now() - startTime;
    const success = errors.length === 0;
    
    if (success) {
      logger.info(`Successfully cleared all caches in ${duration.toFixed(2)}ms`, stats);
    } else {
      logger.warn(`Partially cleared caches in ${duration.toFixed(2)}ms`, { stats, errors });
    }
    
    return {
      success,
      data: stats,
      error: errors.length > 0 ? errors[0] : undefined,
      stats
    };
  } catch (error) {
    logger.error('Error clearing all caches:', error);
    return {
      success: false,
      data: stats,
      error: error as Error,
      stats
    };
  }
}

/**
 * Get current cache statistics with performance metrics
 */
export function getCacheStats(): CacheStats {
  const stats: CacheStats = {
    localStorageKeys: localStorage.length,
    sessionStorageKeys: sessionStorage.length,
    indexedDBDatabases: [],
    clearedItems: 0
  };
  
  // Count image-related keys
  let imageRelatedKeys = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('spheroseg_images') || key.includes('project-images'))) {
      imageRelatedKeys++;
    }
  }
  
  logger.debug('Cache statistics', { 
    ...stats, 
    imageRelatedKeys,
    storageEstimate: navigator.storage?.estimate ? 'available' : 'unavailable'
  });
  
  return stats;
}

/**
 * Retry an operation with exponential backoff
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  attempts: number = CACHE_CONFIG.retryAttempts || 3
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < attempts - 1) {
        const delay = (CACHE_CONFIG.retryDelayMs || 100) * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        logger.debug(`Retrying operation after ${delay}ms (attempt ${i + 1}/${attempts})`);
      }
    }
  }
  
  throw lastError;
}

/**
 * Check storage quota and log warning if near limit
 */
async function checkStorageQuota(): Promise<void> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage && estimate.quota) {
        const percentUsed = (estimate.usage / estimate.quota) * 100;
        if (percentUsed > 80) {
          logger.warn(`Storage quota is ${percentUsed.toFixed(1)}% full`);
        }
      }
    } catch (error) {
      logger.debug('Failed to check storage quota', error);
    }
  }
}

/**
 * Estimate storage size for a storage type
 */
async function estimateStorageSize(type: 'localStorage' | 'sessionStorage'): Promise<number> {
  const storage = type === 'localStorage' ? localStorage : sessionStorage;
  let totalSize = 0;
  
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key) {
      const value = storage.getItem(key) || '';
      totalSize += key.length + value.length;
    }
  }
  
  return totalSize * 2; // Approximate UTF-16 encoding
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Clean expired cache items based on configuration
 */
export async function cleanExpiredCache(): Promise<CacheOperationResult> {
  const errors: Error[] = [];
  let cleanedItems = 0;
  
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    // Check localStorage for expired items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('spheroseg_')) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const item = JSON.parse(value) as CachedItem<unknown>;
            if (item.expiresAt && item.expiresAt < now) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          // Invalid JSON, remove it
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove expired items
    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
        cleanedItems++;
      } catch (error) {
        errors.push(new CacheOperationError(
          `Failed to remove expired key: ${key}`,
          'cleanup',
          error as Error
        ));
      }
    }
    
    const success = errors.length === 0;
    logger.info(`Cleaned ${cleanedItems} expired cache items`);
    
    return {
      success,
      error: errors.length > 0 ? errors[0] : undefined,
      stats: { clearedItems: cleanedItems }
    };
  } catch (error) {
    logger.error('Error cleaning expired cache:', error);
    return {
      success: false,
      error: error as Error
    };
  }
}

// Add utilities to window object in development mode with proper typing
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  // Use type-safe window extension
  window.cacheManager = {
    clearProjectImageCache,
    clearAllCaches,
    getCacheStats,
    version: CACHE_CONFIG.version
  };
  logger.info('Cache manager utilities available in window.cacheManager (dev mode only)');
}

// Export configuration for testing
export { CACHE_CONFIG };