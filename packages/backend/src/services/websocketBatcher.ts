import { Server as SocketIOServer } from 'socket.io';
import logger from '../utils/logger';

export interface BatchedMessage {
  event: string;
  data: any;
  room?: string;
  userId?: string;
  timestamp: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxBatchDelay: number;
  compressionThreshold: number;
  enableCompression: boolean;
  priorityEvents: string[];
}

export class WebSocketBatcher {
  private io: SocketIOServer;
  private messageQueue: Map<string, BatchedMessage[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: BatchConfig;
  private metrics = {
    totalMessages: 0,
    batchesSent: 0,
    messagesPerBatch: [] as number[],
    compressionSavings: 0,
  };

  constructor(io: SocketIOServer, config?: Partial<BatchConfig>) {
    this.io = io;
    this.config = {
      maxBatchSize: config?.maxBatchSize || 50,
      maxBatchDelay: config?.maxBatchDelay || 100, // ms
      compressionThreshold: config?.compressionThreshold || 1024, // bytes
      enableCompression: config?.enableCompression !== false,
      priorityEvents: config?.priorityEvents || ['error', 'critical-update', 'auth-change'],
    };

    this.setupInterceptors();
    this.startMetricsReporting();
  }

  // Intercept socket.io emit calls
  private setupInterceptors(): void {
    const originalEmit = this.io.emit.bind(this.io);
    const originalTo = this.io.to.bind(this.io);
    // const originalIn = this.io.in.bind(this.io); // TODO: Implement .in() interception if needed

    // Override io.emit
    this.io.emit = (event: string, ...args: unknown[]): boolean => {
      if (this.shouldBatch(event)) {
        this.addToBatch('global', event, args[0]);
        return true;
      }
      return originalEmit(event, ...args);
    };

    // Override io.to
    this.io.to = (room: string) => {
      const chainableObj = originalTo(room);
      const originalRoomEmit = chainableObj.emit.bind(chainableObj);

      chainableObj.emit = (event: string, ...args: unknown[]): boolean => {
        if (this.shouldBatch(event)) {
          this.addToBatch(room, event, args[0], room);
          return true;
        }
        return originalRoomEmit(event, ...args);
      };

      return chainableObj;
    };

    // Override io.in (alias for io.to)
    this.io.in = this.io.to;
  }

  // Check if event should be batched
  private shouldBatch(event: string): boolean {
    // Don't batch priority events
    if (this.config.priorityEvents.includes(event)) {
      return false;
    }

    // Don't batch connection events
    if (['connect', 'disconnect', 'error'].includes(event)) {
      return false;
    }

    return true;
  }

  // Add message to batch
  private addToBatch(
    key: string,
    event: string,
    data: unknown,
    room?: string,
    userId?: string
  ): void {
    const message: BatchedMessage = {
      event,
      data,
      room,
      userId,
      timestamp: Date.now(),
    };

    // Get or create queue for this key
    if (!this.messageQueue.has(key)) {
      this.messageQueue.set(key, []);
    }

    const queue = this.messageQueue.get(key)!;
    queue.push(message);

    this.metrics.totalMessages++;

    // Check if we should send immediately
    if (queue.length >= this.config.maxBatchSize) {
      this.sendBatch(key);
    } else {
      // Schedule batch send if not already scheduled
      if (!this.batchTimers.has(key)) {
        const timer = setTimeout(() => {
          this.sendBatch(key);
        }, this.config.maxBatchDelay);

        this.batchTimers.set(key, timer);
      }
    }
  }

  // Send batched messages
  private sendBatch(key: string): void {
    const queue = this.messageQueue.get(key);
    if (!queue || queue.length === 0) {
      return;
    }

    // Clear timer
    const timer = this.batchTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(key);
    }

    // Group messages by event type
    const groupedMessages = this.groupMessagesByEvent(queue);

    // Create batch payload
    const batch = {
      timestamp: Date.now(),
      messages: groupedMessages,
      count: queue.length,
    };

    // Apply compression if needed
    const payload = this.config.enableCompression ? this.compressPayload(batch) : batch;

    // Send to appropriate destination
    if (key === 'global') {
      this.io.emit('batch-update', payload);
    } else {
      this.io.to(key).emit('batch-update', payload);
    }

    // Update metrics
    this.metrics.batchesSent++;
    this.metrics.messagesPerBatch.push(queue.length);

    // Clear queue
    this.messageQueue.delete(key);

    logger.debug(`Sent batch of ${queue.length} messages to ${key}`);
  }

