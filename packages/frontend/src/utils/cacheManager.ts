/**
 * Cache Manager Utility
 * 
 * Provides utilities for managing and clearing various caches
 * to resolve image visibility and data synchronization issues
 */

import { createLogger } from '@/utils/logging/unifiedLogger';

const logger = createLogger('CacheManager');

export interface CacheStats {
  localStorageKeys: number;
  sessionStorageKeys: number;
  indexedDBDatabases: string[];
  clearedItems: number;
}

/**
 * Clear all image-related caches for a specific project
 */
export async function clearProjectImageCache(projectId: string): Promise<void> {
  const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;
  
  logger.info(`Clearing image cache for project: ${cleanProjectId}`);
  
  // Clear localStorage entries
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes(`spheroseg_images_${cleanProjectId}`) ||
      key.includes(`spheroseg_uploaded_images_${cleanProjectId}`) ||
      key.includes(`project-images:${cleanProjectId}`)
    )) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    logger.debug(`Removed localStorage key: ${key}`);
  });
  
  // Clear from unified cache service
  try {
    const { default: cacheService } = await import('@/services/unifiedCacheService');
    await cacheService.invalidate([`project-${cleanProjectId}`, 'images']);
    logger.debug('Cleared unified cache service entries');
  } catch (error) {
    logger.error('Failed to clear unified cache:', error);
  }
  
  // Clear IndexedDB image data
  try {
    const { deleteProjectImages } = await import('@/utils/indexedDBService');
    await deleteProjectImages(cleanProjectId);
    logger.debug('Cleared IndexedDB image data');
  } catch (error) {
    logger.error('Failed to clear IndexedDB:', error);
  }
  
  logger.info(`Cache cleared for project ${cleanProjectId}. Removed ${keysToRemove.length} localStorage keys`);
}

/**
 * Clear all application caches
 */
export async function clearAllCaches(): Promise<CacheStats> {
  logger.info('Clearing all application caches');
  
  const stats: CacheStats = {
    localStorageKeys: 0,
    sessionStorageKeys: 0,
    indexedDBDatabases: [],
    clearedItems: 0
  };
  
  // Clear localStorage
  const localStorageKeys = Object.keys(localStorage);
  stats.localStorageKeys = localStorageKeys.length;
  localStorage.clear();
  
  // Clear sessionStorage
  const sessionStorageKeys = Object.keys(sessionStorage);
  stats.sessionStorageKeys = sessionStorageKeys.length;
  sessionStorage.clear();
  
  // Clear IndexedDB
  try {
    const databases = await indexedDB.databases();
    stats.indexedDBDatabases = databases.map(db => db.name || 'unnamed');
    
    for (const db of databases) {
      if (db.name) {
        await indexedDB.deleteDatabase(db.name);
        logger.debug(`Deleted IndexedDB database: ${db.name}`);
      }
    }
  } catch (error) {
    logger.error('Failed to clear IndexedDB databases:', error);
  }
  
  stats.clearedItems = stats.localStorageKeys + stats.sessionStorageKeys + stats.indexedDBDatabases.length;
  
  logger.info('All caches cleared', stats);
  return stats;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const stats: CacheStats = {
    localStorageKeys: localStorage.length,
    sessionStorageKeys: sessionStorage.length,
    indexedDBDatabases: [],
    clearedItems: 0
  };
  
  // Get localStorage keys related to images
  const imageKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('spheroseg_images') || key.includes('project-images'))) {
      imageKeys.push(key);
    }
  }
  
  logger.debug('Cache statistics', {
    ...stats,
    imageRelatedKeys: imageKeys.length,
    sampleKeys: imageKeys.slice(0, 5)
  });
  
  return stats;
}

/**
 * Add cache management to window for debugging
 */
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).cacheManager = {
    clearProjectImageCache,
    clearAllCaches,
    getCacheStats
  };
  
  logger.info('Cache manager utilities available in window.cacheManager (dev mode only)');
}

export default {
  clearProjectImageCache,
  clearAllCaches,
  getCacheStats
};