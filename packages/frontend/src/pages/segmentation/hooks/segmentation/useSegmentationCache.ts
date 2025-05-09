import { useState, useEffect } from 'react';
import { SegmentationData } from './types';

// Type for the cache
interface SegmentationCache {
  [key: string]: {
    data: SegmentationData;
    timestamp: number;
  };
}

/**
 * Hook for caching segmentation data
 * This provides a simple in-memory cache for segmentation data
 * to avoid unnecessary API calls when switching between images
 */
export const useSegmentationCache = () => {
  // Initialize cache
  const [cache, setCache] = useState<SegmentationCache>({});
  
  // Function to get segmentation data from cache
  const getFromCache = (imageId: string): SegmentationData | null => {
    const cachedItem = cache[imageId];
    
    if (!cachedItem) {
      console.log(`[useSegmentationCache] Cache miss for imageId=${imageId}`);
      return null;
    }
    
    // Check if cache is still valid (10 minutes)
    const now = Date.now();
    const cacheAge = now - cachedItem.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    if (cacheAge > maxAge) {
      console.log(`[useSegmentationCache] Cache expired for imageId=${imageId}, age=${cacheAge}ms`);
      return null;
    }
    
    console.log(`[useSegmentationCache] Cache hit for imageId=${imageId}, age=${cacheAge}ms`);
    return cachedItem.data;
  };
  
  // Function to add segmentation data to cache
  const addToCache = (imageId: string, data: SegmentationData): void => {
    console.log(`[useSegmentationCache] Adding to cache: imageId=${imageId}`);
    
    setCache(prevCache => ({
      ...prevCache,
      [imageId]: {
        data,
        timestamp: Date.now()
      }
    }));
  };
  
  // Function to clear cache
  const clearCache = (): void => {
    console.log('[useSegmentationCache] Clearing cache');
    setCache({});
  };
  
  // Function to remove item from cache
  const removeFromCache = (imageId: string): void => {
    console.log(`[useSegmentationCache] Removing from cache: imageId=${imageId}`);
    
    setCache(prevCache => {
      const newCache = { ...prevCache };
      delete newCache[imageId];
      return newCache;
    });
  };
  
  // Function to get cache stats
  const getCacheStats = (): { size: number; keys: string[] } => {
    const keys = Object.keys(cache);
    return {
      size: keys.length,
      keys
    };
  };
  
  // Clean up expired cache items every 5 minutes
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes
      
      setCache(prevCache => {
        const newCache = { ...prevCache };
        let removedCount = 0;
        
        Object.entries(newCache).forEach(([key, value]) => {
          if (now - value.timestamp > maxAge) {
            delete newCache[key];
            removedCount++;
          }
        });
        
        if (removedCount > 0) {
          console.log(`[useSegmentationCache] Cleaned up ${removedCount} expired cache items`);
        }
        
        return newCache;
      });
    }, 5 * 60 * 1000); // Run every 5 minutes
    
    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);
  
  return {
    getFromCache,
    addToCache,
    clearCache,
    removeFromCache,
    getCacheStats
  };
};
