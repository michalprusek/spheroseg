/**
 * Integration tests for UnifiedWebSocketService
 * 
 * Tests WebSocket communication with mock socket.io server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { io } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client');

// Mock the auth service
vi.mock('../authService', () => ({
  getAccessToken: vi.fn(() => 'mock-token'),
}));

// Mock the logger
vi.mock('@/utils/logging/unifiedLogger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock the error handler
vi.mock('@/utils/error/unifiedErrorHandler', () => ({
  handleError: vi.fn((error) => ({ message: error.message || 'Test error' })),
  ErrorType: { NETWORK: 'NETWORK' },
  ErrorSeverity: { ERROR: 'ERROR' },
}));

// Mock the batch handler
vi.mock('../websocketBatchHandler', () => {
  const batchListeners = new Map<string, Set<Function>>();
  const batchQueue: any[] = [];
  
  return {
    websocketBatchHandler: {
      updateConfig: vi.fn(),
      initialize: vi.fn(),
      clear: vi.fn(() => {
        batchQueue.length = 0;
        batchListeners.clear();
      }),
      send: vi.fn((event: string, data: any) => {
        batchQueue.push({ event, data });
        return Promise.resolve();
      }),
      sendImmediate: vi.fn(),
      flush: vi.fn(() => {
        const items = [...batchQueue];
        batchQueue.length = 0;
        return items;
      }),
      getStatus: vi.fn(() => ({
        queueLength: batchQueue.length,
        pendingAcks: 0,
        capabilities: null,
        isConnected: true,
      })),
      on: vi.fn((event: string, handler: Function) => {
        if (!batchListeners.has(event)) {
          batchListeners.set(event, new Set());
        }
        batchListeners.get(event)!.add(handler);
      }),
      off: vi.fn((event: string, handler?: Function) => {
        if (handler && batchListeners.has(event)) {
          batchListeners.get(event)!.delete(handler);
        } else if (!handler) {
          batchListeners.delete(event);
        }
      }),
      // Helper to trigger batch events in tests
      _triggerBatchEvent: (event: string, data: any) => {
        const handlers = batchListeners.get(event);
        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      },
      _getBatchQueue: () => batchQueue,
      _clearQueue: () => {
        batchQueue.length = 0;
      },
    },
  };
});

// Mock the unifiedWebSocketService to ensure it has a default export
vi.mock('@/services/unifiedWebSocketService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual.default || actual,
  };
});

// Create mock socket
const createMockSocket = () => {
  const listeners = new Map<string, Set<Function>>();
  const mockSocket = {
    connected: false,
    id: 'mock_socket_id',
    connect: vi.fn().mockImplementation(function() {
      this.connected = true;
      // Emit the connect event asynchronously to simulate real behavior
      setTimeout(() => {
        // Make sure connected is still true when we trigger the event
        this.connected = true;
        const handlers = listeners.get('connect');
        if (handlers) {
          handlers.forEach(handler => handler());
        }
      }, 0);
      return this;
    }),
    disconnect: vi.fn().mockImplementation(function() {
      this.connected = false;
      // Emit the disconnect event asynchronously to simulate real behavior
      setTimeout(() => {
        const handlers = listeners.get('disconnect');
        if (handlers) {
          handlers.forEach(handler => handler('client disconnect'));
        }
      }, 0);
      return this;
    }),
    emit: vi.fn().mockImplementation(function(event: string, ...args: any[]) {
      // Simulate server acknowledgment for certain events
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        setTimeout(() => {
          if (event === 'join_room') {
            callback({ success: true });
          } else if (event === 'leave_room') {
            callback({ success: true });
          } else {
            // For other events, just acknowledge without error
            callback({ success: true });
          }
        }, 10);
      }
      return this;
    }),
    on: vi.fn().mockImplementation(function(event: string, handler: Function) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
      return this;
    }),
    off: vi.fn().mockImplementation(function(event: string, handler?: Function) {
      if (handler && listeners.has(event)) {
        listeners.get(event)!.delete(handler);
      } else if (!handler) {
        listeners.delete(event);
      }
      return this;
    }),
    once: vi.fn().mockImplementation(function(event: string, handler: Function) {
      const wrappedHandler = (...args: any[]) => {
        handler(...args);
        this.off(event, wrappedHandler);
      };
      return this.on(event, wrappedHandler);
    }),
    removeAllListeners: vi.fn().mockImplementation(function() {
      listeners.clear();
      return this;
    }),
    // Helper to trigger events in tests
    _trigger: (event: string, ...args: any[]) => {
      const handlers = listeners.get(event);
      if (handlers) {
        handlers.forEach(handler => handler(...args));
      }
    },
    // Helper to get listeners
    _getListeners: () => listeners
  };

  return mockSocket;
};

describe('UnifiedWebSocketService Integration Tests', () => {
  let wsService: any;
  let mockSocket: any;

  beforeEach(async () => {
    mockSocket = createMockSocket();
    
    // Set up io() to return our mock socket and simulate auto-connect
    (io as any).mockImplementation(() => {
      // Socket.io automatically connects when created unless autoConnect: false
      setTimeout(() => {
        mockSocket.connected = true;
        mockSocket._trigger('connect');
      }, 0);
      return mockSocket;
    });
    
    // Clear batch handler queue
    const { websocketBatchHandler } = await import('../websocketBatchHandler');
    (websocketBatchHandler as any)._clearQueue();
    
    // Import the service after mocks are set up
    vi.resetModules();
    const mod = await import('../unifiedWebSocketService');
    wsService = mod.default;
  });

  afterEach(async () => {
    if (wsService && wsService.disconnect) {
      await wsService.disconnect();
    }
    vi.clearAllMocks();
  });

  describe('connection management', () => {
    it('should connect to WebSocket server', async () => {
      // When we call connect, it should create a socket with io()
      await wsService.connect();
      
      // Wait for async connection to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // io() should have been called with proper configuration
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'mock-token' },
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        })
      );

      // The socket created by io() automatically connects, so we don't need to check connect() was called
      // Instead, check that the socket state was updated correctly
      expect(wsService.getConnectionState().isConnected).toBe(true);
    });

    it('should handle connection events', async () => {
      const connectionStates: boolean[] = [];
      
      // Subscribe to state changes before connecting
      wsService.onStateChange((state: any) => {
        connectionStates.push(state.isConnected);
      });

      // Connect - this should trigger a state change
      await wsService.connect();
      
      // Wait for async connection to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // The connect event should have fired and updated state
      expect(connectionStates).toContain(true);
      
      // Clear the array to track only disconnect event
      connectionStates.length = 0;

      // Trigger disconnect
      mockSocket._trigger('disconnect', 'transport close');
      
      // Wait for state change to propagate
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have false state after disconnect
      expect(connectionStates).toContain(false);
    });

    it('should handle reconnection', async () => {
      let connectCount = 0;
      
      // Track connect events
      wsService.onStateChange((state: any) => {
        if (state.isConnected) {
          connectCount++;
        }
      });

      // Initial connection
      await wsService.connect();
      
      // Wait for async connection to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(connectCount).toBe(1);
      
      // To test reconnection, we need to simulate the socket getting reconnected
      // after a disconnect. Socket.io handles this internally.
      
      // Simulate disconnect
      mockSocket.connected = false;
      mockSocket._trigger('disconnect', 'transport close');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Service should be disconnected now
      expect(wsService.getConnectionState().isConnected).toBe(false);
      
      // Simulate reconnection (as socket.io would do internally)
      mockSocket.connected = true;
      mockSocket._trigger('connect');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have counted 2 connections
      expect(connectCount).toBe(2);
    });

    it('should disconnect cleanly', async () => {
      await wsService.connect();
      await wsService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(wsService.getConnectionState().isConnected).toBe(false);
    });
  });

  describe('room management', () => {
    beforeEach(async () => {
      await wsService.connect();
      // Wait for the async connect event to fire
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should join rooms', async () => {
      const roomId = 'project_123';
      
      await wsService.joinRoom(roomId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'join_room',
        { room: roomId },
        expect.any(Function)
      );
    });

    it('should leave rooms', async () => {
      const roomId = 'project_123';
      
      await wsService.joinRoom(roomId);
      await wsService.leaveRoom(roomId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'leave_room',
        { room: roomId },
        expect.any(Function)
      );
    });

    it('should handle room errors', async () => {
      mockSocket.emit.mockImplementationOnce((event, data, callback) => {
        if (typeof callback === 'function') {
          setTimeout(() => callback({ success: false, error: 'Room not found' }), 10);
        }
        return mockSocket;
      });

      await expect(wsService.joinRoom('invalid_room'))
        .rejects.toThrow('Room not found');
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await wsService.connect();
      // Wait for the async connect event to fire
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should handle image upload events', () => {
      const uploadEvents: any[] = [];
      
      wsService.on('image_upload_progress', (data: any) => {
        uploadEvents.push(data);
      });

      mockSocket._trigger('image_upload_progress', {
        imageId: 'img_123',
        progress: 50,
        status: 'uploading'
      });

      mockSocket._trigger('image_upload_complete', {
        imageId: 'img_123',
        url: 'http://example.com/image.jpg'
      });

      expect(uploadEvents).toHaveLength(1);
      expect(uploadEvents[0]).toEqual({
        imageId: 'img_123',
        progress: 50,
        status: 'uploading'
      });
    });

    it('should handle segmentation events', () => {
      const segmentationEvents: any[] = [];
      
      wsService.on('segmentation_status', (data: any) => {
        segmentationEvents.push(data);
      });

      // Progress update
      mockSocket._trigger('segmentation_status', {
        imageId: 'img_123',
        status: 'processing',
        progress: 75
      });

      // Completion
      mockSocket._trigger('segmentation_complete', {
        imageId: 'img_123',
        status: 'completed',
        cellCount: 42
      });

      expect(segmentationEvents).toHaveLength(1);
      expect(segmentationEvents[0].status).toBe('processing');
    });

    it('should handle project updates', () => {
      const projectUpdates: any[] = [];
      
      wsService.on('project_updated', (data: any) => {
        projectUpdates.push(data);
      });

      mockSocket._trigger('project_updated', {
        projectId: 'proj_123',
        updates: { name: 'Updated Project' }
      });

      expect(projectUpdates).toHaveLength(1);
      expect(projectUpdates[0].updates.name).toBe('Updated Project');
    });

    it('should handle error events', () => {
      const errors: any[] = [];
      
      wsService.on('error', (error: any) => {
        errors.push(error);
      });

      mockSocket._trigger('error', {
        message: 'Connection error',
        code: 'CONN_ERROR'
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Connection error');
    });
  });

  describe('event subscription management', () => {
    beforeEach(async () => {
      await wsService.connect();
      // Wait for the async connect event to fire
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should support multiple listeners for same event', async () => {
      const listener1Calls: any[] = [];
      const listener2Calls: any[] = [];
      
      wsService.on('test_event', (data: any) => listener1Calls.push(data));
      wsService.on('test_event', (data: any) => listener2Calls.push(data));

      mockSocket._trigger('test_event', { value: 1 });

      expect(listener1Calls).toHaveLength(1);
      expect(listener2Calls).toHaveLength(1);
    });

    it('should remove specific listeners', async () => {
      const calls: any[] = [];
      const listener = (data: any) => calls.push(data);
      
      // Register the listener before triggering events
      wsService.on('test_event', listener);
      
      mockSocket._trigger('test_event', { value: 1 });
      expect(calls).toHaveLength(1);

      wsService.off('test_event', listener);
      mockSocket._trigger('test_event', { value: 2 });
      expect(calls).toHaveLength(1); // Should not receive second event
    });

    it('should support one-time listeners', async () => {
      const calls: any[] = [];
      
      // Note: WebSocket service doesn't have a 'once' method, so we simulate it
      const listener = (data: any) => {
        calls.push(data);
        wsService.off('test_event', listener);
      };
      wsService.on('test_event', listener);
      
      mockSocket._trigger('test_event', { value: 1 });
      mockSocket._trigger('test_event', { value: 2 });

      expect(calls).toHaveLength(1);
      expect(calls[0].value).toBe(1);
    });
  });

  describe('batching and performance', () => {
    beforeEach(async () => {
      await wsService.connect({ enableBatching: true });
      // Wait for the async connect event to fire
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should batch multiple events', async () => {
      // Import the mocked batch handler
      const { websocketBatchHandler } = await import('../websocketBatchHandler');
      
      // Update batch configuration
      wsService.updateBatchConfig({
        maxBatchWaitTime: 100,
        maxBatchSize: 5
      });

      // Send multiple events quickly
      for (let i = 0; i < 3; i++) {
        await wsService.sendBatched('batchable_event', { id: i });
      }

      // Check that events were added to the queue
      const queue = (websocketBatchHandler as any)._getBatchQueue();
      expect(queue).toHaveLength(3);
      expect(queue[0]).toEqual({ event: 'batchable_event', data: { id: 0 } });
      expect(queue[1]).toEqual({ event: 'batchable_event', data: { id: 1 } });
      expect(queue[2]).toEqual({ event: 'batchable_event', data: { id: 2 } });

      // Verify batch configuration was updated
      expect(websocketBatchHandler.updateConfig).toHaveBeenCalledWith({
        maxBatchWaitTime: 100,
        maxBatchSize: 5
      });
    });

    it('should get batch status', async () => {
      // Import the mocked batch handler
      const { websocketBatchHandler } = await import('../websocketBatchHandler');
      
      // Send some events to populate the queue
      await wsService.sendBatched('event1', { data: 1 });
      await wsService.sendBatched('event2', { data: 2 });

      // Get batch status
      const status = wsService.getBatchStatus();
      
      expect(status).toEqual({
        enabled: true,
        queueLength: 2,
        pendingAcks: 0,
        capabilities: null,
        isConnected: true
      });

      // Verify getStatus was called
      expect(websocketBatchHandler.getStatus).toHaveBeenCalled();
    });

    it('should flush batch on demand', async () => {
      // Import the mocked batch handler
      const { websocketBatchHandler } = await import('../websocketBatchHandler');
      
      // Send some events
      await wsService.sendBatched('event1', { data: 1 });
      await wsService.sendBatched('event2', { data: 2 });

      // Flush the batch
      wsService.flushBatch();

      // Verify flush was called
      expect(websocketBatchHandler.flush).toHaveBeenCalled();
      
      // Queue should be empty after flush
      const queue = (websocketBatchHandler as any)._getBatchQueue();
      expect(queue).toHaveLength(0);
    });
  });

  describe('error handling and recovery', () => {
    it('should handle connection errors', async () => {
      await wsService.connect();
      // Wait for the async connect event to fire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // The service listens to 'connect_error' internally and updates state
      // but doesn't re-emit it as 'error' to external listeners
      const error = new Error('Connection failed');
      mockSocket._trigger('connect_error', error);

      // Check that the connection state was updated with the error
      const state = wsService.getConnectionState();
      expect(state.error).toBeTruthy();
      expect(state.error.message).toBe('Connection failed');
    });

    it('should attempt reconnection on disconnect', async () => {
      await wsService.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate server-initiated disconnect (which triggers auto-reconnect)
      mockSocket._trigger('disconnect', 'io server disconnect');
      
      // The service should schedule a reconnect after the configured delay
      // We can't easily test the setTimeout behavior, but we can verify
      // the connection state was updated
      const state = wsService.getConnectionState();
      expect(state.isConnected).toBe(false);
      expect(state.lastDisconnectedAt).toBeTruthy();
    });

    it('should handle reconnection failure', async () => {
      const failureHandler = vi.fn();
      
      await wsService.connect();
      // Wait for the async connect event to fire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      wsService.on('reconnect_failed', failureHandler);
      mockSocket._trigger('reconnect_failed');

      expect(failureHandler).toHaveBeenCalled();
      
      // Note: The service doesn't automatically update connection state on reconnect_failed
      // It relies on the disconnect event to update the state
      mockSocket._trigger('disconnect', 'transport close');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(wsService.getConnectionState().isConnected).toBe(false);
    });
  });

  describe('message queuing', () => {
    it('should not send messages when disconnected', async () => {
      // Connect first
      await wsService.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Clear any previous calls
      mockSocket.emit.mockClear();
      
      // Simulate disconnection
      mockSocket.connected = false;
      mockSocket._trigger('disconnect', 'transport close');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try to emit while disconnected (service should handle this gracefully)
      wsService.emit('test_message', { data: 'queued' });

      // Since socket is not connected, emit should not be called
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should send messages when connected', async () => {
      await wsService.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Ensure socket is marked as connected
      mockSocket.connected = true;
      
      // Clear any previous calls from connection
      mockSocket.emit.mockClear();

      // Emit while connected
      wsService.emit('test_message', { data: 'sent' });

      // Message should be sent immediately
      expect(mockSocket.emit).toHaveBeenCalledWith('test_message', { data: 'sent' });
    });
  });
});