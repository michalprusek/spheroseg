import React, { memo, useMemo, useCallback } from 'react';
import { ProjectImage } from '@/types';
import { VirtualList } from '@/components/ui/VirtualList';
import { ImageDisplay } from './ImageDisplayOptimized';
import { cn } from '@/lib/utils';

interface VirtualImageGridProps {
  images: ProjectImage[];
  onDelete: (imageId: string) => void;
  onOpen?: (imageId: string) => void;
  onResegment: (imageId: string) => void;
  selectionMode?: boolean;
  selectedImages: Record<string, boolean>;
  onToggleSelection?: (imageId: string) => void;
  viewMode?: 'grid' | 'list';
  columns?: number;
  className?: string;
  height?: number | string;
}

/**
 * Virtual scrolling image grid for handling thousands of images efficiently
 */
export const VirtualImageGrid = memo(
  ({
    images,
    onDelete,
    onOpen,
    onResegment,
    selectionMode = false,
    selectedImages = {},
    onToggleSelection,
    viewMode = 'grid',
    columns = 4,
    className,
    height = '100vh',
  }: VirtualImageGridProps) => {
    // Group images into rows for grid view
    const rows = useMemo(() => {
      if (viewMode === 'list') {
        // In list view, each image is its own row
        return images.map((image) => [image]);
      }

      // In grid view, group images into rows
      const rowsArray: ProjectImage[][] = [];
      for (let i = 0; i < images.length; i += columns) {
        rowsArray.push(images.slice(i, i + columns));
      }
      return rowsArray;
    }, [images, columns, viewMode]);

    // Calculate row height based on view mode
    const getRowHeight = useCallback(
      (index: number) => {
        if (viewMode === 'list') {
          return 80; // Fixed height for list items
        }
        // Grid view: aspect ratio 1:1 plus padding
        const containerWidth = window.innerWidth - 32; // Account for padding
        const itemWidth = containerWidth / columns;
        return itemWidth + 16; // Add padding
      },
      [viewMode, columns],
    );

    // Render a row of images
    const renderRow = useCallback(
      (row: ProjectImage[], rowIndex: number) => {
        if (viewMode === 'list') {
          // List view: single image per row
          const image = row[0];
          return (
            <div className="px-4">
              <ImageDisplay
                image={image}
                onDelete={onDelete}
                onOpen={onOpen}
                onResegment={onResegment}
                selectionMode={selectionMode}
                isSelected={selectedImages[image.id]}
                onToggleSelection={() => onToggleSelection?.(image.id)}
                viewMode="list"
              />
            </div>
          );
        }

        // Grid view: multiple images per row
        return (
          <div className="grid gap-4 px-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {row.map((image) => (
              <ImageDisplay
                key={image.id}
                image={image}
                onDelete={onDelete}
                onOpen={onOpen}
                onResegment={onResegment}
                selectionMode={selectionMode}
                isSelected={selectedImages[image.id]}
                onToggleSelection={() => onToggleSelection?.(image.id)}
                viewMode="grid"
              />
            ))}
            {/* Fill empty cells in the last row */}
            {row.length < columns &&
              Array.from({ length: columns - row.length }).map((_, i) => <div key={`empty-${rowIndex}-${i}`} />)}
          </div>
        );
      },
      [viewMode, columns, onDelete, onOpen, onResegment, selectionMode, selectedImages, onToggleSelection],
    );

    // Get unique key for each row
    const getRowKey = useCallback(
      (row: ProjectImage[], index: number) => {
        return viewMode === 'list' ? row[0].id : `row-${index}`;
      },
      [viewMode],
    );

    return (
      <VirtualList
        items={rows}
        height={height}
        itemHeight={getRowHeight}
        renderItem={renderRow}
        overscan={2}
        className={cn('bg-background', className)}
        getItemKey={getRowKey}
      />
    );
  },
);

VirtualImageGrid.displayName = 'VirtualImageGrid';

/**
 * Hook to manage virtual image grid state
 */
export function useVirtualImageGrid(initialColumns: number = 4) {
  const [columns, setColumns] = React.useState(initialColumns);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

  // Adjust columns based on container width
  const updateColumns = useCallback(
    (containerWidth: number) => {
      if (viewMode === 'list') return;

      // Calculate optimal columns based on container width
      const minItemWidth = 200;
      const gap = 16;
      const padding = 32;
      const availableWidth = containerWidth - padding;
      const newColumns = Math.max(1, Math.floor((availableWidth + gap) / (minItemWidth + gap)));

      setColumns(newColumns);
    },
    [viewMode],
  );

  // Set up resize observer
  React.useEffect(() => {
    const handleResize = () => {
      updateColumns(window.innerWidth);
    };

    handleResize(); // Initial calculation
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateColumns]);

  return {
    columns,
    viewMode,
    setViewMode,
    updateColumns,
  };
}

export default VirtualImageGrid;
