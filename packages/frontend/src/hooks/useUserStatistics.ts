import { useApiCache } from '@/hooks/useUnifiedCache';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { CacheLayer } from '@/services/unifiedCacheService';
import { API_PATHS } from '@/lib/apiPaths';
import { mapApiToUserStatistics, ApiUserStatistics, UserStatistics } from '@/utils/statsMapper';
import { useEffect, useRef } from 'react';

const logger = createLogger('useUserStatistics');

export const useUserStatistics = () => {
  // Track the current user ID to detect changes
  const currentUserIdRef = useRef<string | null>(null);
  
  // Get current user ID from localStorage
  const getCurrentUserId = () => {
    try {
      const userStr = localStorage.getItem('spheroseg_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.id || null;
      }
    } catch (error) {
      logger.debug('Could not parse user from localStorage');
    }
    return null;
  };
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

  // Check for user changes and invalidate cache if needed
  useEffect(() => {
    const currentUserId = getCurrentUserId();
    
    if (currentUserIdRef.current !== null && currentUserIdRef.current !== currentUserId) {
      logger.info('User changed, invalidating statistics cache', {
        previousUser: currentUserIdRef.current,
        currentUser: currentUserId
      });
      invalidate();
    }
    
    currentUserIdRef.current = currentUserId;
  }, [invalidate]);

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
