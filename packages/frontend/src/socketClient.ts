/**
 * Socket.IO client configuration
 * Provides a centralized way to create authenticated socket connections
 */
import { Socket, io } from 'socket.io-client';
import config from './config';
import { getToken } from './services/authService';

// Configuration for socket connection
const SOCKET_OPTIONS = {
  reconnectionAttempts: 5, // Increase reconnection attempts for better reliability
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000, // Increase timeout for Docker environment
  autoConnect: false, // Don't connect until explicitly called
  transports: ['polling'], // Use only polling since WebSocket is not supported in simple-server
  forceNew: true, // Force new connection to avoid stale connections
  withCredentials: true, // Send cookies in Docker environment to maintain auth state
  extraHeaders: {
    'Cache-Control': 'no-cache',
  },
  // Add additional options for better compatibility
  path: '/socket.io', // Explicitly set the path
  rejectUnauthorized: false, // Allow self-signed certificates
};

// Development debug mode
const DEBUG = process.env.NODE_ENV === 'development';

// Socket instance
let socket: Socket | null = null;

/**
 * Get the Socket.IO URL - we use the standard HTTP URL
 * Socket.IO will handle the protocol translation internally
 * @returns Socket.IO server URL
 */
export const getSocketUrl = (): string => {
  // When running in Docker, use the relative path to leverage the proxy
  // This ensures the request goes through the frontend's proxy to the backend
  if (DEBUG) console.log('Using relative path for Socket.IO to leverage proxy');

  // Get the current window location
  const currentUrl = window.location.href;
  const currentHost = window.location.hostname;
  const currentPort = window.location.port || '3000';

  // Handle different hostname scenarios
  let host = currentHost;

  // Replace 0.0.0.0 with localhost for WebSocket connections
  if (currentHost === '0.0.0.0') {
    host = 'localhost';
  }

  // Build the origin URL
  const origin = `${window.location.protocol}//${host}:${currentPort}`;

  if (DEBUG) {
    console.log(`Original URL: ${currentUrl}`);
    console.log(`Using Socket.IO URL: ${origin}`);
  }

  return origin;
};

/**
 * Create and connect to the Socket.IO server
 * @returns Connected Socket.IO instance
 */
export const connectSocket = (): Socket => {
  if (socket?.connected) {
    if (DEBUG) console.log('Reusing existing socket connection', socket.id);
    return socket;
  }

  // If reconnecting, disconnect the previous instance
  if (socket) {
    if (DEBUG) console.log('Disconnecting previous socket before reconnect');
    socket.disconnect();
  }

  // Get the authentication token with validation
  const token = getToken(true, true); // Validate and remove if invalid
  if (DEBUG) console.log('Socket auth token available:', !!token);

  const url = getSocketUrl();

  // Create new Socket.IO instance with authentication
  // Only include token in auth if it exists (validation already happened in getToken)
  const authOptions = token ? { auth: { token } } : {};

  try {
    // Odstraníme existující socket.io-client skript ze stránky, pokud existuje
    // Toto pomůže zabránit konfliktům a chybám "message channel closed"
    try {
      const existingScripts = document.querySelectorAll('script[src*="socket.io"]');
      existingScripts.forEach(script => {
        if (DEBUG) console.log('Removing existing socket.io script:', script);
        script.remove();
      });
    } catch (scriptError) {
      if (DEBUG) console.log('Error cleaning up socket.io scripts:', scriptError);
    }

    // Create socket with improved configuration
    const socketOptions = {
      ...SOCKET_OPTIONS,
      ...authOptions,
      path: '/socket.io',
      reconnection: true, // Enable automatic reconnection
    };

    if (DEBUG) {
      console.log('Socket.IO connecting to:', url, 'with options:', {
        ...socketOptions,
        auth: { token: token ? '[token available]' : '[no token]' },
      });
    }

    // Create the socket instance
    socket = io(url, socketOptions);

    // Add a small delay before connecting to avoid race conditions
    setTimeout(() => {
      try {
        if (socket && !socket.connected) {
          socket.connect();
          console.log('WebSocket connecting...');
        }
      } catch (connectError) {
        if (DEBUG) console.error('Error connecting socket:', connectError);
      }
    }, 300);
  } catch (error) {
    console.error('Error creating socket connection:', error);
    // Return a dummy socket that won't cause errors when methods are called on it
    return createDummySocket();
  }

  // Debug logging
  socket.on('connect', () => {
    console.log('Socket connected', socket?.id);
  });

  socket.on('connect_error', (error) => {
    if (DEBUG) console.warn('Socket connection error:', error.message);

    // Don't try to reconnect automatically - the application will work without socket.io
    if (DEBUG) console.log('Socket.IO connection failed, application will continue in offline mode');

    // Clean up event listeners to prevent memory leaks
    socket.removeAllListeners();
    console.log('WebSocket: Cleaned up event listeners');

    // Prevent excessive reconnection attempts
    try {
      socket?.disconnect();
      console.log('Cleaned up WebSocket event listeners');
    } catch (err) {
      if (DEBUG) console.error('Error disconnecting socket:', err);
    }

    // Provide a fallback mechanism for components that depend on socket.io
    // This will allow the application to work in offline mode
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socket:offline', {
        detail: { error: error.message }
      }));
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

/**
 * Get the current Socket.IO instance, creating one if it doesn't exist
 * @returns Socket.IO instance
 */
export const getSocket = (): Socket => {
  if (!socket || !socket.connected) {
    return connectSocket();
  }
  return socket;
};

/**
 * Disconnect the Socket.IO connection
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Creates a dummy socket that won't cause errors when methods are called on it
 * This is used as a fallback when socket connection fails
 * @returns A dummy socket object
 */
const createDummySocket = (): Socket => {
  // Create a mock event emitter that does nothing
  const dummyEmitter: any = {
    on: () => dummyEmitter,
    off: () => dummyEmitter,
    once: () => dummyEmitter,
    emit: () => false,
    listeners: () => [],
    connect: () => {},
    disconnect: () => {},
    connected: false,
    id: 'dummy-socket-id',
  };

  console.warn('Using dummy socket due to connection failure');

  // Dispatch offline event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('socket:offline', {
      detail: { error: 'Failed to create socket connection' }
    }));
  }

  return dummyEmitter as unknown as Socket;
};

export default {
  connectSocket,
  getSocket,
  disconnectSocket,
  getSocketUrl
};