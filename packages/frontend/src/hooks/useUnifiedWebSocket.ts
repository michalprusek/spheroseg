/**
 * Unified WebSocket Hook
 *
 * This hook provides a simple interface for WebSocket functionality,
 * managing connections and event subscriptions with automatic cleanup.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import webSocketService, { ConnectionState } from '@/services/unifiedWebSocketService';
import { createLogger } from '@/utils/logging/unifiedLogger';

const logger = createLogger('useUnifiedWebSocket');

// ===========================
// Types and Interfaces
// ===========================

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
  room?: string | string[];
  events?: Record<string, (...args: unknown[]) => void>;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export interface UseWebSocketReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  connectionState: ConnectionState;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  emit: (event: string, ...args: unknown[]) => void;
  emitWithAck: (event: string, ...args: unknown[]) => Promise<any>;

  // Room management
  joinRoom: (room: string) => Promise<void>;
  leaveRoom: (room: string) => Promise<void>;

  // Event management
  on: (event: string, handler: (...args: unknown[]) => void) => () => void;
  off: (event: string, handler?: (...args: unknown[]) => void) => void;
}

// ===========================
// Main Hook
// ===========================

export function useUnifiedWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { autoConnect = true, reconnect = true, room, events = {}, onConnect, onDisconnect, onError } = options;

  const { isAuthenticated } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>(webSocketService.getConnectionState());

  // Track mounted state
  const isMounted = useRef(true);
  const eventCleanups = useRef<Map<string, () => void>>(new Map());
  const stateUnsubscribe = useRef<(() => void) | null>(null);

  // Update connection state
  const updateState = useCallback((state: ConnectionState) => {
    if (isMounted.current) {
      setConnectionState(state);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!isAuthenticated) {
      logger.warn('Cannot connect: User not authenticated');
      return;
    }

    try {
      await webSocketService.connect();
      logger.info('WebSocket connection initiated');
    } catch (error) {
      logger.error('Failed to connect:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [isAuthenticated, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(async () => {
    try {
      await webSocketService.disconnect();
      logger.info('WebSocket disconnected');
    } catch (error) {
      logger.error('Failed to disconnect:', error);
    }
  }, []);

  // Emit event
  const emit = useCallback((event: string, ...args: unknown[]) => {
    webSocketService.emit(event, ...args);
  }, []);

  // Emit with acknowledgment
  const emitWithAck = useCallback(async (event: string, ...args: unknown[]) => {
    return webSocketService.emitWithAck(event, ...args);
  }, []);

  // Join room
  const joinRoom = useCallback(async (roomName: string) => {
    try {
      await webSocketService.joinRoom(roomName);
      logger.info(`Joined room: ${roomName}`);
    } catch (error) {
      logger.error(`Failed to join room ${roomName}:`, error);
      throw error;
    }
  }, []);

  // Leave room
  const leaveRoom = useCallback(async (roomName: string) => {
    try {
      await webSocketService.leaveRoom(roomName);
      logger.info(`Left room: ${roomName}`);
    } catch (error) {
      logger.error(`Failed to leave room ${roomName}:`, error);
    }
  }, []);

  // Register event handler
  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const id = webSocketService.on(event, handler);

    // Return cleanup function
    return () => {
      webSocketService.off(event, id);
    };
  }, []);

  // Remove event handler
  const off = useCallback((event: string, handler?: (...args: unknown[]) => void) => {
    webSocketService.off(event, handler);
  }, []);

  // Set up connection and event handlers
  useEffect(() => {
    isMounted.current = true;

    // Subscribe to state changes
    stateUnsubscribe.current = webSocketService.onStateChange(updateState);

    // Set up event handlers from options
    for (const [event, handler] of Object.entries(events)) {
      const cleanup = on(event, handler);
      eventCleanups.current.set(event, cleanup);
    }

    // Set up connection event handlers
    const cleanupConnect = on('connect', () => {
      logger.info('Socket connected in hook');
      onConnect?.();
    });

    const cleanupDisconnect = on('disconnect', (reason) => {
      logger.info('Socket disconnected in hook:', reason);
      onDisconnect?.(reason);
    });

    const cleanupError = on('error', (error) => {
      logger.error('Socket error in hook:', error);
      onError?.(error);
    });

    eventCleanups.current.set('_connect', cleanupConnect);
    eventCleanups.current.set('_disconnect', cleanupDisconnect);
    eventCleanups.current.set('_error', cleanupError);

    // Auto-connect if enabled and authenticated
    if (autoConnect && isAuthenticated) {
      connect();
    }

    // Join rooms if specified
    if (room) {
      const rooms = Array.isArray(room) ? room : [room];
      rooms.forEach((r) => {
        joinRoom(r).catch((error) => {
          logger.error(`Failed to join room ${r}:`, error);
        });
      });
    }

    // Cleanup
    return () => {
      isMounted.current = false;

      // Unsubscribe from state changes
      if (stateUnsubscribe.current) {
        stateUnsubscribe.current();
      }

      // Clean up event handlers
      for (const cleanup of eventCleanups.current.values()) {
        cleanup();
      }
      eventCleanups.current.clear();

      // Leave rooms
      if (room) {
        const rooms = Array.isArray(room) ? room : [room];
        rooms.forEach((r) => {
          leaveRoom(r).catch((error) => {
            logger.error(`Failed to leave room ${r} on cleanup:`, error);
          });
        });
      }

      // Disconnect if no longer authenticated
      if (!isAuthenticated && connectionState.isConnected) {
        disconnect();
      }
    };
  }, [isAuthenticated, autoConnect]);

  return {
    // Connection state
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    error: connectionState.error,
    connectionState,

    // Actions
    connect,
    disconnect,
    emit,
    emitWithAck,

    // Room management
    joinRoom,
    leaveRoom,

    // Event management
    on,
    off,
  };
}

// ===========================
// Specialized Hooks
// ===========================

/**
 * Hook for project-specific WebSocket updates
 */
