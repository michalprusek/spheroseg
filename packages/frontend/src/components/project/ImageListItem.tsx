import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ProjectImage } from '@/types';
import { Badge } from '@/components/ui/badge';
import ImageListActions from './ImageListActions';
import { useLanguage } from '@/contexts/LanguageContext';
import { constructUrl } from '@/lib/urlUtils';
import { safeFormatDate } from '@/utils/dateUtils';
import SegmentationThumbnail from './SegmentationThumbnail';
import useSocketConnection from '@/hooks/useSocketConnection';

interface ImageListItemProps {
  image: ProjectImage;
  onDelete: (imageId: string) => void;
  onOpen?: (imageId: string) => void;
  onResegment?: (imageId: string) => void;
  className?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (event?: React.MouseEvent) => void;
}

export const ImageListItem = ({
  image,
  onDelete,
  onOpen,
  onResegment,
  className,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
}: ImageListItemProps) => {
  const { t } = useLanguage();
  const [currentStatus, setCurrentStatus] = useState<string>(image.segmentationStatus || 'pending');

  // Get socket connection
  const { socket, isConnected } = useSocketConnection();

  // Sledujeme změny stavu segmentace
  useEffect(() => {
    setCurrentStatus(image.segmentationStatus || 'pending');
  }, [image.segmentationStatus]);

  // Handle segmentation updates from WebSocket
  const handleSegmentationUpdate = useCallback(
    (data: any) => {
      if (data && data.imageId === image.id && data.status) {
        console.log(`ImageListItem: Received WebSocket segmentation update for image ${data.imageId}: ${data.status}`);

        // Update image status
        setCurrentStatus(data.status);

        // Trigger queue status update
        if (data.status === 'processing' || data.status === 'completed' || data.status === 'failed') {
          console.log(`ImageListItem: Dispatching queue-status-update for image ${data.imageId}`);

          // Use setTimeout to ensure the status update is processed first
          setTimeout(() => {
            const queueUpdateEvent = new CustomEvent('queue-status-update', {
              detail: {
                refresh: true,
                forceRefresh: true,
                immediate: data.status === 'processing',
              },
            });
            window.dispatchEvent(queueUpdateEvent);
          }, 100);
        }
      }
    },
    [image.id],
  );

  // Listen for WebSocket segmentation updates
  useEffect(() => {
    if (socket && isConnected) {
      // Listen for segmentation updates
      socket.on('segmentation_update', handleSegmentationUpdate);

      // Join project room if needed
      if (image.project_id) {
        socket.emit('join_project', { projectId: image.project_id });
        socket.emit('join-project', image.project_id);
        socket.emit('join', `project-${image.project_id}`);
      }

      return () => {
        socket.off('segmentation_update', handleSegmentationUpdate);
      };
    }
  }, [socket, isConnected, handleSegmentationUpdate, image.id, image.project_id]);

  // Listen for custom events (fallback mechanism)
  useEffect(() => {
    const handleImageStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        status: string;
        forceQueueUpdate?: boolean;
      }>;
      const { imageId, status, forceQueueUpdate } = customEvent.detail;

      if (imageId === image.id) {
        console.log(`ImageListItem: Received custom event status update for image ${imageId}: ${status}`);
        setCurrentStatus(status);

        // If forceQueueUpdate is true or status is 'processing', update the queue indicator
        if (forceQueueUpdate || status === 'processing') {
          console.log(`ImageListItem: Dispatching queue-status-update for image ${imageId}`);

          // Use setTimeout to ensure the status update is processed first
          setTimeout(() => {
            const queueUpdateEvent = new CustomEvent('queue-status-update', {
              detail: {
                refresh: true,
                forceRefresh: true,
                immediate: status === 'processing',
              },
            });
            window.dispatchEvent(queueUpdateEvent);
          }, 100);
        }
      }
    };

    window.addEventListener('image-status-update', handleImageStatusUpdate);

    return () => {
      window.removeEventListener('image-status-update', handleImageStatusUpdate);
    };
  }, [image.id]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      layout
      className={cn(
        'flex items-center p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750 group',
        isSelected ? 'ring-2 ring-blue-500' : '',
        className,
      )}
      onClick={(e) => {
        if (selectionMode) {
          onToggleSelection?.(e);
        } else if (onOpen) {
          onOpen(image.id);
        }
      }}
    >
      {/* Thumbnail with segmentation overlay for completed images */}
      <div className="h-10 w-10 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 cursor-pointer">
        {(currentStatus === 'completed' || currentStatus === 'processing') && image.id ? (
          <SegmentationThumbnail
            imageId={image.id}
            thumbnailUrl={image.thumbnail_url}
            fallbackSrc="/placeholder.svg"
            altText={image.name || 'Image'}
            className="h-full w-full"
            width={40}
            height={40}
          />
        ) : image.thumbnail_url ? (
          <img
            src={constructUrl(image.thumbnail_url)}
            alt={image.name || 'Image'}
            className="h-full w-full object-cover"
            onError={(e) => {
              console.error(`Failed to load thumbnail: ${image.thumbnail_url}`);
              try {
                // Try with direct URL to backend including port
                const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
                const thumbnailPath = image.thumbnail_url?.includes('uploads/')
                  ? image.thumbnail_url.substring(image.thumbnail_url.indexOf('uploads/') + 8)
                  : image.thumbnail_url?.replace(/^.*uploads\//, '');
                const directPath = `${backendUrl}/uploads/${thumbnailPath}`;
                console.log(`Trying direct backend URL: ${directPath}`);
                e.currentTarget.src = directPath;
                return;
              } catch (err) {
                console.error('Error handling thumbnail fallback:', err);
              }

              // Try original image as fallback
              if (image.url && !image.url.startsWith('blob:')) {
                e.currentTarget.src = constructUrl(image.url);
                return;
              }

              // Final fallback
              e.currentTarget.src = '/placeholder.svg';
            }}
          />
        ) : image.url ? (
          <img src={constructUrl(image.url)} alt={image.name || 'Image'} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <span className="text-xs text-gray-400">{t('imageStatus.noImage')}</span>
          </div>
        )}
      </div>

      {/* Image details */}
      <div className="ml-3 flex-1 min-w-0 cursor-pointer">
        <div className="flex items-center">
          <h4 className="text-sm font-medium truncate">{image.name || t('imageStatus.untitledImage')}</h4>
          {currentStatus && (
            <Badge
              variant="outline"
              className={cn(
                'ml-2 text-xs',
                currentStatus === 'completed'
                  ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/40'
                  : currentStatus === 'processing'
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/40'
                    : currentStatus === 'failed'
                      ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/40'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
              )}
              title={image.error ? `Chyba: ${image.error}` : undefined}
            >
              {currentStatus === 'completed' ? (
                t('imageStatus.completed')
              ) : currentStatus === 'processing' ? (
                <span className="flex items-center">
                  <span className="animate-pulse mr-1">●</span> {t('imageStatus.processing')}
                </span>
              ) : currentStatus === 'failed' ? (
                <span className="flex items-center">
                  <span className="mr-1">⚠️</span> {t('imageStatus.failed', 'Chyba')}
                </span>
              ) : (
                t('imageStatus.pending')
              )}
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{safeFormatDate(image.createdAt, 'PPP', '')}</p>
        {currentStatus === 'failed' && image.error && (
          <div className="mt-1 text-xs text-red-500 truncate" title={image.error}>
            <span className="font-medium">Chyba:</span> {image.error.substring(0, 50)}
            {image.error.length > 50 ? '...' : ''}
          </div>
        )}
      </div>

      {/* Selection checkbox or actions */}
      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {selectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelection?.(e.nativeEvent)}
            className="h-5 w-5 rounded border-gray-300"
          />
        ) : (
          <ImageListActions onDelete={() => onDelete(image.id)} onResegment={() => onResegment?.(image.id)} />
        )}
      </div>
    </motion.div>
  );
};
