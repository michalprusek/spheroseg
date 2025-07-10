import React, { useEffect, useState, useCallback } from 'react';
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
import DebugSegmentationThumbnail from './DebugSegmentationThumbnail';
import useSocketConnection from '@/hooks/useSocketConnection';
import apiClient from '@/lib/apiClient';
import { useTranslations } from '@/hooks/useTranslations';
import { SEGMENTATION_STATUS, isProcessingStatus } from '@/constants/segmentationStatus';

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

export const ImageDisplay = ({
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

  // Track segmentation status changes and force check on mount
  useEffect(() => {
    setCurrentStatus(image.segmentationStatus || SEGMENTATION_STATUS.WITHOUT_SEGMENTATION);
    
    // Force check the actual status from API when component mounts or image changes
    const checkInitialStatus = async () => {
      try {
        const response = await apiClient.get(`/api/images/${image.id}/segmentation`);
        if (response.data && response.data.status) {
          const apiStatus = response.data.status;
          if (apiStatus !== currentStatus) {
            console.log(`ImageDisplay: Initial status check - updating from ${currentStatus} to ${apiStatus}`);
            setCurrentStatus(apiStatus);
          }
        }
      } catch (error: any) {
        // Silently ignore 404 errors (no segmentation yet)
        if (error?.response?.status !== 404) {
          console.debug(`ImageDisplay: Error checking initial segmentation status for image ${image.id}`);
        }
      }
    };
    
    // Check status after a short delay to avoid race conditions
    const timeoutId = setTimeout(checkInitialStatus, 500);
    
    return () => clearTimeout(timeoutId);
  }, [image.segmentationStatus, image.id]);

  // Get socket connection
  const { socket, isConnected } = useSocketConnection();

  // Handle segmentation updates from WebSocket
  const handleSegmentationUpdate = useCallback(
    (data: any) => {
      if (data && data.imageId === image.id && data.status) {
        console.log(`ImageDisplay: Received WebSocket segmentation update for image ${data.imageId}: ${data.status}`);

        // Update image status
        setCurrentStatus(data.status);

        // Trigger queue status update
        if (
          data.status === SEGMENTATION_STATUS.PROCESSING ||
          data.status === SEGMENTATION_STATUS.COMPLETED ||
          data.status === SEGMENTATION_STATUS.FAILED ||
          data.status === SEGMENTATION_STATUS.QUEUED
        ) {
          console.log(`ImageDisplay: Dispatching queue-status-update for image ${data.imageId}`);

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

            // Also dispatch an image-status-update event to ensure all components are updated
            const imageUpdateEvent = new CustomEvent('image-status-update', {
              detail: {
                imageId: data.imageId,
                status: data.status,
                forceQueueUpdate: true,
                error: data.error,
                resultPath: data.resultPath,
              },
            });
            window.dispatchEvent(imageUpdateEvent);
          }, 50); // Reduced timeout for faster updates
        }
      }
    },
    [image.id],
  );

  // Listen for WebSocket segmentation updates
  useEffect(() => {
    if (socket && isConnected) {
      console.log(`ImageDisplay: Setting up WebSocket listeners for image ${image.id}`);

      // Listen for segmentation updates
      socket.on('segmentation_update', handleSegmentationUpdate);

      // Join project room if needed
      if (image.project_id) {
        console.log(`ImageDisplay: Joining project room for project ${image.project_id}`);
        // Try all possible room joining methods for compatibility
        socket.emit('join_project', { projectId: image.project_id });
        socket.emit('join-project', image.project_id);
        socket.emit('join', `project-${image.project_id}`);

        // Also join a room specific to this image for targeted updates
        socket.emit('join', `image-${image.id}`);
      }

      // Request current status for this image
      socket.emit('get_image_status', { imageId: image.id });

      return () => {
        socket.off('segmentation_update', handleSegmentationUpdate);
      };
    } else if (!isConnected && socket) {
      // If socket exists but is not connected, try to reconnect
      console.log(`ImageDisplay: Socket not connected, attempting to reconnect for image ${image.id}`);
      try {
        socket.connect();
      } catch (err) {
        console.error('Error reconnecting socket:', err);
      }
    }
  }, [socket, isConnected, handleSegmentationUpdate, image.id, image.project_id]);

  // Periodically check status for processing/queued images to catch missed updates
  useEffect(() => {
    // Set up polling for processing or queued status
    if (currentStatus === SEGMENTATION_STATUS.PROCESSING || currentStatus === SEGMENTATION_STATUS.QUEUED) {

      // Function to check current image status through API
      const checkImageStatus = async () => {
        try {
          // Try to get segmentation status directly
          const response = await apiClient.get(`/api/images/${image.id}/segmentation`);
          if (response.data && response.data.status) {
            const apiStatus = response.data.status;
            if (apiStatus !== currentStatus) {
              setCurrentStatus(apiStatus);

              // If status changed to completed, trigger update notification
              if (apiStatus === SEGMENTATION_STATUS.COMPLETED) {
                const imageUpdateEvent = new CustomEvent('image-status-update', {
                  detail: {
                    imageId: image.id,
                    status: apiStatus,
                    forceQueueUpdate: true,
                  },
                });
                window.dispatchEvent(imageUpdateEvent);
              }
            }
          }
        } catch (error: any) {
          // Silently ignore 401 and 429 errors
          if (error?.response?.status === 401 || error?.response?.status === 429) {
            return; // Stop polling on auth or rate limit errors
          }
          // Only log other errors once
          if (error?.response?.status !== 404) {
            console.debug(`ImageDisplay: Error checking segmentation status for image ${image.id}`);
          }
        }
      };

      // Check after a delay to avoid initial burst of requests
      const timeoutId = setTimeout(checkImageStatus, 2000);

      // Set up polling interval - check every 5 seconds for processing images
      const intervalId = setInterval(checkImageStatus, 5000);

      return () => {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
      };
    }
  }, [image.id]); // Removed currentStatus from dependencies to prevent infinite loops

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
        console.log(`ImageDisplay: Received custom event status update for image ${imageId}: ${status}`);

        // Update image status
        setCurrentStatus(status);

        // If forceQueueUpdate is true or status is 'processing' or 'queued', update the queue indicator
        if (forceQueueUpdate || status === SEGMENTATION_STATUS.PROCESSING || status === SEGMENTATION_STATUS.QUEUED) {
          console.log(`ImageDisplay: Dispatching queue-status-update for image ${imageId}`);

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

  // Try to load image from IndexedDB when component mounts
  useEffect(() => {
    const loadImageFromIndexedDB = async () => {
      try {
        // Check if image URL is a blob URL
        if (
          (image.thumbnail_url && image.thumbnail_url.startsWith('blob:')) ||
          (image.url && image.url.startsWith('blob:'))
        ) {
          // Try to get the image from IndexedDB
          const blob = await getImageBlob(image.id);

          if (blob) {
            // Create a new blob URL from the stored blob
            const url = URL.createObjectURL(blob);
            setImageSrc(url);
            console.debug(`Loaded image ${image.id} from IndexedDB`);
          } else {
            // Use the provided URL if available
            setImageSrc(image.thumbnail_url || image.url || null);
          }
        } else {
          // Use the provided URL if it's not a blob URL
          setImageSrc(image.thumbnail_url || image.url || null);
        }
      } catch (error) {
        console.error('Error loading image from IndexedDB:', error);
        setImageSrc(image.thumbnail_url || image.url || null);
      }
    };

    loadImageFromIndexedDB();

    // Clean up blob URL when component unmounts
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [image.id, image.thumbnail_url, image.url]);

  // Determine if image is originally a TIFF based on filename
  const isOriginallyTiff = image.name?.toLowerCase().endsWith('.tiff') || image.name?.toLowerCase().endsWith('.tif');

  // Handle image errors
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error(`Failed to load image: ${imageSrc}`);

    // If the image is already using a placeholder, don't try to replace it again
    if (e.currentTarget.src.includes('placeholder.svg')) {
      return;
    }

    try {
      console.log(`Image load failed for image ${image.id} (${image.name})`);

      // Try to load from IndexedDB first
      getImageBlob(image.id)
        .then((blob) => {
          // Check if element still exists before setting src
          if (!e.currentTarget) {
            console.warn(`Image element no longer exists for ${image.id}`);
            return;
          }

          if (blob) {
            // Create a new blob URL from the stored blob
            const url = URL.createObjectURL(blob);
            e.currentTarget.src = url;
            console.debug(`Loaded image ${image.id} from IndexedDB after error`);
            return;
          }

          // Try various fallback methods
          if (image.thumbnail_url) {
            if (image.thumbnail_url.startsWith('data:')) {
              e.currentTarget.src = image.thumbnail_url;
              return;
            } else if (!image.thumbnail_url.startsWith('blob:')) {
              // Try direct backend URL
              const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
              const thumbnailPath = image.thumbnail_url.includes('uploads/')
                ? image.thumbnail_url.substring(image.thumbnail_url.indexOf('uploads/') + 8)
                : image.thumbnail_url;
              const directPath = `${backendUrl}/uploads/${thumbnailPath}`;
              e.currentTarget.src = directPath;
              return;
            }
          }

          // Check if we have the original URL (for converted TIFF files)
          if (image.url && !image.url.startsWith('blob:')) {
            const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
            const imagePath = image.url.includes('uploads/')
              ? image.url.substring(image.url.indexOf('uploads/') + 8)
              : image.url;
            const directPath = `${backendUrl}/uploads/${imagePath}`;
            e.currentTarget.src = directPath;
            return;
          }

          // Final fallback
          e.currentTarget.src = isOriginallyTiff ? '/placeholder-tiff.svg' : '/placeholder.svg';
        })
        .catch((err) => {
          console.error('Error getting image from IndexedDB:', err);
          if (e.currentTarget) {
            e.currentTarget.src = isOriginallyTiff ? '/placeholder-tiff.svg' : '/placeholder.svg';
          }
        });
    } catch (err) {
      console.error('Error handling image fallback:', err);
      if (e.currentTarget) {
        e.currentTarget.src = isOriginallyTiff ? '/placeholder-tiff.svg' : '/placeholder.svg';
      }
    }
  };

  // Status badge component
  const StatusBadge = ({ className: badgeClassName }: { className?: string }) => (
    <Badge
      className={cn(
        badgeClassName,
        currentStatus === SEGMENTATION_STATUS.COMPLETED
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
          : currentStatus === SEGMENTATION_STATUS.PROCESSING
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
            : currentStatus === SEGMENTATION_STATUS.QUEUED
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
              : currentStatus === SEGMENTATION_STATUS.FAILED
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                : currentStatus === SEGMENTATION_STATUS.WITHOUT_SEGMENTATION
                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
      )}
      title={image.error ? `${t('common.error')}: ${image.error}` : undefined}
    >
      {currentStatus === SEGMENTATION_STATUS.COMPLETED ? (
        t('segmentation.status.completed')
      ) : currentStatus === SEGMENTATION_STATUS.PROCESSING ? (
        <span className="flex items-center">
          <span className="animate-pulse mr-1">●</span> {t('segmentation.status.processing')}
        </span>
      ) : currentStatus === SEGMENTATION_STATUS.QUEUED ? (
        <span className="flex items-center">
          <span className="mr-1">⏱</span> {t('segmentation.status.queued')}
        </span>
      ) : currentStatus === SEGMENTATION_STATUS.FAILED ? (
        <span className="flex items-center">
          <span className="mr-1">⚠️</span> {t('segmentation.status.failed')}
        </span>
      ) : currentStatus === SEGMENTATION_STATUS.WITHOUT_SEGMENTATION ? (
        t('segmentation.status.withoutSegmentation')
      ) : (
        t('segmentation.status.pending')
      )}
    </Badge>
  );

  // Render grid view (card layout)
  if (viewMode === 'grid') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        layout
        className="h-full"
      >
        <Card
          className={cn(
            'overflow-hidden border-gray-200 dark:border-gray-700 transition-all group hover:shadow-md relative h-full flex flex-col',
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
          {/* Selection checkbox or actions */}
          {selectionMode ? (
            <div className="absolute top-2 right-2 z-10">
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onToggleSelection?.(e.nativeEvent)}
                  className="h-5 w-5 rounded border-gray-300"
                />
              </div>
            </div>
          ) : (
            <ImageActions
              onDelete={() => onDelete(image.id)}
              onResegment={() => onResegment(image.id)}
              isProcessing={isProcessingStatus(currentStatus)}
            />
          )}

          {/* Image preview with segmentation overlay - clickable to open segmentation editor */}
          <div
            className="bg-gray-100 dark:bg-gray-800 relative overflow-hidden cursor-pointer flex items-center justify-center w-full flex-1"
            style={{ margin: '0' }}
          >
            {imageSrc ? (
              <>
                <img
                  src={imageSrc || (isOriginallyTiff ? '/placeholder-tiff.svg' : '/placeholder.svg')}
                  alt={image.name || 'Image'}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                  loading="lazy"
                />
                {/* Segmentation overlay for completed images */}
                {currentStatus === SEGMENTATION_STATUS.COMPLETED && (
                  <div className="absolute inset-0 pointer-events-none">
                    <SegmentationThumbnail
                      imageId={image.id}
                      projectId={image.project_id || ''}
                      thumbnailUrl={imageSrc || undefined}
                      fallbackSrc="/placeholder.svg"
                      altText={image.name || 'Image'}
                      className="w-full h-full"
                      width={300}
                      height={300}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                <span className="text-gray-400 dark:text-gray-500">No preview</span>
              </div>
            )}

            {/* Status badge */}
            <StatusBadge className="absolute bottom-2 left-2" />
          </div>

          <CardContent className="p-3">
            <div className="truncate">
              <h3 className="font-medium text-sm truncate" title={image.name || 'Image'}>
                {image.name || 'Image'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {safeFormatDate(image.createdAt, 'PPP', 'Unknown date')}
              </p>
              {currentStatus === SEGMENTATION_STATUS.FAILED && image.error && (
                <div className="mt-1 text-xs text-red-500 truncate" title={image.error}>
                  <span className="font-medium">{t('common.error')}:</span> {image.error.substring(0, 50)}
                  {image.error.length > 50 ? '...' : ''}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Render list view
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
        {(currentStatus === SEGMENTATION_STATUS.COMPLETED || currentStatus === SEGMENTATION_STATUS.PROCESSING) &&
        image.id ? (
          <SegmentationThumbnail
            imageId={image.id}
            projectId={image.project_id || ''}
            thumbnailUrl={imageSrc || undefined}
            fallbackSrc="/placeholder.svg"
            altText={image.name || 'Image'}
            className="h-full w-full"
            width={40}
            height={40}
          />
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt={image.name || 'Image'}
            className="h-full w-full object-cover"
            onError={handleImageError}
          />
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
          {currentStatus && <StatusBadge className="ml-2 text-xs" />}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{safeFormatDate(image.createdAt, 'PPP', '')}</p>
        {currentStatus === SEGMENTATION_STATUS.FAILED && image.error && (
          <div className="mt-1 text-xs text-red-500 truncate" title={image.error}>
            <span className="font-medium">{t('common.error')}:</span> {image.error.substring(0, 50)}
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
          <ImageListActions
            onDelete={() => onDelete(image.id)}
            onResegment={() => onResegment(image.id)}
            isProcessing={isProcessingStatus(currentStatus)}
          />
        )}
      </div>
    </motion.div>
  );
};
