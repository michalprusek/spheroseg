import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';
import { ActivityItem } from './useRecentActivity';

export interface UserStatistics {
  totalProjects: number;
  totalImages: number;
  completedSegmentations: number;
  storageUsedMB?: number;
  storageUsedBytes?: string;
  storageLimitBytes?: string;
  recentActivity?: ActivityItem[];
  recentProjects?: any[];
  recentImages?: any[];
  comparisons?: {
    projectsThisMonth: number;
    projectsLastMonth: number;
    projectsChange: number;
    imagesThisMonth: number;
    imagesLastMonth: number;
    imagesChange: number;
  };
}

interface UseUserStatisticsOptions {
  /**
   * Whether to show toast notifications for errors
   * @default true
   */
  showToasts?: boolean;
  
  /**
   * Whether to use cached data if available
   * @default true
   */
  useCache?: boolean;
  
  /**
   * Cache expiration time in milliseconds
   * @default 5 minutes (300000 ms)
   */
  cacheExpiration?: number;
  
  /**
   * Whether to automatically fetch data on mount
   * @default true
   */
  autoFetch?: boolean;
}

interface UseUserStatisticsReturn {
  /**
   * User statistics
   */
  statistics: UserStatistics | null;
  
  /**
   * Whether data is being loaded
   */
  loading: boolean;
  
  /**
   * Error message if fetch failed
   */
  error: string | null;
  
  /**
   * Fetch user statistics
   */
  fetchStatistics: () => Promise<void>;
  
  /**
   * Clear cached statistics
   */
  clearCache: () => void;
}

// Cache keys for localStorage
const STATISTICS_CACHE_KEY = 'spheroseg_user_statistics';
const STATISTICS_CACHE_TIMESTAMP_KEY = 'spheroseg_user_statistics_timestamp';

