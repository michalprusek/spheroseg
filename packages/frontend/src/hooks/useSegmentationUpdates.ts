/**
 * useSegmentationUpdates hook
 *
 * A custom hook for listening to segmentation updates via Socket.IO
 */
import { useEffect, useState, useCallback } from 'react';
import useSocketConnection from './useSocketConnection';

export interface SegmentationUpdate {
  imageId: string;
  status: 'completed' | 'failed' | 'processing';
  resultPath?: string;
  error?: string;
  timestamp: string;
}

export interface QueueStatusUpdate {
  pendingTasks: string[];
  runningTasks: string[];
  queueLength: number;
  activeTasksCount: number;
  timestamp: string;
  // V2 service specific fields
  queuedTasksCount?: number;
  pendingTasksCount?: number;
  runningTasksCount?: number;
  processingImages?: Array<{
    id: string;
    name: string;
    projectId: string;
  }>;
  queuedImages?: Array<{
    id: string;
    name: string;
    projectId: string;
  }>;
}

interface UseSegmentationUpdatesOptions {
  imageId?: string; // Optional specific image to track
  onUpdate?: (update: SegmentationUpdate) => void;
  onQueueUpdate?: (status: QueueStatusUpdate) => void;
}

/**
 * Hook for receiving real-time segmentation updates
 */
