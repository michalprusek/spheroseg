import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketBatchHandler } from '../websocketBatchHandler';
import { Socket } from 'socket.io-client';

// Mock Socket.IO client
const createMockSocket = (): Partial<Socket> => ({
  connected: true,
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
});

describe('WebSocketBatchHandler', () => {
  let handler: WebSocketBatchHandler;
  let mockSocket: Partial<Socket>;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new WebSocketBatchHandler({
      maxBatchSize: 3,
      maxBatchWaitTime: 100,
    });
    mockSocket = createMockSocket();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultHandler = new WebSocketBatchHandler();
      const status = defaultHandler.getStatus();
      expect(status.queueLength).toBe(0);
      expect(status.pendingAcks).toBe(0);
      expect(status.isConnected).toBe(false);
    });

    it('should initialize with custom config', () => {
      handler.initialize(mockSocket as Socket);
      expect(mockSocket.on).toHaveBeenCalledWith('batch', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('batch_ack', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('capabilities', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('batch_error', expect.any(Function));
    });

    it('should negotiate capabilities on initialization', () => {
      handler.initialize(mockSocket as Socket);
      expect(mockSocket.emit).toHaveBeenCalledWith('negotiate_capabilities', {
        supportsBatching: true,
        supportsCompression: false,
        version: '1.0.0',
      });
    });
  });

  describe('message batching', () => {
    beforeEach(() => {
      handler.initialize(mockSocket as Socket);
      // Simulate server capabilities response
      const capabilitiesHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'capabilities')[1];
      capabilitiesHandler({
        supportsBatching: true,
        supportsCompression: false,
        version: '1.0.0',
      });
    });

    it('should batch messages up to maxBatchSize', async () => {
      const promises = [handler.send('event1', { data: 1 }), handler.send('event2', { data: 2 })];

      // Should not send yet
      expect(mockSocket.emit).not.toHaveBeenCalledWith('batch', expect.any(Object));

      // Third message should trigger batch send
      promises.push(handler.send('event3', { data: 3 }));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'batch',
        expect.objectContaining({
          batchId: expect.stringMatching(/^batch_/),
          messages: expect.arrayContaining([
            expect.objectContaining({ event: 'event1', data: { data: 1 } }),
            expect.objectContaining({ event: 'event2', data: { data: 2 } }),
            expect.objectContaining({ event: 'event3', data: { data: 3 } }),
          ]),
          compressed: false,
        }),
      );
    });

    it('should send batch after maxBatchWaitTime', async () => {
      handler.send('event1', { data: 1 });
      handler.send('event2', { data: 2 });

      // Should not send immediately
      expect(mockSocket.emit).not.toHaveBeenCalledWith('batch', expect.any(Object));

      // Advance time to trigger batch send
      vi.advanceTimersByTime(100);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'batch',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ event: 'event1' }),
            expect.objectContaining({ event: 'event2' }),
          ]),
        }),
      );
    });

    it('should handle immediate send without batching', () => {
      handler.sendImmediate('urgent', { data: 'immediate' });
      expect(mockSocket.emit).toHaveBeenCalledWith('urgent', { data: 'immediate' });
      expect(mockSocket.emit).not.toHaveBeenCalledWith('batch', expect.any(Object));
    });

    it('should fallback to direct emit when batching not supported', async () => {
      // Reset capabilities to not support batching
      const capabilitiesHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'capabilities')[1];
      capabilitiesHandler({
        supportsBatching: false,
        supportsCompression: false,
        version: '1.0.0',
      });

      await handler.send('event', { data: 'test' });
      expect(mockSocket.emit).toHaveBeenCalledWith('event', { data: 'test' });
      expect(mockSocket.emit).not.toHaveBeenCalledWith('batch', expect.any(Object));
    });
  });

  describe('batch acknowledgments', () => {
    beforeEach(() => {
      handler.initialize(mockSocket as Socket);
      // Enable batching
      const capabilitiesHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'capabilities')[1];
      capabilitiesHandler({ supportsBatching: true, supportsCompression: false, version: '1.0.0' });
    });

    it('should resolve promises on successful acknowledgment', async () => {
      const promise1 = handler.send('event1', { data: 1 });
      const promise2 = handler.send('event2', { data: 2 });
      const promise3 = handler.send('event3', { data: 3 });

      // Get the batch that was sent
      const batchCall = (mockSocket.emit as unknown).mock.calls.find((call: any) => call[0] === 'batch');
      const batch = batchCall[1];

      // Simulate acknowledgment
      const ackHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'batch_ack')[1];

      ackHandler({
        batchId: batch.batchId,
        results: batch.messages.map((msg: any) => ({
          messageId: msg.id,
          data: { success: true },
        })),
      });

      const results = await Promise.all([promise1, promise2, promise3]);
      results.forEach((result) => {
        expect(result).toEqual({ success: true });
      });
    });

    it('should reject promises on error acknowledgment', async () => {
      const promise = handler.send('event', { data: 'test' });

      // Trigger batch send
      handler.flush();

      const batchCall = (mockSocket.emit as unknown).mock.calls.find((call: any) => call[0] === 'batch');
      const batch = batchCall[1];

      // Simulate error acknowledgment
      const ackHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'batch_ack')[1];

      ackHandler({
        batchId: batch.batchId,
        results: [
          {
            messageId: batch.messages[0].id,
            error: 'Processing failed',
          },
        ],
      });

      await expect(promise).rejects.toThrow('Processing failed');
    });

    it('should timeout pending acknowledgments', async () => {
      const promise = handler.send('event', { data: 'test' });
      handler.flush();

      // Advance time to trigger timeout
      vi.advanceTimersByTime(30000);

      await expect(promise).rejects.toThrow(/timed out/);
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      handler.initialize(mockSocket as Socket);
    });

    it('should process incoming batch messages', () => {
      const eventHandler = vi.fn();
      handler.on('custom_event', eventHandler);

      // Simulate incoming batch
      const batchHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'batch')[1];

      batchHandler({
        messages: [
          { id: '1', event: 'custom_event', data: { value: 1 }, timestamp: Date.now() },
          { id: '2', event: 'custom_event', data: { value: 2 }, timestamp: Date.now() },
          { id: '3', event: 'other_event', data: { value: 3 }, timestamp: Date.now() },
        ],
        compressed: false,
      });

      expect(eventHandler).toHaveBeenCalledTimes(2);
      expect(eventHandler).toHaveBeenCalledWith({ value: 1 });
      expect(eventHandler).toHaveBeenCalledWith({ value: 2 });
    });

    it('should handle event handler errors gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      handler.on('error_event', errorHandler);

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const batchHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'batch')[1];

      batchHandler({
        messages: [{ id: '1', event: 'error_event', data: {}, timestamp: Date.now() }],
      });

      expect(errorHandler).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('Error in batch event handler for error_event:', expect.any(Error));
    });
  });

  describe('batch management', () => {
    beforeEach(() => {
      handler.initialize(mockSocket as Socket);
      // Enable batching
      const capabilitiesHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'capabilities')[1];
      capabilitiesHandler({ supportsBatching: true, supportsCompression: false, version: '1.0.0' });
    });

    it('should flush pending messages', () => {
      handler.send('event1', { data: 1 });
      handler.send('event2', { data: 2 });

      expect(mockSocket.emit).not.toHaveBeenCalledWith('batch', expect.any(Object));

      handler.flush();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'batch',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ event: 'event1' }),
            expect.objectContaining({ event: 'event2' }),
          ]),
        }),
      );
    });

    it('should clear all pending messages and timers', () => {
      handler.send('event1', { data: 1 });
      handler.send('event2', { data: 2 });

      const statusBefore = handler.getStatus();
      expect(statusBefore.queueLength).toBe(2);
      expect(statusBefore.pendingAcks).toBe(2);

      handler.clear();

      const statusAfter = handler.getStatus();
      expect(statusAfter.queueLength).toBe(0);
      expect(statusAfter.pendingAcks).toBe(0);
    });

    it('should update configuration', () => {
      handler.updateConfig({
        maxBatchSize: 10,
        maxBatchWaitTime: 200,
        enableCompression: true,
      });

      // Send 5 messages - should not trigger batch yet with new size
      for (let i = 0; i < 5; i++) {
        handler.send(`event${i}`, { data: i });
      }

      expect(mockSocket.emit).not.toHaveBeenCalledWith('batch', expect.any(Object));

      // Send 5 more to reach new batch size
      for (let i = 5; i < 10; i++) {
        handler.send(`event${i}`, { data: i });
      }

      expect(mockSocket.emit).toHaveBeenCalledWith('batch', expect.any(Object));
    });
  });

  describe('status reporting', () => {
    it('should report correct status', () => {
      const status = handler.getStatus();
      expect(status).toEqual({
        queueLength: 0,
        pendingAcks: 0,
        capabilities: null,
        isConnected: false,
      });

      handler.initialize(mockSocket as Socket);
      const statusAfterInit = handler.getStatus();
      expect(statusAfterInit.isConnected).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle disconnected socket gracefully', async () => {
      handler.initialize(mockSocket as Socket);
      (mockSocket as unknown).connected = false;

      await expect(handler.send('event', {})).rejects.toThrow('WebSocket not connected');
    });

    it('should handle null socket gracefully', () => {
      handler.sendImmediate('event', {});
      // Should not throw
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should generate unique message IDs', () => {
      handler.initialize(mockSocket as Socket);
      // Enable batching
      const capabilitiesHandler = (mockSocket.on as unknown).mock.calls.find((call: any) => call[0] === 'capabilities')[1];
      capabilitiesHandler({ supportsBatching: true, supportsCompression: false, version: '1.0.0' });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(handler.send(`event${i}`, {}));
      }

      handler.flush();

      const batchCalls = (mockSocket.emit as unknown).mock.calls.filter((call: any) => call[0] === 'batch');

      const messageIds = new Set();
      batchCalls.forEach((call: any) => {
        call[1].messages.forEach((msg: any) => {
          messageIds.add(msg.id);
        });
      });

      expect(messageIds.size).toBe(10);
    });
  });
});
