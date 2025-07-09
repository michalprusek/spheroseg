/**
 * Socket.IO singleton instance
 * This file provides access to the Socket.IO server instance
 */
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from './utils/logger';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server
 */
export function initializeSocketIO(server: HttpServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  logger.info('Socket.IO server initialized');
  return io;
}

/**
 * Get Socket.IO server instance
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO server not initialized. Call initializeSocketIO first.');
  }
  return io;
}

export default io;
