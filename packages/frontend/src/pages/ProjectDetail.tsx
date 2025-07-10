import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ProjectHeader from '@/components/project/ProjectHeader';
import ProjectToolbar from '@/components/project/ProjectToolbar';
import EmptyState from '@/components/project/EmptyState';
import EmptyProjectState from '@/components/EmptyProjectState';
import ProjectImages from '@/components/project/ProjectImages';
import ProjectUploaderSection from '@/components/project/ProjectUploaderSection';
import { useProjectData } from '@/hooks/useProjectData';
import { useImageFilter } from '@/hooks/useImageFilter';
import { useProjectImageActions } from '@/components/project/ProjectImageActions';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Project, ProjectImage, ImageStatus } from '@/types';
import axios from 'axios';
import { useSocket } from '@/contexts/SocketContext';
import * as socketClient from '@/services/socketClient';
import { useExportFunctions } from '@/pages/export/hooks/useExportFunctions';
import { useTranslation } from 'react-i18next';
import logger from '@/utils/logger'; // Import logger

interface UseProjectDataReturn {
  project: Project | null;
  projectTitle: string;
  images: ProjectImage[];
  loading: boolean;
  error: string | null;
  refreshData: () => void;
  updateImageStatus: (imageId: string, status: ImageStatus, resultPath?: string | null) => void;
  setImages: React.Dispatch<React.SetStateAction<ProjectImage[]>>;
}

