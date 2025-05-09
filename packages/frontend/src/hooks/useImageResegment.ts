import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { useLanguage } from '@/contexts/LanguageContext';
import { ImageStatus, ProjectImage } from '@/types';
import logger from '@/lib/logger';

interface UseImageResegmentOptions {
  /**
   * Callback function to be called after successful resegmentation trigger
   */
  onSuccess?: (imageId: string) => void;
  
  /**
   * Callback function to update image status in UI
   */
  onStatusChange?: (imageId: string, status: ImageStatus) => void;
  
  /**
   * Whether to show toast notifications
   * @default true
   */
  showToasts?: boolean;
  
  /**
   * Priority of the resegmentation task (1-10)
   * @default 5
   */
  priority?: number;
  
  /**
   * Model type to use for resegmentation
   * @default 'resunet'
   */
  modelType?: string;
}

interface UseImageResegmentReturn {
  /**
   * Trigger resegmentation for an image
   * @param imageId - ID of the image to resegment
   * @returns Promise that resolves when the resegmentation is triggered
   */
  resegmentImage: (imageId: string) => Promise<void>;
  
  /**
   * Trigger resegmentation for multiple images
   * @param imageIds - Array of image IDs to resegment
   * @returns Promise that resolves when all resegmentations are triggered
   */
  resegmentImages: (imageIds: string[]) => Promise<void>;
  
  /**
   * Whether an image resegmentation is in progress
   * @param imageId - ID of the image to check
   */
  isResegmenting: (imageId: string) => boolean;
  
  /**
   * Whether any image resegmentation is in progress
   */
  isAnyResegmenting: boolean;
  
  /**
   * Error message if resegmentation failed
   */
  error: string | null;
}

/**
 * Hook for triggering resegmentation of images
 * 
 * @example
 * ```tsx
 * const { resegmentImage, isResegmenting } = useImageResegment({
 *   onSuccess: (imageId) => {
 *     // Update UI or fetch new data
 *     refreshProjectData();
 *   },
 *   onStatusChange: (imageId, status) => {
 *     // Update image status in UI
 *     updateImageStatus(imageId, status);
 *   }
 * });
 * 
 * return (
 *   <Button 
 *     onClick={() => resegmentImage(imageId)}
 *     disabled={isResegmenting(imageId)}
 *   >
 *     {isResegmenting(imageId) ? 'Processing...' : 'Resegment'}
 *   </Button>
 * );
 * ```
 */
export const useImageResegment = (options: UseImageResegmentOptions = {}): UseImageResegmentReturn => {
  const { t } = useLanguage();
  const { 
    onSuccess, 
    onStatusChange, 
    showToasts = true, 
    priority = 5,
    modelType = 'resunet'
  } = options;
  
  const [resegmentingImages, setResegmentingImages] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  
  const isResegmenting = useCallback((imageId: string): boolean => {
    return !!resegmentingImages[imageId];
  }, [resegmentingImages]);
  
  const isAnyResegmenting = Object.values(resegmentingImages).some(Boolean);
  
  const resegmentImage = useCallback(async (imageId: string): Promise<void> => {
    if (resegmentingImages[imageId]) {
      logger.warn('Attempted to resegment an image that is already being processed', { imageId });
      return;
    }
    
    setResegmentingImages(prev => ({ ...prev, [imageId]: true }));
    setError(null);
    
    try {
      logger.info('Triggering resegmentation for image', { imageId, modelType, priority });
      
      if (showToasts) {
        toast.info(t('segmentation.resegmenting') || 'Starting resegmentation with neural network...');
      }
      
      // Update image status to 'processing' immediately for better UX
      if (onStatusChange) {
        onStatusChange(imageId, 'processing');
      }
      
      // Call the batch segmentation endpoint with a single image
      await apiClient.post('/images/segmentation/trigger-batch', {
        imageIds: [imageId],
        priority,
        model_type: modelType
      });
      
      logger.info('Resegmentation triggered successfully', { imageId });
      
      if (showToasts) {
        toast.success(t('segmentation.resegmentSuccess') || 'Resegmentation task queued successfully');
      }
      
      if (onSuccess) {
        onSuccess(imageId);
      }
    } catch (err) {
      logger.error('Failed to trigger resegmentation', { imageId, error: err });
      
      let errorMessage = t('segmentation.resegmentError') || 'Failed to trigger resegmentation';
      
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data?.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      if (showToasts) {
        toast.error(errorMessage);
      }
      
      // Revert status if it was changed
      if (onStatusChange) {
        onStatusChange(imageId, 'failed');
      }
      
      throw err;
    } finally {
      setResegmentingImages(prev => ({ ...prev, [imageId]: false }));
    }
  }, [resegmentingImages, onSuccess, onStatusChange, showToasts, t, priority, modelType]);
  
  const resegmentImages = useCallback(async (imageIds: string[]): Promise<void> => {
    if (imageIds.length === 0) {
      return;
    }
    
    // For a single image, use the regular resegmentImage function
    if (imageIds.length === 1) {
      return resegmentImage(imageIds[0]);
    }
    
    // Mark all images as resegmenting
    setResegmentingImages(prev => {
      const newState = { ...prev };
      imageIds.forEach(id => {
        newState[id] = true;
      });
      return newState;
    });
    
    setError(null);
    
    try {
      logger.info('Triggering resegmentation for multiple images', { count: imageIds.length, modelType, priority });
      
      if (showToasts) {
        toast.info(
          t('segmentation.resegmentingMultiple', { count: imageIds.length }) || 
          `Starting resegmentation for ${imageIds.length} images...`
        );
      }
      
      // Update all image statuses to 'processing' immediately for better UX
      if (onStatusChange) {
        imageIds.forEach(id => {
          onStatusChange(id, 'processing');
        });
      }
      
      // Call the batch segmentation endpoint with multiple images
      await apiClient.post('/images/segmentation/trigger-batch', {
        imageIds,
        priority,
        model_type: modelType
      });
      
      logger.info('Batch resegmentation triggered successfully', { count: imageIds.length });
      
      if (showToasts) {
        toast.success(
          t('segmentation.resegmentMultipleSuccess', { count: imageIds.length }) || 
          `Resegmentation queued for ${imageIds.length} images`
        );
      }
      
      // Call onSuccess for each image
      if (onSuccess) {
        imageIds.forEach(id => {
          onSuccess(id);
        });
      }
    } catch (err) {
      logger.error('Failed to trigger batch resegmentation', { count: imageIds.length, error: err });
      
      let errorMessage = t('segmentation.resegmentMultipleError') || 'Failed to trigger batch resegmentation';
      
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data?.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      if (showToasts) {
        toast.error(errorMessage);
      }
      
      // Revert statuses if they were changed
      if (onStatusChange) {
        imageIds.forEach(id => {
          onStatusChange(id, 'failed');
        });
      }
    } finally {
      // Mark all images as not resegmenting
      setResegmentingImages(prev => {
        const newState = { ...prev };
        imageIds.forEach(id => {
          newState[id] = false;
        });
        return newState;
      });
    }
  }, [resegmentImage, onSuccess, onStatusChange, showToasts, t, priority, modelType]);
  
  return {
    resegmentImage,
    resegmentImages,
    isResegmenting,
    isAnyResegmenting,
    error
  };
};
