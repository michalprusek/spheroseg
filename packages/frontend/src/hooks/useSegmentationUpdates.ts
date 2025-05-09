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
  const { socket, isConnected } = useSocketConnection();
  
  const [lastUpdate, setLastUpdate] = useState<SegmentationUpdate | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatusUpdate | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Handler for segmentation updates
  const handleSegmentationUpdate = useCallback((update: SegmentationUpdate) => {
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
  }, [imageId, onUpdate]);

  // Handler for queue status updates
  const handleQueueUpdate = useCallback((status: QueueStatusUpdate) => {
    console.log('Received queue status update:', status);
    setQueueStatus(status);
    
    // Call the queue update callback if provided
    if (onQueueUpdate) {
      onQueueUpdate(status);
    }
  }, [onQueueUpdate]);

  // Set up event listeners when the socket is connected
  useEffect(() => {
    if (!socket || !isConnected) {
      setIsListening(false);
      return () => {}; // Prázdná cleanup funkce, aby nedošlo k chybám
    }

    try {
      // Bezpečně registrujeme event listenery
      const registerListeners = () => {
        try {
          // Register event listeners
          socket.on('segmentation_update', handleSegmentationUpdate);
          socket.on('segmentation_queue_update', handleQueueUpdate);
          setIsListening(true);
        } catch (error) {
          console.error('Failed to register socket listeners:', error);
          setIsListening(false);
        }
      };

      // Registrujeme listenery s malým zpožděním, aby se socket mohl správně inicializovat
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
          console.error('Error during socket cleanup:', error);
        } finally {
          setIsListening(false);
        }
      };
    } catch (error) {
      console.error('Error in socket effect setup:', error);
      setIsListening(false);
      return () => {}; // Prázdná cleanup funkce
    }
  }, [socket, isConnected, handleSegmentationUpdate, handleQueueUpdate]);

  return {
    lastUpdate,
    queueStatus,
    isConnected,
    isListening
  };
};

export default useSegmentationUpdates;