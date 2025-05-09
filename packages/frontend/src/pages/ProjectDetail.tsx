import React, { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from '@/contexts/LanguageContext';
import ProjectHeader from "@/components/project/ProjectHeader";
import ProjectToolbar from "@/components/project/ProjectToolbar";
import EmptyState from "@/components/project/EmptyState";
import EmptyProjectState from "@/components/EmptyProjectState";
import ProjectImages from "@/components/project/ProjectImages";
import ProjectUploaderSection from "@/components/project/ProjectUploaderSection";
import { useProjectData } from "@/hooks/useProjectData";
import { useImageFilter } from "@/hooks/useImageFilter";
import { useProjectImageActions } from "@/components/project/ProjectImageActions";
import { motion } from "framer-motion";
import { toast } from "sonner"; // We'll use Sonner toast instead of shared utilities
import apiClient from "@/lib/apiClient";
import { ProjectImage } from "@/types";
import axios from "axios";
import { Socket } from 'socket.io-client';
import socketClient from '@/socketClient'; // Import the centralized socket client
import { useExportFunctions } from "@/pages/export/hooks/useExportFunctions";

const ProjectDetail = () => {
  // Get id parameter from URL - could be from /project/:id or /projects/:id
  const params = useParams<{ id: string }>();
  const id = params.id;
  const navigate = useNavigate();

  // Log URL parameters for debugging purpose
  console.log('ProjectDetail: Received projectId from URL:', id);
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [showUploader, setShowUploader] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [segmentAfterUpload, setSegmentAfterUpload] = useState<boolean>(true);
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedImages, setSelectedImages] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const lastSelectedImageRef = useRef<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch project data
  const { projectTitle, images, loading, refreshData, updateImageStatus } = useProjectData(id);

  // Setup WebSocket connection for real-time updates using the centralized socket client
  useEffect(() => {
    if (!id) return;

    let isComponentMounted = true;

    try {
      console.log('Setting up WebSocket connection for project updates');

      // Clean the project ID to ensure it has the correct format for API calls
      const cleanProjectId = (rawId: string): string => {
        if (!rawId) return rawId;

        // IMPORTANT: We need to KEEP the "project-" prefix for API calls
        // The backend expects IDs in the format "project-XXXXXXXXX"
        if (rawId.startsWith('project-')) {
          console.log(`Project ID already has correct prefix: ${rawId}`);
          return rawId; // Keep the prefix for API calls
        }

        // If ID doesn't have the prefix, add it
        const prefixedId = `project-${rawId}`;
        console.log(`Added 'project-' prefix: ${prefixedId}`);
        return prefixedId;
      };

      const cleanedId = cleanProjectId(id);
      console.log(`Using cleaned project ID: ${cleanedId} (original: ${id})`);

      // Verify project exists before connecting to avoid wasteful connections
      apiClient.get(`/projects/${cleanedId}`)
        .then(response => {
          console.log(`Project ${cleanedId} verified as existing`);
        })
        .catch(err => {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.log(`Project ${cleanedId} not found, redirecting to dashboard`);
            navigate('/dashboard', { replace: true });
            return;
          }
          console.warn('Error verifying project:', err);
        });

      // Get the socket from the centralized client
      const socket = socketClient.getSocket();

      // Set up event listeners for segmentation updates
      const handleSegmentationUpdate = (data: any) => {
        if (!isComponentMounted) return;

        console.log('Received segmentation update:', data);
        if (data.imageId && data.status) {
          // Update image status in UI immediately
          updateImageStatus(data.imageId, data.status);

          // Show notification about segmentation completion
          if (data.status === 'completed') {
            toast.success(`Image segmentation complete for ${data.imageId.substring(0, 8)}...`);
            // Refresh data to update the queue indicator
            refreshData();
          } else if (data.status === 'failed') {
            toast.error(`Segmentation failed: ${data.error || 'Unknown error'}`);
            // Refresh data to update the queue indicator
            refreshData();
          }
        }
      };

      // Set up project-specific room joining
      const handleConnect = () => {
        if (!isComponentMounted) return;

        try {
          // Join project-specific room for targeted updates
          socket.emit('join_project', { projectId: cleanedId });
          console.log(`Joined WebSocket room for project ${cleanedId}`);
        } catch (joinErr) {
          console.error('Failed to join project room:', joinErr);
        }
      };

      // Add event listeners
      socket.on('connect', handleConnect);
      socket.on('segmentation_update', handleSegmentationUpdate);

      // Store the socket in state
      setSocket(socket);

      // Log connection status
      if (socket.connected) {
        console.log('WebSocket already connected:', socket.id);
        // If already connected, manually execute join
        handleConnect();
      } else {
        console.log('WebSocket connecting...');
        socket.connect();
      }

      // Save project ID for diagnostics
      try {
        localStorage.setItem('spheroseg_current_project', cleanedId);
      } catch (e) {
        // Ignore storage errors
      }

      return () => {
        isComponentMounted = false;

        try {
          // Leave project-specific room when unmounting
          socket.emit('leave_project', { projectId: cleanedId });
          console.log(`Left WebSocket room for project ${cleanedId}`);
        } catch (leaveErr) {
          console.error('Error leaving project room:', leaveErr);
        }

        // Remove event listeners
        socket.off('connect', handleConnect);
        socket.off('segmentation_update', handleSegmentationUpdate);

        // Note: We don't disconnect the socket here since it's managed by the centralized client
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

  // Filtering and sorting
  const {
    filteredImages,
    searchTerm,
    sortField,
    sortDirection,
    handleSearch,
    handleSort
  } = useImageFilter(images);

  // Image operations
  const {
    handleDeleteImage,
    handleOpenSegmentationEditor,
    handleResegment,
  } = useProjectImageActions({
    projectId: id,
    onImagesChange: refreshData,
    images
  });

  const toggleUploader = () => {
    setShowUploader(!showUploader);
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // Reset selection when exiting selection mode
      setSelectedImages({});
      setSelectAll(false);
    }
    setSelectionMode(!selectionMode);
  };

  // Toggle selection of a single image with support for Shift+click and Ctrl/Cmd+click
  const toggleImageSelection = (imageId: string, event?: React.MouseEvent) => {
    // Handle Shift+click for range selection
    if (event?.shiftKey && lastSelectedImageRef.current) {
      const lastSelectedId = lastSelectedImageRef.current;
      const currentIndex = filteredImages.findIndex(img => img.id === imageId);
      const lastIndex = filteredImages.findIndex(img => img.id === lastSelectedId);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const startIdx = Math.min(currentIndex, lastIndex);
        const endIdx = Math.max(currentIndex, lastIndex);
        const imagesToSelect = filteredImages.slice(startIdx, endIdx + 1);

        const newSelectedImages = { ...selectedImages };
        imagesToSelect.forEach(img => {
          newSelectedImages[img.id] = true;
        });

        setSelectedImages(newSelectedImages);
        return;
      }
    }

    // Handle Ctrl/Cmd+click for toggling single selection without affecting others
    if (event?.ctrlKey || event?.metaKey) {
      setSelectedImages(prev => ({
        ...prev,
        [imageId]: !prev[imageId]
      }));
    } else {
      // Regular click - toggle single selection
      setSelectedImages(prev => ({
        ...prev,
        [imageId]: !prev[imageId]
      }));
      // Store the last selected image ID for shift+click range selection
      lastSelectedImageRef.current = imageId;
    }
  };

  // Toggle select all images
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);

    // Update selected images based on selectAll state
    const newSelectedImages: Record<string, boolean> = {};
    filteredImages.forEach(image => {
      newSelectedImages[image.id] = newSelectAll;
    });
    setSelectedImages(newSelectedImages);
  };

  // Handle batch operations on selected images
  const handleBatchResegment = () => {
    const selectedImageIds = Object.entries(selectedImages)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (selectedImageIds.length === 0) {
      toast.error('No images selected');
      return;
    }

    toast.info(`Triggering re-segmentation for ${selectedImageIds.length} images...`);

    // Call the batch segmentation endpoint
    (async () => {
      try {
        await apiClient.post(`/images/segmentation/trigger-batch`, {
          imageIds: selectedImageIds,
          priority: 5, // High priority for manual re-segmentation
          model_type: 'resunet' // Explicitly specify model
        });
        toast.success(`Re-segmentation triggered for ${selectedImageIds.length} images`);
      } catch (error) {
        console.error(error);
        toast.error('Failed to trigger batch re-segmentation');
      }
    })();
  };

  // Handle batch delete
  const handleBatchDelete = () => {
    const selectedImageIds = Object.entries(selectedImages)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (selectedImageIds.length === 0) {
      toast.error('No images selected');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedImageIds.length} images? This action cannot be undone.`)) {
      toast.info(`Deleting ${selectedImageIds.length} images...`);

      // Delete images one by one using the new API endpoint with project ID
      (async () => {
        try {
          const results = await Promise.allSettled(
            selectedImageIds.map(imageId =>
              apiClient.delete(`/projects/${id}/images/${imageId}`)
            )
          );

          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failCount = results.filter(r => r.status === 'rejected').length;

          if (successCount > 0) {
            toast.success(`Successfully deleted ${successCount} images`);
          }

          if (failCount > 0) {
            toast.error(`Failed to delete ${failCount} images`);
          }

          // Refresh data and reset selection
          refreshData();
          setSelectedImages({});
          setSelectAll(false);
        } catch (error) {
          console.error(error);
          toast.error('Error deleting images');
        }
      })();
    }
  };

  // Použijeme useExportFunctions pro export vybraných obrázků
  // Předáváme všechny obrázky a filtrujeme je až při exportu
  const {
    handleExport: exportFunction,
    isExporting
  } = useExportFunctions(images, projectTitle);

  // Vytvoříme vlastní funkci pro export, která bude filtrovat obrázky podle aktuálního výběru
  const exportSelectedImages = useCallback(() => {
    // Filtrujeme pouze vybrané obrázky
    const selectedImagesToExport = images.filter(img => selectedImages[img.id]);
    // Voláme exportFunction s filtrovanými obrázky
    exportFunction(selectedImagesToExport);
  }, [images, selectedImages, exportFunction]);

  // Handle batch export
  const handleBatchExport = () => {
    const selectedImageIds = Object.entries(selectedImages)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (selectedImageIds.length === 0) {
      toast.error('No images selected');
      return;
    }

    // Použijeme funkci z useExportFunctions pro vytvoření ZIP souboru
    toast.info(`Připravuji export ${selectedImageIds.length} obrázků...`);

    // Spustíme export, který vytvoří ZIP soubor s vybranými obrázky, segmentacemi a metrikami
    exportSelectedImages();
  };

  // Handle completion of image upload
  const handleUploadComplete = useCallback(async (projectId: string, uploadedImages: ProjectImage[] | ProjectImage) => {
    console.log('Upload complete:', projectId);
    refreshData(); // Refresh the image list immediately to show pending uploads
    setShowUploader(false); // Close the uploader section

    // Ensure uploadedImages is always an array
    const imagesArray = Array.isArray(uploadedImages) ? uploadedImages : [uploadedImages];

    if (segmentAfterUpload && imagesArray.length > 0) {
      // Filtrujeme obrázky, které mají platné ID
      const validImages = imagesArray.filter(img => img && img.id);
      const imageIds = validImages.map(img => img.id);

      // Pokud nemáme žádné platné ID, zobrazíme chybu a skončíme
      if (imageIds.length === 0) {
        console.error('No valid image IDs found for segmentation');
        toast.error('No valid images found for segmentation');
        return;
      }

      toast.info(`Triggering segmentation for ${imageIds.length} uploaded image(s)...`);

      try {
        // Call the new batch endpoint with model_type parameter
        const response = await apiClient.post(`/images/segmentation/trigger-batch`, {
          imageIds,
          priority: 3, // Střední priorita pro nově nahrané obrázky
          model_type: 'resunet' // Explicitně specifikujeme model
        });
        console.log('Batch trigger response:', response.data);
        // Optionally report failures based on response.data.failed
        if (response.data?.failed?.length > 0) {
             response.data.failed.forEach((failure: { id: string; reason: string }) => {
                 toast.error(`Failed to trigger segmentation for image ${failure.id}: ${failure.reason}`);
             });
        }
        // Status updates will now come via WebSocket
      } catch (error: unknown) {
        console.error("Error triggering batch segmentation:", error);
        let message = "Failed to trigger batch segmentation.";
         if (axios.isAxiosError(error) && error.response) {
            message = error.response.data?.message || message;
         } else if (error instanceof Error) {
           message = error.message;
         }
        toast.error(message);
      }
      // REMOVED: Promise.allSettled and individual triggers
      // REMOVED: setTimeout for refresh
    }
  }, [segmentAfterUpload, refreshData, t]); // Keep dependencies

  // Handle opening an image - now takes the image ID directly
  const handleOpenImage = (imageId: string) => {
    handleOpenSegmentationEditor(imageId);
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Background elements */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 dark:bg-blue-400/10 rounded-full filter blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 dark:bg-blue-500/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 dark:bg-blue-600/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-4s" }} />
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
                    console.error("Project ID is missing in onUploadComplete wrapper");
                    toast.error("An error occurred during upload completion.");
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
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
              showStatusSort={true} // Přidáno pro Image Gallery
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
            ) : false ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
                  <h3 className="text-red-800 font-medium">{t('project.errorLoading')}</h3>
                  <p className="text-red-600">Error loading project</p>
                </div>
              </motion.div>
            ) : filteredImages.length === 0 && !searchTerm ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <EmptyProjectState
                  projectId={id || ''}
                  onUploadClick={toggleUploader}
                />
              </motion.div>
            ) : filteredImages.length === 0 && searchTerm ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <EmptyState
                  hasSearchTerm={true}
                  onUpload={toggleUploader}
                />
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
