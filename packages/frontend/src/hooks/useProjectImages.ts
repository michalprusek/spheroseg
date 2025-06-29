/**
 * Hook for managing project images with unified caching
 */

import { useCallback } from 'react';
import { ProjectImage } from '@/types';
import { useProjectCache, useCacheManager } from '@/hooks/useUnifiedCache';
import { getProjectImages } from '@/api/projectImages';
import { createLogger } from '@/utils/logging/unifiedLogger';

const logger = createLogger('useProjectImages');

interface UseProjectImagesOptions {
  enabled?: boolean;
  ttl?: number;
  onSuccess?: (images: ProjectImage[]) => void;
  onError?: (error: Error) => void;
}

export function useProjectImages(
  projectId: string | undefined,
  options: UseProjectImagesOptions = {}
) {
  const cleanProjectId = projectId?.startsWith('project-') 
    ? projectId.substring(8) 
    : projectId;
    
  const { clearByTag } = useCacheManager();
  
  const {
    data: images,
    error,
    isLoading,
    isFetching,
    isSuccess,
    refetch,
    invalidate,
    update
  } = useProjectCache(
    cleanProjectId || 'unknown',
    async () => {
      if (!cleanProjectId) {
        throw new Error('Project ID is required');
      }
      return getProjectImages(cleanProjectId);
    },
    {
      enabled: !!cleanProjectId && options.enabled !== false,
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
      tags: ['project-data', `project-${cleanProjectId}`, 'images'],
      onSuccess: (data) => {
        logger.info(`Loaded ${data.length} images for project ${cleanProjectId}`);
        options.onSuccess?.(data);
      },
      onError: (error) => {
        logger.error(`Failed to load images for project ${cleanProjectId}:`, error);
        options.onError?.(error as Error);
      }
    }
  );
  
  const addImage = useCallback(async (newImage: ProjectImage) => {
    if (!images) return;
    
    const updatedImages = [...images, newImage];
    await update(updatedImages);
    
    logger.info(`Added image ${newImage.id} to project ${cleanProjectId}`);
  }, [images, update, cleanProjectId]);
  
  const removeImage = useCallback(async (imageId: string) => {
    if (!images) return;
    
    const updatedImages = images.filter(img => img.id !== imageId);
    await update(updatedImages);
    
    logger.info(`Removed image ${imageId} from project ${cleanProjectId}`);
  }, [images, update, cleanProjectId]);
  
  const updateImage = useCallback(async (imageId: string, updates: Partial<ProjectImage>) => {
    if (!images) return;
    
    const updatedImages = images.map(img => 
      img.id === imageId ? { ...img, ...updates } : img
    );
    await update(updatedImages);
    
    logger.info(`Updated image ${imageId} in project ${cleanProjectId}`);
  }, [images, update, cleanProjectId]);
  
  const clearAllProjectCaches = useCallback(async () => {
    if (!cleanProjectId) return;
    
    // Clear all caches related to this project
    await clearByTag(`project-${cleanProjectId}`);
    
    logger.info(`Cleared all caches for project ${cleanProjectId}`);
  }, [clearByTag, cleanProjectId]);
  
  return {
    images: images || [],
    error,
    isLoading,
    isFetching,
    isSuccess,
    refetch,
    invalidate,
    addImage,
    removeImage,
    updateImage,
    clearAllProjectCaches
  };
}

/**
 * Hook for batch operations on project images
 */
export function useProjectImagesBatch(projectId: string | undefined) {
  const { images, updateImage } = useProjectImages(projectId);
  
  const batchUpdateStatus = useCallback(async (
    imageIds: string[],
    status: ProjectImage['segmentationStatus']
  ) => {
    const updates = imageIds.map(id => 
      updateImage(id, { segmentationStatus: status })
    );
    
    await Promise.all(updates);
    
    logger.info(`Batch updated ${imageIds.length} images to status ${status}`);
  }, [updateImage]);
  
  const batchDelete = useCallback(async (imageIds: string[]) => {
    // This would trigger individual delete operations
    // Implementation depends on your delete API
    logger.info(`Batch delete requested for ${imageIds.length} images`);
  }, []);
  
  return {
    images,
    batchUpdateStatus,
    batchDelete
  };
}