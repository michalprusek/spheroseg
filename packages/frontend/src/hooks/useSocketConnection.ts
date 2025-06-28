/**
 * useSocketConnection hook
 *
 * A React hook that provides a managed Socket.IO connection and event handling
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { initializeSocket, disconnectSocket } from '../services/socketClient';
import { useAuth } from '@/contexts/AuthContext';

interface SocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
}

/**
 * Hook for managing Socket.IO connections with authentication
 */
export const useSocketConnection = (options: SocketOptions = {}) => {
  const { autoConnect = true, reconnect = true } = options;
  const { isAuthenticated } = useAuth(); // Get authentication status

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  /**
   * Connect to the Socket.IO server
   */
  const connect = useCallback(() => {
    try {
      if (!isAuthenticated) {
        setError(new Error('Authentication required for socket connection'));
        return;
      }

      const newSocket = initializeSocket();
      setSocket(newSocket);

      // Set up event listeners
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);

        // Handle reconnection for specific disconnect reasons
        if (reconnect && (reason === 'io server disconnect' || reason === 'transport close')) {
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1;
            setTimeout(() => {
              console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`);
              newSocket.connect();
            }, 1000 * reconnectAttempts.current); // Exponential backoff
          } else {
            setError(new Error(`Failed to reconnect after ${maxReconnectAttempts} attempts`));
          }
        }
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setError(err);
        setIsConnected(false);
      });

      // Connect if autoConnect is enabled
      if (autoConnect) {
        newSocket.connect();
      }
    } catch (err) {
      console.error('Error creating socket:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [autoConnect, isAuthenticated, reconnect]);

  /**
   * Disconnect from the Socket.IO server
   */
  const disconnect = useCallback(() => {
    if (socket) {
      disconnectSocket();
      setIsConnected(false);
      setSocket(null);
    }
  }, [socket]);

  // Connect when the component mounts or when auth status changes
  useEffect(() => {
    let mounted = true;
    let connectTimer: NodeJS.Timeout | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    // Connect after a small delay for better stability
    if (isAuthenticated && autoConnect) {
      connectTimer = setTimeout(() => {
        if (mounted) {
          try {
            connect();
            console.log('Socket connection initiated');
          } catch (err) {
            console.error('Failed to connect socket:', err);

            // Try to reconnect after a delay
            if (reconnect && mounted) {
              reconnectTimer = setTimeout(() => {
                console.log('Attempting to reconnect after initial connection failure...');
                if (mounted) {
                  try {
                    connect();
                  } catch (reconnectErr) {
                    console.error('Failed to reconnect socket:', reconnectErr);
                  }
                }
              }, 2000);
            }
          }
        }
      }, 300); // Reduced delay for faster connection
    }

    // Set up a more aggressive heartbeat to check connection status
    const heartbeatInterval = setInterval(() => {
      if (mounted && socket) {
        if (!isConnected && reconnect) {
          console.log('Heartbeat detected disconnected socket, attempting to reconnect...');
          try {
            socket.connect();
          } catch (err) {
            console.error('Heartbeat reconnection failed:', err);
          }
        } else if (isConnected) {
          // Send a ping to keep the connection alive and verify it's working
          try {
            socket.emit('ping', { timestamp: Date.now() });
          } catch (err) {
            console.error('Error sending ping:', err);
          }
        }
      }
    }, 5000); // Check every 5 seconds for more responsive reconnection

    // Clean up on unmount
    return () => {
      mounted = false;
      if (connectTimer) {
        clearTimeout(connectTimer);
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      clearInterval(heartbeatInterval);

      try {
        disconnect();
      } catch (err) {
        // Ignore errors when disconnecting on unmount
      }
    };
  }, [isAuthenticated, autoConnect, connect, disconnect, socket, isConnected, reconnect]);

  return {
    socket,
    isConnected,
    error,
    connect,
    disconnect,
  };
};

export default useSocketConnection;
