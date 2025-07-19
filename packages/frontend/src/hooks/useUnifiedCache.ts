/**
 * Unified Cache Hook
 *
 * This hook provides a simple interface for cache functionality with React Query integration.
 */

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import cacheService, { CacheOptions, CacheLayer, CacheStats } from '@/services/unifiedCacheService';
import { createLogger } from '@/utils/logging/unifiedLogger';
import apiClient from '@/lib/apiClient';

const logger = createLogger('useUnifiedCache');

// ===========================
// Types and Interfaces
// ===========================

export interface UseCacheOptions<T = unknown> extends CacheOptions {
  key: string | string[];
  fetcher?: () => Promise<T>;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
  retry?: boolean | number;
  retryDelay?: number | ((attemptIndex: number) => number);
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseCacheReturn<T = unknown> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<unknown>;
  invalidate: () => Promise<void>;
  prefetch: () => Promise<void>;
  remove: () => Promise<void>;
  update: (data: T) => Promise<void>;
}

// ===========================
// Main Hook
// ===========================

export function useUnifiedCache<T = unknown>(options: UseCacheOptions<T>): UseCacheReturn<T> {
  const {
    key,
    fetcher,
    ttl,
    layer = [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
    compress,
    encrypt,
    priority,
    tags,
    staleTime = 5 * 60 * 1000, // 5 minutes
    gcTime = 10 * 60 * 1000, // 10 minutes
    enabled = true,
    refetchOnMount = false,
    refetchOnWindowFocus = false,
    refetchInterval,
    retry = 3,
    retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onSuccess,
    onError,
  } = options;

  const queryClient = useQueryClient();
  const cacheKey = Array.isArray(key) ? key : [key];
  const cacheKeyStr = cacheKey.join(':');

  // Query function that integrates with cache service
  const queryFn = useCallback(async () => {
    // Try to get from cache first
    const cached = await cacheService.get<T>(cacheKeyStr, { layer });
    if (cached !== null) {
      logger.debug(`Cache hit for ${cacheKeyStr}`);
      return cached;
    }

    // If no fetcher, return null
    if (!fetcher) {
      logger.debug(`No fetcher provided for ${cacheKeyStr}`);
      return null;
    }

    // Fetch fresh data
    logger.debug(`Cache miss for ${cacheKeyStr}, fetching...`);
    const data = await fetcher();

    // Store in cache
    await cacheService.set(cacheKeyStr, data, {
      ttl,
      layer,
      compress,
      encrypt,
      priority,
      tags,
    });

    return data;
  }, [cacheKeyStr, fetcher, ttl, layer, compress, encrypt, priority, tags]);

  // React Query configuration
  const queryOptions: UseQueryOptions<T, Error> = {
    queryKey: cacheKey,
    queryFn,
    staleTime,
    gcTime,
    enabled,
    refetchOnMount,
    refetchOnWindowFocus,
    refetchInterval,
    retry,
    retryDelay,
    onSuccess,
    onError,
  };

  // Use React Query
  const query = useQuery(queryOptions);

  // Invalidate cache
  const invalidate = useCallback(async () => {
    // Remove from unified cache
    await cacheService.delete(cacheKeyStr, layer);

    // Invalidate React Query
    await queryClient.invalidateQueries({ queryKey: cacheKey });

    logger.debug(`Invalidated cache for ${cacheKeyStr}`);
  }, [cacheKeyStr, layer, queryClient, cacheKey]);

  // Prefetch data
  const prefetch = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: cacheKey,
      queryFn,
      staleTime,
    });
  }, [queryClient, cacheKey, queryFn, staleTime]);

  // Remove from cache
  const remove = useCallback(async () => {
    // Remove from unified cache
    await cacheService.delete(cacheKeyStr, layer);

    // Remove from React Query
    queryClient.removeQueries({ queryKey: cacheKey });

    logger.debug(`Removed cache for ${cacheKeyStr}`);
  }, [cacheKeyStr, layer, queryClient, cacheKey]);

  // Update cache
  const update = useCallback(
    async (data: T) => {
      // Update unified cache
      await cacheService.set(cacheKeyStr, data, {
        ttl,
        layer,
        compress,
        encrypt,
        priority,
        tags,
      });

      // Update React Query
      queryClient.setQueryData(cacheKey, data);

      logger.debug(`Updated cache for ${cacheKeyStr}`);
    },
    [cacheKeyStr, ttl, layer, compress, encrypt, priority, tags, queryClient, cacheKey],
  );

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    invalidate,
    prefetch,
    remove,
    update,
  };
}

// ===========================
// Specialized Hooks
// ===========================

/**
 * Hook for caching API responses
 */
