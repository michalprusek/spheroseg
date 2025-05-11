import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ImageCard } from './ImageCard';
import { ImageListItem } from './ImageListItem';
import { ProjectImage } from '@spheroseg/types';
import ImageDebugger from './ImageDebugger';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface ProjectImagesProps {
  images: ProjectImage[];
  onDelete: (imageId: string) => void;
  onOpen: (imageId: string) => void;
  onResegment: (imageId: string) => void;
  viewMode: 'grid' | 'list';
  selectionMode?: boolean;
  selectedImages?: Record<string, boolean>;
  onToggleSelection?: (imageId: string, event?: React.MouseEvent) => void;
  selectAll?: boolean;
  onToggleSelectAll?: () => void;
  onBatchResegment?: () => void;
  onBatchDelete?: () => void;
  onBatchExport?: () => void;
}

const ProjectImages = ({
  images,
  onDelete,
  onOpen,
  onResegment,
  viewMode,
  selectionMode = false,
  selectedImages = {},
  onToggleSelection,
  selectAll = false,
  onToggleSelectAll,
  onBatchResegment,
  onBatchDelete,
  onBatchExport,
}: ProjectImagesProps) => {
  const [showDebug, setShowDebug] = useState(false);
  const [debugImageId, setDebugImageId] = useState<string | null>(null);
  const [localImages, setLocalImages] = useState<ProjectImage[]>(images);

  // Keep local images in sync with prop images
  useEffect(() => {
    console.log('ProjectImages: Updating local images from props', images.length);
    setLocalImages(images);
  }, [images]);

  // Listen for image status updates and deletion events
  useEffect(() => {
    const handleImageStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        status: string;
        error?: string;
        resultPath?: string;
      }>;

      const { imageId, status, error, resultPath } = customEvent.detail;

      // Update the status of the specific image in our local state
      setLocalImages(prevImages =>
        prevImages.map(img =>
          img.id === imageId
            ? { ...img, segmentationStatus: status, error, resultPath }
            : img
        )
      );
    };

    // Listen for image deletion events
    const handleImageDeleted = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        projectId: string;
      }>;

      const { imageId } = customEvent.detail;

      console.log(`ProjectImages: Handling image-deleted event for ${imageId}`);

      // Immediately remove the deleted image from our local state
      setLocalImages(prevImages => {
        const filtered = prevImages.filter(img => img.id !== imageId);
        console.log(`ProjectImages: Filtered out deleted image. Before: ${prevImages.length}, After: ${filtered.length}`);
        return filtered;
      });
    };

    window.addEventListener('image-status-update', handleImageStatusUpdate);
    window.addEventListener('image-deleted', handleImageDeleted);

    return () => {
      window.removeEventListener('image-status-update', handleImageStatusUpdate);
      window.removeEventListener('image-deleted', handleImageDeleted);
    };
  }, []);

  const handleResegment = (imageId: string) => {
    console.log(`Triggering resegmentation for image: ${imageId}`);
    onResegment(imageId);
  };

  const toggleDebug = (imageId: string) => {
    if (debugImageId === imageId) {
      setShowDebug(!showDebug);
    } else {
      setDebugImageId(imageId);
      setShowDebug(true);
    }
  };

  // Render batch actions panel when in selection mode
  const renderBatchActionsPanel = () => {
    if (!selectionMode) return null;

    const selectedCount = Object.values(selectedImages).filter(Boolean).length;

    return (
      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-md mb-4">
        <div className="flex items-center gap-2">
          <Checkbox checked={selectAll} onCheckedChange={onToggleSelectAll} id="select-all" />
          <label htmlFor="select-all" className="text-sm cursor-pointer">
            {selectedCount === 0
              ? 'Select all'
              : `Selected ${selectedCount} ${selectedCount === 1 ? 'image' : 'images'}`}
          </label>
        </div>

        <div className="flex gap-2">
          <Button variant="info" size="sm" onClick={onBatchResegment} disabled={selectedCount === 0}>
            Re-segment
          </Button>
          <Button variant="success" size="sm" onClick={onBatchExport} disabled={selectedCount === 0}>
            Export
          </Button>
          <Button variant="destructive" size="sm" onClick={onBatchDelete} disabled={selectedCount === 0}>
            Delete
          </Button>
        </div>
      </div>
    );
  };

  if (viewMode === 'grid') {
    return (
      <>
        {renderBatchActionsPanel()}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {localImages.map((image) => {
            // Ensure each image has a valid ID for the key prop
            const imageId = image.id || `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            // Log any images without IDs for debugging
            if (!image.id) {
              console.warn('Image missing ID in ProjectImages component:', image);
            }

            return (
              <ImageCard
                key={imageId}
                image={{ ...image, id: imageId }} // Ensure image has an ID
                onDelete={onDelete}
                onOpen={selectionMode ? undefined : onOpen}
                onResegment={handleResegment}
                selectionMode={selectionMode}
                isSelected={!!selectedImages[imageId]}
                onToggleSelection={(event) => onToggleSelection?.(imageId, event)}
              />
            );
          })}
        </motion.div>
      </>
    );
  }

  return (
    <>
      {renderBatchActionsPanel()}
      <motion.div
        className="space-y-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {localImages.map((image) => {
          // Ensure each image has a valid ID for the key prop
          const imageId = image.id || `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          // Log any images without IDs for debugging
          if (!image.id) {
            console.warn('Image missing ID in ProjectImages list view:', image);
          }

          return (
            <ImageListItem
              key={imageId}
              image={{ ...image, id: imageId }} // Ensure image has an ID
              onDelete={onDelete}
              onOpen={selectionMode ? undefined : onOpen}
              onResegment={handleResegment}
              selectionMode={selectionMode}
              isSelected={!!selectedImages[imageId]}
              onToggleSelection={(event) => onToggleSelection?.(imageId, event)}
            />
          );
        })}
      </motion.div>
    </>
  );
};

export default ProjectImages;
