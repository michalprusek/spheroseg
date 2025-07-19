/**
 * WebSocket and Socket.IO Mock
 * 
 * Comprehensive mock for WebSocket and Socket.IO client functionality
 * to support real-time communication testing.
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';

// WebSocket readyState constants
export const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

// Mock WebSocket class
export class MockWebSocket extends EventEmitter {
  static CONNECTING = WS_READY_STATE.CONNECTING;
  static OPEN = WS_READY_STATE.OPEN;
  static CLOSING = WS_READY_STATE.CLOSING;
  static CLOSED = WS_READY_STATE.CLOSED;

  url: string;
  readyState: number = WS_READY_STATE.CONNECTING;
  protocol: string = '';
  extensions: string = '';
  bufferedAmount: number = 0;
  binaryType: BinaryType = 'blob';

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
    
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = WS_READY_STATE.OPEN;
      const openEvent = new Event('open');
      this.onopen?.(openEvent);
      this.emit('open', openEvent);
    }, 0);
  }

  send = vi.fn((data: string | ArrayBuffer | Blob) => {
    if (this.readyState !== WS_READY_STATE.OPEN) {
      throw new Error('WebSocket is not open');
    }
  });

  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = WS_READY_STATE.CLOSING;
    setTimeout(() => {
      this.readyState = WS_READY_STATE.CLOSED;
      const closeEvent = new CloseEvent('close', { code, reason });
      this.onclose?.(closeEvent);
      this.emit('close', closeEvent);
    }, 0);
  });

  // Test helper to simulate receiving a message
  __simulateMessage(data: any) {
    const messageEvent = new MessageEvent('message', { data });
    this.onmessage?.(messageEvent);
    this.emit('message', messageEvent);
  }

  // Test helper to simulate an error
  __simulateError(error?: Error) {
    const errorEvent = new Event('error');
    this.onerror?.(errorEvent);
    this.emit('error', error || errorEvent);
  }
}

// Mock Socket.IO client
export class MockSocketIO extends EventEmitter {
  connected: boolean = false;
  disconnected: boolean = true;
  id: string = 'mock-socket-id';
  
  // Mock methods
  connect = vi.fn(() => {
    this.connected = true;
    this.disconnected = false;
    setTimeout(() => this.emit('connect'), 0);
    return this;
  });

  disconnect = vi.fn(() => {
    this.connected = false;
    this.disconnected = true;
    setTimeout(() => this.emit('disconnect'), 0);
    return this;
  });

  emit = vi.fn((event: string, ...args: any[]) => {
    super.emit(event, ...args);
    return this;
  });

  on = vi.fn((event: string, listener: (...args: any[]) => void) => {
    super.on(event, listener);
    return this;
  });

  off = vi.fn((event: string, listener?: (...args: any[]) => void) => {
    if (listener) {
      super.off(event, listener);
    } else {
      super.removeAllListeners(event);
    }
    return this;
  });

  once = vi.fn((event: string, listener: (...args: any[]) => void) => {
    super.once(event, listener);
    return this;
  });

  send = vi.fn((...args: any[]) => {
    return this.emit('message', ...args);
  });

  // Test helpers
  __simulateConnect() {
    this.connected = true;
    this.disconnected = false;
    this.emit('connect');
  }

  __simulateDisconnect() {
    this.connected = false;
    this.disconnected = true;
    this.emit('disconnect');
  }

  __simulateEvent(event: string, ...args: any[]) {
    this.emit(event, ...args);
  }
}

// Factory function for Socket.IO
export const mockIo = vi.fn((url?: string, options?: any) => {
  return new MockSocketIO();
});

// Setup function to install mocks globally
export function setupWebSocketMocks() {
  // Mock WebSocket
  global.WebSocket = MockWebSocket as any;
  
  // Mock Socket.IO if needed
  vi.mock('socket.io-client', () => ({
    default: mockIo,
    io: mockIo,
  }));

  return {
    MockWebSocket,
    MockSocketIO,
    mockIo,
  };
}

// Cleanup function
export function cleanupWebSocketMocks() {
  vi.clearAllMocks();
}

export default {
  MockWebSocket,
  MockSocketIO,
  mockIo,
  setupWebSocketMocks,
  cleanupWebSocketMocks,
  WS_READY_STATE,
};