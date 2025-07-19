/**
 * Enhanced Socket.IO Service with Message Batching
 *
 * Provides improved WebSocket performance through intelligent message batching,
 * compression, and optimized delivery strategies.
 */
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../utils/logger';
import { initializeSocketIO as initSocket } from '../socket';
import { initializeWebSocketBatcher, getWebSocketBatcher, BatchConfig } from './websocketBatcher';

// Socket.IO server instance
let io: SocketIOServer | null = null;

// Enhanced configuration
const ENHANCED_CONFIG: Partial<BatchConfig> = {
  maxBatchSize: parseInt(process.env["WEBSOCKET_BATCH_SIZE"] || '50'),
  maxBatchDelay: parseInt(process.env["WEBSOCKET_BATCH_DELAY"] || '100'),
  compressionThreshold: parseInt(process.env["WEBSOCKET_COMPRESSION_THRESHOLD"] || '1024'),
  enableCompression: process.env["WEBSOCKET_COMPRESSION"] !== 'false',
  priorityEvents: [
    'error',
    'auth-required',
    'segmentation_completed',
    'segmentation_failed',
    'critical-update',
  ],
};

/**
 * Initialize the enhanced Socket.IO server with batching
 */
export function initializeEnhancedSocketIO(server: HttpServer): SocketIOServer {
  // Use the shared socket initialization
  io = initSocket(server);

  if (!io) {
    throw new Error('Failed to initialize Socket.IO server');
  }

  // Initialize WebSocket batcher
  const batcher = initializeWebSocketBatcher(io, ENHANCED_CONFIG);
  logger.info('WebSocket batcher initialized with config:', ENHANCED_CONFIG);

  // Enhanced connection handler
  io.on('connection', (socket) => {
    const clientId = socket.id;
    const clientInfo = {
      clientId,
      address: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    logger.info('Enhanced client connected', clientInfo);

    // Track client capabilities
    let clientSupportsBatching = false;
    let clientSupportsCompression = false;

    // Client capability detection
    socket.on('client-capabilities', (capabilities) => {
      clientSupportsBatching = capabilities.batching || false;
      clientSupportsCompression = capabilities.compression || false;

      logger.info('Client capabilities registered', {
        clientId,
        batching: clientSupportsBatching,
        compression: clientSupportsCompression,
      });

      // Acknowledge capabilities
      socket.emit('capabilities-acknowledged', {
        batching: clientSupportsBatching,
        compression: clientSupportsCompression,
        batchConfig: {
          maxBatchSize: ENHANCED_CONFIG.maxBatchSize,
          maxBatchDelay: ENHANCED_CONFIG.maxBatchDelay,
        },
      });
    });

    // Handle batch acknowledgments
    socket.on('batch-ack', (batchId) => {
      logger.debug('Batch acknowledged by client', { clientId, batchId });
    });

    // Enhanced room joining with batching consideration
    const joinRoom = (room: string) => {
      socket.join(room);

      // If client supports batching, add to batched room
      if (clientSupportsBatching) {
        socket.join(`${room}:batched`);
      }

      logger.info('Client joined room', {
        clientId,
        room,
        batched: clientSupportsBatching,
      });
    };

    // Handle various join events
    socket.on('join_project', (data) => {
      try {
        const { projectId } = data;
        if (!projectId) {
          logger.warn('Invalid join_project request', { clientId });
          return;
        }

        joinRoom(`project-${projectId}`);
        joinRoom(`project:${projectId}`);

        socket.emit('joined_project', {
          projectId,
          batching: clientSupportsBatching,
        });
      } catch (error) {
        logger.error('Error handling join_project', { clientId, error });
      }
    });

    socket.on('join-project', (projectId) => {
      try {
        if (!projectId) {
          logger.warn('Invalid join-project request', { clientId });
          return;
        }

        joinRoom(`project-${projectId}`);
        joinRoom(`project:${projectId}`);

        socket.emit('joined_project', {
          projectId,
          batching: clientSupportsBatching,
        });
      } catch (error) {
        logger.error('Error handling join-project', { clientId, error });
      }
    });

    socket.on('join', (room) => {
      try {
        if (!room) {
          logger.warn('Invalid join request', { clientId });
          return;
        }

        joinRoom(room);
        socket.emit('joined', {
          room,
          batching: clientSupportsBatching,
        });
      } catch (error) {
        logger.error('Error handling join', { clientId, error });
      }
    });

    // Handle leaving rooms
    socket.on('leave_project', (data) => {
      try {
        const { projectId } = data;
        if (!projectId) {
          logger.warn('Invalid leave_project request', { clientId });
          return;
        }

        socket.leave(`project-${projectId}`);
        socket.leave(`project:${projectId}`);
        socket.leave(`project-${projectId}:batched`);
        socket.leave(`project:${projectId}:batched`);

        logger.info('Client left project room', { clientId, projectId });
      } catch (error) {
        logger.error('Error handling leave_project', { clientId, error });
      }
    });

    // Enhanced disconnection handling
    socket.on('disconnect', (reason) => {
      logger.info('Enhanced client disconnected', {
        clientId,
        reason,
        connectionDuration: Date.now() - new Date(clientInfo.timestamp).getTime(),
      });
    });

    // Error handling with context
    socket.on('error', (error) => {
      logger.error('Socket error', {
        clientId,
        error,
        batching: clientSupportsBatching,
      });
    });

    // Performance monitoring
    socket.on('client-metrics', (metrics) => {
      logger.info('Client performance metrics', {
        clientId,
        ...metrics,
      });
    });
  });

  // Periodic metrics reporting
  setInterval(() => {
    const batcherMetrics = batcher.getMetrics();
    const connectedClients = io.sockets.sockets.size;

    logger.info('WebSocket performance metrics', {
      connectedClients,
      ...batcherMetrics,
    });
  }, 60000); // Every minute

  logger.info('Enhanced Socket.IO server initialized with batching');
  return io;
}

// Cache for throttled and batched emit functions
// TODO: Implement emit caching for performance optimization
// const emitCache = new Map<
//   string,
//   {
//     throttled: (event: string, data: unknown) => void;
//     batched: boolean;
//   }
// >();

/**
 * Enhanced broadcast for segmentation updates with batching support
 */
export function broadcastSegmentationUpdate(
  projectId: string,
  imageId: string,
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'without_segmentation',
  resultPath?: string,
  error?: string
): void {
  if (!io) {
    logger.warn('Cannot broadcast: Socket.IO not initialized');
    return;
  }

  const batcher = getWebSocketBatcher();
  if (!batcher) {
    logger.warn('WebSocket batcher not initialized');
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

    // Check if this is a priority event
    const isPriority = ['completed', 'failed'].includes(status);

    // Send to non-batched clients immediately
    if (isPriority) {
      io.to(roomName).emit('segmentation_update', updateData);
    } else {
      // Use batcher for non-priority updates
      // The batcher will handle emission through the intercepted methods
      io.to(roomName).emit('segmentation_update', updateData);
    }

    // Backward compatibility
    const backwardCompatibleStatus =
      status === 'queued' ? 'pending' : status === 'without_segmentation' ? 'pending' : status;

    const backwardCompatibleData = {
      ...updateData,
      status: backwardCompatibleStatus,
      newStatus: status,
    };

    io.to(roomName).emit('segmentation_update_legacy', backwardCompatibleData);

    logger.debug('Broadcasted segmentation update', {
      roomName,
      imageId,
      status,
      priority: isPriority,
    });
  } catch (error) {
    logger.error('Error broadcasting segmentation update', {
      projectId,
      imageId,
      error,
    });
  }
}

/**
 * Broadcast multiple updates efficiently
 */
export function broadcastBulkUpdates(
  updates: Array<{
    projectId: string;
    imageId: string;
    status: string;
    resultPath?: string;
    error?: string;
  }>
): void {
  if (!io) {
    logger.warn('Cannot broadcast bulk: Socket.IO not initialized');
    return;
  }

  // Group updates by project
  const groupedUpdates = updates.reduce(
    (acc, update) => {
      const key = update.projectId;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(update);
      return acc;
    },
    {} as Record<string, typeof updates>
  );

  // Send grouped updates
  for (const [projectId, projectUpdates] of Object.entries(groupedUpdates)) {
    const roomName = `project-${projectId}`;

    io.to(roomName).emit('bulk_updates', {
      projectId,
      updates: projectUpdates,
      timestamp: new Date().toISOString(),
    });
  }

  logger.info('Broadcasted bulk updates', {
    projectCount: Object.keys(groupedUpdates).length,
    totalUpdates: updates.length,
  });
}

/**
 * Send targeted message with optimal delivery
 */
export function sendTargetedMessage(
  userId: string,
  event: string,
  data: unknown,
  options?: {
    priority?: boolean;
    compress?: boolean;
  }
): void {
  if (!io) return;

  const batcher = getWebSocketBatcher();
  const { priority = false } = options || {}; // compress option removed - not implemented yet

  if (priority || !batcher) {
    // Send immediately for priority messages
    io.to(`user:${userId}`).emit(event, data);
  } else {
    // Use batcher for non-priority messages
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Get enhanced Socket.IO metrics
 */
export function getEnhancedMetrics() {
  if (!io) return null;

  const batcher = getWebSocketBatcher();
  const rooms = io.sockets.adapter.rooms;
  const sockets = io.sockets.sockets;

  // Count batched vs non-batched clients
  let batchedClients = 0;
  let nonBatchedClients = 0;

  rooms.forEach((sids, room) => {
    if (room.endsWith(':batched')) {
      batchedClients += sids.size;
    }
  });

  nonBatchedClients = sockets.size - batchedClients;

  return {
    totalClients: sockets.size,
    batchedClients,
    nonBatchedClients,
    totalRooms: rooms.size,
    batcherMetrics: batcher?.getMetrics() || null,
  };
}

export default {
  initializeEnhancedSocketIO,
  getSocketIO: () => io,
  broadcastSegmentationUpdate,
  broadcastBulkUpdates,
  sendTargetedMessage,
  getEnhancedMetrics,
};
