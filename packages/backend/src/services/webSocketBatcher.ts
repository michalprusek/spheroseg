/**
 * WebSocket Message Batcher
 * 
 * Optimizes WebSocket communication by batching multiple messages
 * together to reduce overhead and improve performance.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

interface BatchedMessage {
  event: string;
  data: any;
  timestamp: number;
}

interface BatcherOptions {
  maxBatchSize?: number;       // Maximum number of messages per batch
  batchInterval?: number;      // Maximum time to wait before sending (ms)
  compressionThreshold?: number; // Minimum batch size to compress
}

export class WebSocketBatcher {
  private io: SocketIOServer;
  private options: Required<BatcherOptions>;
  private messageBatches: Map<string, BatchedMessage[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(io: SocketIOServer, options: BatcherOptions = {}) {
    this.io = io;
    this.options = {
      maxBatchSize: options.maxBatchSize || 50,
      batchInterval: options.batchInterval || 100, // 100ms default
      compressionThreshold: options.compressionThreshold || 10,
    };
    
    this.setupSocketHandlers();
  }
  
  /**
   * Set up socket connection handlers
   */
  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      socket.on('disconnect', () => {
        // Clean up batches for this socket
        this.flushBatch(socket.id);
        this.clearBatchTimer(socket.id);
        this.messageBatches.delete(socket.id);
      });
    });
  }
  
  /**
   * Queue a message for batching
   */
  queueMessage(socketId: string, event: string, data: any) {
    // Get or create batch for this socket
    if (!this.messageBatches.has(socketId)) {
      this.messageBatches.set(socketId, []);
    }
    
    const batch = this.messageBatches.get(socketId)!;
    
    // Add message to batch
    batch.push({
      event,
      data,
      timestamp: Date.now(),
    });
    
    // Check if we should send immediately
    if (batch.length >= this.options.maxBatchSize) {
      this.flushBatch(socketId);
    } else {
      // Set up timer if not already set
      if (!this.batchTimers.has(socketId)) {
        const timer = setTimeout(() => {
          this.flushBatch(socketId);
        }, this.options.batchInterval);
        
        this.batchTimers.set(socketId, timer);
      }
    }
  }
  
  /**
   * Queue a broadcast message
   */
  queueBroadcast(room: string, event: string, data: any) {
    const sockets = this.io.sockets.adapter.rooms.get(room);
    if (!sockets) return;
    
    sockets.forEach(socketId => {
      this.queueMessage(socketId, event, data);
    });
  }
  
  /**
   * Flush batch for a specific socket
   */
  private flushBatch(socketId: string) {
    const batch = this.messageBatches.get(socketId);
    if (!batch || batch.length === 0) return;
    
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) {
      // Socket disconnected, clean up
      this.messageBatches.delete(socketId);
      return;
    }
    
    // Send batched message
    const shouldCompress = batch.length >= this.options.compressionThreshold;
    
    socket.emit('batch', {
      messages: batch,
      compressed: shouldCompress,
      count: batch.length,
    });
    
    logger.debug('Sent batched messages', {
      socketId,
      count: batch.length,
      compressed: shouldCompress,
    });
    
    // Clear batch
    this.messageBatches.set(socketId, []);
    this.clearBatchTimer(socketId);
  }
  
  /**
   * Clear batch timer
   */
  private clearBatchTimer(socketId: string) {
    const timer = this.batchTimers.get(socketId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(socketId);
    }
  }
  
  /**
   * Flush all pending batches
   */
  flushAll() {
    this.messageBatches.forEach((_, socketId) => {
      this.flushBatch(socketId);
    });
  }
  
  /**
   * Get batch statistics
   */
  getStats() {
    const stats = {
      activeBatches: this.messageBatches.size,
      pendingMessages: 0,
      activeTimers: this.batchTimers.size,
    };
    
    this.messageBatches.forEach(batch => {
      stats.pendingMessages += batch.length;
    });
    
    return stats;
  }
}

/**
 * Middleware to enable batching for a socket.io server
 */
export function enableBatching(io: SocketIOServer, options?: BatcherOptions): WebSocketBatcher {
  const batcher = new WebSocketBatcher(io, options);
  
  // Override emit methods to use batching
  const originalEmit = Socket.prototype.emit;
  Socket.prototype.emit = function(event: string, ...args: any[]) {
    if (event === 'batch' || this.request.headers['x-no-batch']) {
      // Don't batch these events
      return originalEmit.apply(this, [event, ...args]);
    }
    
    // Queue for batching
    batcher.queueMessage(this.id, event, args[0]);
    return true;
  };
  
  // Periodic flush to ensure messages don't get stuck
  setInterval(() => {
    batcher.flushAll();
  }, 1000); // Flush every second as fallback
  
  return batcher;
}

/**
 * Client-side batch processor
 * Include this in the frontend to handle batched messages
 */
export const clientBatchProcessor = `
function processBatchedMessages(socket) {
  socket.on('batch', (data) => {
    const { messages, compressed } = data;
    
    // Process each message in the batch
    messages.forEach(msg => {
      // Emit the original event locally
      socket.emit(msg.event, msg.data);
    });
  });
}
`;

export default {
  WebSocketBatcher,
  enableBatching,
  clientBatchProcessor,
};