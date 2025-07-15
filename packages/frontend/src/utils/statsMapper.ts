/**
 * Utility for mapping API statistics data to frontend format
 */

import { createLogger } from '@/utils/logging/unifiedLogger';

const logger = createLogger('statsMapper');

// API response format from backend
export interface ApiUserStatistics {
  // New format property names
  totalProjects: number;
  totalImages: number;
  completedSegmentations: number;
  processingCount?: number;
  queuedCount?: number;
  failedCount?: number;
  storageUsedBytes: string;
  storageLimitBytes: string;
  storageUsedMB: number;
  recentActivity: any[];
  recentProjects: any[];
  recentImages: any[];
  comparisons: {
    projectsThisMonth: number;
    projectsLastMonth: number;
    projectsChange: number;
    imagesThisMonth: number;
    imagesLastMonth: number;
    imagesChange: number;
  };

  // Old format property names for compatibility
  projects_count?: number;
  images_count?: number;
  segmentations_count?: number;
  processing_count?: number;
  queued_count?: number;
  failed_count?: number;
  storage_used_mb?: number;
  storage_used_bytes?: string;
  storage_limit_bytes?: string;
  last_login?: string;
  recent_activity?: any[];
  recent_projects?: any[];
  recent_images?: any[];
  projects_this_month?: number;
  projects_last_month?: number;
  projects_change?: number;
  images_this_month?: number;
  images_last_month?: number;
  images_change?: number;
}

// Frontend expected format
export interface UserStatistics {
  totalProjects: number;
  totalImages: number;
  segmentedImages: number;
  pendingImages: number;
  failedImages: number;
  storageUsed: number;
  lastActivity: string;
}

// Extended format for StatsOverview component
export interface ExtendedUserStatistics extends UserStatistics {
  recentActivity: any[];
  comparisons: {
    projectsThisMonth: number;
    projectsLastMonth: number;
    projectsChange: number;
    imagesThisMonth: number;
    imagesLastMonth: number;
    imagesChange: number;
  };
}

/**
 * Maps API response to frontend UserStatistics format
 */
export function mapApiToUserStatistics(apiData: ApiUserStatistics | null): UserStatistics | null {
  if (!apiData) {
    logger.warn('No API data provided for mapping');
    return null;
  }

  logger.debug('Mapping API data to UserStatistics:', apiData);

  // Use new format properties, fallback to old format if needed
  const mapped: UserStatistics = {
    totalProjects: apiData.totalProjects ?? apiData.projects_count ?? 0,
    totalImages: apiData.totalImages ?? apiData.images_count ?? 0,
    segmentedImages: apiData.completedSegmentations ?? apiData.segmentations_count ?? 0,
    pendingImages: (apiData.processingCount ?? apiData.processing_count ?? 0) + (apiData.queuedCount ?? apiData.queued_count ?? 0),
    failedImages: apiData.failedCount ?? apiData.failed_count ?? 0,
    storageUsed: apiData.storageUsedMB ?? apiData.storage_used_mb ?? 0,
    lastActivity: apiData.last_login ?? new Date().toISOString(),
  };

  logger.debug('Mapped UserStatistics:', mapped);

  return mapped;
}

/**
 * Maps API response to extended statistics format used by StatsOverview
 */
export function mapApiToExtendedStatistics(apiData: ApiUserStatistics | null): ExtendedUserStatistics | null {
  if (!apiData) {
    logger.warn('No API data provided for extended mapping');
    return null;
  }

  const basicStats = mapApiToUserStatistics(apiData);
  if (!basicStats) {
    return null;
  }

  logger.debug('Mapping API data to ExtendedUserStatistics:', apiData);

  const extended: ExtendedUserStatistics = {
    ...basicStats,
    recentActivity: apiData.recentActivity ?? apiData.recent_activity ?? [],
    comparisons: apiData.comparisons ?? {
      projectsThisMonth: apiData.projects_this_month ?? 0,
      projectsLastMonth: apiData.projects_last_month ?? 0,
      projectsChange: apiData.projects_change ?? 0,
      imagesThisMonth: apiData.images_this_month ?? 0,
      imagesLastMonth: apiData.images_last_month ?? 0,
      imagesChange: apiData.images_change ?? 0,
    },
  };

  logger.debug('Mapped ExtendedUserStatistics:', extended);

  return extended;
}
