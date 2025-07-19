/**
 * Integration tests for UnifiedWebSocketService
 * 
 * Tests WebSocket communication with mock socket.io server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedWebSocketService } from '../unifiedWebSocketService';
import { io } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client');

// Create mock socket
const createMockSocket = () => {
  const listeners = new Map<string, Set<Function>>();
  const mockSocket = {
    connected: false,
    id: 'mock_socket_id',
    connect: vi.fn().mockImplementation(function() {
      this.connected = true;
      this.emit('connect');
      return this;
    }),
    disconnect: vi.fn().mockImplementation(function() {
      this.connected = false;
      this.emit('disconnect');
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
  let wsService: UnifiedWebSocketService;
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = createMockSocket();
    (io as any).mockReturnValue(mockSocket);
    
    wsService = UnifiedWebSocketService.getInstance();
  });

  afterEach(() => {
    wsService.disconnect();
    vi.clearAllMocks();
  });

  describe('connection management', () => {
    it('should connect to WebSocket server', () => {
      const token = 'mock_auth_token';
      wsService.connect(token);

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        })
      );

      expect(mockSocket.connect).toHaveBeenCalled();
      expect(wsService.isConnected()).toBe(true);
    });

    it('should handle connection events', () => {
      const connectionStates: boolean[] = [];
      
      wsService.on('connection_change', (connected: boolean) => {
        connectionStates.push(connected);
      });

      wsService.connect('token');
      expect(connectionStates).toEqual([true]);

      mockSocket._trigger('disconnect');
      expect(connectionStates).toEqual([true, false]);
    });

    it('should handle reconnection', () => {
      let reconnectCount = 0;
      
      wsService.on('reconnect', () => {
        reconnectCount++;
      });

      wsService.connect('token');
      
      mockSocket._trigger('reconnect', 3);
      expect(reconnectCount).toBe(1);
    });

    it('should disconnect cleanly', () => {
      wsService.connect('token');
      wsService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(wsService.isConnected()).toBe(false);
    });
  });

  describe('room management', () => {
    beforeEach(() => {
      wsService.connect('token');
    });

    it('should join rooms', async () => {
      const roomId = 'project_123';
      
      await wsService.joinRoom(roomId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'join_room',
        { roomId },
        expect.any(Function)
      );
    });

    it('should leave rooms', async () => {
      const roomId = 'project_123';
      
      await wsService.joinRoom(roomId);
      await wsService.leaveRoom(roomId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'leave_room',
        { roomId },
        expect.any(Function)
      );
    });

    it('should handle room errors', async () => {
      mockSocket.emit.mockImplementationOnce((event, data, callback) => {
        setTimeout(() => callback({ success: false, error: 'Room not found' }), 10);
      });

      await expect(wsService.joinRoom('invalid_room'))
        .rejects.toThrow('Failed to join room');
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      wsService.connect('token');
    });

    it('should handle image upload events', () => {
      const uploadEvents: any[] = [];
      
      wsService.on('image_upload_progress', (data) => {
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
      
      wsService.on('segmentation_status', (data) => {
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
      
      wsService.on('project_updated', (data) => {
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
      
      wsService.on('error', (error) => {
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
    it('should support multiple listeners for same event', () => {
      const listener1Calls: any[] = [];
      const listener2Calls: any[] = [];
      
      wsService.on('test_event', (data) => listener1Calls.push(data));
      wsService.on('test_event', (data) => listener2Calls.push(data));

      wsService.connect('token');
      mockSocket._trigger('test_event', { value: 1 });

      expect(listener1Calls).toHaveLength(1);
      expect(listener2Calls).toHaveLength(1);
    });

    it('should remove specific listeners', () => {
      const calls: any[] = [];
      const listener = (data: any) => calls.push(data);
      
      wsService.on('test_event', listener);
      wsService.connect('token');
      
      mockSocket._trigger('test_event', { value: 1 });
      expect(calls).toHaveLength(1);

      wsService.off('test_event', listener);
      mockSocket._trigger('test_event', { value: 2 });
      expect(calls).toHaveLength(1); // Should not receive second event
    });

    it('should support one-time listeners', () => {
      const calls: any[] = [];
      
      wsService.once('test_event', (data) => calls.push(data));
      wsService.connect('token');
      
      mockSocket._trigger('test_event', { value: 1 });
      mockSocket._trigger('test_event', { value: 2 });

      expect(calls).toHaveLength(1);
      expect(calls[0].value).toBe(1);
    });
  });

  describe('batching and performance', () => {
    beforeEach(() => {
      wsService.connect('token');
    });

    it('should batch multiple events', () => {
      vi.useFakeTimers();
      
      const batchedEvents: any[] = [];
      wsService.on('batch_complete', (batch) => {
        batchedEvents.push(batch);
      });

      // Enable batching
      wsService.enableBatching({
        batchInterval: 100,
        maxBatchSize: 5
      });

      // Send multiple events quickly
      for (let i = 0; i < 3; i++) {
        mockSocket._trigger('batchable_event', { id: i });
      }

      // Advance timers to trigger batch
      vi.advanceTimersByTime(100);

      expect(batchedEvents).toHaveLength(1);
      expect(batchedEvents[0]).toHaveLength(3);

      vi.useRealTimers();
    });

    it('should respect max batch size', () => {
      vi.useFakeTimers();
      
      const batchedEvents: any[] = [];
      wsService.on('batch_complete', (batch) => {
        batchedEvents.push(batch);
      });

      wsService.enableBatching({
        batchInterval: 1000,
        maxBatchSize: 3
      });

      // Send more events than max batch size
      for (let i = 0; i < 5; i++) {
        mockSocket._trigger('batchable_event', { id: i });
      }

      // Should trigger immediately when max size reached
      expect(batchedEvents).toHaveLength(1);
      expect(batchedEvents[0]).toHaveLength(3);

      // Advance time for remaining events
      vi.advanceTimersByTime(1000);
      expect(batchedEvents).toHaveLength(2);
      expect(batchedEvents[1]).toHaveLength(2);

      vi.useRealTimers();
    });
  });

  describe('error handling and recovery', () => {
    it('should handle connection errors', () => {
      const errorHandler = vi.fn();
      wsService.on('error', errorHandler);

      wsService.connect('token');
      mockSocket._trigger('connect_error', new Error('Connection failed'));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection_error',
          message: 'Connection failed'
        })
      );
    });

    it('should attempt reconnection on disconnect', () => {
      const reconnectAttempts: number[] = [];
      
      wsService.on('reconnect_attempt', (attempt) => {
        reconnectAttempts.push(attempt);
      });

      wsService.connect('token');
      
      mockSocket._trigger('disconnect', 'transport close');
      mockSocket._trigger('reconnect_attempt', 1);
      mockSocket._trigger('reconnect_attempt', 2);
      mockSocket._trigger('reconnect', 2);

      expect(reconnectAttempts).toEqual([1, 2]);
    });

    it('should handle reconnection failure', () => {
      const failureHandler = vi.fn();
      wsService.on('reconnect_failed', failureHandler);

      wsService.connect('token');
      mockSocket._trigger('reconnect_failed');

      expect(failureHandler).toHaveBeenCalled();
      expect(wsService.isConnected()).toBe(false);
    });
  });

  describe('message queuing', () => {
    it('should queue messages when disconnected', () => {
      wsService.connect('token');
      mockSocket.connected = false;

      // Try to emit while disconnected
      wsService.emit('test_message', { data: 'queued' });

      expect(mockSocket.emit).not.toHaveBeenCalled();

      // Reconnect
      mockSocket.connected = true;
      mockSocket._trigger('connect');

      // Queued message should be sent
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'test_message',
        { data: 'queued' }
      );
    });

    it('should respect queue size limit', () => {
      wsService.setQueueOptions({ maxQueueSize: 2 });
      wsService.connect('token');
      mockSocket.connected = false;

      // Queue multiple messages
      wsService.emit('message1', { id: 1 });
      wsService.emit('message2', { id: 2 });
      wsService.emit('message3', { id: 3 }); // Should drop oldest

      mockSocket.connected = true;
      mockSocket._trigger('connect');

      // Only last 2 messages should be sent
      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
      expect(mockSocket.emit).toHaveBeenCalledWith('message2', { id: 2 });
      expect(mockSocket.emit).toHaveBeenCalledWith('message3', { id: 3 });
    });
  });
});