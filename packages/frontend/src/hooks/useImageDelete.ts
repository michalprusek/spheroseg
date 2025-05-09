import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProjectImage } from '@/types';
import logger from '@/lib/logger';

interface UseImageDeleteOptions {
  /**
   * Callback function to be called after successful deletion
   */
  onSuccess?: (deletedImageId: string) => void;
  
  /**
   * Whether to show toast notifications
   * @default true
   */
  showToasts?: boolean;
}

interface UseImageDeleteReturn {
  /**
   * Delete an image
   * @param projectId - ID of the project containing the image
   * @param imageId - ID of the image to delete
   * @returns Promise that resolves when the deletion is complete
   */
  deleteImage: (projectId: string, imageId: string) => Promise<void>;
  
  /**
   * Delete multiple images
   * @param projectId - ID of the project containing the images
   * @param imageIds - Array of image IDs to delete
   * @returns Promise that resolves when all deletions are complete
   */
  deleteImages: (projectId: string, imageIds: string[]) => Promise<void>;
  
  /**
   * Whether an image deletion is in progress
   * @param imageId - ID of the image to check
   */
  isDeleting: (imageId: string) => boolean;
  
  /**
   * Whether any image deletion is in progress
   */
  isAnyDeleting: boolean;
  
  /**
   * Error message if deletion failed
   */
  error: string | null;
}

/**
 * Hook for deleting images from a project
 * 
 * @example
 * ```tsx
 * const { deleteImage, isDeleting } = useImageDelete({
 *   onSuccess: (deletedImageId) => {
 *     // Update UI or fetch new data
 *     refreshProjectData();
 *   }
 * });
 * 
 * return (
 *   <Button 
 *     onClick={() => deleteImage(projectId, imageId)}
 *     disabled={isDeleting(imageId)}
 *   >
 *     {isDeleting(imageId) ? 'Deleting...' : 'Delete'}
 *   </Button>
 * );
 * ```
 */
export const useImageDelete = (options: UseImageDeleteOptions = {}): UseImageDeleteReturn => {
  const { t } = useLanguage();
  const { onSuccess, showToasts = true } = options;
  
  const [deletingImages, setDeletingImages] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  
  const isDeleting = useCallback((imageId: string): boolean => {
    return !!deletingImages[imageId];
  }, [deletingImages]);
  
  const isAnyDeleting = Object.values(deletingImages).some(Boolean);
  
  const deleteImage = useCallback(async (projectId: string, imageId: string): Promise<void> => {
    if (deletingImages[imageId]) {
      logger.warn('Attempted to delete an image that is already being deleted', { imageId });
      return;
    }
    
    setDeletingImages(prev => ({ ...prev, [imageId]: true }));
    setError(null);
    
    try {
      logger.info('Deleting image', { projectId, imageId });
      
      if (showToasts) {
        toast.info(t('images.deleting') || 'Deleting image...');
      }
      
      await apiClient.delete(`/projects/${projectId}/images/${imageId}`);
      
      logger.info('Image deleted successfully', { projectId, imageId });
      
      if (showToasts) {
        toast.success(t('images.deleteSuccess') || 'Image deleted successfully');
      }
      
      if (onSuccess) {
        onSuccess(imageId);
      }
    } catch (err) {
      logger.error('Failed to delete image', { projectId, imageId, error: err });
      
      let errorMessage = t('images.deleteError') || 'Failed to delete image';
      
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data?.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      if (showToasts) {
        toast.error(errorMessage);
      }
      
      throw err;
    } finally {
      setDeletingImages(prev => ({ ...prev, [imageId]: false }));
    }
  }, [deletingImages, onSuccess, showToasts, t]);
  
  const deleteImages = useCallback(async (projectId: string, imageIds: string[]): Promise<void> => {
    if (imageIds.length === 0) {
      return;
    }
    
    // For a single image, use the regular deleteImage function
    if (imageIds.length === 1) {
      return deleteImage(projectId, imageIds[0]);
    }
    
    // Mark all images as deleting
    setDeletingImages(prev => {
      const newState = { ...prev };
      imageIds.forEach(id => {
        newState[id] = true;
      });
      return newState;
    });
    
    setError(null);
    
    try {
      logger.info('Deleting multiple images', { projectId, count: imageIds.length });
      
      if (showToasts) {
        toast.info(t('images.deletingMultiple', { count: imageIds.length }) || `Deleting ${imageIds.length} images...`);
      }
      
      // Delete images sequentially to avoid overwhelming the server
      for (const imageId of imageIds) {
        try {
          await apiClient.delete(`/projects/${projectId}/images/${imageId}`);
          logger.info('Image deleted successfully', { projectId, imageId });
          
          if (onSuccess) {
            onSuccess(imageId);
          }
        } catch (err) {
          logger.error('Failed to delete image in batch', { projectId, imageId, error: err });
          // Continue with other images even if one fails
        }
      }
      
      if (showToasts) {
        toast.success(t('images.deleteMultipleSuccess', { count: imageIds.length }) || `${imageIds.length} images deleted successfully`);
      }
    } catch (err) {
      logger.error('Failed to delete images', { projectId, count: imageIds.length, error: err });
      
      let errorMessage = t('images.deleteMultipleError') || 'Failed to delete some images';
      
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data?.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      if (showToasts) {
        toast.error(errorMessage);
      }
    } finally {
      // Mark all images as not deleting
      setDeletingImages(prev => {
        const newState = { ...prev };
        imageIds.forEach(id => {
          newState[id] = false;
        });
        return newState;
      });
    }
  }, [deleteImage, onSuccess, showToasts, t]);
  
  return {
    deleteImage,
    deleteImages,
    isDeleting,
    isAnyDeleting,
    error
  };
};
