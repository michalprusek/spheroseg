/**
 * Unified Socket Context
 *
 * This context provides global WebSocket functionality using the unified service.
 * It manages authentication-based connections and provides a clean API for components.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import webSocketService, { ConnectionState } from '@/services/unifiedWebSocketService';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { toast } from 'sonner';

const logger = createLogger('UnifiedSocketContext');

// ===========================
// Types and Interfaces
// ===========================

// Type for event data
type EventData = unknown;
type EventArgs = EventData[];
type EventHandler = (...args: EventArgs) => void;

export interface SocketContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: Error | null;
  connectionState: ConnectionState;

  // Core actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // Event handling
  emit: (event: string, ...args: EventArgs) => void;
  emitWithAck: (event: string, ...args: EventArgs) => Promise<unknown>;
  on: (event: string, handler: EventHandler) => () => void;
  off: (event: string, handler?: EventHandler) => void;

  // Room management
  joinRoom: (room: string) => Promise<void>;
  leaveRoom: (room: string) => Promise<void>;
  getRooms: () => string[];

  // Specialized methods
  joinProjectRoom: (projectId: string) => Promise<void>;
  leaveProjectRoom: (projectId: string) => Promise<void>;
  joinSegmentationQueue: () => Promise<void>;
  leaveSegmentationQueue: () => Promise<void>;
}

// ===========================
// Context Creation
// ===========================

const UnifiedSocketContext = createContext<SocketContextValue | null>(null);

// ===========================
// Provider Component
// ===========================

export interface UnifiedSocketProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
  showConnectionToasts?: boolean;
  reconnectOnAuth?: boolean;
}

export function UnifiedSocketProvider({
  children,
  autoConnect = true,
  showConnectionToasts = true,
  reconnectOnAuth = true,
}: UnifiedSocketProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>(webSocketService.getConnectionState());

  // Track initialization
  const [isInitialized, setIsInitialized] = useState(false);

  // Update connection state
  const updateConnectionState = useCallback(
    (state: ConnectionState) => {
      setConnectionState(state);

      // Show connection toasts if enabled
      if (showConnectionToasts) {
        if (state.isConnected && !connectionState.isConnected) {
          toast.success('Real-time connection established');
        } else if (!state.isConnected && connectionState.isConnected) {
          toast.warning('Real-time connection lost');
        }
      }
    },
    [connectionState.isConnected, showConnectionToasts],
  );

  // Initialize WebSocket service
  const initialize = useCallback(async () => {
    if (isInitialized) return;

    try {
      logger.info('Initializing WebSocket service');

      // Initialize with authentication
      await webSocketService.initialize({
        autoConnect: false, // We'll handle connection manually
      });

      // Subscribe to state changes
      const unsubscribe = webSocketService.onStateChange(updateConnectionState);

      setIsInitialized(true);

      // Return cleanup function
      return unsubscribe;
    } catch (error) {
      logger.error('Failed to initialize WebSocket:', error);
      if (showConnectionToasts) {
        toast.error('Failed to initialize real-time connection');
      }
    }
  }, [isInitialized, updateConnectionState, showConnectionToasts]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!isAuthenticated) {
      logger.warn('Cannot connect: User not authenticated');
      return;
    }

    if (!isInitialized) {
      await initialize();
    }

    try {
      await webSocketService.connect();
      logger.info('WebSocket connected');
    } catch (error) {
      logger.error('Failed to connect:', error);
      if (showConnectionToasts) {
        toast.error('Failed to establish real-time connection');
      }
    }
  }, [isAuthenticated, isInitialized, initialize, showConnectionToasts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(async () => {
    try {
      await webSocketService.disconnect();
      logger.info('WebSocket disconnected');
    } catch (error) {
      logger.error('Failed to disconnect:', error);
    }
  }, []);

  // Event handling methods
  const emit = useCallback((event: string, ...args: EventArgs) => {
    webSocketService.emit(event, ...args);
  }, []);

  const emitWithAck = useCallback(async (event: string, ...args: EventArgs) => {
    return webSocketService.emitWithAck(event, ...args);
  }, []);

  const on = useCallback((event: string, handler: EventHandler) => {
    const id = webSocketService.on(event, handler);

    // Return cleanup function
    return () => {
      webSocketService.off(event, id);
    };
  }, []);

  const off = useCallback((event: string, handler?: EventHandler) => {
    webSocketService.off(event, handler);
  }, []);

  // Room management methods
  const joinRoom = useCallback(async (room: string) => {
    try {
      await webSocketService.joinRoom(room);
      logger.info(`Joined room: ${room}`);
    } catch (error) {
      logger.error(`Failed to join room ${room}:`, error);
      throw error;
    }
  }, []);

  const leaveRoom = useCallback(async (room: string) => {
    try {
      await webSocketService.leaveRoom(room);
      logger.info(`Left room: ${room}`);
    } catch (error) {
      logger.error(`Failed to leave room ${room}:`, error);
    }
  }, []);

  const getRooms = useCallback(() => {
    return webSocketService.getRooms();
  }, []);

  // Specialized room methods
  const joinProjectRoom = useCallback(async (projectId: string) => {
    await webSocketService.joinProjectRoom(projectId);
  }, []);

  const leaveProjectRoom = useCallback(async (projectId: string) => {
    await webSocketService.leaveProjectRoom(projectId);
  }, []);

  const joinSegmentationQueue = useCallback(async () => {
    await webSocketService.joinSegmentationQueueRoom();
  }, []);

  const leaveSegmentationQueue = useCallback(async () => {
    await webSocketService.leaveRoom('segmentation_queue');
  }, []);

  // Handle authentication changes
  useEffect(() => {
    if (isAuthenticated && autoConnect) {
      // Connect when authenticated
      connect();
    } else if (!isAuthenticated && connectionState.isConnected) {
      // Disconnect when logged out
      disconnect();
    }
  }, [isAuthenticated, autoConnect, connectionState.isConnected, connect, disconnect]);

  // Initialize on mount
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    initialize().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      unsubscribe?.();
      if (connectionState.isConnected) {
        disconnect();
      }
    };
  }, []);

  // Create context value
  const contextValue = useMemo<SocketContextValue>(
    () => ({
      // Connection state
      isConnected: connectionState.isConnected,
      isConnecting: connectionState.isConnecting,
      connectionError: connectionState.error,
      connectionState,

      // Core actions
      connect,
      disconnect,

      // Event handling
      emit,
      emitWithAck,
      on,
      off,

      // Room management
      joinRoom,
      leaveRoom,
      getRooms,

      // Specialized methods
      joinProjectRoom,
      leaveProjectRoom,
      joinSegmentationQueue,
      leaveSegmentationQueue,
    }),
    [
      connectionState,
      connect,
      disconnect,
      emit,
      emitWithAck,
      on,
      off,
      joinRoom,
      leaveRoom,
      getRooms,
      joinProjectRoom,
      leaveProjectRoom,
      joinSegmentationQueue,
      leaveSegmentationQueue,
    ],
  );

  return <UnifiedSocketContext.Provider value={contextValue}>{children}</UnifiedSocketContext.Provider>;
}

// ===========================
// Hook to Use Context
// ===========================

export function useUnifiedSocket(): SocketContextValue {
  const context = useContext(UnifiedSocketContext);

  if (!context) {
    throw new Error('useUnifiedSocket must be used within UnifiedSocketProvider');
  }

  return context;
}

// ===========================
// Higher-Order Component
// ===========================

export function withUnifiedSocket<P extends object>(
  Component: React.ComponentType<P & { socket: SocketContextValue }>,
) {
  return function WithUnifiedSocketComponent(props: P) {
    const socket = useUnifiedSocket();

    return <Component {...props} socket={socket} />;
  };
}

// ===========================
// Export
// ===========================

export default UnifiedSocketContext;