  // Group messages by event type for better compression
  private groupMessagesByEvent(messages: BatchedMessage[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const message of messages) {
      if (!grouped[message.event]) {
        grouped[message.event] = [];
      }

      grouped[message.event].push({
        data: message.data,
        timestamp: message.timestamp,
        room: message.room,
        userId: message.userId,
      });
    }

    return grouped;
  }

  // Compress payload if it's large enough
  private compressPayload(data: unknown): any {
    const jsonStr = JSON.stringify(data);

    if (jsonStr.length < this.config.compressionThreshold) {
      return data;
    }

    // Use built-in compression if available
    try {
      const compressed = this.compress(jsonStr);
      const savings = jsonStr.length - compressed.length;
      this.metrics.compressionSavings += savings;

      return {
        compressed: true,
        data: compressed,
        originalSize: jsonStr.length,
      };
    } catch (error) {
      logger.error('Compression failed:', error);
      return data;
    }
  }

  // Simple compression using repeated string elimination
  private compress(str: string): string {
    // This is a placeholder - in production, use a real compression library
    // like pako or lz-string
    return str
      .replace(/(\w+)(?=.*\1)/g, '') // Remove duplicate words
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  // Send any pending batches
  public flush(): void {
    const keys = Array.from(this.messageQueue.keys());
    for (const key of keys) {
      this.sendBatch(key);
    }
  }

  // Force send a specific message immediately
  public sendImmediate(event: string, data: unknown, target?: string | string[]): void {
    if (!target) {
      this.io.emit(event, data);
    } else if (Array.isArray(target)) {
      target.forEach((room) => this.io.to(room).emit(event, data));
    } else {
      this.io.to(target).emit(event, data);
    }
  }

  // Get current metrics
  public getMetrics() {
    const avgMessagesPerBatch =
      this.metrics.messagesPerBatch.length > 0
        ? this.metrics.messagesPerBatch.reduce((a, b) => a + b, 0) /
          this.metrics.messagesPerBatch.length
        : 0;

    return {
      totalMessages: this.metrics.totalMessages,
      batchesSent: this.metrics.batchesSent,
      avgMessagesPerBatch,
      compressionSavings: this.metrics.compressionSavings,
      pendingBatches: this.messageQueue.size,
      efficiency:
        this.metrics.totalMessages > 0
          ? (
              ((this.metrics.totalMessages - this.metrics.batchesSent) /
                this.metrics.totalMessages) *
              100
            ).toFixed(2) + '%'
          : '0%',
    };
  }

  // Start periodic metrics reporting
  private startMetricsReporting(): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      if (metrics.totalMessages > 0) {
        logger.info('WebSocket Batcher Metrics:', metrics);
      }
    }, 60000); // Every minute
  }

  // Update configuration
  public updateConfig(config: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Cleanup
  public destroy(): void {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }

    // Send any pending messages
    this.flush();

    // Clear data structures
    this.messageQueue.clear();
    this.batchTimers.clear();
  }
}

// Helper class for handling batched messages on the client side
export class BatchedMessageHandler {
  private handlers: Map<string, ((data: unknown) => void)[]> = new Map();

  // Register handler for specific event
  public on(event: string, handler: (data: unknown) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  // Process batched update
  public processBatch(batch: unknown): void {
    // Handle compressed payload
    if (batch.compressed) {
      // Decompress in production
      logger.warn('Received compressed batch, decompression not implemented');
      return;
    }

    // Process each event type
    for (const [event, messages] of Object.entries(batch.messages)) {
      const handlers = this.handlers.get(event);
      if (!handlers) continue;

      // Call handlers for each message
      for (const message of messages as unknown[]) {
        for (const handler of handlers) {
          try {
            handler(message.data);
          } catch (error) {
            logger.error(`Error in batch handler for event ${event}:`, error);
          }
        }
      }
    }
  }
}

// Export singleton instance
let batcherInstance: WebSocketBatcher | null = null;

export function initializeWebSocketBatcher(
  io: SocketIOServer,
  config?: Partial<BatchConfig>
): WebSocketBatcher {
  if (batcherInstance) {
    batcherInstance.destroy();
  }

  batcherInstance = new WebSocketBatcher(io, config);
  return batcherInstance;
}

export function getWebSocketBatcher(): WebSocketBatcher | null {
  return batcherInstance;
}
