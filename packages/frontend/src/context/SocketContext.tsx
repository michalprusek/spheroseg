/**
 * SocketContext
 *
 * Provides global Socket.IO connection management for the application
 */
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import useSocketConnection from '../hooks/useSocketConnection';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
}

// Create context with default values
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  error: null,
  connect: () => {},
  disconnect: () => {},
});

interface SocketProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
}

/**
 * Socket context provider component
 */
export const SocketProvider: React.FC<SocketProviderProps> = ({ children, autoConnect = true }) => {
  const { socket, isConnected, error, connect, disconnect } = useSocketConnection({
    autoConnect,
    reconnect: true,
  });

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      socket,
      isConnected,
      error,
      connect,
      disconnect,
    }),
    [socket, isConnected, error, connect, disconnect],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

/**
 * Custom hook to use the socket context
 */
export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);

  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }

  return context;
};

export default SocketContext;
