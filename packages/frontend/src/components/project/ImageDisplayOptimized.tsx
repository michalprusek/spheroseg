import React, { useEffect, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ProjectImage } from '@/types';
import { Badge } from '@/components/ui/badge';
import ImageActions from './ImageActions';
import ImageListActions from './ImageListActions';
import { constructUrl } from '@/lib/urlUtils';
import { safeFormatDate } from '@/utils/dateUtils';
import { getImageBlob, storeImageBlob } from '@/utils/indexedDBService';
import SegmentationThumbnail from './SegmentationThumbnail';
import useSocketConnection from '@/hooks/useSocketConnection';
import apiClient from '@/lib/apiClient';
import { useTranslations } from '@/hooks/useTranslations';
import { SEGMENTATION_STATUS, isProcessingStatus } from '@/constants/segmentationStatus';
import { debouncedCacheUpdate } from '@/utils/debounce';
import { pollingManager } from '@/utils/pollingManager';

interface ImageDisplayProps {
  image: ProjectImage;
  onDelete: (imageId: string) => void;
  onOpen?: (imageId: string) => void;
  onResegment: (imageId: string) => void;
  className?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (event?: React.MouseEvent) => void;
  viewMode?: 'grid' | 'list';
}

// Memoized Image Display Component with custom comparison
export const ImageDisplay = memo(
  ({
    image,
    onDelete,
    onOpen,
    onResegment,
    className,
    selectionMode = false,
    isSelected = false,
    onToggleSelection,
    viewMode = 'grid',
  }: ImageDisplayProps) => {
    const { t } = useTranslations();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [currentStatus, setCurrentStatus] = useState<string>(
      image.segmentationStatus || SEGMENTATION_STATUS.WITHOUT_SEGMENTATION,
    );

    // Memoized status badge computation
    const statusBadge = React.useMemo(() => {
      const statusColors: Record<string, string> = {
        [SEGMENTATION_STATUS.WITHOUT_SEGMENTATION]: 'bg-gray-500',
        [SEGMENTATION_STATUS.QUEUED]: 'bg-yellow-500',
        [SEGMENTATION_STATUS.PROCESSING]: 'bg-blue-500',
        [SEGMENTATION_STATUS.COMPLETED]: 'bg-green-500',
        [SEGMENTATION_STATUS.FAILED]: 'bg-red-500',
      };

      const statusLabels: Record<string, string> = {
        [SEGMENTATION_STATUS.WITHOUT_SEGMENTATION]: t('segmentation.status.without_segmentation'),
        [SEGMENTATION_STATUS.QUEUED]: t('segmentation.status.queued'),
        [SEGMENTATION_STATUS.PROCESSING]: t('segmentation.status.processing'),
        [SEGMENTATION_STATUS.COMPLETED]: t('segmentation.status.completed'),
        [SEGMENTATION_STATUS.FAILED]: t('segmentation.status.failed'),
      };

      return {
        color: statusColors[currentStatus] || 'bg-gray-500',
        label: statusLabels[currentStatus] || currentStatus,
      };
    }, [currentStatus, t]);

    // Optimized image loading with caching
    const loadImage = useCallback(async () => {
      if (!image.thumbnail_url && !image.image_url) {
        return;
      }

      const imageUrl = image.thumbnail_url || image.image_url;

      // Check IndexedDB cache first
      try {
        const cachedBlob = await getImageBlob(imageUrl);
        if (cachedBlob) {
          const objectUrl = URL.createObjectURL(cachedBlob);
          setImageSrc(objectUrl);
          return;
        }
      } catch (error) {
        console.debug('Cache miss for image:', imageUrl);
      }

      // Load from network
      try {
        const response = await fetch(constructUrl(imageUrl));
        const blob = await response.blob();

        // Store in IndexedDB for future use
        await storeImageBlob(imageUrl, blob);

        const objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      } catch (error) {
        console.error('Failed to load image:', error);
      }
    }, [image.thumbnail_url, image.image_url]);

    // Load image on mount
    useEffect(() => {
      loadImage();

      return () => {
        // Cleanup object URL on unmount
        if (imageSrc && imageSrc.startsWith('blob:')) {
          URL.revokeObjectURL(imageSrc);
        }
      };
    }, [loadImage]); // eslint-disable-line react-hooks/exhaustive-deps

    // Memoized handlers
    const handleDelete = useCallback(() => {
      onDelete(image.id);
    }, [onDelete, image.id]);

    const handleOpen = useCallback(() => {
      onOpen?.(image.id);
    }, [onOpen, image.id]);

    const handleResegment = useCallback(() => {
      onResegment(image.id);
    }, [onResegment, image.id]);

    // Subscribe to WebSocket updates for this specific image
    const socket = useSocketConnection();

    useEffect(() => {
      if (!socket) return;

      const handleSegmentationUpdate = (data: unknown) => {
        if (data.imageId === image.id) {
          setCurrentStatus(data.status);
          // Update polling manager state
          pollingManager.updateImageStatus(image.id, data.status);
        }
      };

      socket.on('segmentation_update', handleSegmentationUpdate);

      return () => {
        socket.off('segmentation_update', handleSegmentationUpdate);
      };
    }, [socket, image.id]);

    // Polling for status updates as fallback
    useEffect(() => {
      // Only poll if status indicates processing
      if (!isProcessingStatus(currentStatus)) {
        return;
      }

      const checkStatus = async () => {
        try {
          const response = await apiClient.get(`/images/${image.id}`);
          const newStatus = response.data.segmentationStatus || response.data.segmentation_status;

          if (newStatus && newStatus !== currentStatus) {
            setCurrentStatus(newStatus);
            // Update cache with debouncing
            debouncedCacheUpdate(image.id, { segmentationStatus: newStatus });
          }
        } catch (error) {
          console.error('Failed to check image status:', error);
        }
      };

      // Register with polling manager for coordinated polling
      const unregister = pollingManager.registerImage(image.id, currentStatus, checkStatus);

      return unregister;
    }, [image.id, currentStatus]);

    if (viewMode === 'list') {
      return (
        <motion.div
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn('group relative', className)}
        >
          <Card className="overflow-hidden">
            <CardContent className="p-4 flex items-center space-x-4">
              {selectionMode && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelection}
                  className="w-4 h-4"
                  onClick={(e) => e.stopPropagation()}
                />
              )}

              <div className="flex-shrink-0 w-16 h-16">
                {imageSrc && (
                  <img src={imageSrc} alt={image.name} className="w-full h-full object-cover rounded" loading="lazy" />
                )}
              </div>

              <div className="flex-grow">
                <h3 className="font-medium truncate">{image.name}</h3>
                <p className="text-sm text-muted-foreground">{safeFormatDate(image.created_at)}</p>
              </div>

              <Badge className={cn('text-white', statusBadge.color)}>{statusBadge.label}</Badge>

              <ImageListActions
                image={image}
                onDelete={handleDelete}
                onOpen={handleOpen}
                onResegment={handleResegment}
              />
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    // Grid view
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn('group relative', className)}
        onClick={selectionMode ? onToggleSelection : handleOpen}
      >
        <Card
          className={cn(
            'overflow-hidden cursor-pointer transition-all duration-200',
            'hover:shadow-lg hover:scale-[1.02]',
            isSelected && 'ring-2 ring-primary',
          )}
        >
          <div className="relative aspect-square">
            {selectionMode && (
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelection}
                  className="w-4 h-4"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {imageSrc ? (
              <img src={imageSrc} alt={image.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-muted animate-pulse" />
            )}

            {currentStatus === SEGMENTATION_STATUS.COMPLETED && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <SegmentationThumbnail imageId={image.id} projectId={image.project_id} />
              </div>
            )}

            <div className="absolute top-2 right-2">
              <Badge className={cn('text-white text-xs', statusBadge.color)}>{statusBadge.label}</Badge>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <h3 className="text-white font-medium truncate">{image.name}</h3>
              <p className="text-white/80 text-sm">{safeFormatDate(image.created_at)}</p>
            </div>
          </div>

          {!selectionMode && (
            <CardContent className="p-4">
              <ImageActions image={image} onDelete={handleDelete} onOpen={handleOpen} onResegment={handleResegment} />
            </CardContent>
          )}
        </Card>
      </motion.div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if these specific props change
    return (
      prevProps.image.id === nextProps.image.id &&
      prevProps.image.segmentationStatus === nextProps.image.segmentationStatus &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.selectionMode === nextProps.selectionMode &&
      prevProps.viewMode === nextProps.viewMode &&
      prevProps.className === nextProps.className
    );
  },
);

ImageDisplay.displayName = 'ImageDisplay';

export default ImageDisplay;
