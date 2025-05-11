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
import socketClient from '@/socketClient';
import { useExportFunctions } from '@/pages/export/hooks/useExportFunctions';

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

  console.log('ProjectDetail: Received projectId from URL:', id);
  useAuth();

  const [showUploader, setShowUploader] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [segmentAfterUpload, setSegmentAfterUpload] = useState<boolean>(true);
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedImages, setSelectedImages] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const lastSelectedImageRef = useRef<string | null>(null);

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

    try {
      console.log('Setting up WebSocket connection for project updates');

      const cleanProjectId = (rawId: string): string => {
        if (!rawId) return rawId;

        if (rawId.startsWith('project-')) {
          const cleanedId = rawId.substring(8);
          console.log(`Removed 'project-' prefix: ${cleanedId}`);
          return cleanedId;
        }

        return rawId;
      };

      const cleanedId = cleanProjectId(id);
      console.log(`Using cleaned project ID: ${cleanedId} (original: ${id})`);

      // Okamžitě načteme data projektu při otevření stránky
      refreshData();

      apiClient
        .get(`/api/projects/${cleanedId}`)
        .then(() => {
          console.log(`Project ${cleanedId} verified as existing`);
        })
        .catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.log(`Project ${cleanedId} not found, redirecting to dashboard`);
            navigate('/dashboard', { replace: true });
            return;
          }
          console.warn('Error verifying project:', err);
        });

      const socket = socketClient.getSocket();

      const handleSegmentationUpdate = (data: any) => {
        if (!isComponentMounted) return;

        console.log('Received segmentation update:', data);
        if (data.imageId && data.status) {
          // Aktualizujeme stav obrázku včetně chybové zprávy, pokud existuje
          updateImageStatus(data.imageId, data.status, data.resultPath, data.error);

          if (data.status === 'completed') {
            toast.success(`Image segmentation complete for ${data.imageId.substring(0, 8)}...`);
            refreshData();
          } else if (data.status === 'failed') {
            const errorMessage = data.error || 'Unknown error';
            toast.error(`Segmentation failed: ${errorMessage}`);

            // Aktualizujeme také stav fronty
            const queueUpdateEvent = new CustomEvent('queue-status-update', {
              detail: {
                refresh: true,
                projectId: id,
                forceRefresh: true,
              },
            });
            window.dispatchEvent(queueUpdateEvent);

            refreshData();
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
          console.log(`Joined WebSocket room for project ${cleanedId} in multiple formats`);
        } catch (joinErr) {
          console.error('Failed to join project room:', joinErr);
        }
      };

      socket.on('connect', handleConnect);
      socket.on('segmentation_update', handleSegmentationUpdate);

      if (socket.connected) {
        console.log('WebSocket already connected:', socket.id);
        handleConnect();
      } else {
        console.log('WebSocket connecting...');
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
          console.log(`Left WebSocket room for project ${cleanedId}`);
        } catch (leaveErr) {
          console.error('Error leaving project room:', leaveErr);
        }

        socket.off('connect', handleConnect);
        socket.off('segmentation_update', handleSegmentationUpdate);

        console.log('Cleaned up WebSocket event listeners');
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      toast.error('Failed to connect to real-time updates. Some features may be limited.');

      return () => {
        isComponentMounted = false;
      };
    }
  }, [id, updateImageStatus, refreshData, navigate]);

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
        console.log(`ProjectDetail: Received image-deleted event for image ${imageId}, forceRefresh: ${forceRefresh}`);

        // Okamžitě aktualizujeme UI odebráním smazaného obrázku
        setImages(prevImages => {
          const updatedImages = prevImages.filter(img => img.id !== imageId);
          console.log(`ProjectDetail: Filtered out deleted image. Before: ${prevImages.length}, After: ${updatedImages.length}`);
          return updatedImages;
        });

        // Vždy aktualizujeme data projektu pro aktualizaci statistik
        refreshData();

        // Pokud přijde flag forceRefresh, načteme znovu veškerá data ze serveru
        if (forceRefresh) {
          console.log('ProjectDetail: Force refreshing project data due to forceRefresh flag');
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

      console.log(`ProjectDetail: Received image-status-update event for image ${imageId} with status ${status}`);

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
      }

      // Pro všechny stavy okamžitě aktualizujeme data projektu
      refreshData();
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
      toast.error('No images selected');
      return;
    }

    toast.info(`Triggering re-segmentation for ${selectedImageIds.length} images...`);

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

      console.log(`Rozdělení ${selectedImageIds.length} obrázků do ${batches.length} dávek po max ${batchSize}`);

      // Zobrazíme informaci o zpracování
      if (batches.length > 1) {
        toast.info(`Spouštění segmentace pro ${selectedImageIds.length} obrázků v ${batches.length} dávkách...`);
      }

      // Postupné zpracování všech dávek
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`Zpracování dávky ${i+1}/${batches.length} s ${batch.length} obrázky`);

          // Přidáme krátké zpoždění mezi dávkami, aby se server nezahltil
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          try {
              // Zkusit nejprve nový endpoint s validními parametry
              const response = await apiClient.post(`/api/projects/${id}/segmentations/batch`, {
                  imageIds: batch,
                  priority: 5,
                  model_type: 'resunet',
                  // Přidáme další parametry pro validaci
                  parameters: {
                    threshold: 0.5,
                    model: 'resunet'
                  }
              });
              console.log(`Batch ${i+1} trigger response (new endpoint):`, response);
              successCount += batch.length;

              // Informujeme uživatele o průběhu
              if (batches.length > 1) {
                toast.success(`Dávka ${i+1}/${batches.length} úspěšně zařazena do fronty`);
              }
          } catch (newEndpointErr) {
              console.warn(`Batch ${i+1}: New endpoint failed, trying legacy endpoint:`, newEndpointErr);

              try {
                  // Zkusit záložní endpoint s validními parametry
                  const legacyResponse = await apiClient.post(`/api/segmentations/batch`, {
                      imageIds: batch,
                      priority: 5,
                      model_type: 'resunet',
                      // Přidáme další parametry pro validaci
                      parameters: {
                        threshold: 0.5,
                        model: 'resunet'
                      }
                  });
                  console.log(`Batch ${i+1} trigger response (legacy endpoint):`, legacyResponse);
                  successCount += batch.length;

                  // Informujeme uživatele o průběhu
                  if (batches.length > 1) {
                    toast.success(`Dávka ${i+1}/${batches.length} úspěšně zařazena do fronty (záložní endpoint)`);
                  }
              } catch (legacyErr) {
                  console.error(`Batch ${i+1}: Both endpoints failed:`, legacyErr);
                  failCount += batch.length;

                  // Informujeme uživatele o chybě
                  if (batches.length > 1) {
                    toast.error(`Chyba při zpracování dávky ${i+1}/${batches.length}`);
                  }
              }
          }
      }

      console.log(`Celkový výsledek: ${successCount} úspěšně, ${failCount} selhalo`);

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
      toast.error('No images selected');
      return;
    }

    if (
      window.confirm(`Are you sure you want to delete ${selectedImageIds.length} images? This action cannot be undone.`)
    ) {
      toast.info(`Deleting ${selectedImageIds.length} images...`);

      const remainingImages = images.filter((img) => !selectedImageIds.includes(img.id));
      onImagesChange(remainingImages);

      (async () => {
        const results = await Promise.allSettled(
          selectedImageIds.map(async (imageId) => {
            try {
              await apiClient.delete(`/api/projects/${id}/images/${imageId}`);
              return { success: true, imageId };
            } catch (newEndpointErr) {
              console.warn(`Failed to delete with new endpoint: ${imageId}`, newEndpointErr);

              try {
                await apiClient.delete(`/api/images/${imageId}`);
                return { success: true, imageId };
              } catch (legacyErr) {
                console.error(`Failed to delete with both endpoints: ${imageId}`, legacyErr);
                return { success: false, imageId, error: legacyErr };
              }
            }
          }),
        );

        const successCount = results.filter((r) => r.status === 'fulfilled' && (r.value as any).success).length;
        const failCount = results.length - successCount;

        if (successCount > 0) {
          toast.success(`Successfully deleted ${successCount} images`);
        }

        if (failCount > 0) {
          toast.error(`Failed to delete ${failCount} images`);
          console.error(
            'Failed deletions:',
            results.filter((r) => r.status !== 'fulfilled' || !(r.value as any).success),
          );
        }

        refreshData();
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
      toast.error('No images selected');
      return;
    }

    toast.info(`Preparing export of ${selectedImageIds.length} images...`);

    exportSelectedImages();
  };

  const handleUploadComplete = useCallback(
    async (projectId: string, uploadedImages: ProjectImage[] | ProjectImage) => {
      console.log('Upload complete:', projectId);
      refreshData();
      setShowUploader(false);

      const imagesArray = Array.isArray(uploadedImages) ? uploadedImages : [uploadedImages];

      console.log('Handling upload complete with images:', imagesArray);

      const { isValidImageId } = await import('@/api/projectImages');

      if (segmentAfterUpload && imagesArray.length > 0) {
        imagesArray.forEach((img, index) => {
          console.log(`Image ${index}:`, img);
          if (!img || !img.id) {
            console.warn(`Image ${index} has invalid ID:`, img);
          }
        });

        const validImages = imagesArray.filter((img) => img && img.id && isValidImageId(img.id));
        const imageIdsForSegmentation = validImages.map((img) => img.id);
        const uiImageIdsToUpdate = validImages.map((img) => img.id);

        console.log('Valid image IDs for segmentation API:', imageIdsForSegmentation);

        if (imageIdsForSegmentation.length === 0) {
          console.error('No valid image IDs found for segmentation');
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

        console.log(`Rozdělení ${imageIdsForSegmentation.length} obrázků do ${batches.length} dávek po max ${batchSize}`);

        // Zobrazíme informaci o zpracování
        if (batches.length > 1) {
          toast.info(`Spouštění segmentace pro ${imageIdsForSegmentation.length} obrázků v ${batches.length} dávkách...`);
        }

        // Postupné zpracování všech dávek
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`Zpracování dávky ${i+1}/${batches.length} s ${batch.length} obrázky`);

            // Přidáme krátké zpoždění mezi dávkami, aby se server nezahltil
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

            try {
                // Zkusit nejprve nový endpoint s validními parametry
                const response = await apiClient.post(`/api/projects/${projectId}/segmentations/batch`, {
                    imageIds: batch,
                    priority: 3,
                    model_type: 'resunet',
                    // Přidáme další parametry pro validaci
                    parameters: {
                      threshold: 0.5,
                      model: 'resunet'
                    }
                });
                console.log(`Batch ${i+1} trigger response (new endpoint):`, response);
                successCount += batch.length;
                apiSuccess = true;

                // Informujeme uživatele o průběhu
                if (batches.length > 1) {
                  toast.success(`Dávka ${i+1}/${batches.length} úspěšně zařazena do fronty`);
                }
            } catch (newEndpointErr) {
                console.warn(`Batch ${i+1}: New endpoint failed, trying legacy endpoint:`, newEndpointErr);

                try {
                    // Zkusit záložní endpoint s validními parametry
                    const legacyResponse = await apiClient.post(`/api/segmentations/batch`, {
                        imageIds: batch,
                        priority: 3,
                        model_type: 'resunet',
                        // Přidáme další parametry pro validaci
                        parameters: {
                          threshold: 0.5,
                          model: 'resunet'
                        }
                    });
                    console.log(`Batch ${i+1} trigger response (legacy endpoint):`, legacyResponse);
                    successCount += batch.length;
                    apiSuccess = true;

                    // Informujeme uživatele o průběhu
                    if (batches.length > 1) {
                      toast.success(`Dávka ${i+1}/${batches.length} úspěšně zařazena do fronty (záložní endpoint)`);
                    }
                } catch (legacyErr) {
                    console.error(`Batch ${i+1}: Both endpoints failed:`, legacyErr);
                    failCount += batch.length;

                    // Informujeme uživatele o chybě
                    if (batches.length > 1) {
                      toast.error(`Chyba při zpracování dávky ${i+1}/${batches.length}`);
                    }
                }
            }
        }

        console.log(`Celkový výsledek: ${successCount} úspěšně, ${failCount} selhalo`);

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
          toast.success(`Segmentation started for ${imageIdsForSegmentation.length} images`);
        } else {
          toast.warning(
            `Segmentation queued locally for ${imageIdsForSegmentation.length} images. Server connection failed.`,
          );
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
                    console.error('Project ID is missing in onUploadComplete wrapper');
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
