/**
 * useSocketConnection hook
 *
 * A React hook that provides a managed Socket.IO connection and event handling
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '../socketClient';
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

      const newSocket = connectSocket();
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

    // Připojení po malém zpoždění pro lepší stabilitu
    if (isAuthenticated && autoConnect) {
      connectTimer = setTimeout(() => {
        if (mounted) {
          try {
            connect();
          } catch (err) {
            console.error('Failed to connect socket:', err);
          }
        }
      }, 500);
    }

    // Clean up on unmount
    return () => {
      mounted = false;
      if (connectTimer) {
        clearTimeout(connectTimer);
      }

      try {
        disconnect();
      } catch (err) {
        // Ignoruj chyby při odpojování na unmount
      }
    };
  }, [isAuthenticated, autoConnect, connect, disconnect]);

  return {
    socket,
    isConnected,
    error,
    connect,
    disconnect
  };
};

export default useSocketConnection;