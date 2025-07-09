import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ProjectImage, ImageStatus } from '@/types'; // Import ImageStatus
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { deleteImageFromDB } from '@/utils/indexedDBService';
import cacheService from '@/services/unifiedCacheService';
import { SEGMENTATION_STATUS } from '@/constants/segmentationStatus';

interface UseProjectImageActionsProps {
  projectId?: string;
  onImagesChange: (images: ProjectImage[]) => void;
  images: ProjectImage[];
}

export const useProjectImageActions = ({ projectId, onImagesChange, images }: UseProjectImageActionsProps) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [isResegmenting, setIsResegmenting] = useState<Record<string, boolean>>({});

  const handleDeleteImage = useCallback(
    async (imageId: string) => {
      setIsDeleting((prev) => ({ ...prev, [imageId]: true }));
      try {
        // Find the project ID for this image
        const image = images.find((img) => img.id === imageId);
        if (!image || !projectId) {
          toast.error('Obrázek nebo projekt nebyl nalezen.');
          setIsDeleting((prev) => ({ ...prev, [imageId]: false }));
          return;
        }

        // Use the backend UUID if available, otherwise use the ID directly
        // This allows compatibility with both locally created images and backend images
        const imageUuid = image.imageUuid || imageId;
        console.log(`UI image ID: ${imageId}, Backend image UUID: ${imageUuid}, Project ID: ${projectId}`);

        // Ensure projectId is properly formatted - remove "project-" prefix if present
        const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;

        console.log(`Deleting image ${imageUuid} from project ${cleanProjectId} (formatted: ${cleanProjectId})`);

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
                    const imageExists = storedImages.some((img: any) => img.id === imageId);

                    if (imageExists) {
                      const filteredImages = storedImages.filter((img: any) => img.id !== imageId);
                      localStorage.setItem(storageKey, JSON.stringify(filteredImages));
                      console.log(`Removed image ${imageId} from localStorage (key: ${storageKey})`);
                      deletionSuccessful = true;

                      // Update the cache as well
                      try {
                        // Import dynamically to avoid circular dependencies
                        const { projectImagesCache } = await import('@/api/projectImages');

                        // Update cache for both key formats
                        [cleanProjectId, cleanProjectId].forEach((cacheKey) => {
                          if (projectImagesCache && projectImagesCache[cacheKey]) {
                            projectImagesCache[cacheKey].data = projectImagesCache[cacheKey].data.filter(
                              (img: any) => img.id !== imageId,
                            );
                            console.log(`Updated cache for project ${cacheKey}`);
                          }
                        });
                      } catch (cacheError) {
                        console.error('Error updating image cache:', cacheError);
                      }

                      // Break the loop if we successfully deleted the image
                      break;
                    }
                  } else {
                    console.warn(`Invalid data format in localStorage for key ${storageKey}, expected array`);
                  }
                } catch (parseError) {
                  console.error(`Error parsing localStorage data for key ${storageKey}: ${parseError}`);
                }
              } else {
                console.warn(`No images found in localStorage for key ${storageKey}`);
              }
            }
          } catch (storageErr) {
            console.error('Error updating localStorage after image deletion:', storageErr);
          }
        }

        // For non-local images or if localStorage removal failed, try the API
        if (!isLocalImage || !deletionSuccessful) {
          // We already have the cleanProjectId from above

          // Try first with the new API endpoint format
          try {
            // Use the actual database ID from the backend if available
            const idToDelete = image.id || imageUuid;
            console.log(
              `Attempting to delete image ${idToDelete} using API endpoint: /api/projects/${cleanProjectId}/images/${idToDelete}`,
            );
            await apiClient.delete(`/api/projects/${cleanProjectId}/images/${idToDelete}`);
            console.log(`Successfully deleted image ${idToDelete} using primary endpoint`);
            deletionSuccessful = true;
          } catch (deleteErr) {
            console.warn(`First delete attempt failed, trying legacy endpoint: ${deleteErr}`);

            // If that fails, try with a legacy format
            try {
              // Try with the image UUID if different from ID
              const legacyIdToDelete = image.imageUuid || imageId;
              console.log(
                `Attempting to delete image ${legacyIdToDelete} using legacy API endpoint: /api/images/${legacyIdToDelete}`,
              );
              await apiClient.delete(`/api/images/${legacyIdToDelete}`);
              console.log(`Successfully deleted image ${legacyIdToDelete} using legacy endpoint`);
              deletionSuccessful = true;
            } catch (legacyErr) {
              console.error(`Both delete attempts failed: ${legacyErr}`);

              // If both API calls fail but it's a local image (not yet saved to backend),
              // still consider it a success if we already removed it from localStorage
              if (isLocalImage && deletionSuccessful) {
                console.log(
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
                      const filteredImages = storedImages.filter((img: any) => img.id !== imageId);
                      localStorage.setItem(storageKey, JSON.stringify(filteredImages));
                      console.log(`Removed image ${imageId} from localStorage as last resort`);
                      deletionSuccessful = true;

                      // Update the cache as well
                      try {
                        const { projectImagesCache } = await import('@/api/projectImages');

                        // Update cache for both key formats
                        [cleanProjectId, cleanProjectId].forEach((cacheKey) => {
                          if (projectImagesCache && projectImagesCache[cacheKey]) {
                            projectImagesCache[cacheKey].data = projectImagesCache[cacheKey].data.filter(
                              (img: any) => img.id !== imageId,
                            );
                            console.log(`Updated cache for project ${cacheKey}`);
                          }
                        });
                      } catch (cacheError) {
                        console.error('Error updating image cache:', cacheError);
                      }
                    }
                  }
                } catch (lastResortError) {
                  console.error('Last resort localStorage deletion failed:', lastResortError);
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
            console.log(`Deleted image ${imageId} from IndexedDB`);
          } catch (dbError) {
            console.error('Error deleting image from IndexedDB:', dbError);
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

              console.log(`Invalidated unified cache for project ${cleanedId}`);
            }

            // Vyčistíme legacy projectImagesCache
            try {
              // Dynamický import pro vyhnutí se cyklickým závislostem
              const { projectImagesCache } = await import('@/api/projectImages');

              if (cleanedId && projectImagesCache && projectImagesCache[cleanedId]) {
                console.log(`Invalidating legacy project images cache for project ${cleanedId}`);
                delete projectImagesCache[cleanedId]; // Kompletně vymažeme cache pro tento projekt
              }
            } catch (cacheError) {
              console.error('Error invalidating legacy project images cache:', cacheError);
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
                        const updatedData = parsedData.filter((item: any) => item.id !== imageId);
                        localStorage.setItem(key, JSON.stringify(updatedData));
                        console.log(`Removed image ${imageId} from localStorage key ${key}`);
                      }
                    } catch (parseError) {
                      console.error(`Error parsing localStorage data for key ${key}:`, parseError);
                    }
                  }
                }
              }
            } catch (localStorageError) {
              console.error('Error cleaning localStorage:', localStorageError);
            }

            // Garantovaně znovu načíst seznam obrázků z backendu
            console.log(`ProjectImageActions: Fetching fresh project data after image deletion`);

            // Je-li k dispozici projectId, použijeme ho k získání aktuálních dat
            if (projectId) {
              // Pokus získat čerstvá data
              try {
                const cleanedId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;
                console.log(`Fetching images for project ${cleanedId} after image deletion`);

                // Explicitně zavoláme getProjectImages pro aktuální data
                const { getProjectImages } = await import('@/api/projectImages');
                const freshImages = await getProjectImages(cleanedId);
                console.log(`Successfully loaded ${freshImages.length} fresh images after deletion`);

                // Aktualizovat UI s novými daty
                onImagesChange(freshImages);
              } catch (fetchError) {
                console.error('Error fetching fresh images after deletion:', fetchError);

                // Jako záloha, pokud se nezdaří aktualizace z API, aktualizujeme lokálně
                const updatedImages = images.filter((img) => img.id !== imageId);
                console.log(`Falling back to local update after failed fetch. Images: ${updatedImages.length}`);
                onImagesChange(updatedImages);
              }
            } else {
              // Pokud nemáme projectId, aktualizujeme alespoň lokálně
              const updatedImages = images.filter((img) => img.id !== imageId);
              console.log(`No projectId available, updating locally. Images: ${updatedImages.length}`);
              onImagesChange(updatedImages);
            }
          } catch (updateError) {
            console.error('Failed to update images after deletion:', updateError);

            // Pokud selže vše ostatní, zkusíme základní aktualizaci
            try {
              const updatedImages = images.filter((img) => img.id !== imageId);
              onImagesChange(updatedImages);
            } catch (finalError) {
              console.warn('Failed to update images with onImagesChange:', finalError);
            }
          }

          // Dispatch a custom event that can be listened to by other components
          console.log(
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

          // Also dispatch an event to update queue status if needed
          const queueUpdateEvent = new CustomEvent('queue-status-update', {
            detail: {
              refresh: true,
              projectId: cleanProjectId,
              forceRefresh: true,
            },
          });
          window.dispatchEvent(queueUpdateEvent);

          if (isLocalImage) {
            toast.success('Lokální obrázek byl úspěšně odstraněn');
          } else {
            toast.success('Obrázek byl úspěšně smazán');
          }
        } else {
          throw new Error('Nepodařilo se smazat obrázek');
        }
      } catch (err: unknown) {
        let message = 'Failed to delete image';
        if (axios.isAxiosError(err)) {
          message = err.response?.data?.message || message;
        } else if (err instanceof Error) {
          message = err.message;
        }
        console.error('Error deleting image:', err);
        toast.error(message);
      } finally {
        setIsDeleting((prev) => ({ ...prev, [imageId]: false }));
      }
    },
    [images, onImagesChange, projectId],
  );

  const handleOpenSegmentationEditor = useCallback(
    (imageId: string) => {
      if (!projectId) {
        console.error('Cannot open editor without project ID');
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
      console.log(`Fetching status for image ${imageId} in project ${projectId}`);

      // Zkusíme získat stav obrázku z backendu - použijeme endpoint pro získání detailu obrázku
      const response = await apiClient.get(`/api/projects/${projectId}/images/${imageId}`);

      if (response.data && response.data.segmentationStatus) {
        console.log(`Received status for image ${imageId}: ${response.data.segmentationStatus}`);

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
        console.log(`Trying to get status from queue for image ${imageId}`);
        const queueResponse = await apiClient.get(`/api/segmentations/queue/status/${projectId}`);

        if (queueResponse.data) {
          // Zkontrolujeme, zda je obrázek v seznamu zpracovávaných obrázků
          const processingImages = queueResponse.data.processingImages || [];
          const pendingTasks = queueResponse.data.pendingTasks || [];

          if (processingImages.includes(imageId)) {
            console.log(`Image ${imageId} is currently processing`);
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
          } else if (pendingTasks.some((task: any) => task.imageId === imageId)) {
            console.log(`Image ${imageId} is pending in queue`);
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
      console.error(`Error fetching status for image ${imageId}:`, error);

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
          console.warn('Failed to update images with onImagesChange:', error);
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
          console.log('Dispatching queue-status-update event');
          const queueUpdateEvent = new CustomEvent('queue-status-update', {
            detail: { refresh: true, projectId },
          });
          window.dispatchEvent(queueUpdateEvent);
        }, 100);

        // 2. Call the resegment API endpoint
        if (projectId) {
          const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;

          try {
            console.log(`Triggering resegmentation for image ${imageId} in project ${cleanProjectId}`);

            // Use the dedicated resegment endpoint that deletes old data
            const response = await apiClient.post(`/api/segmentation/${imageId}/resegment`, {
              project_id: cleanProjectId,
            });

            console.log('Resegmentation API response:', response.data);

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
            console.error('Resegmentation API call failed:', apiErr);
            toast.error('Failed to start resegmentation. Please try again.');

            // Reset status on error
            try {
              onImagesChange(
                images.map((img: ProjectImage) => {
                  if (img.id === imageId) {
                    return {
                      ...img,
                      segmentationStatus: img.segmentationStatus || (SEGMENTATION_STATUS.WITHOUT_SEGMENTATION as ImageStatus),
                    };
                  }
                  return img;
                }),
              );
            } catch (error) {
              console.warn('Failed to update images with onImagesChange:', error);
            }
            throw apiErr;
          }
        } else {
          // Missing projectId
          console.error('Missing projectId for segmentation');
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
            console.warn('Failed to update images with onImagesChange:', error);
          }
          throw new Error('Missing projectId for segmentation');
        }
      } catch (err: unknown) {
        console.error('Error triggering segmentation:', err);

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
        toast.error('Obrázek nebo projekt nebyl nalezen pro navigaci, nebo chybí UUID.');
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
        toast.error('Obrázek pro vymazání segmentace nebyl nalezen nebo chybí UUID.');
        return;
      }
      const imageUuidToClear = imageToClear.imageUuid;

      toast.info(`Mažu segmentaci pro obrázek ${imageToClear.name}...`);
      try {
        await apiClient.delete(`/api/images/${imageUuidToClear}/segmentation`);
        toast.success('Segmentace byla úspěšně odstraněna.');

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
          console.warn('Failed to update images with onImagesChange:', error);
        }
      } catch (error) {
        console.error('Error clearing segmentation:', error);
        toast.error('Nepodařilo se odstranit segmentaci');
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
        toast.info('Vyberte prosím alespoň jeden obrázek.');
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
