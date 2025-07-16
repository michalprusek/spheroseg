import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { io } from 'socket.io-client';
import unifiedWebSocketService from '../unifiedWebSocketService';
import { websocketBatchHandler } from '../websocketBatchHandler';

// Mock dependencies
vi.mock('@/utils/logging/unifiedLogger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/utils/error/unifiedErrorHandler', () => ({
  handleError: vi.fn((error) => ({ message: error.message || 'Error' })),
  ErrorType: { NETWORK: 'NETWORK' },
  ErrorSeverity: { ERROR: 'ERROR' },
}));

vi.mock('../authService', () => ({
  getAccessToken: vi.fn().mockReturnValue('test-token'),
}));

// Mock socket.io-client
const mockSocketConnected = false;
const mockSocket = {
  connected: false,
  on: vi.fn((event, handler) => {
    // Simulate connection events
    if (event === 'connect') {
      setTimeout(() => {
        mockSocket.connected = true;
        handler();
      }, 0);
    }
  }),
  emit: vi.fn(),
  disconnect: vi.fn(() => {
    mockSocket.connected = false;
  }),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
  connect: vi.fn(() => {
    mockSocket.connected = true;
  }),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock the batch handler
vi.mock('../websocketBatchHandler', () => ({
  websocketBatchHandler: {
    initialize: vi.fn(),
    updateConfig: vi.fn(),
    send: vi.fn().mockResolvedValue({ success: true }),
    sendImmediate: vi.fn(),
    flush: vi.fn(),
    clear: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      queueLength: 0,
      pendingAcks: 0,
      capabilities: { supportsBatching: true, supportsCompression: false, version: '1.0.0' },
      isConnected: true,
    }),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

describe('UnifiedWebSocketService - Batching Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the service state between tests
    if (unifiedWebSocketService.getSocket()) {
      unifiedWebSocketService.disconnect();
    }
  });

  afterEach(async () => {
    await unifiedWebSocketService.disconnect();
    vi.clearAllMocks();
  });

  describe('connection with batching', () => {
    it('should initialize batch handler when batching is enabled', async () => {
      await unifiedWebSocketService.connect({
        enableBatching: true,
        auth: { token: 'test-token' },
      });

      expect(websocketBatchHandler.initialize).toHaveBeenCalled();
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'test-token' },
        }),
      );
    });

    it('should update batch config when provided', async () => {
      const batchConfig = {
        maxBatchSize: 100,
        maxBatchWaitTime: 50,
        enableCompression: true,
      };

      await unifiedWebSocketService.connect({
        enableBatching: true,
        batchConfig,
      });

      expect(websocketBatchHandler.updateConfig).toHaveBeenCalledWith(batchConfig);
    });

    it('should not initialize batch handler when batching is disabled', async () => {
      await unifiedWebSocketService.connect();
      expect(websocketBatchHandler.initialize).not.toHaveBeenCalled();
    });
  });

  describe('batched sending', () => {
    beforeEach(async () => {
      await unifiedWebSocketService.connect({ enableBatching: true });
    });

    it('should use batch handler for sendBatched when enabled', async () => {
      const result = await unifiedWebSocketService.sendBatched('test_event', { data: 'test' });

      expect(websocketBatchHandler.send).toHaveBeenCalledWith('test_event', { data: 'test' });
      expect(result).toEqual({ success: true });
    });

    it('should fallback to direct emit when batching is disabled', async () => {
      // Reconnect without batching
      await unifiedWebSocketService.disconnect();
      await unifiedWebSocketService.connect();

      // Wait for connection
      await vi.waitFor(() => {
        expect(mockSocket.connected).toBe(true);
      });

      const socket = unifiedWebSocketService.getSocket();
      await unifiedWebSocketService.sendBatched('test_event', { data: 'test' });

      expect(websocketBatchHandler.send).not.toHaveBeenCalled();
      expect(socket?.emit).toHaveBeenCalledWith('test_event', { data: 'test' });
    });

    it('should use sendImmediate for priority messages', () => {
      unifiedWebSocketService.sendImmediate('urgent_event', { priority: 'high' });

      expect(websocketBatchHandler.sendImmediate).toHaveBeenCalledWith('urgent_event', { priority: 'high' });
    });
  });

  describe('batch management', () => {
    beforeEach(async () => {
      await unifiedWebSocketService.connect({ enableBatching: true });
    });

    it('should flush batch when requested', () => {
      unifiedWebSocketService.flushBatch();
      expect(websocketBatchHandler.flush).toHaveBeenCalled();
    });

    it('should not flush when batching is disabled', async () => {
      await unifiedWebSocketService.disconnect();
      await unifiedWebSocketService.connect();

      unifiedWebSocketService.flushBatch();
      expect(websocketBatchHandler.flush).not.toHaveBeenCalled();
    });

    it('should clear batch handler on disconnect', () => {
      unifiedWebSocketService.disconnect();
      expect(websocketBatchHandler.clear).toHaveBeenCalled();
    });

    it('should update batch configuration', () => {
      const newConfig = {
        maxBatchSize: 200,
        maxBatchWaitTime: 25,
      };

      unifiedWebSocketService.updateBatchConfig(newConfig);
      expect(websocketBatchHandler.updateConfig).toHaveBeenCalledWith(newConfig);
    });
  });

  describe('status reporting', () => {
    it('should return batch status when enabled', async () => {
      await unifiedWebSocketService.connect({ enableBatching: true });

      const status = unifiedWebSocketService.getBatchStatus();

      expect(status).toEqual({
        enabled: true,
        queueLength: 0,
        pendingAcks: 0,
        capabilities: { supportsBatching: true, supportsCompression: false, version: '1.0.0' },
        isConnected: true,
      });
    });

    it('should return disabled status when batching is off', async () => {
      await unifiedWebSocketService.connect();

      // Wait for connection to be established
      await vi.waitFor(() => {
        expect(mockSocket.connected).toBe(true);
      });

      const status = unifiedWebSocketService.getBatchStatus();

      expect(status).toEqual({
        enabled: false,
        queueLength: 0,
        pendingAcks: 0,
        capabilities: null,
        isConnected: true,
      });
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await unifiedWebSocketService.connect({ enableBatching: true });
    });

    it('should use batch handler for event listeners when enabled', () => {
      const handler = vi.fn();
      unifiedWebSocketService.onBatchEvent('custom_event', handler);

      expect(websocketBatchHandler.on).toHaveBeenCalledWith('custom_event', handler);
    });

    it('should use regular event system when batching is disabled', async () => {
      await unifiedWebSocketService.disconnect();
      await unifiedWebSocketService.connect();

      const handler = vi.fn();
      const onSpy = vi.spyOn(unifiedWebSocketService, 'on');

      unifiedWebSocketService.onBatchEvent('custom_event', handler);

      expect(onSpy).toHaveBeenCalledWith('custom_event', handler);
      expect(websocketBatchHandler.on).not.toHaveBeenCalled();
    });

    it('should remove batch event handlers', () => {
      const handler = vi.fn();
      unifiedWebSocketService.offBatchEvent('custom_event', handler);

      expect(websocketBatchHandler.off).toHaveBeenCalledWith('custom_event', handler);
    });
  });

  describe('backward compatibility', () => {
    it('should work normally without batching enabled', async () => {
      await unifiedWebSocketService.connect();

      // Wait for connection to be established
      await vi.waitFor(() => {
        expect(mockSocket.connected).toBe(true);
      });

      expect(unifiedWebSocketService.getConnectionState().isConnected).toBe(true);
      expect(unifiedWebSocketService.getSocket()).toBeDefined();

      // Regular operations should work
      const socket = unifiedWebSocketService.getSocket();
      unifiedWebSocketService.joinProjectRoom('project-123');

      expect(socket?.emit).toHaveBeenCalledWith(
        'join_room',
        expect.objectContaining({ room: 'project_project-123' }),
        expect.any(Function),
      );
    });

    it('should maintain all existing functionality with batching enabled', async () => {
      await unifiedWebSocketService.connect({ enableBatching: true });

      // Wait for connection to be established
      await vi.waitFor(() => {
        expect(mockSocket.connected).toBe(true);
      });

      // Existing methods should still work
      expect(unifiedWebSocketService.getConnectionState().isConnected).toBe(true);
      unifiedWebSocketService.joinProjectRoom('project-123');
      unifiedWebSocketService.leaveProjectRoom('project-123');

      const socket = unifiedWebSocketService.getSocket();
      expect(socket?.emit).toHaveBeenCalledWith(
        'join_room',
        expect.objectContaining({ room: 'project_project-123' }),
        expect.any(Function),
      );
      expect(socket?.emit).toHaveBeenCalledWith(
        'leave_room',
        expect.objectContaining({ room: 'project_project-123' }),
        expect.any(Function),
      );
    });
  });
});