export function useProjectWebSocket(projectId: string | undefined) {
  const [updates, setUpdates] = useState<any[]>([]);

  const handleUpdate = useCallback((update: unknown) => {
    setUpdates((prev) => [...prev, update]);
  }, []);

  const { isConnected, joinRoom, leaveRoom } = useUnifiedWebSocket({
    autoConnect: true,
    events: {
      image_added: handleUpdate,
      image_updated: handleUpdate,
      image_deleted: handleUpdate,
      segmentation_started: handleUpdate,
      segmentation_completed: handleUpdate,
      segmentation_failed: handleUpdate,
      project_updated: handleUpdate,
    },
  });

  // Join/leave project room
  useEffect(() => {
    if (isConnected && projectId) {
      joinRoom(`project_${projectId}`);

      return () => {
        leaveRoom(`project_${projectId}`);
      };
    }
  }, [isConnected, projectId, joinRoom, leaveRoom]);

  return {
    isConnected,
    updates,
    clearUpdates: () => setUpdates([]),
  };
}

/**
 * Hook for segmentation queue updates
 */
export function useSegmentationQueueWebSocket() {
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { isConnected } = useUnifiedWebSocket({
    autoConnect: true,
    room: 'segmentation_queue',
    events: {
      queue_updated: (status) => {
        setQueueStatus(status);
        setLastUpdate(new Date());
      },
      task_started: (task) => {
        logger.info('Segmentation task started:', task);
      },
      task_completed: (task) => {
        logger.info('Segmentation task completed:', task);
      },
      task_failed: (task) => {
        logger.error('Segmentation task failed:', task);
      },
    },
  });

  return {
    isConnected,
    queueStatus,
    lastUpdate,
  };
}

/**
 * Hook for real-time notifications
 */
export function useNotificationWebSocket(userId: string | undefined) {
  const [notifications, setNotifications] = useState<any[]>([]);

  const handleNotification = useCallback((notification: unknown) => {
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  const { isConnected } = useUnifiedWebSocket({
    autoConnect: true,
    room: userId ? `user_${userId}` : undefined,
    events: {
      notification: handleNotification,
      alert: handleNotification,
      message: handleNotification,
    },
  });

  return {
    isConnected,
    notifications,
    clearNotifications: () => setNotifications([]),
    markAsRead: (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
  };
}

// ===========================
// Export
// ===========================

export default useUnifiedWebSocket;
