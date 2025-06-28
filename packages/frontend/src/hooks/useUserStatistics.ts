import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/apiClient';
import logger from '@/utils/logger';

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
  return useQuery<UserStatistics>({
    queryKey: ['userStatistics'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/api/users/me/statistics');
        return response.data;
      } catch (error) {
        logger.error('Failed to fetch user statistics:', error);
        // Return default statistics if API fails
        return {
          totalProjects: 0,
          totalImages: 0,
          segmentedImages: 0,
          pendingImages: 0,
          failedImages: 0,
          storageUsed: 0,
          lastActivity: new Date().toISOString(),
        };
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1,
  });
};