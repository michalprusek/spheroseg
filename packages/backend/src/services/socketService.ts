/**
 * Socket.IO Service
 *
 * Handles real-time communication between the server and clients.
 * Manages WebSocket connections, rooms, and event broadcasting.
 */
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../utils/logger';
import { initializeSocketIO as initSocket, getIO } from '../socket';
import { createThrottledEmit } from '../utils/socketThrottle';

// Socket.IO server instance
let io: SocketIOServer | null = null;

/**
 * Initialize the Socket.IO server
 *
 * @param server HTTP server instance to attach Socket.IO to
 * @returns The initialized Socket.IO server instance
 */
export function initializeSocketIO(server: HttpServer): SocketIOServer {
  // Use the shared socket initialization from socket.ts
  io = initSocket(server);

  if (!io) {
    throw new Error('Failed to initialize Socket.IO server');
  }

  // Connection event handler
  io.on('connection', (socket) => {
    const clientId = socket.id;
    logger.info('New client connected', { clientId });

    // Handle joining project-specific rooms - original format
    socket.on('join_project', (data) => {
      try {
        const { projectId } = data;
        if (!projectId) {
          logger.warn('Invalid join_project request: missing projectId', {
            clientId,
          });
          return;
        }

        // Join the room for this project in multiple formats for compatibility
        socket.join(`project-${projectId}`);
        socket.join(`project:${projectId}`);
        logger.info('Client joined project room via join_project', {
          clientId,
          projectId,
        });

        // Acknowledge successful join
        socket.emit('joined_project', { projectId });
      } catch (error) {
        logger.error('Error handling join_project event', { clientId, error });
      }
    });

    // Handle joining project-specific rooms - alternative format
    socket.on('join-project', (projectId) => {
      try {
        if (!projectId) {
          logger.warn('Invalid join-project request: missing projectId', {
            clientId,
          });
          return;
        }

        // Join the room for this project in multiple formats for compatibility
        socket.join(`project-${projectId}`);
        socket.join(`project:${projectId}`);
        logger.info('Client joined project room via join-project', {
          clientId,
          projectId,
        });

        // Acknowledge successful join
        socket.emit('joined_project', { projectId });
      } catch (error) {
        logger.error('Error handling join-project event', { clientId, error });
      }
    });

    // Handle generic room joining
    socket.on('join', (room) => {
      try {
        if (!room) {
          logger.warn('Invalid join request: missing room', { clientId });
          return;
        }

        socket.join(room);
        logger.info('Client joined room via generic join', { clientId, room });

        // Acknowledge successful join
        socket.emit('joined', { room });
      } catch (error) {
        logger.error('Error handling join event', { clientId, error });
      }
    });

    // Handle leaving project-specific rooms
    socket.on('leave_project', (data) => {
      try {
        const { projectId } = data;
        if (!projectId) {
          logger.warn('Invalid leave_project request: missing projectId', {
            clientId,
          });
          return;
        }

        // Leave the room for this project
        socket.leave(`project-${projectId}`);
        logger.info('Client left project room', { clientId, projectId });
      } catch (error) {
        logger.error('Error handling leave_project event', { clientId, error });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', { clientId, reason });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', { clientId, error });
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

/**
 * Get the Socket.IO server instance
 *
 * @returns The Socket.IO server instance or null if not initialized
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast a segmentation update to clients in a project room
 *
 * @param projectId The project ID
 * @param imageId The image ID
 * @param status The segmentation status
 * @param resultPath Optional path to the segmentation result
 * @param error Optional error message if segmentation failed
 */
// Cache throttled emit functions per room
const throttledEmitCache = new Map<string, (event: string, data: unknown) => void>();

export function broadcastSegmentationUpdate(
  projectId: string,
  imageId: string,
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'without_segmentation',
  resultPath?: string,
  error?: string
): void {
  if (!io) {
    logger.warn('Cannot broadcast segmentation update: Socket.IO not initialized');
    return;
  }

  try {
    const roomName = `project-${projectId}`;
    const updateData = {
      imageId,
      status,
      resultPath,
      error,
      timestamp: new Date().toISOString(),
    };

    logger.info('Broadcasting segmentation update', {
      roomName,
      imageId,
      status,
    });

    // Map new statuses to old ones for backward compatibility
    const backwardCompatibleStatus =
      status === 'queued' ? 'pending' : status === 'without_segmentation' ? 'pending' : status;

    const backwardCompatibleData = {
      ...updateData,
      status: backwardCompatibleStatus,
      // Include new status in a separate field for updated clients
      newStatus: status,
    };

    // Get or create throttled emit function for this room
    let throttledEmit = throttledEmitCache.get(roomName);
    if (!throttledEmit) {
      throttledEmit = createThrottledEmit(
        (event: string, data: unknown) => io!.to(roomName).emit(event, data),
        roomName
      );
      throttledEmitCache.set(roomName, throttledEmit);
    }

    // Use throttled emit for high-frequency updates (processing status)
    if (status === 'processing' || status === 'queued') {
      throttledEmit('segmentation_update', updateData);
      throttledEmit('segmentation_update_legacy', backwardCompatibleData);
    } else {
      // Emit immediately for important status changes (completed, failed)
      io.to(roomName).emit('segmentation_update', updateData);
      io.to(roomName).emit('segmentation_update_legacy', backwardCompatibleData);
    }
  } catch (error) {
    logger.error('Error broadcasting segmentation update', {
      projectId,
      imageId,
      error,
    });
  }
}

export default {
  initializeSocketIO,
  getSocketIO,
  broadcastSegmentationUpdate,
};