const ProjectDetail = () => {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const navigate = useNavigate();
  const { t } = useTranslation();

  // logger.debug('ProjectDetail: Received projectId from URL:', id);
  useAuth();
  const { socket, isConnected } = useSocket();

  const [showUploader, setShowUploader] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [segmentAfterUpload, setSegmentAfterUpload] = useState<boolean>(true);
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedImages, setSelectedImages] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const lastSelectedImageRef = useRef<string | null>(null);

  // Funkce pro aktualizaci pouze statistik projektu bez načítání všech obrázků
  const updateProjectStatistics = useCallback(async () => {
    if (!id) return;

    try {
      // TODO: Statistics endpoint not implemented yet
      // const response = await apiClient.get(`/api/projects/${id}/statistics`);

      // For now, just update queue status
      // if (response.data) {
      //   logger.debug('Aktualizovány statistiky projektu:', response.data);

      //   // Oznámíme změnu statistik pomocí event
      //   const statsEvent = new CustomEvent('project-statistics-updated', {
      //     detail: {
      //       projectId: id,
      //       statistics: response.data
      //     }
      //   });
      //   window.dispatchEvent(statsEvent);
      // }

      // Aktualizujeme statistiky fronty bez refreshování stránky
      const queueUpdateEvent = new CustomEvent('queue-status-update', {
        detail: {
          refresh: true,
          projectId: id,
          forceRefresh: true,
        },
      });
      window.dispatchEvent(queueUpdateEvent);
    } catch (error) {
      logger.error('Chyba při aktualizaci statistik projektu:', error);
    }
  }, [id]);

  const {
    projectTitle,
    images,
    loading,
    error: projectError,
    refreshData,
    updateImageStatus,
    setImages: onImagesChange,
  } = useProjectData(id) as UseProjectDataReturn;

  useEffect(() => {
    if (!id) return;

    let isComponentMounted = true;

    // Skip WebSocket setup if socket is not connected
    if (!socket || !isConnected) {
      logger.debug('WebSocket not ready, skipping setup');
      return;
    }

    try {
      logger.debug('Setting up WebSocket connection for project updates');

      const cleanProjectId = (rawId: string): string => {
        if (!rawId) return rawId;

        if (rawId.startsWith('project-')) {
          const cleanedId = rawId.substring(8);
          logger.debug(`Removed 'project-' prefix: ${cleanedId}`);
          return cleanedId;
        }

        return rawId;
      };

      const cleanedId = cleanProjectId(id);
      logger.debug(`Using cleaned project ID: ${cleanedId} (original: ${id})`);

      // Okamžitě načteme data projektu při otevření stránky
      refreshData();

      const handleSegmentationUpdate = (data: any) => {
        if (!isComponentMounted) return;

        logger.debug('Received segmentation update:', data);
        if (data.imageId && data.status) {
          // Aktualizujeme stav obrázku včetně chybové zprávy, pokud existuje
          updateImageStatus(data.imageId, data.status, data.resultPath, data.error);

          if (data.status === 'completed') {
            // Odstraníme toast odsud, protože se zobrazí v handleImageStatusUpdate
            // Namísto refreshData použijeme cílenější aktualizaci
            updateProjectStatistics();
          } else if (data.status === 'failed') {
            // Odstraníme toast odsud, protože se zobrazí v handleImageStatusUpdate

            // Aktualizujeme také stav fronty
            const queueUpdateEvent = new CustomEvent('queue-status-update', {
              detail: {
                refresh: true,
                projectId: id,
                forceRefresh: true,
              },
            });
            window.dispatchEvent(queueUpdateEvent);

            // Namísto refreshData použijeme cílenější aktualizaci
            updateProjectStatistics();
          }
        }
      };

      const handleConnect = () => {
        if (!isComponentMounted) return;

        try {
          // Join the project room in multiple formats to ensure compatibility
          socket.emit('join_project', { projectId: cleanedId });
          socket.emit('join-project', cleanedId);
          socket.emit('join', `project-${cleanedId}`);
          socket.emit('join', `project:${cleanedId}`);
          logger.info(`Joined WebSocket room for project ${cleanedId} in multiple formats`);
        } catch (joinErr: any) {
          // Cast joinErr to any
          logger.error('Failed to join project room:', joinErr);
        }
      };

      socket.on('connect', handleConnect);
      socket.on('segmentation_update', handleSegmentationUpdate);

      if (socket.connected) {
        logger.debug('WebSocket already connected:', socket.id);
        handleConnect();
      } else {
        logger.debug('WebSocket connecting...');
        socket.connect();
      }

      try {
        localStorage.setItem('spheroseg_current_project', cleanedId);
      } catch (e) {
        // Ignore storage errors
      }

      return () => {
        isComponentMounted = false;

        try {
          socket.emit('leave_project', { projectId: cleanedId });
          logger.info(`Left WebSocket room for project ${cleanedId}`);
        } catch (leaveErr: any) {
          // Cast leaveErr to any
          logger.error('Error leaving project room:', leaveErr);
        }

        socket.off('connect', handleConnect);
        socket.off('segmentation_update', handleSegmentationUpdate);

        logger.info('Cleaned up WebSocket event listeners');
      };
    } catch (error: any) {
      // Cast error to any
      logger.error('Error setting up WebSocket:', error);
      toast.error('Failed to connect to real-time updates. Some features may be limited.');

      return () => {
        isComponentMounted = false;
      };
    }
  }, [id, updateImageStatus, updateProjectStatistics, navigate, socket, isConnected]);

  const { filteredImages, searchTerm, sortField, sortDirection, handleSearch, handleSort } = useImageFilter(images);

  const { handleDeleteImage, handleOpenSegmentationEditor, handleResegment } = useProjectImageActions({
    projectId: id,
    onImagesChange: onImagesChange,
    images,
  });

  useEffect(() => {
    if (!id) return;

    const handleImageDeleted = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        projectId: string;
        forceRefresh?: boolean;
      }>;
      const { imageId, projectId: eventProjectId, forceRefresh } = customEvent.detail;

      if (eventProjectId === id || eventProjectId === id?.replace('project-', '')) {
        logger.debug(`ProjectDetail: Received image-deleted event for image ${imageId}, forceRefresh: ${forceRefresh}`);

        // Okamžitě aktualizujeme UI odebráním smazaného obrázku
        onImagesChange((prevImages) => {
          const updatedImages = prevImages.filter((img) => img.id !== imageId);
          logger.debug(
            `ProjectDetail: Filtered out deleted image. Before: ${prevImages.length}, After: ${updatedImages.length}`,
          );
          return updatedImages;
        });

        // Vždy aktualizujeme data projektu pro aktualizaci statistik
        refreshData();

        // Pokud přijde flag forceRefresh, načteme znovu veškerá data ze serveru
        if (forceRefresh) {
          logger.debug('ProjectDetail: Force refreshing project data due to forceRefresh flag');
          setTimeout(() => refreshData(), 100); // Přidáme malé zpoždění pro sekundární refresh
        }

        // Pokud jsme v režimu výběru, odstraníme obrázek z výběru
        if (selectionMode) {
          setSelectedImages((prev) => {
            const updated = { ...prev };
            delete updated[imageId];
            return updated;
          });
        }
      }
    };

    // Posluchač pro aktualizaci stavu obrázku
    const handleImageStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        status: ImageStatus;
        forceQueueUpdate?: boolean;
        error?: string;
        resultPath?: string | null;
      }>;
      const { imageId, status, forceQueueUpdate, error, resultPath } = customEvent.detail;

      logger.debug(`ProjectDetail: Received image-status-update event for image ${imageId} with status ${status}`);

      // Aktualizujeme stav obrázku včetně chybové zprávy, pokud existuje
      updateImageStatus(imageId, status, resultPath, error);

      // Pro jakýkoliv status aktualizujeme ukazatel fronty
      // Aktualizujeme stav fronty
      const queueUpdateEvent = new CustomEvent('queue-status-update', {
        detail: {
          refresh: true,
          projectId: id,
          forceRefresh: true,
          immediate: status === 'processing',
        },
      });
      window.dispatchEvent(queueUpdateEvent);

      // Pokud je status "failed", zobrazíme chybovou zprávu
      if (status === 'failed' && error) {
        toast.error(`Segmentation failed: ${error}`);
      }

      // Pokud je status "completed", zobrazíme úspěšnou zprávu
      if (status === 'completed') {
        toast.success(`Image segmentation completed for ${imageId.substring(0, 8)}...`);

        // For completed status, ensure cache is updated before refreshing
        import('@/api/projectImages').then(({ updateImageStatusInCache }) => {
          updateImageStatusInCache(id!, imageId, status, resultPath).then(() => {
            // Pouze aktualizujeme statistiky nebo jiná potřebná data, nikoliv celý seznam obrázků
            updateProjectStatistics();
          });
        });
      } else if (status === 'failed') {
        // Pro failed status také aktualizujeme statistiky
        updateProjectStatistics();
      }
    };

    window.addEventListener('image-deleted', handleImageDeleted);
    window.addEventListener('image-status-update', handleImageStatusUpdate);

    return () => {
      window.removeEventListener('image-deleted', handleImageDeleted);
      window.removeEventListener('image-status-update', handleImageStatusUpdate);
    };
  }, [id, refreshData, selectionMode]);

  const toggleUploader = () => {
    setShowUploader(!showUploader);
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedImages({});
      setSelectAll(false);
    }
    setSelectionMode(!selectionMode);
  };

  const toggleImageSelection = (imageId: string, event?: React.MouseEvent) => {
    if (event?.shiftKey && lastSelectedImageRef.current) {
      const lastSelectedId = lastSelectedImageRef.current;
      const currentIndex = filteredImages.findIndex((img) => img.id === imageId);
      const lastIndex = filteredImages.findIndex((img) => img.id === lastSelectedId);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const startIdx = Math.min(currentIndex, lastIndex);
        const endIdx = Math.max(currentIndex, lastIndex);
        const imagesToSelect = filteredImages.slice(startIdx, endIdx + 1);

        const newSelectedImages = { ...selectedImages };
        imagesToSelect.forEach((img) => {
          newSelectedImages[img.id] = true;
        });

        setSelectedImages(newSelectedImages);
        return;
      }
    }

    if (event?.ctrlKey || event?.metaKey) {
      setSelectedImages((prev) => ({
        ...prev,
        [imageId]: !prev[imageId],
      }));
    } else {
      setSelectedImages((prev) => ({
        ...prev,
        [imageId]: !prev[imageId],
      }));
      lastSelectedImageRef.current = imageId;
    }
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);

    const newSelectedImages: Record<string, boolean> = {};
    filteredImages.forEach((image) => {
      newSelectedImages[image.id] = newSelectAll;
    });
    setSelectedImages(newSelectedImages);
  };

  const handleBatchResegment = () => {
    const selectedImageIds = Object.entries(selectedImages)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (selectedImageIds.length === 0) {
      toast.error(t('project.detail.noImagesSelected'));
      return;
    }

    toast.info(t('project.detail.triggeringResegmentation', { count: selectedImageIds.length }));

    const updatedImages = images.map((img) => {
      if (selectedImageIds.includes(img.id)) {
        return { ...img, segmentationStatus: 'processing' as ImageStatus };
      }
      return img;
    });

    onImagesChange(updatedImages);

    (async () => {
      // Rozdělení obrázků na menší skupiny (po 5) pro případ, že je omezení na backendu
      const batchSize = 5;
      const batches = [];

      // Rozdělení ID na menší dávky
      for (let i = 0; i < selectedImageIds.length; i += batchSize) {
        batches.push(selectedImageIds.slice(i, i + batchSize));
      }

      logger.debug(`Rozdělení ${selectedImageIds.length} obrázků do ${batches.length} dávek po max ${batchSize}`);

      // Zobrazíme informaci o zpracování
      if (batches.length > 1) {
        toast.info(
          t('project.segmentation.processingInBatches', { count: selectedImageIds.length, batches: batches.length }),
        );
      }

      // Postupné zpracování všech dávek
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.debug(`Zpracování dávky ${i + 1}/${batches.length} s ${batch.length} obrázky`);

        // Přidáme krátké zpoždění mezi dávkami, aby se server nezahltil
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        try {
          const response = await apiClient.post(`/api/segmentations/batch`, {
            imageIds: batch,
            priority: 5,
            model_type: 'resunet',
            projectId: id, // Add projectId here
            parameters: {
              threshold: 0.5,
              model: 'resunet',
            },
          });
          logger.debug(`Batch ${i + 1} trigger response:`, response);
          successCount += batch.length;

          // Informujeme uživatele o průběhu
          if (batches.length > 1) {
            toast.success(t('project.segmentation.batchQueued', { current: i + 1, total: batches.length }));
          }
        } catch (error: any) {
          logger.error(`Batch ${i + 1}: Failed to trigger segmentation:`, error);
          failCount += batch.length;

          // Informujeme uživatele o chybě
          if (batches.length > 1) {
            toast.error(t('project.segmentation.batchError', { current: i + 1, total: batches.length }));
          }
        }
      }

      logger.info(`Total result: ${successCount} successful, ${failCount} failed`);

      // Zobrazíme celkový výsledek
      if (successCount > 0 && failCount > 0) {
        toast.info(`Segmentace: ${successCount} obrázků úspěšně zařazeno do fronty, ${failCount} selhalo`);
      } else if (successCount > 0) {
        toast.success(`Segmentace: Všech ${successCount} obrázků úspěšně zařazeno do fronty`);
      } else if (failCount > 0) {
        toast.error(`Segmentace: Všech ${failCount} obrázků selhalo`);
      }

      // Aktualizujeme data projektu
      setTimeout(() => {
        refreshData();
      }, 2000);
    })();
  };

  const handleBatchDelete = () => {
    const selectedImageIds = Object.entries(selectedImages)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (selectedImageIds.length === 0) {
      toast.error(t('project.detail.noImagesSelected'));
      return;
    }

    if (window.confirm(t('project.detail.deleteConfirmation', { count: selectedImageIds.length }))) {
      toast.info(t('project.detail.deletingImages', { count: selectedImageIds.length }));

      // Don't update UI immediately - wait for API success
      // const remainingImages = images.filter((img) => !selectedImageIds.includes(img.id));
      // onImagesChange(remainingImages);

      (async () => {
        const results = await Promise.allSettled(
          selectedImageIds.map(async (imageId) => {
            try {
              await apiClient.delete(`/api/projects/${id}/images/${imageId}`);
              return { success: true, imageId };
            } catch (newEndpointErr: any) {
              // Cast error to any
              logger.warn(`Failed to delete with new endpoint: ${imageId}`, newEndpointErr);

              try {
                await apiClient.delete(`/api/images/${imageId}`);
                return { success: true, imageId };
              } catch (legacyErr: any) {
                // Cast error to any
                logger.error(`Failed to delete with both endpoints: ${imageId}`, legacyErr);
                return { success: false, imageId, error: legacyErr };
              }
            }
          }),
        );

        const successfulDeletions = results
          .filter((r) => r.status === 'fulfilled' && (r.value as any).success)
          .map((r) => (r.value as any).imageId);
        const failCount = results.length - successfulDeletions.length;

        if (successfulDeletions.length > 0) {
          toast.success(t('project.detail.deleteSuccess', { count: successfulDeletions.length }));
          
          // Update UI only for successfully deleted images
          const remainingImages = images.filter((img) => !successfulDeletions.includes(img.id));
          onImagesChange(remainingImages);
          
          // Clean up caches for deleted images
          for (const imageId of successfulDeletions) {
            try {
              const { cleanImageFromAllStorages } = await import('@/api/projectImages');
              await cleanImageFromAllStorages(id!, imageId);
              
              // Dispatch image-deleted event for each successfully deleted image
              const event = new CustomEvent('image-deleted', {
                detail: {
                  imageId: imageId,
                  projectId: id,
                  forceRefresh: false,
                },
              });
              window.dispatchEvent(event);
            } catch (cleanupError) {
              logger.error(`Failed to clean up storage for image ${imageId}:`, cleanupError);
            }
          }
        }

        if (failCount > 0) {
          toast.error(t('project.detail.deleteFailed', { count: failCount }));
          logger.error(
            'Failed deletions:',
            results.filter((r) => r.status !== 'fulfilled' || !(r.value as any).success),
          );
        }

        // Don't refresh entire gallery - images are already removed from UI
        setSelectedImages({});
        setSelectAll(false);
      })();
    }
  };

  const { handleExport: exportFunction } = useExportFunctions(images, projectTitle);

  const exportSelectedImages = useCallback(() => {
    const selectedImagesToExport = images.filter((img) => selectedImages[img.id]);
    exportFunction(selectedImagesToExport);
  }, [images, selectedImages, exportFunction]);

  const handleBatchExport = () => {
    const selectedImageIds = Object.entries(selectedImages)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (selectedImageIds.length === 0) {
      toast.error(t('project.detail.noImagesSelected'));
      return;
    }

    toast.info(t('project.detail.preparingExport', { count: selectedImageIds.length }));

    exportSelectedImages();
  };

  const handleUploadComplete = useCallback(
    async (projectId: string, uploadedImages: ProjectImage[] | ProjectImage) => {
      logger.debug('Upload complete:', projectId);

      // Immediately add new images to the gallery
      const imagesArray = Array.isArray(uploadedImages) ? uploadedImages : [uploadedImages];
      logger.debug('Handling upload complete with images:', imagesArray);

      // Update local state immediately to show images in gallery
      if (imagesArray.length > 0) {
        onImagesChange((prevImages) => {
          // Filter out any duplicates based on ID
          const existingIds = new Set(prevImages.map((img) => img.id));
          const newImages = imagesArray.filter((img) => img && img.id && !existingIds.has(img.id));
          return [...prevImages, ...newImages];
        });
      }

      // Refresh data after a delay to get any server-side updates
      setTimeout(() => {
        refreshData();
      }, 2000);

      setShowUploader(false);

      const { isValidImageId } = await import('@/api/projectImages');

      if (segmentAfterUpload && imagesArray.length > 0) {
        imagesArray.forEach((img, index) => {
          logger.debug(`Image ${index}:`, img);
          if (!img || !img.id) {
            logger.warn(`Image ${index} has invalid ID:`, img);
          }
        });

        const validImages = imagesArray.filter((img) => img && img.id && isValidImageId(img.id));
        const imageIdsForSegmentation = validImages.map((img) => img.id);
        const uiImageIdsToUpdate = validImages.map((img) => img.id);

        logger.debug('Valid image IDs for segmentation API:', imageIdsForSegmentation);

        if (imageIdsForSegmentation.length === 0) {
          logger.error('No valid image IDs found for segmentation');
          toast.error('No images ready for server segmentation (missing IDs).');
          return;
        }

        toast.info(`Triggering segmentation for ${imageIdsForSegmentation.length} uploaded image(s)...`);

        uiImageIdsToUpdate.forEach((id) => {
          updateImageStatus(id, 'processing');
        });

        let apiSuccess = false;

        // Rozdělení obrázků na menší skupiny (po 5) pro případ, že je omezení na backendu
        // Snížíme velikost dávky na 5, aby se snížila pravděpodobnost chyby
        const batchSize = 5;
        const batches = [];

        // Rozdělení ID na menší dávky
        for (let i = 0; i < imageIdsForSegmentation.length; i += batchSize) {
          batches.push(imageIdsForSegmentation.slice(i, i + batchSize));
        }

        logger.debug(
          `Rozdělení ${imageIdsForSegmentation.length} obrázků do ${batches.length} dávek po max ${batchSize}`,
        );

        // Zobrazíme informaci o zpracování
        if (batches.length > 1) {
          toast.info(
            t('project.segmentation.processingInBatches', {
              count: imageIdsForSegmentation.length,
              batches: batches.length,
            }),
          );
        }

        // Postupné zpracování všech dávek
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          logger.debug(`Zpracování dávky ${i + 1}/${batches.length} s ${batch.length} obrázky`);

          // Přidáme krátké zpoždění mezi dávkami, aby se server nezahltil
          if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          try {
            const response = await apiClient.post(`/api/segmentations/batch`, {
              imageIds: batch,
              priority: 3,
              model_type: 'resunet',
              projectId: projectId, // Add projectId here
              parameters: {
                threshold: 0.5,
                model: 'resunet',
              },
            });
            logger.debug(`Batch ${i + 1} trigger response:`, response);
            successCount += batch.length;
            apiSuccess = true;

            // Informujeme uživatele o průběhu
            if (batches.length > 1) {
              toast.success(t('project.segmentation.batchQueued', { current: i + 1, total: batches.length }));
            }
          } catch (error: any) {
            logger.warn(`Batch ${i + 1}: Failed to trigger segmentation:`, error);
            failCount += batch.length;

            // Informujeme uživatele o chybě
            if (batches.length > 1) {
              toast.error(t('project.segmentation.batchError', { current: i + 1, total: batches.length }));
            }
          }
        }

        logger.info(`Total result: ${successCount} successful, ${failCount} failed`);

        // Zobrazíme celkový výsledek
        if (successCount > 0 && failCount > 0) {
          toast.info(`Segmentace: ${successCount} obrázků úspěšně zařazeno do fronty, ${failCount} selhalo`);
        } else if (successCount > 0) {
          toast.success(`Segmentace: Všech ${successCount} obrázků úspěšně zařazeno do fronty`);
        } else if (failCount > 0) {
          toast.error(`Segmentace: Všech ${failCount} obrázků selhalo`);
        }
        apiSuccess = successCount > 0;

        if (apiSuccess) {
          toast.success(t('project.segmentation.startedImages', { count: imageIdsForSegmentation.length }));
        } else {
          toast.warning(t('project.segmentation.queuedLocallyWarning', { count: imageIdsForSegmentation.length }));
        }

        setTimeout(() => {
          refreshData();
        }, 2000);
      }
    },
    [segmentAfterUpload, refreshData, images, apiClient, updateImageStatus, id],
  );

  const handleOpenImage = (imageId: string) => {
    handleOpenSegmentationEditor(imageId);
  };

  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };

  // Handle loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Handle error state
  if (projectError || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <p className="text-gray-600 mb-4">{projectError || 'The requested project could not be found.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 dark:bg-blue-400/10 rounded-full filter blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 dark:bg-blue-500/10 rounded-full filter blur-3xl animate-float"
          style={{ animationDelay: '-2s' }}
        />
        <div
          className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 dark:bg-blue-600/10 rounded-full filter blur-3xl animate-float"
          style={{ animationDelay: '-4s' }}
        />
      </div>

      <ProjectHeader
        projectTitle={projectTitle}
        imagesCount={filteredImages.length}
        loading={loading}
        projectId={id || ''}
      />

      <div className="container mx-auto px-4 py-8">
        {showUploader ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {id ? (
              <ProjectUploaderSection
                projectId={id}
                onCancel={toggleUploader}
                onUploadComplete={(uploadedImages: ProjectImage[] | ProjectImage) => {
                  const imagesArray = Array.isArray(uploadedImages) ? uploadedImages : [uploadedImages];
                  if (id) {
                    handleUploadComplete(id, imagesArray);
                  } else {
                    logger.error('Project ID is missing in onUploadComplete wrapper');
                    toast.error('An error occurred during upload completion.');
                  }
                }}
                segmentAfterUpload={segmentAfterUpload}
                onSegmentAfterUploadChange={setSegmentAfterUpload}
              />
            ) : (
              <p>Error: Project ID is missing.</p>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <ProjectToolbar
              searchTerm={searchTerm}
              onSearchChange={handleSearch}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onToggleUploader={toggleUploader}
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectionMode={selectionMode}
              onToggleSelectionMode={toggleSelectionMode}
              showStatusSort={true}
            />

            {loading ? (
              <motion.div
                className="flex justify-center items-center h-64"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              </motion.div>
            ) : projectError ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
                  <h3 className="text-red-800 font-medium">Error loading project</h3>
                  <p className="text-red-600">
                    {projectError || 'An unknown error occurred while loading the project.'}
                  </p>
                </div>
              </motion.div>
            ) : filteredImages.length === 0 && !searchTerm ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <EmptyProjectState projectId={id || ''} onUploadClick={toggleUploader} />
              </motion.div>
            ) : filteredImages.length === 0 && searchTerm ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <EmptyState hasSearchTerm={true} onUpload={toggleUploader} />
              </motion.div>
            ) : (
              <ProjectImages
                images={filteredImages}
                onDelete={handleDeleteImage}
                onOpen={handleOpenImage}
                onResegment={handleResegment}
                viewMode={viewMode}
                selectionMode={selectionMode}
                selectedImages={selectedImages}
                onToggleSelection={toggleImageSelection}
                selectAll={selectAll}
                onToggleSelectAll={toggleSelectAll}
                onBatchResegment={handleBatchResegment}
                onBatchDelete={handleBatchDelete}
                onBatchExport={handleBatchExport}
              />
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default ProjectDetail;
