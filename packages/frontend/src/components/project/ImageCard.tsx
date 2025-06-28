import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ProjectImage } from '@spheroseg/types';
import { Badge } from '@/components/ui/badge';
import ImageActions from './ImageActions';
import { constructUrl } from '@/lib/urlUtils';
import { safeFormatDate } from '@/utils/dateUtils';
import { getImageBlob, storeImageBlob } from '@/utils/indexedDBService';
import SegmentationThumbnail from './SegmentationThumbnail';
import DebugSegmentationThumbnail from './DebugSegmentationThumbnail';
import useSocketConnection from '@/hooks/useSocketConnection';
import apiClient from '@/lib/apiClient';
import { useTranslations } from '@/hooks/useTranslations';

interface ImageCardProps {
  image: ProjectImage;
  onDelete: (imageId: string) => void;
  onOpen?: (imageId: string) => void;
  onResegment: (imageId: string) => void;
  className?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (event?: React.MouseEvent) => void;
}

export const ImageCard = ({
  image,
  onDelete,
  onOpen,
  onResegment,
  className,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
}: ImageCardProps) => {
  const { t } = useTranslations();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>(image.segmentationStatus || 'pending');

  // Sledujeme změny stavu segmentace
  useEffect(() => {
    setCurrentStatus(image.segmentationStatus || 'pending');
  }, [image.segmentationStatus]);

  // Get socket connection
  const { socket, isConnected } = useSocketConnection();

  // Handle segmentation updates from WebSocket
  const handleSegmentationUpdate = useCallback(
    (data: any) => {
      if (data && data.imageId === image.id && data.status) {
        console.log(`ImageCard: Received WebSocket segmentation update for image ${data.imageId}: ${data.status}`);

        // Update image status
        setCurrentStatus(data.status);

        // Trigger queue status update
        if (data.status === 'processing' || data.status === 'completed' || data.status === 'failed' || data.status === 'queued') {
          console.log(`ImageCard: Dispatching queue-status-update for image ${data.imageId}`);

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
      console.log(`ImageCard: Setting up WebSocket listeners for image ${image.id}`);

      // Listen for segmentation updates
      socket.on('segmentation_update', handleSegmentationUpdate);

      // Join project room if needed
      if (image.project_id) {
        console.log(`ImageCard: Joining project room for project ${image.project_id}`);
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
      console.log(`ImageCard: Socket not connected, attempting to reconnect for image ${image.id}`);
      try {
        socket.connect();
      } catch (err) {
        console.error('Error reconnecting socket:', err);
      }
    }
  }, [socket, isConnected, handleSegmentationUpdate, image.id, image.project_id]);

  // Periodically check status for processing images to catch missed updates
  useEffect(() => {
    // Only set up polling for processing status and avoid infinite loops
    if (currentStatus === 'processing') {
      console.log(`ImageCard: Setting up status polling for processing image ${image.id}`);

      // Function to check current image status through API
      const checkImageStatus = async () => {
        try {
          // Try to get segmentation status directly
          const response = await apiClient.get(`/api/images/${image.id}/segmentation`);
          if (response.data && response.data.status) {
            const apiStatus = response.data.status;
            if (apiStatus !== currentStatus) {
              console.log(`ImageCard: Status polling detected change for image ${image.id}: ${currentStatus} → ${apiStatus}`);
              setCurrentStatus(apiStatus);

              // If status changed to completed, trigger update notification
              if (apiStatus === 'completed') {
                const imageUpdateEvent = new CustomEvent('image-status-update', {
                  detail: {
                    imageId: image.id,
                    status: apiStatus,
                    forceQueueUpdate: true
                  },
                });
                window.dispatchEvent(imageUpdateEvent);
              }
            }
          }
        } catch (error) {
          // Don't spam the console with 401 errors, just log once
          if (error?.response?.status === 401) {
            console.warn(`ImageCard: Authentication required for image ${image.id}, stopping polling`);
            return; // Stop polling on auth errors
          }
          console.warn(`ImageCard: Error checking segmentation status for image ${image.id}:`, error);
        }
      };

      // Check immediately on mount
      checkImageStatus();

      // Set up polling interval - check every 15 seconds (increased to reduce spam)
      const intervalId = setInterval(checkImageStatus, 15000);

      return () => {
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
        console.log(`ImageCard: Received custom event status update for image ${imageId}: ${status}`);

        // Update image status
        setCurrentStatus(status);

        // If forceQueueUpdate is true or status is 'processing' or 'queued', update the queue indicator
        if (forceQueueUpdate || status === 'processing' || status === 'queued') {
          console.log(`ImageCard: Dispatching queue-status-update for image ${imageId}`);

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
            console.log(`Loaded image ${image.id} from IndexedDB`);
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
            console.log(`Loaded image ${image.id} from IndexedDB after error`);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      layout
    >
      <Card
        className={cn(
          'overflow-hidden border-gray-200 dark:border-gray-700 transition-all group hover:shadow-md relative',
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
          <ImageActions onDelete={() => onDelete(image.id)} onResegment={() => onResegment(image.id)} />
        )}

        {/* Image preview with segmentation overlay - clickable to open segmentation editor */}
        <div
          className="bg-gray-100 dark:bg-gray-800 relative overflow-hidden cursor-pointer flex items-center justify-center w-full aspect-square"
          style={{ width: '100%', height: '100%', margin: '0' }}
        >
          {/* Always try to use SegmentationThumbnail for all images - it will handle missing segmentations gracefully */}
          {imageSrc ? (
            <>
              {/* <SegmentationThumbnail
                imageId={image.id}
                projectId={image.project_id || ''}
                thumbnailUrl={imageSrc}
                fallbackSrc="/placeholder.svg"
                altText={image.name || 'Image'}
                className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                width={200}
                height={200}
              /> */}
              <img
                src={imageSrc || (isOriginallyTiff ? '/placeholder-tiff.svg' : '/placeholder.svg')}
                alt={image.name || 'Image'}
                className="w-full h-full object-cover"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={handleImageError}
                loading="lazy"
              />
              {/* Debug overlay for segmentation - bright red to make it visible */}
              {currentStatus === 'completed' && (
                <div className="absolute inset-0">
                  <DebugSegmentationThumbnail
                    imageId={image.id}
                    projectId={image.project_id || ''}
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
          <Badge
            className={cn(
              'absolute bottom-2 left-2',
              currentStatus === 'completed'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                : currentStatus === 'processing'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                  : currentStatus === 'queued'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                    : currentStatus === 'failed'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
            )}
            title={image.error ? `${t('common.error')}: ${image.error}` : undefined}
          >
            {currentStatus === 'completed' ? (
              t('segmentation.status.completed')
            ) : currentStatus === 'processing' ? (
              <span className="flex items-center">
                <span className="animate-pulse mr-1">●</span> {t('segmentation.status.processing')}
              </span>
            ) : currentStatus === 'queued' ? (
              <span className="flex items-center">
                <span className="mr-1">⏱</span> {t('segmentation.status.queued')}
              </span>
            ) : currentStatus === 'failed' ? (
              <span className="flex items-center">
                <span className="mr-1">⚠️</span> {t('segmentation.status.failed')}
              </span>
            ) : (
              t('segmentation.status.pending')
            )}
          </Badge>
        </div>

        <CardContent className="p-3">
          <div className="truncate">
            <h3 className="font-medium text-sm truncate" title={image.name || 'Image'}>
              {image.name || 'Image'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {safeFormatDate(image.createdAt, 'PPP', 'Unknown date')}
            </p>
            {currentStatus === 'failed' && image.error && (
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
};