/**
 * Hook for fetching user statistics
 * 
 * @example
 * ```tsx
 * const { statistics, loading, error, fetchStatistics } = useUserStatistics();
 * 
 * return (
 *   <div>
 *     <h2>User Statistics</h2>
 *     {loading ? (
 *       <p>Loading...</p>
 *     ) : error ? (
 *       <p>Error: {error}</p>
 *     ) : !statistics ? (
 *       <p>No statistics available</p>
 *     ) : (
 *       <div>
 *         <p>Total Projects: {statistics.totalProjects}</p>
 *         <p>Total Images: {statistics.totalImages}</p>
 *         <p>Completed Segmentations: {statistics.completedSegmentations}</p>
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 */
export const useUserStatistics = (options: UseUserStatisticsOptions = {}): UseUserStatisticsReturn => {
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const { 
    showToasts = true, 
    useCache = true,
    cacheExpiration = 5 * 60 * 1000, // 5 minutes
    autoFetch = true
  } = options;
  
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Function to save statistics to cache
  const saveToCache = useCallback((data: UserStatistics) => {
    try {
      localStorage.setItem(STATISTICS_CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(STATISTICS_CACHE_TIMESTAMP_KEY, Date.now().toString());
      logger.debug('Saved statistics to cache');
    } catch (err) {
      logger.warn('Failed to save statistics to cache', { error: err });
    }
  }, []);
  
  // Function to load statistics from cache
  const loadFromCache = useCallback((): { data: UserStatistics | null, timestamp: number } => {
    try {
      const cachedData = localStorage.getItem(STATISTICS_CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(STATISTICS_CACHE_TIMESTAMP_KEY);
      
      if (cachedData && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const data = JSON.parse(cachedData) as UserStatistics;
        logger.debug('Loaded statistics from cache', { timestamp });
        return { data, timestamp };
      }
    } catch (err) {
      logger.warn('Failed to load statistics from cache', { error: err });
    }
    
    return { data: null, timestamp: 0 };
  }, []);
  
  // Function to clear cache
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(STATISTICS_CACHE_KEY);
      localStorage.removeItem(STATISTICS_CACHE_TIMESTAMP_KEY);
      logger.debug('Cleared statistics cache');
    } catch (err) {
      logger.warn('Failed to clear statistics cache', { error: err });
    }
  }, []);
  
  // Function to fetch statistics from API
  const fetchStatistics = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      logger.warn('Cannot fetch statistics: user not logged in');
      return;
    }
    
    // Check cache first if enabled
    if (useCache) {
      const { data: cachedData, timestamp } = loadFromCache();
      const cacheAge = Date.now() - timestamp;
      
      if (cachedData && cacheAge < cacheExpiration) {
        logger.info('Using cached statistics', { 
          cacheAge: `${Math.round(cacheAge / 1000)}s`,
          cacheExpiration: `${Math.round(cacheExpiration / 1000)}s`
        });
        setStatistics(cachedData);
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      logger.info('Fetching user statistics');
      
      // Try to fetch from /users/me/statistics first (detailed endpoint)
      try {
        const response = await apiClient.get('/users/me/statistics');
        const data = response.data;
        
        // Transform data to match our interface
        const stats: UserStatistics = {
          totalProjects: data.totalProjects || 0,
          totalImages: data.totalImages || 0,
          completedSegmentations: data.completedSegmentations || 0,
          storageUsedMB: data.storageUsedMB,
          storageUsedBytes: data.storageUsedBytes,
          storageLimitBytes: data.storageLimitBytes,
          recentActivity: data.recentActivity,
          recentProjects: data.recentProjects,
          recentImages: data.recentImages,
          comparisons: data.comparisons
        };
        
        logger.info('Fetched statistics from statistics endpoint');
        
        setStatistics(stats);
        
        // Save to cache if enabled
        if (useCache) {
          saveToCache(stats);
        }
        
        return;
      } catch (statErr) {
        logger.warn('Statistics endpoint not available, falling back to stats endpoint', { error: statErr });
      }
      
      // Fall back to /users/me/stats (basic endpoint)
      const fallbackResponse = await apiClient.get('/users/me/stats');
      const fallbackData = fallbackResponse.data;

      logger.debug('Fallback data from /users/me/stats:', fallbackData);

      // Transform data to match our interface, handling both new and old response formats
      const stats: UserStatistics = {
        // Handle both new format (totalProjects) and old format (projects_count)
        totalProjects: fallbackData.totalProjects || fallbackData.projects_count || 0,
        // Handle both new format (totalImages) and old format (images_count)
        totalImages: fallbackData.totalImages || fallbackData.images_count || 0,
        // Handle both new format (completedSegmentations) and old format (segmentations_count)
        completedSegmentations: fallbackData.completedSegmentations || fallbackData.segmentations_count || 0,
        storageUsedMB: fallbackData.storageUsedMB || Math.round(parseInt(fallbackData.storage_used_bytes || '0') / (1024 * 1024) * 100) / 100,
        storageUsedBytes: fallbackData.storageUsedBytes || fallbackData.storage_used_bytes,
        storageLimitBytes: fallbackData.storageLimitBytes || fallbackData.storage_limit_bytes,
        recentActivity: fallbackData.recentActivity || fallbackData.recent_activity,
        recentProjects: fallbackData.recentProjects || fallbackData.recent_projects,
        recentImages: fallbackData.recentImages || fallbackData.recent_images,
        // If no comparisons are available, create a default structure
        comparisons: fallbackData.comparisons || {
          projectsThisMonth: fallbackData.projects_this_month || 0,
          projectsLastMonth: fallbackData.projects_last_month || 0,
          projectsChange: fallbackData.projects_change || 0,
          imagesThisMonth: fallbackData.images_this_month || 0,
          imagesLastMonth: fallbackData.images_last_month || 0,
          imagesChange: fallbackData.images_change || 0
        }
      };
      
      logger.info('Fetched statistics from stats endpoint');
      
      setStatistics(stats);
      
      // Save to cache if enabled
      if (useCache) {
        saveToCache(stats);
      }
    } catch (err) {
      logger.error('Failed to fetch statistics', { error: err });
      
      let errorMessage = t('profile.fetchError') || 'Failed to load user statistics';
      
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data?.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      if (showToasts) {
        toast.error(errorMessage);
      }
      
      // Try to use cached data even if it's expired
      if (useCache) {
        const { data: cachedData } = loadFromCache();
        if (cachedData) {
          logger.info('Using expired cached statistics due to fetch error');
          setStatistics(cachedData);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, showToasts, useCache, cacheExpiration, t, loadFromCache, saveToCache]);
  
  // Fetch statistics on mount if autoFetch is enabled
  useEffect(() => {
    if (autoFetch) {
      fetchStatistics();
    }
  }, [autoFetch, fetchStatistics]);
  
  return {
    statistics,
    loading,
    error,
    fetchStatistics,
    clearCache
  };
};
