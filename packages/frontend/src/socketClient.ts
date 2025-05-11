/**
 * Socket.IO client configuration
 * Provides a centralized way to create authenticated socket connections
 */
import { Socket, io } from 'socket.io-client';
import config from './config';
import { getToken } from './services/authService';

// Configuration for socket connection
const SOCKET_OPTIONS = {
  reconnectionAttempts: 10, // Increased number of attempts
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000, // Increased max delay
  timeout: 30000, // Significantly increased timeout to allow more time for connection
  autoConnect: false, // Don't connect until explicitly called
  transports: ['polling', 'websocket'], // Start with polling, then try websocket
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
  const currentProtocol = window.location.protocol;

  // Return window.location.origin for consistency
  return window.location.origin;
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
    // Remove existing socket.io-client script from the page if it exists
    // This helps prevent conflicts and "message channel closed" errors
    try {
      const existingScripts = document.querySelectorAll('script[src*="socket.io"]');
      existingScripts.forEach((script) => {
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

    // Set up error handling for the socket
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);

      // Don't interrupt the user experience due to socket connection issues
      // We'll try to reconnect in the background and let the app continue working

      // If polling is failing, the server might be down or unreachable
      // In this case, we'll just let the socket.io client handle reconnection
      // and avoid showing errors to the user

      // Log error but don't show it to the user directly to avoid confusion
    });

    // Add connect event handler for logging
    socket.on('connect', () => {
      console.log('Socket connected successfully with ID:', socket.id);
    });

    // Handle reconnect events
    socket.io.on('reconnect', (attempt) => {
      console.log(`Socket reconnected after ${attempt} attempts`);
    });

    // Handle disconnect events
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      // Don't interrupt the user experience - we'll try to reconnect automatically
    });

    return socket;
  } catch (error) {
    console.error('Error creating socket connection:', error);
    throw new Error('Socket connection failed: ' + error.message);
  }
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

export default {
  connectSocket,
  getSocket,
  disconnectSocket,
  getSocketUrl,
};
