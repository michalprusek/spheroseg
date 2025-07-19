import { Socket } from 'socket.io-client';

interface BatchMessage {
  id: string;
  event: string;
  data: any;
  timestamp: number;
}

interface BatchConfig {
  maxBatchSize: number;
  maxBatchWaitTime: number;
  enableCompression?: boolean;
}

interface BatchCapabilities {
  supportsBatching: boolean;
  supportsCompression: boolean;
  version: string;
}

export class WebSocketBatchHandler {
  private socket: Socket | null = null;
  private batchQueue: BatchMessage[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private messageIdCounter = 0;
  private config: BatchConfig;
  private capabilities: BatchCapabilities | null = null;
  private pendingAcks: Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void; timeout: NodeJS.Timeout }> = new Map();
  private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor(config?: Partial<BatchConfig>) {
    this.config = {
      maxBatchSize: config?.maxBatchSize || 50,
      maxBatchWaitTime: config?.maxBatchWaitTime || 100, // milliseconds
      enableCompression: config?.enableCompression || false,
    };
  }

  /**
   * Initialize the batch handler with a socket connection
   */
  initialize(socket: Socket): void {
    this.socket = socket;
    this.setupBatchHandlers();
    this.negotiateCapabilities();
  }

  /**
   * Set up WebSocket event handlers for batch processing
   */
  private setupBatchHandlers(): void {
    if (!this.socket) return;

    // Handle batch messages from server
    this.socket.on('batch', (batch: { messages: BatchMessage[]; compressed?: boolean }) => {
      this.processBatch(batch);
    });

    // Handle batch acknowledgments
    this.socket.on('batch_ack', (data: { batchId: string; results: any[] }) => {
      this.handleBatchAck(data);
    });

    // Handle capability negotiation response
    this.socket.on('capabilities', (capabilities: BatchCapabilities) => {
      this.capabilities = capabilities;
      console.log('Server capabilities:', capabilities);
    });

    // Handle errors
    this.socket.on('batch_error', (error: { batchId: string; error: string }) => {
      console.error('Batch error:', error);
      this.handleBatchError(error);
    });
  }

  /**
   * Negotiate capabilities with the server
   */
  private negotiateCapabilities(): void {
    if (!this.socket) return;

    const clientCapabilities: BatchCapabilities = {
      supportsBatching: true,
      supportsCompression: this.config.enableCompression || false,
      version: '1.0.0',
    };

    this.socket.emit('negotiate_capabilities', clientCapabilities);
  }

  /**
   * Send a message through the batch handler
   */
  send(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Check if server supports batching
      if (!this.capabilities?.supportsBatching) {
        // Fallback to direct emit
        this.socket.emit(event, data);
        resolve(undefined);
        return;
      }

      const messageId = this.generateMessageId();
      const message: BatchMessage = {
        id: messageId,
        event,
        data,
        timestamp: Date.now(),
      };

      // Add to batch queue
      this.batchQueue.push(message);

      // Set up acknowledgment handling with timeout
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(messageId);
        reject(new Error(`Message ${messageId} timed out`));
      }, 30000); // 30 second timeout

      this.pendingAcks.set(messageId, { resolve, reject, timeout });

      // Check if we should send the batch
      this.checkBatchSend();
    });
  }

  /**
   * Send a message without batching (for priority messages)
   */
  sendImmediate(event: string, data: any): void {
    if (!this.socket?.connected) {
      console.error('Cannot send immediate message: WebSocket not connected');
      return;
    }

    this.socket.emit(event, data);
  }

  /**
   * Check if the batch should be sent
   */
  private checkBatchSend(): void {
    if (this.batchQueue.length >= this.config.maxBatchSize) {
      this.sendBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.sendBatch();
      }, this.config.maxBatchWaitTime);
    }
  }

  /**
   * Send the current batch
   */
  private sendBatch(): void {
    if (!this.socket || this.batchQueue.length === 0) return;

    // Clear the timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Prepare batch
    const batch = [...this.batchQueue];
    this.batchQueue = [];

    const batchData = {
      batchId: this.generateBatchId(),
      messages: batch,
      compressed: false,
    };

    // Apply compression if enabled and supported
    if (this.config.enableCompression && this.capabilities?.supportsCompression) {
      // In a real implementation, you would compress the data here
      // For now, we'll just mark it as uncompressed
      batchData.compressed = false;
    }

    // Send batch
    this.socket.emit('batch', batchData);
  }

  /**
   * Process a batch received from the server
   */
  private processBatch(batch: { messages: BatchMessage[]; compressed?: boolean }): void {
    const messages = batch.messages;

    // Decompress if needed
    if (batch.compressed && this.config.enableCompression) {
      // In a real implementation, decompress the data here
      // For now, we assume it's not compressed
    }

    // Process each message
    messages.forEach((message) => {
      this.emitLocalEvent(message.event, message.data);
    });
  }

  /**
   * Handle batch acknowledgment from server
   */
  private handleBatchAck(data: { batchId: string; results: any[] }): void {
    // Process acknowledgments for each message in the batch
    data.results.forEach((result) => {
      const pending = this.pendingAcks.get(result.messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        if (result.error) {
          pending.reject(new Error(result.error));
        } else {
          pending.resolve(result.data);
        }
        this.pendingAcks.delete(result.messageId);
      }
    });
  }

  /**
   * Handle batch errors
   */
  private handleBatchError(error: { batchId: string; error: string }): void {
    // Reject all pending acknowledgments for this batch
    // In a real implementation, you'd track which messages belong to which batch
    console.error('Batch processing error:', error);
  }

  /**
   * Register an event handler
   */
  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister an event handler
   */
  off(event: string, handler?: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) return;

    if (handler) {
      this.eventHandlers.get(event)!.delete(handler);
    } else {
      this.eventHandlers.delete(event);
    }
  }

  /**
   * Emit a local event
   */
  private emitLocalEvent(event: string, data: any): void {
    if (!this.eventHandlers.has(event)) return;

    this.eventHandlers.get(event)!.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in batch event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Generate a unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Flush any pending messages
   */
  flush(): void {
    if (this.batchQueue.length > 0) {
      this.sendBatch();
    }
  }

  /**
   * Clear all pending messages and timers
   */
  clear(): void {
    this.batchQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Clear all pending acknowledgments
    this.pendingAcks.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingAcks.clear();
  }

  /**
   * Get current batch status
   */
  getStatus(): {
    queueLength: number;
    pendingAcks: number;
    capabilities: BatchCapabilities | null;
    isConnected: boolean;
  } {
    return {
      queueLength: this.batchQueue.length,
      pendingAcks: this.pendingAcks.size,
      capabilities: this.capabilities,
      isConnected: this.socket?.connected || false,
    };
  }

  /**
   * Update batch configuration
   */
  updateConfig(config: Partial<BatchConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Export a singleton instance
export const websocketBatchHandler = new WebSocketBatchHandler();
