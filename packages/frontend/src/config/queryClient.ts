import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getLogger } from '@/utils/logging/unifiedLogger';

const logger = getLogger('queryClient');

// Network error detection
const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('network') || error.message.includes('Network') || error.message.includes('fetch');
  }
  return false;
};

// Retry configuration based on error type
const getRetryCount = (failureCount: number, error: unknown): number => {
  // Don't retry on 4xx errors (client errors)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as unknown).status;
    if (status >= 400 && status < 500) {
      return 0; // Don't retry client errors
    }
  }

  // Retry network errors more aggressively
  if (isNetworkError(error)) {
    return Math.min(failureCount * 2, 5);
  }

  // Default retry strategy
  return Math.min(failureCount, 3);
};

// Retry delay with exponential backoff
const getRetryDelay = (failureCount: number): number => {
  return Math.min(1000 * Math.pow(2, failureCount), 30000);
};

// Create the query client with optimized configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time configuration
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for this duration
      gcTime: 15 * 60 * 1000, // 15 minutes - keep inactive data in cache

      // Refetch configuration
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: true, // Refetch if data is stale when component mounts
      refetchOnReconnect: 'always', // Always refetch on reconnect
      refetchInterval: false, // No automatic refetching

      // Retry configuration
      retry: getRetryCount,
      retryDelay: getRetryDelay,

      // Network mode
      networkMode: 'offlineFirst', // Try cache first, then network

      // Structural sharing for better performance
      structuralSharing: true,

      // Placeholder data while loading
      placeholderData: (previousData) => previousData,
    },
    mutations: {
      // Retry configuration for mutations
      retry: 2,
      retryDelay: getRetryDelay,

      // Network mode for mutations
      networkMode: 'online', // Only run mutations when online

      // Global error handler
      onError: (error) => {
        logger.error('Mutation error:', error);

        // Show user-friendly error messages
        if (isNetworkError(error)) {
          toast.error('Network error. Please check your connection.');
        } else if (error instanceof Error) {
          toast.error(error.message || 'Failed to update data. Please try again.');
        } else {
          toast.error('An unexpected error occurred. Please try again.');
        }
      },
    },
  },

  // Query client configuration
  queryCache: {
    onError: (error, query) => {
      // Log query errors for debugging
      logger.error('Query error:', {
        queryKey: query.queryKey,
        error,
      });

      // Only show toast for user-initiated queries (not background refetches)
      if (query.state.dataUpdateCount === 0) {
        if (isNetworkError(error)) {
          toast.error('Failed to load data. Please check your connection.');
        }
      }
    },
    onSuccess: (data, query) => {
      // Log successful queries in development
      if (import.meta.env.DEV) {
        logger.debug('Query success:', {
          queryKey: query.queryKey,
          dataSize: JSON.stringify(data).length,
        });
      }
    },
  },

  mutationCache: {
    onSuccess: (data, variables, context, mutation) => {
      // Log successful mutations
      logger.debug('Mutation success:', {
        mutationKey: mutation.options.mutationKey,
      });
    },
  },
});

// Prefetch helper with deduplication
const prefetchedQueries = new Set<string>();

export const prefetchQuery = async (key: unknown[], fn: () => Promise<unknown>, staleTime?: number) => {
  const keyString = JSON.stringify(key);

  // Skip if already prefetched
  if (prefetchedQueries.has(keyString)) {
    return;
  }

  prefetchedQueries.add(keyString);

  try {
    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: fn,
      staleTime: staleTime || 10 * 60 * 1000, // Default 10 minutes
    });
  } catch (error) {
    logger.error('Prefetch error:', error);
    // Remove from set so it can be retried
    prefetchedQueries.delete(keyString);
  }
};

// Invalidate queries helper with options
export const invalidateQueries = async (
  key: unknown[],
  options?: {
    exact?: boolean;
    refetchType?: 'active' | 'inactive' | 'all' | 'none';
  },
) => {
  await queryClient.invalidateQueries({
    queryKey: key,
    exact: options?.exact,
    refetchType: options?.refetchType || 'active',
  });
};

// Set query data with optimistic updates
export const setQueryData = <T>(key: unknown[], updater: T | ((old: T | undefined) => T)) => {
  queryClient.setQueryData(key, updater);
};

// Cancel queries helper
export const cancelQueries = async (key: unknown[]) => {
  await queryClient.cancelQueries({ queryKey: key });
};

// Reset queries helper
export const resetQueries = async (key: unknown[]) => {
  await queryClient.resetQueries({ queryKey: key });
};

// Remove queries from cache
export const removeQueries = (key: unknown[]) => {
  queryClient.removeQueries({ queryKey: key });
};

// Get query state
export const getQueryState = <T>(key: unknown[]) => {
  return queryClient.getQueryState<T>(key);
};

// Get query data
export const getQueryData = <T>(key: unknown[]) => {
  return queryClient.getQueryData<T>(key);
};

// Ensure query data exists
export const ensureQueryData = async <T>(key: unknown[], fn: () => Promise<T>, staleTime?: number) => {
  return queryClient.ensureQueryData({
    queryKey: key,
    queryFn: fn,
    staleTime: staleTime || 5 * 60 * 1000,
  });
};

export default queryClient;
