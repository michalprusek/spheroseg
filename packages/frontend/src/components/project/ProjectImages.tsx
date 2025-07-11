import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { FixedSizeGrid as Grid, VariableSizeList as List } from 'react-window';
import { ImageDisplay } from './ImageDisplay';
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
      setLocalImages((prevImages) =>
        prevImages.map((img) => (img.id === imageId ? { ...img, segmentationStatus: status, error, resultPath } : img)),
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
      setLocalImages((prevImages) => {
        const filtered = prevImages.filter((img) => img.id !== imageId);
        console.log(
          `ProjectImages: Filtered out deleted image. Before: ${prevImages.length}, After: ${filtered.length}`,
        );
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

  // Fixed 4 columns as requested
  const FIXED_COLUMN_COUNT = 4;
  const GRID_GAP = 16; // Gap between cards

  // Get container element reference to measure actual width
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate dimensions based on actual container width
  const [dimensions, setDimensions] = useState(() => {
    // Initial calculation based on viewport (will be updated when container mounts)
    const viewportWidth = window.innerWidth;
    const containerPadding = viewportWidth >= 1280 ? 64 : 32; // Estimate based on typical container padding
    const containerWidth = viewportWidth - containerPadding;
    const columnWidth = Math.floor((containerWidth - GRID_GAP * (FIXED_COLUMN_COUNT - 1)) / FIXED_COLUMN_COUNT);
    const rowHeight = Math.floor(columnWidth * 1.2); // Aspect ratio 1:1.2 for cards
    return {
      columnWidth,
      rowHeight,
      containerWidth,
      windowHeight: window.innerHeight - 200,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        // Use actual container width from the DOM element
        const containerWidth = containerRef.current.offsetWidth;
        const columnWidth = Math.floor((containerWidth - GRID_GAP * (FIXED_COLUMN_COUNT - 1)) / FIXED_COLUMN_COUNT);
        const rowHeight = Math.floor(columnWidth * 1.2); // Maintain aspect ratio
        setDimensions({
          columnWidth,
          rowHeight,
          containerWidth,
          windowHeight: window.innerHeight - 200,
        });
      }
    };

    // Initial calculation when container is mounted
    const timer = setTimeout(handleResize, 0);

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cell renderer for grid view
  const GridCell = useCallback(
    ({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
      const index = rowIndex * FIXED_COLUMN_COUNT + columnIndex;
      if (index >= localImages.length) return null;

      const image = localImages[index];
      const imageId = image.id || `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      if (!image.id) {
        console.warn('Image missing ID in ProjectImages component:', image);
      }

      return (
        <div style={{ ...style, padding: `${GRID_GAP / 2}px` }}>
          <ImageDisplay
            image={{ ...image, id: imageId }}
            onDelete={onDelete}
            onOpen={selectionMode ? undefined : onOpen}
            onResegment={handleResegment}
            selectionMode={selectionMode}
            isSelected={!!selectedImages[imageId]}
            onToggleSelection={(event) => onToggleSelection?.(imageId, event)}
            viewMode="grid"
          />
        </div>
      );
    },
    [localImages, onDelete, onOpen, handleResegment, selectionMode, selectedImages, onToggleSelection],
  );

  // Row renderer for list view
  const ListRow = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const image = localImages[index];
      const imageId = image.id || `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      if (!image.id) {
        console.warn('Image missing ID in ProjectImages list view:', image);
      }

      return (
        <div style={{ ...style, padding: '4px 8px' }}>
          <ImageDisplay
            image={{ ...image, id: imageId }}
            onDelete={onDelete}
            onOpen={selectionMode ? undefined : onOpen}
            onResegment={handleResegment}
            selectionMode={selectionMode}
            isSelected={!!selectedImages[imageId]}
            onToggleSelection={(event) => onToggleSelection?.(imageId, event)}
            viewMode="list"
          />
        </div>
      );
    },
    [localImages, onDelete, onOpen, handleResegment, selectionMode, selectedImages, onToggleSelection],
  );

  // Calculate row count for grid
  const rowCount = Math.ceil(localImages.length / FIXED_COLUMN_COUNT);

  if (viewMode === 'grid') {
    return (
      <div ref={containerRef} className="w-full">
        {renderBatchActionsPanel()}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ height: dimensions.windowHeight }}
        >
          <Grid
            columnCount={FIXED_COLUMN_COUNT}
            columnWidth={dimensions.columnWidth}
            height={dimensions.windowHeight}
            rowCount={rowCount}
            rowHeight={dimensions.rowHeight}
            width={dimensions.containerWidth}
            overscanRowCount={2} // Render 2 extra rows for smoother scrolling
          >
            {GridCell}
          </Grid>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      {renderBatchActionsPanel()}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{ height: dimensions.windowHeight }}
      >
        <List
          height={dimensions.windowHeight}
          itemCount={localImages.length}
          itemSize={() => 80} // Fixed height for list items
          width="100%"
          overscanCount={5} // Render 5 extra items for smoother scrolling
        >
          {ListRow}
        </List>
      </motion.div>
    </div>
  );
};

export default ProjectImages;
