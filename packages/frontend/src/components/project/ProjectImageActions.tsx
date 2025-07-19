import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ProjectImage, ImageStatus } from '@/types'; // Import ImageStatus
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { deleteImageFromDB } from '@/utils/indexedDBService';
import cacheService from '@/services/unifiedCacheService';
import { SEGMENTATION_STATUS } from '@/constants/segmentationStatus';
import { useTranslation } from 'react-i18next';
import logger from '@/utils/logger';

interface UseProjectImageActionsProps {
  projectId?: string;
  onImagesChange: (images: ProjectImage[]) => void;
  images: ProjectImage[];
}

export const useProjectImageActions = ({ projectId, onImagesChange, images }: UseProjectImageActionsProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [isResegmenting, setIsResegmenting] = useState<Record<string, boolean>>({});

  const handleDeleteImage = useCallback(
    async (imageId: string) => {
      setIsDeleting((prev) => ({ ...prev, [imageId]: true }));
      try {
        // Find the project ID for this image
        const image = images.find((img) => img.id === imageId);
        if (!image || !projectId) {
          toast.error(t('images.errors.imageOrProjectNotFound'));
          setIsDeleting((prev) => ({ ...prev, [imageId]: false }));
          return;
        }

        // Use the backend UUID if available, otherwise use the ID directly
        // This allows compatibility with both locally created images and backend images
        const imageUuid = image.imageUuid || imageId;
        logger.debug(`UI image ID: ${imageId}, Backend image UUID: ${imageUuid}, Project ID: ${projectId}`);

        // Ensure projectId is properly formatted - remove "project-" prefix if present
        const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;

        logger.debug(`Deleting image ${imageUuid} from project ${cleanProjectId} (formatted: ${cleanProjectId})`);

        // Check if this is a local image (starts with 'img-')
        const isLocalImage = imageId.startsWith('img-');
        let deletionSuccessful = false;

        // Handle local images (stored in localStorage)
        if (isLocalImage) {
          try {
            // Try both storage key formats
            const storageKeys = [
              `spheroseg_uploaded_images_${cleanProjectId}`,
              `spheroseg_uploaded_images_${cleanProjectId}`,
            ];

            for (const storageKey of storageKeys) {
              const storedImagesJson = localStorage.getItem(storageKey);
              if (storedImagesJson) {
                try {
                  const storedImages = JSON.parse(storedImagesJson);

                  // Ensure storedImages is an array
                  if (Array.isArray(storedImages)) {
                    // Check if the image exists in localStorage before claiming success
                    const imageExists = storedImages.some(
                      (img: unknown) => typeof img === 'object' && img !== null && 'id' in img && img.id === imageId,
                    );

                    if (imageExists) {
                      const filteredImages = storedImages.filter(
                        (img: unknown) =>
                          !(typeof img === 'object' && img !== null && 'id' in img && img.id === imageId),
                      );
                      localStorage.setItem(storageKey, JSON.stringify(filteredImages));
                      logger.debug(`Removed image ${imageId} from localStorage (key: ${storageKey})`);
                      deletionSuccessful = true;

                      // Update the cache as well
                      try {
                        // Import dynamically to avoid circular dependencies
                        const { projectImagesCache } = await import('@/api/projectImages');

                        // Update cache for both key formats
                        [cleanProjectId, cleanProjectId].forEach((cacheKey) => {
                          if (projectImagesCache && projectImagesCache[cacheKey]) {
                            projectImagesCache[cacheKey].data = projectImagesCache[cacheKey].data.filter(
                              (img: unknown) =>
                                !(typeof img === 'object' && img !== null && 'id' in img && img.id === imageId),
                            );
                            logger.debug(`Updated cache for project ${cacheKey}`);
                          }
                        });
                      } catch (cacheError) {
                        logger.error('Error updating image cache:', cacheError);
                      }

                      // Break the loop if we successfully deleted the image
                      break;
                    }
                  } else {
                    logger.warn(`Invalid data format in localStorage for key ${storageKey}, expected array`);
                  }
                } catch (parseError) {
                  logger.error(`Error parsing localStorage data for key ${storageKey}: ${parseError}`);
                }
              } else {
                logger.debug(`No images found in localStorage for key ${storageKey}`);
              }
            }
          } catch (storageErr) {
            logger.error('Error updating localStorage after image deletion:', storageErr);
          }
        }

        // For non-local images or if localStorage removal failed, try the API
        if (!isLocalImage || !deletionSuccessful) {
          // We already have the cleanProjectId from above

          // Try first with the new API endpoint format
          try {
            // Use the actual database ID from the backend if available
            const idToDelete = image.id || imageUuid;
            logger.debug(
              `Attempting to delete image ${idToDelete} using API endpoint: /api/projects/${cleanProjectId}/images/${idToDelete}`,
            );
            await apiClient.delete(`/api/projects/${cleanProjectId}/images/${idToDelete}`);
            logger.debug(`Successfully deleted image ${idToDelete} using primary endpoint`);
            deletionSuccessful = true;
          } catch (deleteErr) {
            logger.warn(`First delete attempt failed, trying legacy endpoint: ${deleteErr}`);

            // If that fails, try with a legacy format
            try {
              // Try with the image UUID if different from ID
              const legacyIdToDelete = image.imageUuid || imageId;
              logger.debug(
                `Attempting to delete image ${legacyIdToDelete} using legacy API endpoint: /api/images/${legacyIdToDelete}`,
              );
              await apiClient.delete(`/api/images/${legacyIdToDelete}`);
              logger.debug(`Successfully deleted image ${legacyIdToDelete} using legacy endpoint`);
              deletionSuccessful = true;
            } catch (legacyErr) {
              logger.error(`Both delete attempts failed: ${legacyErr}`);

              // If both API calls fail but it's a local image (not yet saved to backend),
              // still consider it a success if we already removed it from localStorage
              if (isLocalImage && deletionSuccessful) {
                logger.debug(
                  `Image ${imageId} was successfully removed from localStorage, considering deletion successful`,
                );
                // Already successful from localStorage removal
              } else {
                // Try one more approach - delete from localStorage with the correct key format
                try {
                  const storageKey = `spheroseg_uploaded_images_${cleanProjectId}`;
                  const storedImagesJson = localStorage.getItem(storageKey);

                  if (storedImagesJson) {
                    const storedImages = JSON.parse(storedImagesJson);

                    if (Array.isArray(storedImages)) {
                      // Filter out the image regardless of whether it exists
                      const filteredImages = storedImages.filter(
                        (img: unknown) =>
                          !(typeof img === 'object' && img !== null && 'id' in img && img.id === imageId),
                      );
                      localStorage.setItem(storageKey, JSON.stringify(filteredImages));
                      logger.debug(`Removed image ${imageId} from localStorage as last resort`);
                      deletionSuccessful = true;

                      // Update the cache as well
                      try {
                        const { projectImagesCache } = await import('@/api/projectImages');

                        // Update cache for both key formats
                        [cleanProjectId, cleanProjectId].forEach((cacheKey) => {
                          if (projectImagesCache && projectImagesCache[cacheKey]) {
                            projectImagesCache[cacheKey].data = projectImagesCache[cacheKey].data.filter(
                              (img: unknown) =>
                                !(typeof img === 'object' && img !== null && 'id' in img && img.id === imageId),
                            );
                            logger.debug(`Updated cache for project ${cacheKey}`);
                          }
                        });
                      } catch (cacheError) {
                        logger.error('Error updating image cache:', cacheError);
                      }
                    }
                  }
                } catch (lastResortError) {
                  logger.error('Last resort localStorage deletion failed:', lastResortError);
                  throw legacyErr; // Re-throw the original error
                }

                if (!deletionSuccessful) {
                  throw legacyErr; // Re-throw for the outer catch block if all attempts failed
                }
              }
            }
          }
        }

        // Only update UI and show success message if deletion was successful
        if (deletionSuccessful) {
          // Also delete from IndexedDB if it exists there
          try {
            await deleteImageFromDB(imageId);
            logger.debug(`Deleted image ${imageId} from IndexedDB`);
          } catch (dbError) {
            logger.error('Error deleting image from IndexedDB:', dbError);
            // Continue even if IndexedDB deletion fails
          }

          // Garantovaně vyčistit všechna úložiště a cache
          try {
            // Vyčistíme unified cache
            const cleanedId = projectId?.startsWith('project-') ? projectId.substring(8) : projectId;
            if (cleanedId) {
              // Invalidate project images cache in unified cache service
              await cacheService.delete(`project-images:${cleanedId}`);

              // Also clear by tags
              await cacheService.deleteByTag(`project-${cleanedId}`);

              logger.debug(`Invalidated unified cache for project ${cleanedId}`);
            }

            // Vyčistíme legacy projectImagesCache
            try {
              // Dynamický import pro vyhnutí se cyklickým závislostem
              const { projectImagesCache } = await import('@/api/projectImages');

              if (cleanedId && projectImagesCache && projectImagesCache[cleanedId]) {
                logger.debug(`Invalidating legacy project images cache for project ${cleanedId}`);
                delete projectImagesCache[cleanedId]; // Kompletně vymažeme cache pro tento projekt
              }
            } catch (cacheError) {
              logger.error('Error invalidating legacy project images cache:', cacheError);
            }

            // Vyčistíme localStorage
            try {
              const cleanedId = projectId?.startsWith('project-') ? projectId.substring(8) : projectId;
              if (cleanedId) {
                const storageKeys = [`spheroseg_images_${cleanedId}`, `spheroseg_uploaded_images_${cleanedId}`];

                for (const key of storageKeys) {
                  const storedData = localStorage.getItem(key);
                  if (storedData) {
                    try {
                      const parsedData = JSON.parse(storedData);
                      if (Array.isArray(parsedData)) {
                        // Filtrujeme smazaný obrázek
                        const updatedData = parsedData.filter(
                          (item: unknown) =>
                            !(typeof item === 'object' && item !== null && 'id' in item && item.id === imageId),
                        );
                        localStorage.setItem(key, JSON.stringify(updatedData));
                        logger.debug(`Removed image ${imageId} from localStorage key ${key}`);
                      }
                    } catch (parseError) {
                      logger.error(`Error parsing localStorage data for key ${key}:`, parseError);
                    }
                  }
                }
              }
            } catch (localStorageError) {
              logger.error('Error cleaning localStorage:', localStorageError);
            }

            // Garantovaně znovu načíst seznam obrázků z backendu
            logger.debug(`ProjectImageActions: Fetching fresh project data after image deletion`);

            // Je-li k dispozici projectId, použijeme ho k získání aktuálních dat
            if (projectId) {
              // Pokus získat čerstvá data
              try {
                const cleanedId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;
                logger.debug(`Fetching images for project ${cleanedId} after image deletion`);

                // Explicitně zavoláme getProjectImages pro aktuální data
                const { getProjectImages } = await import('@/api/projectImages');
                const freshImages = await getProjectImages(cleanedId);
                logger.debug(`Successfully loaded ${freshImages.length} fresh images after deletion`);

                // Aktualizovat UI s novými daty
                onImagesChange(freshImages);
              } catch (fetchError) {
                logger.error('Error fetching fresh images after deletion:', fetchError);

                // Jako záloha, pokud se nezdaří aktualizace z API, aktualizujeme lokálně
                const updatedImages = images.filter((img) => img.id !== imageId);
                logger.debug(`Falling back to local update after failed fetch. Images: ${updatedImages.length}`);
                onImagesChange(updatedImages);
              }
            } else {
              // Pokud nemáme projectId, aktualizujeme alespoň lokálně
              const updatedImages = images.filter((img) => img.id !== imageId);
              logger.debug(`No projectId available, updating locally. Images: ${updatedImages.length}`);
              onImagesChange(updatedImages);
            }
          } catch (updateError) {
            logger.error('Failed to update images after deletion:', updateError);

            // Pokud selže vše ostatní, zkusíme základní aktualizaci
            try {
              const updatedImages = images.filter((img) => img.id !== imageId);
              onImagesChange(updatedImages);
            } catch (finalError) {
              logger.warn('Failed to update images with onImagesChange:', finalError);
            }
          }

          // Dispatch a custom event that can be listened to by other components
          logger.debug(
            `ProjectImageActions: Dispatching image-deleted event for ${imageId} in project ${cleanProjectId}`,
          );
          const event = new CustomEvent('image-deleted', {
            detail: {
              imageId,
              projectId: cleanProjectId,
              forceRefresh: true, // Přidáno pro informaci, že je nutná kompletní aktualizace
            },
          });
          window.dispatchEvent(event);

          // Note: We don't dispatch queue-status-update here because:
          // 1. Deleting an image doesn't affect the segmentation queue
          // 2. It causes unnecessary API calls that can fail with permission errors
          // 3. If the deleted image was in the queue, the backend will handle queue cleanup

          if (isLocalImage) {
            toast.success(t('images.success.localImageDeleted'));
          } else {
            toast.success(t('images.success.imageDeleted'));
          }
        } else {
          throw new Error(t('images.errors.failedToDeleteImage'));
        }
      } catch (err: unknown) {
        // Permission errors are already handled by the API client interceptor
        // We just need to log the error for debugging
        logger.error('Error deleting image:', err);

        // Only show a generic error if it's not a permission error
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          // Don't show additional errors for permission-related status codes
          // as they're already handled by the permission error handler
          if (status !== 403 && status !== 500 && status !== 404) {
            const message = err.response?.data?.message || 'Failed to delete image';
            toast.error(message);
          }
        } else if (err instanceof Error) {
          // For non-axios errors, show the message
          toast.error(err.message);
        }
      } finally {
        setIsDeleting((prev) => ({ ...prev, [imageId]: false }));
      }
    },
    [images, onImagesChange, projectId],
  );

  const handleOpenSegmentationEditor = useCallback(
    (imageId: string) => {
      if (!projectId) {
        logger.error('Cannot open editor without project ID');
        toast.error('Cannot open editor: Project context missing.');
        return;
      }
      const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;
      navigate(`/projects/${cleanProjectId}/segmentation/${imageId}`);
    },
    [navigate, projectId],
  );

  // Funkce pro získání aktuálního stavu obrázku z backendu
  const fetchImageStatus = async (imageId: string, projectId: string) => {
    try {
      logger.debug(`Fetching status for image ${imageId} in project ${projectId}`);

      // Zkusíme získat stav obrázku z backendu - použijeme endpoint pro získání detailu obrázku
      const response = await apiClient.get(`/api/projects/${projectId}/images/${imageId}`);

      if (response.data && response.data.segmentationStatus) {
        logger.debug(`Received status for image ${imageId}: ${response.data.segmentationStatus}`);

        // Aktualizujeme stav obrázku v UI
        const updateEvent = new CustomEvent('image-status-update', {
          detail: {
            imageId,
            status: response.data.segmentationStatus,
            forceQueueUpdate: true, // Přidáme flag pro vynucení aktualizace fronty
          },
        });
        window.dispatchEvent(updateEvent);

        // Aktualizujeme také lokální stav
        handleUpdateImageStatus(imageId, response.data.segmentationStatus);
      } else {
        // Alternativně zkusíme získat stav z fronty
        logger.debug(`Trying to get status from queue for image ${imageId}`);
        const queueResponse = await apiClient.get(`/api/segmentation/queue-status/${projectId}`);

        if (queueResponse.data) {
          // Zkontrolujeme, zda je obrázek v seznamu zpracovávaných obrázků
          const processingImages = queueResponse.data.processingImages || [];
          const pendingTasks = queueResponse.data.pendingTasks || [];

          if (processingImages.includes(imageId)) {
            logger.debug(`Image ${imageId} is currently processing`);
            // Aktualizujeme stav obrázku v UI
            const updateEvent = new CustomEvent('image-status-update', {
              detail: {
                imageId,
                status: 'processing',
                forceQueueUpdate: true,
              },
            });
            window.dispatchEvent(updateEvent);

            // Aktualizujeme také lokální stav
            handleUpdateImageStatus(imageId, 'processing');
          } else if (
            pendingTasks.some(
              (task: unknown) =>
                typeof task === 'object' && task !== null && 'imageId' in task && task.imageId === imageId,
            )
          ) {
            logger.debug(`Image ${imageId} is pending in queue`);
            // Aktualizujeme stav obrázku v UI
            const updateEvent = new CustomEvent('image-status-update', {
              detail: {
                imageId,
                status: 'pending',
                forceQueueUpdate: true,
              },
            });
            window.dispatchEvent(updateEvent);

            // Aktualizujeme také lokální stav
            handleUpdateImageStatus(imageId, 'pending');
          }
        }
      }
    } catch (error) {
      logger.error(`Error fetching status for image ${imageId}:`, error);

      // I když se nepodařilo získat stav, aktualizujeme ukazatel fronty
      const queueUpdateEvent = new CustomEvent('queue-status-update', {
        detail: {
          refresh: true,
          projectId: projectId,
          forceRefresh: true,
        },
      });
      window.dispatchEvent(queueUpdateEvent);
    }
  };

  const handleResegment = useCallback(
    async (imageId: string) => {
      setIsResegmenting((prev) => ({ ...prev, [imageId]: true }));
      toast.info('Starting resegmentation with ResUNet neural network...');

      try {
        // 1. Update image status to 'queued' in UI for better UX
        const updatedImagesInitial = images.map((img: ProjectImage) => {
          if (img.id === imageId) {
            return { ...img, segmentationStatus: SEGMENTATION_STATUS.QUEUED as ImageStatus };
          }
          return img;
        });

        // Update local state
        try {
          onImagesChange(updatedImagesInitial);
        } catch (error) {
          logger.warn('Failed to update images with onImagesChange:', error);
        }

        // Always dispatch event to update status in all components
        const updateEvent = new CustomEvent('image-status-update', {
          detail: {
            imageId,
            status: SEGMENTATION_STATUS.QUEUED,
            forceQueueUpdate: true,
          },
        });
        window.dispatchEvent(updateEvent);

        // Update queue status
        setTimeout(() => {
          logger.debug('Dispatching queue-status-update event');
          const queueUpdateEvent = new CustomEvent('queue-status-update', {
            detail: { refresh: true, projectId },
          });
          window.dispatchEvent(queueUpdateEvent);
        }, 100);

        // 2. Call the resegment API endpoint
        if (projectId) {
          const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;

          try {
            logger.debug(`Triggering resegmentation for image ${imageId} in project ${cleanProjectId}`);

            // Use the dedicated resegment endpoint that deletes old data
            const response = await apiClient.post(`/api/segmentation/${imageId}/resegment`, {
              project_id: cleanProjectId,
            });

            logger.debug('Resegmentation API response:', response.data);

            // Update status to 'queued' after successful API call
            const updateEvent = new CustomEvent('image-status-update', {
              detail: { imageId, status: SEGMENTATION_STATUS.QUEUED },
            });
            window.dispatchEvent(updateEvent);

            // Update queue status
            const queueUpdateEvent = new CustomEvent('queue-status-update', {
              detail: {
                refresh: true,
                projectId: cleanProjectId,
                forceRefresh: true,
                immediate: true,
              },
            });
            window.dispatchEvent(queueUpdateEvent);

            // Check status after a delay
            setTimeout(() => {
              const delayedQueueUpdateEvent = new CustomEvent('queue-status-update', {
                detail: {
                  refresh: true,
                  projectId: cleanProjectId,
                  forceRefresh: true,
                },
              });
              window.dispatchEvent(delayedQueueUpdateEvent);

              // Also update image status
              fetchImageStatus(imageId, cleanProjectId);
            }, 500);

            toast.success('Resegmentation task has been queued successfully.');
          } catch (apiErr) {
            logger.error('Resegmentation API call failed:', apiErr);

            // Permission errors are already handled by the API client interceptor
            // Only show generic error for non-permission errors
            if (axios.isAxiosError(apiErr)) {
              const status = apiErr.response?.status;
              // Don't show additional errors for permission-related status codes
              if (status !== 403 && status !== 500 && status !== 404) {
                toast.error('Failed to start resegmentation. Please try again.');
              }
            } else {
              toast.error('Failed to start resegmentation. Please try again.');
            }

            // Reset status on error
            try {
              onImagesChange(
                images.map((img: ProjectImage) => {
                  if (img.id === imageId) {
                    return {
                      ...img,
                      segmentationStatus:
                        img.segmentationStatus || (SEGMENTATION_STATUS.WITHOUT_SEGMENTATION as ImageStatus),
                    };
                  }
                  return img;
                }),
              );
            } catch (error) {
              logger.warn('Failed to update images with onImagesChange:', error);
            }
            throw apiErr;
          }
        } else {
          // Missing projectId
          logger.error('Missing projectId for segmentation');
          toast.error('Missing project ID for segmentation');

          // Reset status
          try {
            onImagesChange(
              images.map((img: ProjectImage) => {
                if (img.id === imageId) {
                  return {
                    ...img,
                    segmentationStatus: img.segmentationStatus || ('without_segmentation' as ImageStatus),
                  };
                }
                return img;
              }),
            );
          } catch (error) {
            logger.warn('Failed to update images with onImagesChange:', error);
          }
          throw new Error('Missing projectId for segmentation');
        }
      } catch (err: unknown) {
        logger.error('Error triggering segmentation:', err);

        let errorMessage = 'Error starting segmentation';
        if (err instanceof Error) {
          errorMessage = `Error: ${err.message}`;
        }

        toast.error(errorMessage);
      } finally {
        setIsResegmenting((prev) => ({ ...prev, [imageId]: false }));
      }
    },
    [images, onImagesChange, projectId],
  );

  const handleNavigateToSegmentation = useCallback(
    (imageId: string) => {
      const image = images.find((img) => img.id === imageId);
      if (!image || !image.imageUuid || !projectId) {
        toast.error(t('images.errors.imageOrProjectNotFoundForNavigation'));
        return;
      }

      const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;

      navigate(`/projects/${cleanProjectId}/segmentation/${image.imageUuid}`);
    },
    [navigate, projectId, images],
  );

  const handleClearSegmentation = useCallback(
    async (imageId: string) => {
      const imageToClear = images.find((img) => img.id === imageId);
      if (!imageToClear || !imageToClear.imageUuid) {
        toast.error(t('images.errors.imageNotFoundForClearingSegmentation'));
        return;
      }
      const imageUuidToClear = imageToClear.imageUuid;

      toast.info(t('images.info.clearingSegmentation', { imageName: imageToClear.name }));
      try {
        await apiClient.delete(`/api/images/${imageUuidToClear}/segmentation`);
        toast.success(t('images.success.segmentationCleared'));

        const updatedImages = images.map((img: ProjectImage) =>
          img.id === imageId
            ? {
                ...img,
                segmentationStatus: 'pending' as ImageStatus,
                segmentationResultPath: null,
              }
            : img,
        );
        try {
          onImagesChange(updatedImages);
        } catch (error) {
          logger.warn('Failed to update images with onImagesChange:', error);
        }
      } catch (error) {
        logger.error('Error clearing segmentation:', error);
        toast.error(t('images.errors.failedToClearSegmentation'));
      }
    },
    [images, onImagesChange],
  );

  const handleUpdateImageStatus = useCallback(
    (imageId: string, status: ImageStatus) => {
      const updatedImages = images.map((img: ProjectImage) =>
        img.id === imageId ? { ...img, segmentationStatus: status } : img,
      );
      try {
        onImagesChange(updatedImages);
      } catch (error) {
        console.warn('Failed to update images with onImagesChange:', error);
      }
    },
    [images, onImagesChange],
  );

  const handleBatchAction = useCallback(
    (action: 'delete' | 'resegment' | 'clear', selectedImageIds: Set<string>) => {
      if (selectedImageIds.size === 0) {
        toast.info(t('images.info.selectAtLeastOneImage'));
        return;
      }

      selectedImageIds.forEach((id) => {
        if (action === 'delete') {
          handleDeleteImage(id);
        } else if (action === 'resegment') {
          handleResegment(id);
        } else if (action === 'clear') {
          handleClearSegmentation(id);
        }
      });
    },
    [handleDeleteImage, handleResegment, handleClearSegmentation],
  );

  return {
    handleDeleteImage,
    handleOpenSegmentationEditor,
    handleResegment,
    handleNavigateToSegmentation,
    handleClearSegmentation,
    handleUpdateImageStatus,
    handleBatchAction,
    isDeleting,
    isResegmenting,
  };
};
