import React, { useState } from 'react';
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
  onBatchExport
}: ProjectImagesProps) => {
  const [showDebug, setShowDebug] = useState(false);
  const [debugImageId, setDebugImageId] = useState<string | null>(null);

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
          <Checkbox
            checked={selectAll}
            onCheckedChange={onToggleSelectAll}
            id="select-all"
          />
          <label htmlFor="select-all" className="text-sm cursor-pointer">
            {selectedCount === 0 ? 'Select all' : `Selected ${selectedCount} ${selectedCount === 1 ? 'image' : 'images'}`}
          </label>
        </div>

        <div className="flex gap-2">
          <Button
            variant="info"
            size="sm"
            onClick={onBatchResegment}
            disabled={selectedCount === 0}
          >
            Re-segment
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={onBatchExport}
            disabled={selectedCount === 0}
          >
            Export
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onBatchDelete}
            disabled={selectedCount === 0}
          >
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
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              onDelete={onDelete}
              onOpen={selectionMode ? undefined : onOpen}
              onResegment={handleResegment}
              selectionMode={selectionMode}
              isSelected={!!selectedImages[image.id]}
              onToggleSelection={(event) => onToggleSelection?.(image.id, event)}
            />
          ))}
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
        {images.map((image) => (
          <ImageListItem
            key={image.id}
            image={image}
            onDelete={onDelete}
            onOpen={selectionMode ? undefined : onOpen}
            onResegment={handleResegment}
            selectionMode={selectionMode}
            isSelected={!!selectedImages[image.id]}
            onToggleSelection={(event) => onToggleSelection?.(image.id, event)}
          />
        ))}
      </motion.div>
    </>
  );
};

export default ProjectImages;