export const useSegmentationUpdates = (options: UseSegmentationUpdatesOptions = {}) => {
  const { imageId, onUpdate, onQueueUpdate } = options;

  // Get the socket connection
  const { socket, isConnected } = useSocketConnection();

  const [lastUpdate, setLastUpdate] = useState<SegmentationUpdate | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatusUpdate | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);

  // Handler for segmentation updates
  const handleSegmentationUpdate = useCallback(
    (update: SegmentationUpdate) => {
      console.log('Received segmentation update:', update);

      // If we're tracking a specific image, only process updates for that image
      if (imageId && update.imageId !== imageId) {
        return;
      }

      setLastUpdate(update);

      // Call the update callback if provided
      if (onUpdate) {
        onUpdate(update);
      }
    },
    [imageId, onUpdate],
  );

  // Handler for queue status updates
  const handleQueueUpdate = useCallback(
    (status: QueueStatusUpdate) => {
      console.log('Received queue status update:', status);
      setQueueStatus(status);

      // Call the queue update callback if provided
      if (onQueueUpdate) {
        onQueueUpdate(status);
      }
    },
    [onQueueUpdate],
  );

  // Check for queue data via API instead of unreliable localStorage
  const checkLocalQueueData = useCallback(() => {
    try {
      // Try to fetch current queue status via API
      // First try the new endpoint
      fetch('/api/segmentation/queue-status')
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          // If that fails, try the legacy endpoint
          return fetch('/api/segmentation/queue').then((legacyResponse) => {
            if (legacyResponse.ok) {
              return legacyResponse.json();
            }
            throw new Error('Failed to fetch queue status from both endpoints');
          });
        })
        .then((data) => {
          // Normalize the data structure regardless of which endpoint was used
          const responseData = data.data || data;

          if (responseData) {
            const queueData: QueueStatusUpdate = {
              pendingTasks: responseData.pendingTasks || responseData.queuedTasks || [],
              runningTasks: responseData.runningTasks || [],
              queueLength: responseData.queueLength || 0,
              activeTasksCount: responseData.activeTasksCount || responseData.runningTasks?.length || 0,
              timestamp: responseData.timestamp || new Date().toISOString(),
              processingImages: responseData.processingImages || [],
            };

            setQueueStatus(queueData);

            // Call the queue update callback if provided
            if (onQueueUpdate) {
              onQueueUpdate(queueData);
            }

            // If tracking a specific image and it's in the processing queue, generate an update
            if (
              imageId &&
              (queueData.pendingTasks.includes(imageId) ||
                queueData.runningTasks.includes(imageId) ||
                queueData.processingImages?.some((img) => img.id === imageId))
            ) {
              const statusUpdate: SegmentationUpdate = {
                imageId,
                status: queueData.runningTasks.includes(imageId) ? 'processing' : 'processing',
                timestamp: new Date().toISOString(),
              };

              setLastUpdate(statusUpdate);

              // Call the update callback if provided
              if (onUpdate) {
                onUpdate(statusUpdate);
              }
            }

            return true;
          }
          return false;
        })
        .catch((error) => {
          console.error('Error fetching segmentation queue status:', error);

          // Create empty queue status on error
          const emptyQueueData: QueueStatusUpdate = {
            pendingTasks: [],
            runningTasks: [],
            queueLength: 0,
            activeTasksCount: 0,
            timestamp: new Date().toISOString(),
            processingImages: [],
          };

          setQueueStatus(emptyQueueData);

          if (onQueueUpdate) {
            onQueueUpdate(emptyQueueData);
          }

          return false;
        });

      // Assume we're fetching data - the fetch promise will handle the actual state update
      return true;
    } catch (error) {
      console.error('Error checking segmentation queue data:', error);
      return false;
    }
  }, [imageId, onQueueUpdate, onUpdate]);

  // Set up event listeners when the socket is connected
  useEffect(() => {
    // First, check for local queue data
    const hasLocalData = checkLocalQueueData();

    if (!socket || !isConnected) {
      setIsListening(false);

      // If we already tried to connect and failed, log the error
      if (connectionFailed && !hasLocalData) {
        // Log the connection failure
        console.error('Failed to establish WebSocket connection for segmentation updates');

        // Try to fetch current queue status via API (without generating mock updates)
        // First try the new endpoint
        fetch('/api/segmentation/queue-status')
          .then((response) => {
            if (response.ok) {
              return response.json();
            }
            // If that fails, try the legacy endpoint
            return fetch('/api/segmentation/queue').then((legacyResponse) => {
              if (legacyResponse.ok) {
                return legacyResponse.json();
              }
              throw new Error('Failed to fetch queue status from both endpoints');
            });
          })
          .then((data) => {
            // Normalize the data structure regardless of which endpoint was used
            const responseData = data.data || data;

            if (responseData) {
              const queueData: QueueStatusUpdate = {
                pendingTasks: responseData.pendingTasks || responseData.queuedTasks || [],
                runningTasks: responseData.runningTasks || [],
                queueLength: responseData.queueLength || 0,
                activeTasksCount: responseData.activeTasksCount || responseData.runningTasks?.length || 0,
                timestamp: responseData.timestamp || new Date().toISOString(),
                processingImages: responseData.processingImages || [],
              };

              setQueueStatus(queueData);

              // Call the queue update callback if provided
              if (onQueueUpdate) {
                onQueueUpdate(queueData);
              }
            }
          })
          .catch((error) => {
            console.error('Error fetching segmentation queue status:', error);

            // Create empty queue status on error
            const emptyQueueData: QueueStatusUpdate = {
              pendingTasks: [],
              runningTasks: [],
              queueLength: 0,
              activeTasksCount: 0,
              timestamp: new Date().toISOString(),
              processingImages: [],
            };

            setQueueStatus(emptyQueueData);

            if (onQueueUpdate) {
              onQueueUpdate(emptyQueueData);
            }
          });
      }

      return () => {}; // Empty cleanup function
    }

    try {
      // Register event listeners safely
      const registerListeners = () => {
        try {
          // Register event listeners
          socket.on('segmentation_update', handleSegmentationUpdate);
          socket.on('segmentation_queue_update', handleQueueUpdate);

          // Debug logger for connection state
          socket.on('connect', () => {
            console.log('Socket connected with ID:', socket.id);
            setIsListening(true);
            setConnectionFailed(false);
          });

          socket.on('disconnect', (reason) => {
            console.log('Socket disconnected, reason:', reason);
            setIsListening(false);
          });

          socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            setConnectionFailed(true);
          });

          // Initial connection state setup
          if (socket.connected) {
            console.log('Socket already connected with ID:', socket.id);
            setIsListening(true);
            setConnectionFailed(false);
          } else {
            console.log('Socket initialized but not yet connected');
          }
        } catch (error) {
          console.error('Failed to register socket listeners:', error);
          setIsListening(false);
          setConnectionFailed(true); // Set connection failed flag
        }
      };

      // Register listeners with a small delay to allow the socket to initialize properly
      const timerId = setTimeout(registerListeners, 100);

      // Clean up event listeners when the component unmounts or the socket changes
      return () => {
        clearTimeout(timerId);
        try {
          if (socket && socket.connected) {
            socket.off('segmentation_update', handleSegmentationUpdate);
            socket.off('segmentation_queue_update', handleQueueUpdate);
          }
        } catch (error) {
          // Use structured error handling instead of console.error
          import('@/utils/errorHandling').then(({ handleError, ErrorType, ErrorSeverity }) => {
            handleError(error, {
              context: 'Socket event listener cleanup',
              errorInfo: {
                type: ErrorType.CLIENT,
                severity: ErrorSeverity.WARNING,
                message: 'Error during socket cleanup',
              },
              showToast: false, // No need to show toast for cleanup errors
            });
          });
        } finally {
          setIsListening(false);
        }
      };
    } catch (error) {
      // Use structured error handling
      import('@/utils/errorHandling').then(({ handleError, ErrorType, ErrorSeverity }) => {
        handleError(error, {
          context: 'Socket connection setup',
          errorInfo: {
            type: ErrorType.NETWORK,
            severity: ErrorSeverity.WARNING,
            message: 'Error setting up WebSocket connection',
          },
          showToast: false, // Don't show toast for socket setup errors to prevent spam
        });
      });

      setIsListening(false);
      setConnectionFailed(true); // Set connection failed flag
      return () => {}; // Empty cleanup function
    }
  }, [socket, isConnected, handleSegmentationUpdate, handleQueueUpdate, onQueueUpdate, connectionFailed]);

  return {
    lastUpdate,
    queueStatus,
    isConnected,
    isListening,
  };
};

export default useSegmentationUpdates;
