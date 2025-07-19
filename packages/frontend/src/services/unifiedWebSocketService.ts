/**
 * Unified WebSocket Service
 *
 * This service consolidates all WebSocket functionality into a single source of truth.
 * It provides centralized connection management, event handling, and room management.
 */

import { io, Socket } from 'socket.io-client';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { handleError, ErrorType, ErrorSeverity } from '@/utils/error/unifiedErrorHandler';
import { getAccessToken } from './authService';
import { websocketBatchHandler } from './websocketBatchHandler';

// Create logger instance
const logger = createLogger('UnifiedWebSocketService');

// ===========================
// Types and Interfaces
// ===========================

export interface WebSocketConfig {
  enableBatching?: boolean;
  batchConfig?: {
    maxBatchSize?: number;
    maxBatchWaitTime?: number;
    enableCompression?: boolean;
  };
  url?: string;
  path?: string;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
  autoConnect?: boolean;
  auth?: unknown;
  transports?: string[];
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
}

export interface EventSubscription {
  event: string;
  handler: (...args: unknown[]) => void;
  id: string;
}

export interface RoomSubscription {
  room: string;
  joinedAt: Date;
  events: string[];
}

// ===========================
// Default Configuration
// ===========================

const DEFAULT_CONFIG: WebSocketConfig = {
  path: '/socket.io',
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  autoConnect: true,
  transports: ['websocket', 'polling'],
};

// ===========================
// WebSocket Manager Class
// ===========================

class UnifiedWebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig = DEFAULT_CONFIG;
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
  };

  private eventSubscriptions: Map<string, EventSubscription[]> = new Map();
  private roomSubscriptions: Map<string, RoomSubscription> = new Map();
  private globalHandlers: Map<string, Set<Function>> = new Map();

  // Heartbeat management
  private heartbeatInterval: NodeJS.Timer | null = null;
  private heartbeatTimeout: NodeJS.Timer | null = null;
  private lastPingTime: number = 0;
  private pingTimeouts: number = 0;

  // Event emitter for connection state changes
  private stateChangeHandlers: Set<(state: ConnectionState) => void> = new Set();

  // Batching
  private batchingEnabled = false;

  /**
   * Initialize WebSocket connection
   */
  public async initialize(customConfig?: Partial<WebSocketConfig>): Promise<Socket> {
    try {
      logger.info('Initializing WebSocket connection');

      // Merge configurations
      this.config = { ...DEFAULT_CONFIG, ...customConfig };

      // Disconnect existing connection
      if (this.socket) {
        logger.info('Disconnecting existing socket');
        await this.disconnect();
      }

      // Get authentication token
      const authToken = getAccessToken();
      if (authToken) {
        this.config.auth = { token: authToken };
      }

      // Determine socket URL
      const socketUrl = this.config.url || '';

      // Create socket instance
      this.updateConnectionState({ isConnecting: true });
      this.socket = io(socketUrl, this.config);

      // Set up core event handlers
      this.setupCoreHandlers();

      // Initialize batching if enabled
      if (this.config.enableBatching) {
        this.batchingEnabled = true;
        if (this.config.batchConfig) {
          websocketBatchHandler.updateConfig(this.config.batchConfig);
        }
        websocketBatchHandler.initialize(this.socket);
      }

      // Start heartbeat
      this.startHeartbeat();

      return this.socket;
    } catch (error) {
      const errorInfo = handleError(error, {
        context: 'WebSocket initialization',
        errorInfo: {
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.ERROR,
        },
      });

      this.updateConnectionState({
        isConnecting: false,
        error: new Error(errorInfo.message),
      });

      throw error;
    }
  }

  /**
   * Get current socket instance
   */
  public getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Get connection state
   */
  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(config?: Partial<WebSocketConfig>): Promise<void> {
    if (!this.socket) {
      await this.initialize(config);
      return;
    }

    if (this.socket.connected) {
      logger.info('Socket already connected');
      return;
    }

    logger.info('Connecting socket');
    this.updateConnectionState({ isConnecting: true });
    this.socket.connect();
  }

  /**
   * Disconnect from WebSocket server
   */
  public async disconnect(): Promise<void> {
    if (!this.socket) {
      logger.warn('No socket to disconnect');
      return;
    }

    logger.info('Disconnecting socket');

    // Stop heartbeat
    this.stopHeartbeat();

    // Leave all rooms
    for (const [room] of this.roomSubscriptions) {
      await this.leaveRoom(room);
    }

    // Remove all event handlers
    this.removeAllHandlers();

    // Clear batch handler if enabled
    if (this.batchingEnabled) {
      websocketBatchHandler.clear();
      this.batchingEnabled = false;
    }

    // Disconnect socket
    this.socket.disconnect();
    this.socket = null;

    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      lastDisconnectedAt: new Date(),
    });
  }

  /**
   * Subscribe to connection state changes
   */
  public onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateChangeHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.stateChangeHandlers.delete(handler);
    };
  }

  // ===========================
  // Event Management
  // ===========================

  /**
   * Register event handler
   */
  public on(event: string, handler: (...args: unknown[]) => void): string {
    if (!this.socket) {
      logger.warn(`Cannot register handler for ${event}: Socket not initialized`);
      return '';
    }

    const id = `${event}_${Date.now()}_${Math.random()}`;

    // Create subscription
    const subscription: EventSubscription = {
      event,
      handler,
      id,
    };

    // Add to subscriptions map
    if (!this.eventSubscriptions.has(event)) {
      this.eventSubscriptions.set(event, []);
    }
    this.eventSubscriptions.get(event)!.push(subscription);

    // Register with socket
    this.socket.on(event, handler);

    logger.debug(`Registered handler for event: ${event}`);
    return id;
  }

  /**
   * Remove event handler
   */
  public off(event: string, handlerOrId?: ((...args: unknown[]) => void) | string): void {
    if (!this.socket) return;

    const subscriptions = this.eventSubscriptions.get(event);
    if (!subscriptions) return;

    if (typeof handlerOrId === 'string') {
      // Remove by ID
      const index = subscriptions.findIndex((sub) => sub.id === handlerOrId);
      if (index !== -1) {
        const handler = subscriptions[index].handler;
        this.socket.off(event, handler);
        subscriptions.splice(index, 1);
      }
    } else if (handlerOrId) {
      // Remove by handler reference
      const index = subscriptions.findIndex((sub) => sub.handler === handlerOrId);
      if (index !== -1) {
        this.socket.off(event, handlerOrId);
        subscriptions.splice(index, 1);
      }
    } else {
      // Remove all handlers for event
      subscriptions.forEach((sub) => {
        this.socket!.off(event, sub.handler);
      });
      this.eventSubscriptions.delete(event);
    }

    logger.debug(`Removed handler(s) for event: ${event}`);
  }

  /**
   * Emit event
   */
  public emit(event: string, ...args: unknown[]): void {
    if (!this.socket) {
      logger.warn(`Cannot emit ${event}: Socket not initialized`);
      return;
    }

    if (!this.socket.connected) {
      logger.warn(`Cannot emit ${event}: Socket not connected`);
      return;
    }

    this.socket.emit(event, ...args);
    logger.debug(`Emitted event: ${event}`, args);
  }

  /**
   * Emit event and wait for acknowledgment
   */
  public async emitWithAck(event: string, ...args: unknown[]): Promise<unknown> {
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }

    if (!this.socket.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for acknowledgment: ${event}`));
      }, this.config.timeout || 10000);

      this.socket!.emit(event, ...args, (response: unknown) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // ===========================
  // Room Management
  // ===========================

  /**
   * Join a room
   */
  public async joinRoom(room: string, events?: string[]): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket not connected');
    }

    logger.info(`Joining room: ${room}`);

    try {
      await this.emitWithAck('join_room', { room });

      // Track subscription
      this.roomSubscriptions.set(room, {
        room,
        joinedAt: new Date(),
        events: events || [],
      });

      logger.info(`Successfully joined room: ${room}`);
    } catch (error) {
      logger.error(`Failed to join room ${room}:`, error);
      throw error;
    }
  }

  /**
   * Leave a room
   */
  public async leaveRoom(room: string): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      logger.warn(`Cannot leave room ${room}: Socket not connected`);
      return;
    }

    logger.info(`Leaving room: ${room}`);

    try {
      await this.emitWithAck('leave_room', { room });

      // Remove subscription
      this.roomSubscriptions.delete(room);

      logger.info(`Successfully left room: ${room}`);
    } catch (error) {
      logger.error(`Failed to leave room ${room}:`, error);
    }
  }

  /**
   * Get current room subscriptions
   */
  public getRooms(): string[] {
    return Array.from(this.roomSubscriptions.keys());
  }

  // ===========================
  // Specialized Room Methods
  // ===========================

  /**
   * Join project room for real-time updates
   */
  public async joinProjectRoom(projectId: string): Promise<void> {
    await this.joinRoom(`project_${projectId}`, [
      'image_added',
      'image_updated',
      'image_deleted',
      'segmentation_started',
      'segmentation_completed',
      'segmentation_failed',
      'project_updated',
    ]);
  }

  /**
   * Leave project room
   */
  public async leaveProjectRoom(projectId: string): Promise<void> {
    await this.leaveRoom(`project_${projectId}`);
  }

  /**
   * Join segmentation queue room
   */
  public async joinSegmentationQueueRoom(): Promise<void> {
    await this.joinRoom('segmentation_queue', ['queue_updated', 'task_started', 'task_completed', 'task_failed']);
  }

  // ===========================
  // Private Methods
  // ===========================

  /**
   * Set up core event handlers
   */
  private setupCoreHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      logger.info(`Socket connected with ID: ${this.socket!.id}`);
      this.updateConnectionState({
        isConnected: true,
        isConnecting: false,
        error: null,
        reconnectAttempts: 0,
        lastConnectedAt: new Date(),
      });

      // Rejoin rooms after reconnection
      this.rejoinRooms();
    });

    this.socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${reason}`);
      this.updateConnectionState({
        isConnected: false,
        isConnecting: false,
        lastDisconnectedAt: new Date(),
      });

      // Handle reconnection logic
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        setTimeout(() => this.connect(), this.config.reconnectionDelay);
      }
    });

    this.socket.on('connect_error', (error) => {
      logger.error('Socket connection error:', error);
      this.updateConnectionState({
        isConnecting: false,
        error,
        reconnectAttempts: this.connectionState.reconnectAttempts + 1,
      });
    });

    // Heartbeat events
    this.socket.on('pong', (data) => {
      const latency = Date.now() - this.lastPingTime;
      logger.debug(`Heartbeat pong received, latency: ${latency}ms`);
      this.pingTimeouts = 0;

      // Clear timeout
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = null;
      }
    });

    // Error events
    this.socket.on('error', (error) => {
      logger.error('Socket error:', error);
      handleError(error, {
        context: 'WebSocket error event',
        errorInfo: {
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.ERROR,
        },
      });
    });
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = {
      ...this.connectionState,
      ...updates,
    };

    // Notify state change handlers
    this.stateChangeHandlers.forEach((handler) => {
      try {
        handler(this.getConnectionState());
      } catch (error) {
        logger.error('Error in state change handler:', error);
      }
    });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (!this.socket || !this.socket.connected) return;

      this.lastPingTime = Date.now();
      this.emit('ping', { timestamp: this.lastPingTime });

      // Set timeout for pong response
      this.heartbeatTimeout = setTimeout(() => {
        this.pingTimeouts++;
        logger.warn(`Heartbeat timeout #${this.pingTimeouts}`);

        if (this.pingTimeouts >= 3) {
          logger.error('Multiple heartbeat timeouts, reconnecting...');
          this.socket?.disconnect();
          this.connect();
        }
      }, 5000);
    }, 10000); // Ping every 10 seconds
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    this.pingTimeouts = 0;
  }

  /**
   * Rejoin rooms after reconnection
   */
  private async rejoinRooms(): Promise<void> {
    for (const [room, subscription] of this.roomSubscriptions) {
      try {
        await this.joinRoom(room, subscription.events);
        logger.info(`Rejoined room: ${room}`);
      } catch (error) {
        logger.error(`Failed to rejoin room ${room}:`, error);
      }
    }
  }

  /**
   * Remove all event handlers
   */
  private removeAllHandlers(): void {
    if (!this.socket) return;

    // Remove subscription handlers
    for (const [event, subscriptions] of this.eventSubscriptions) {
      subscriptions.forEach((sub) => {
        this.socket!.off(event, sub.handler);
      });
    }
    this.eventSubscriptions.clear();

    // Remove core handlers
    this.socket.removeAllListeners();
  }

  // ===========================
  // Batching Methods
  // ===========================

  /**
   * Send a message using batching
   */
  public async sendBatched(event: string, data: unknown): Promise<unknown> {
    if (!this.batchingEnabled) {
      // Fallback to regular emit
      return new Promise((resolve) => {
        if (this.socket?.connected) {
          this.socket.emit(event, data);
        }
        resolve(undefined);
      });
    }
    return websocketBatchHandler.send(event, data);
  }

  /**
   * Send a message immediately without batching
   */
  public sendImmediate(event: string, data: unknown): void {
    if (this.batchingEnabled) {
      websocketBatchHandler.sendImmediate(event, data);
    } else if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Flush pending batch messages
   */
  public flushBatch(): void {
    if (this.batchingEnabled) {
      websocketBatchHandler.flush();
    }
  }

  /**
   * Get batch status
   */
  public getBatchStatus() {
    if (!this.batchingEnabled) {
      return {
        enabled: false,
        queueLength: 0,
        pendingAcks: 0,
        capabilities: null,
        isConnected: this.getConnectionState().isConnected,
      };
    }
    return {
      enabled: true,
      ...websocketBatchHandler.getStatus(),
    };
  }

  /**
   * Update batch configuration
   */
  public updateBatchConfig(config: {
    maxBatchSize?: number;
    maxBatchWaitTime?: number;
    enableCompression?: boolean;
  }): void {
    if (this.batchingEnabled) {
      websocketBatchHandler.updateConfig(config);
    }
  }

  /**
   * Add batch event listener
   */
  public onBatchEvent(event: string, handler: (...args: unknown[]) => void): void {
    if (this.batchingEnabled) {
      websocketBatchHandler.on(event, handler);
    } else {
      this.on(event, handler);
    }
  }

  /**
   * Remove batch event listener
   */
  public offBatchEvent(event: string, handler?: (...args: unknown[]) => void): void {
    if (this.batchingEnabled) {
      websocketBatchHandler.off(event, handler);
    } else {
      this.off(event, handler);
    }
  }
}

// ===========================
// Singleton Instance
// ===========================

const webSocketService = new UnifiedWebSocketService();

// ===========================
// Export Public API
// ===========================

export default webSocketService;

// Named exports for convenience
export const {
  initialize,
  getSocket,
  getConnectionState,
  connect,
  disconnect,
  onStateChange,
  on,
  off,
  emit,
  emitWithAck,
  joinRoom,
  leaveRoom,
  getRooms,
  joinProjectRoom,
  leaveProjectRoom,
  joinSegmentationQueueRoom,
  sendBatched,
  sendImmediate,
  flushBatch,
  getBatchStatus,
  updateBatchConfig,
  onBatchEvent,
  offBatchEvent,
} = webSocketService;
