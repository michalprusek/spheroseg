import { useApiCache } from '@/hooks/useUnifiedCache';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { CacheLayer } from '@/services/unifiedCacheService';

const logger = createLogger('useUserStatistics');

interface UserStatistics {
  totalProjects: number;
  totalImages: number;
  segmentedImages: number;
  pendingImages: number;
  failedImages: number;
  storageUsed: number;
  lastActivity: string;
}

export const useUserStatistics = () => {
  const {
    data: statistics,
    error,
    isLoading,
    isFetching,
    isSuccess,
    refetch,
    invalidate
  } = useApiCache<UserStatistics>('/api/users/me/statistics', {
    ttl: 5 * 60 * 1000, // 5 minutes cache
    layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
    tags: ['user-data', 'user-statistics', 'dashboard-data'],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    onError: (error) => {
      logger.error('Failed to fetch user statistics:', error);
    }
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
  
  return {
    data: statistics || defaultStatistics,
    error,
    isLoading,
    isFetching,
    isSuccess,
    refetch,
    invalidate
  };
};