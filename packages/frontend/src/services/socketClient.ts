/**
 * Socket.IO Client Service
 *
 * Manages WebSocket connections to the backend for real-time updates.
 */
import { io, Socket } from 'socket.io-client';
import { getAccessToken as getAuthToken } from './authService';
import logger from '../utils/logger';

// Socket.IO instance
let socket: Socket | null = null;

// Configuration
const SOCKET_RECONNECTION_ATTEMPTS = 5;
const SOCKET_RECONNECTION_DELAY = 1000;
const SOCKET_TIMEOUT = 10000;

/**
 * Initialize Socket.IO connection
 *
 * @returns The Socket.IO client instance
 */
export function initializeSocket(): Socket {
  if (socket) {
    logger.info('Socket already initialized, disconnecting before reconnect');
    socket.disconnect();
  }

  // Get authentication token if available
  const authToken = getAuthToken();
  const hasAuthToken = !!authToken;
  logger.info(`Socket auth token available: ${hasAuthToken}`);

  // Always use relative path to ensure connection to the correct backend
  // This works in both development (with proxy) and production
  const socketUrl = ''; // Empty string means relative to current origin

  logger.info(`Using relative path for Socket.IO connection`);

  // Socket.IO connection options
  const socketOptions = {
    path: '/socket.io',
    reconnectionAttempts: SOCKET_RECONNECTION_ATTEMPTS,
    reconnectionDelay: SOCKET_RECONNECTION_DELAY,
    timeout: SOCKET_TIMEOUT,
    autoConnect: true,
    auth: authToken ? { token: authToken } : undefined,
    transports: ['websocket', 'polling'],
  };

  logger.info(`Socket.IO connecting to: ${socketUrl || window.location.origin} with options:`, socketOptions);

  // Create Socket.IO instance
  socket = io(socketUrl, socketOptions);

  // Set up event handlers
  socket.on('connect', () => {
    logger.info(`Socket connected with ID: ${socket?.id}`);
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    logger.error(`Socket connection error: ${error.message}`);
  });

  socket.on('error', (error) => {
    logger.error(`Socket error: ${error}`);
  });

  return socket;
}

/**
 * Get the Socket.IO client instance
 *
 * @returns The Socket.IO client instance or null if not initialized
 */
export function getSocket(): Socket | null {
  if (!socket) {
    logger.warn('Socket requested but not initialized');
    return null;
  }
  return socket;
}

/**
 * Join a project room to receive updates for a specific project
 *
 * @param projectId The project ID
 */
export function joinProjectRoom(projectId: string): void {
  if (!socket) {
    logger.warn(`Cannot join project room ${projectId}: Socket not initialized`);
    return;
  }

  if (!socket.connected) {
    logger.warn(`Cannot join project room ${projectId}: Socket not connected`);
    return;
  }

  logger.info(`Joining project room: ${projectId}`);
  socket.emit('join_project', { projectId });
}

/**
 * Leave a project room to stop receiving updates for a specific project
 *
 * @param projectId The project ID
 */
export function leaveProjectRoom(projectId: string): void {
  if (!socket) {
    logger.warn(`Cannot leave project room ${projectId}: Socket not initialized`);
    return;
  }

  if (!socket.connected) {
    logger.warn(`Cannot leave project room ${projectId}: Socket not connected`);
    return;
  }

  logger.info(`Leaving project room: ${projectId}`);
  socket.emit('leave_project', { projectId });
}

/**
 * Disconnect the Socket.IO client
 */
export function disconnectSocket(): void {
  if (!socket) {
    logger.warn('Cannot disconnect: Socket not initialized');
    return;
  }

  logger.info('Disconnecting socket');
  socket.disconnect();
  socket = null;
}

export default {
  initializeSocket,
  getSocket,
  joinProjectRoom,
  leaveProjectRoom,
  disconnectSocket,
};
