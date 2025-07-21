import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/services/api/client';
import axios from 'axios';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

export interface ActivityItem {
  id?: string;
  type: string;
  description: string;
  timestamp: string;
  project_id?: string;
  project_name?: string;
  image_id?: string;
  image_name?: string;
}

interface UseRecentActivityOptions {
  /**
   * Maximum number of activities to fetch
   * @default 10
   */
  limit?: number;

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

interface UseRecentActivityReturn {
  /**
   * List of recent activities
   */
  activities: ActivityItem[];

  /**
   * Whether data is being loaded
   */
  loading: boolean;

  /**
   * Error message if fetch failed
   */
  error: string | null;

  /**
   * Fetch recent activities
   */
  fetchActivities: () => Promise<void>;

  /**
   * Clear cached activities
   */
  clearCache: () => void;
}

// Cache key for localStorage - make it user-specific
const getActivityCacheKey = (userId?: string) => `spheroseg_recent_activities_${userId || 'anonymous'}`;
const getActivityCacheTimestampKey = (userId?: string) => `spheroseg_recent_activities_timestamp_${userId || 'anonymous'}`;

/**
 * Hook for fetching recent user activities
 *
 * @example
 * ```tsx
 * const { activities, loading, error, fetchActivities } = useRecentActivity({
 *   limit: 5
 * });
 *
 * return (
 *   <div>
 *     <h2>Recent Activity</h2>
 *     {loading ? (
 *       <p>Loading...</p>
 *     ) : error ? (
 *       <p>Error: {error}</p>
 *     ) : activities.length === 0 ? (
 *       <p>No recent activity</p>
 *     ) : (
 *       <ul>
 *         {activities.map((activity, index) => (
 *           <li key={index}>
 *             {activity.description} - {new Date(activity.timestamp).toLocaleString()}
 *           </li>
 *         ))}
 *       </ul>
 *     )}
 *   </div>
 * );
 * ```
 */
export const useRecentActivity = (options: UseRecentActivityOptions = {}): UseRecentActivityReturn => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const {
    limit = 10,
    showToasts = true,
    useCache = true,
    cacheExpiration = 5 * 60 * 1000, // 5 minutes
    autoFetch = true,
  } = options;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Function to save activities to cache
  const saveToCache = useCallback((data: ActivityItem[]) => {
    try {
      const cacheKey = getActivityCacheKey(user?.id);
      const timestampKey = getActivityCacheTimestampKey(user?.id);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(timestampKey, Date.now().toString());
      logger.debug('Saved activities to cache', { count: data.length, userId: user?.id });
    } catch (err) {
      logger.warn('Failed to save activities to cache', { error: err });
    }
  }, [user?.id]);

  // Function to load activities from cache
  const loadFromCache = useCallback((): {
    data: ActivityItem[] | null;
    timestamp: number;
  } => {
    try {
      const cacheKey = getActivityCacheKey(user?.id);
      const timestampKey = getActivityCacheTimestampKey(user?.id);
      const cachedData = localStorage.getItem(cacheKey);
      const cachedTimestamp = localStorage.getItem(timestampKey);

      if (cachedData && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const data = JSON.parse(cachedData) as ActivityItem[];
        logger.debug('Loaded activities from cache', {
          count: data.length,
          timestamp,
          userId: user?.id,
        });
        return { data, timestamp };
      }
    } catch (err) {
      logger.warn('Failed to load activities from cache', { error: err });
    }

    return { data: null, timestamp: 0 };
  }, [user?.id]);

  // Function to clear cache
  const clearCache = useCallback(() => {
    try {
      const cacheKey = getActivityCacheKey(user?.id);
      const timestampKey = getActivityCacheTimestampKey(user?.id);
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(timestampKey);
      logger.debug('Cleared activities cache', { userId: user?.id });
    } catch (err) {
      logger.warn('Failed to clear activities cache', { error: err });
    }
  }, [user?.id]);

  // Function to fetch activities from API
  const fetchActivities = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      logger.warn('Cannot fetch activities: user not logged in');
      return;
    }

    // Check cache first if enabled
    if (useCache) {
      const { data: cachedData, timestamp } = loadFromCache();
      const cacheAge = Date.now() - timestamp;

      if (cachedData && cacheAge < cacheExpiration) {
        logger.info('Using cached activities', {
          count: cachedData.length,
          cacheAge: `${Math.round(cacheAge / 1000)}s`,
          cacheExpiration: `${Math.round(cacheExpiration / 1000)}s`,
        });
        setActivities(cachedData);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      logger.info('Fetching recent activities', { limit });

      // Try to fetch from /users/me/statistics first (detailed endpoint)
      try {
        const response = await apiClient.get('/api/users/me/statistics');
        const data = response.data;

        if (data.recentActivity && Array.isArray(data.recentActivity)) {
          const activities = data.recentActivity.slice(0, limit);
          logger.info('Fetched activities from statistics endpoint', {
            count: activities.length,
          });

          setActivities(activities);

          // Save to cache if enabled
          if (useCache) {
            saveToCache(activities);
          }

          return;
        } else {
          logger.warn('Statistics endpoint returned no activities, falling back to stats endpoint');
        }
      } catch (statErr) {
        logger.warn('Statistics endpoint not available, falling back to stats endpoint', { error: statErr });
      }

      // Fall back to /users/me/stats (basic endpoint)
      const fallbackResponse = await apiClient.get('/api/users/me/stats');
      const fallbackData = fallbackResponse.data;

      if (fallbackData.recentActivity && Array.isArray(fallbackData.recentActivity)) {
        const activities = fallbackData.recentActivity.slice(0, limit);
        logger.info('Fetched activities from stats endpoint', {
          count: activities.length,
        });

        setActivities(activities);

        // Save to cache if enabled
        if (useCache) {
          saveToCache(activities);
        }
      } else {
        logger.warn('No activities found in API response');
        setActivities([]);
      }
    } catch (err) {
      logger.error('Failed to fetch activities', { error: err });

      let errorMessage = t('profile.fetchError') || 'Failed to load recent activities';

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
          logger.info('Using expired cached activities due to fetch error', {
            count: cachedData.length,
          });
          setActivities(cachedData);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit, showToasts, useCache, cacheExpiration, t, loadFromCache, saveToCache]);

  // Fetch activities on mount if autoFetch is enabled
  useEffect(() => {
    if (autoFetch) {
      fetchActivities();
    }
  }, [autoFetch, fetchActivities]);

  return {
    activities,
    loading,
    error,
    fetchActivities,
    clearCache,
  };
};