export function useApiCache<T = unknown>(endpoint: string, options?: Partial<UseCacheOptions<T>>) {
  return useUnifiedCache<T>({
    key: ['api', endpoint],
    fetcher: async () => {
      try {
        const response = await apiClient.get<T>(endpoint);

        // Add diagnostic logging for user statistics endpoint
        // if (endpoint.includes('user-stats') || endpoint.includes('statistics')) {
        //   logger.info(`API Response for ${endpoint}:`, {
        //     status: response.status,
        //     data: response.data,
        //     headers: response.headers,
        //   });
        // }

        return response.data;
      } catch (error: unknown) {
        logger.error(`API error for ${endpoint}:`, error);
        const errorMessage =
          error &&
          typeof error === 'object' &&
          'response' in error &&
          error.response &&
          typeof error.response === 'object' &&
          'data' in error.response &&
          error.response.data &&
          typeof error.response.data === 'object' &&
          'message' in error.response.data &&
          typeof error.response.data.message === 'string'
            ? error.response.data.message
            : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
              ? error.message
              : 'API request failed';
        throw new Error(errorMessage);
      }
    },
    ttl: 5 * 60 * 1000, // 5 minutes
    layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
    ...options,
  });
}

/**
 * Hook for caching user data
 */
export function useUserCache<T = unknown>(
  userId: string,
  fetcher: () => Promise<T>,
  options?: Partial<UseCacheOptions<T>>,
) {
  return useUnifiedCache<T>({
    key: ['user', userId],
    fetcher,
    ttl: 10 * 60 * 1000, // 10 minutes
    layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
    tags: ['user-data'],
    ...options,
  });
}

/**
 * Hook for caching project data
 */
export function useProjectCache<T = unknown>(
  projectId: string,
  fetcher: () => Promise<T>,
  options?: Partial<UseCacheOptions<T>>,
) {
  return useUnifiedCache<T>({
    key: ['project', projectId],
    fetcher,
    ttl: 5 * 60 * 1000, // 5 minutes
    layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
    tags: ['project-data'],
    ...options,
  });
}

/**
 * Hook for caching image data
 */
export function useImageCache(imageId: string, imageUrl: string, options?: Partial<UseCacheOptions<Blob>>) {
  return useUnifiedCache<Blob>({
    key: ['image', imageId],
    fetcher: async () => {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      return response.blob();
    },
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    layer: [CacheLayer.INDEXED_DB], // Large data goes to IndexedDB
    compress: true,
    tags: ['image-data'],
    ...options,
  });
}

// ===========================
// Cache Management Hooks
// ===========================

/**
 * Hook for cache statistics
 */
export function useCacheStats() {
  const [stats, setStats] = useState<CacheStats>(cacheService.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(cacheService.getStats());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return stats;
}

/**
 * Hook for cache management
 */
export function useCacheManager() {
  const queryClient = useQueryClient();

  const clearAll = useCallback(async () => {
    await cacheService.clear();
    queryClient.clear();
    logger.info('All caches cleared');
  }, [queryClient]);

  const clearByTag = useCallback(async (tag: string) => {
    await cacheService.deleteByTag(tag);
    // Note: React Query doesn't support tags natively
    logger.info(`Cache cleared for tag: ${tag}`);
  }, []);

  const warmUp = useCallback(async (data: Array<{ key: string; value: unknown; options?: CacheOptions }>) => {
    await cacheService.warmUp(data);
    logger.info(`Cache warmed up with ${data.length} items`);
  }, []);

  const configure = useCallback((config: Record<string, unknown>) => {
    cacheService.configure(config);
  }, []);

  return {
    clearAll,
    clearByTag,
    warmUp,
    configure,
    stats: useCacheStats(),
  };
}

// ===========================
// Mutation Hook
// ===========================

/**
 * Hook for cached mutations
 */
export function useCachedMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    cacheKey?: string | ((variables: TVariables) => string);
    invalidateKeys?: string[];
    optimisticUpdate?: (variables: TVariables) => TData;
    ttl?: number;
    layer?: CacheLayer | CacheLayer[];
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
  },
) {
  const queryClient = useQueryClient();
  const { cacheKey, invalidateKeys = [], optimisticUpdate, ttl, layer, onSuccess, onError } = options || {};

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const result = await mutationFn(variables);

      // Cache the result if cacheKey is provided
      if (cacheKey) {
        const key = typeof cacheKey === 'function' ? cacheKey(variables) : cacheKey;
        await cacheService.set(key, result, { ttl, layer });
      }

      return result;
    },
    onMutate: async (variables) => {
      if (!optimisticUpdate) return;

      // Cancel outgoing refetches
      await Promise.all(invalidateKeys.map((key) => queryClient.cancelQueries({ queryKey: [key] })));

      // Snapshot previous values
      const previousData = invalidateKeys.reduce(
        (acc, key) => {
          acc[key] = queryClient.getQueryData([key]);
          return acc;
        },
        {} as Record<string, unknown>,
      );

      // Optimistically update
      const optimisticData = optimisticUpdate(variables);
      if (cacheKey) {
        const key = typeof cacheKey === 'function' ? cacheKey(variables) : cacheKey;
        queryClient.setQueryData([key], optimisticData);
      }

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, data]) => {
          queryClient.setQueryData([key], data);
        });
      }

      onError?.(error as Error, variables);
    },
    onSuccess: async (data, variables) => {
      // Invalidate related queries
      await Promise.all(invalidateKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

      onSuccess?.(data, variables);
    },
  });
}

// ===========================
// Export
// ===========================

export default useUnifiedCache;
