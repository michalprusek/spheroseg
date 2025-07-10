import { useApiCache } from '@/hooks/useUnifiedCache';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { CacheLayer } from '@/services/unifiedCacheService';
import { API_PATHS } from '@/lib/apiPaths';
import { mapApiToUserStatistics, ApiUserStatistics, UserStatistics } from '@/utils/statsMapper';

const logger = createLogger('useUserStatistics');

export const useUserStatistics = () => {
  const {
    data: apiData,
    error,
    isLoading,
    isFetching,
    isSuccess,
    refetch,
    invalidate,
  } = useApiCache<ApiUserStatistics>(API_PATHS.USERS.STATS, {
    ttl: 5 * 60 * 1000, // 5 minutes cache
    layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
    tags: ['user-data', 'user-statistics', 'dashboard-data'],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    onSuccess: (data) => {
      logger.info('User statistics API response:', data);
    },
    onError: (error) => {
      logger.error('Failed to fetch user statistics:', error);
    },
  });

  // Return default statistics if API fails
  const defaultStatistics: UserStatistics = {
    totalProjects: 0,
    totalImages: 0,
    segmentedImages: 0,
    pendingImages: 0,
    failedImages: 0,
    storageUsed: 0,
    lastActivity: new Date().toISOString(),
  };

  // Map API data to frontend format
  const mappedData = apiData ? mapApiToUserStatistics(apiData) : null;
  
  // Log the actual data being returned
  if (mappedData) {
    logger.debug('Returning mapped user statistics:', mappedData);
  }

  return {
    data: mappedData || defaultStatistics,
    error,
    isLoading,
    isFetching,
    isSuccess,
    refetch,
    invalidate,
  };
};
