/**
 * Socket.io configuration
 * This file exports the Socket.io instance to be used throughout the application
 */
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import logger from './utils/logger';
import socketAuthMiddleware from './middleware/socketAuthMiddleware';
import config from './config';

// Socket.io instance
let io: SocketIOServer;

/**
 * Initialize Socket.io with an HTTP server
 * @param server HTTP server instance
 */
export const initializeSocketIO = (server: http.Server): SocketIOServer => {
  // Get CORS origins from config.server.corsOrigins or use defaults
  const corsOrigins = config.server.corsOrigins || 
                     ['http://localhost:3000', 'http://localhost:3003', '*'];
  
  logger.info('Initializing Socket.IO with CORS configuration', { 
    corsOrigins, 
    isDevelopment: config.isDevelopment 
  });

  io = new SocketIOServer(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,  // Increase timeout for development
    connectTimeout: 45000
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Set up connection handler
  io.on('connection', (socket) => {
    const userId = socket.data.user?.userId;
    logger.info('New socket connection', { 
      socketId: socket.id, 
      userId,
      transportType: socket.conn.transport.name,
      remoteAddress: socket.handshake.address
    });

    // Debug information for troubleshooting
    if (config.isDevelopment) {
      logger.debug('Socket connection details', {
        handshake: {
          headers: socket.handshake.headers,
          query: socket.handshake.query,
          auth: socket.handshake.auth
        }
      });
    }

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { socketId: socket.id, userId, reason });
    });

    socket.on('error', (error) => {
      logger.error('Socket error', { socketId: socket.id, userId, error });
    });

    // Add real-time event handlers here
  });

  return io;
};

/**
 * Get the Socket.io instance
 * @returns Socket.io instance
 */
export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export default {
  initializeSocketIO,
  getIO
};
