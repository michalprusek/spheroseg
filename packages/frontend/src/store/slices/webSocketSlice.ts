import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import { unifiedWebSocketService } from '../../services/unifiedWebSocketService';
import type { Socket } from 'socket.io-client';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface WebSocketSlice {
  // State
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  reconnectAttempts: number;
  lastError: string | null;
  
  // Actions
  connectSocket: () => void;
  disconnectSocket: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  once: (event: string, handler: (...args: any[]) => void) => void;
}

export const createWebSocketSlice: StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  WebSocketSlice
> = (set, get) => ({
  // Initial state
  socket: null,
  isConnected: false,
  connectionStatus: 'disconnected',
  reconnectAttempts: 0,
  lastError: null,
  
  // Actions
  connectSocket: () => {
    const { isAuthenticated, tokens } = get();
    if (!isAuthenticated || !tokens) return;
    
    set((state) => {
      state.connectionStatus = 'connecting';
    });
    
    // Connect with auth token
    unifiedWebSocketService.connect({
      auth: {
        token: tokens.accessToken,
      },
    });
    
    const socket = unifiedWebSocketService.getSocket();
    if (!socket) return;
    
    // Set up event listeners
    socket.on('connect', () => {
      set((state) => {
        state.socket = socket;
        state.isConnected = true;
        state.connectionStatus = 'connected';
        state.reconnectAttempts = 0;
        state.lastError = null;
      });
      
      // Add notification
      get().addNotification({
        type: 'success',
        title: 'Connected',
        message: 'Real-time connection established',
      });
    });
    
    socket.on('disconnect', (reason) => {
      set((state) => {
        state.isConnected = false;
        state.connectionStatus = 'disconnected';
      });
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        get().addNotification({
          type: 'warning',
          title: 'Disconnected',
          message: 'Server closed the connection',
        });
      }
    });
    
    socket.on('connect_error', (error) => {
      set((state) => {
        state.connectionStatus = 'error';
        state.lastError = error.message;
      });
    });
    
    socket.io.on('reconnect_attempt', (attempt) => {
      set((state) => {
        state.connectionStatus = 'reconnecting';
        state.reconnectAttempts = attempt;
      });
    });
    
    socket.io.on('reconnect', () => {
      set((state) => {
        state.connectionStatus = 'connected';
        state.isConnected = true;
        state.reconnectAttempts = 0;
      });
      
      get().addNotification({
        type: 'success',
        title: 'Reconnected',
        message: 'Connection restored',
      });
    });
    
    // Listen for auth errors
    socket.on('auth_error', () => {
      get().logout();
      get().addNotification({
        type: 'error',
        title: 'Authentication Error',
        message: 'Your session has expired. Please login again.',
      });
    });
    
    set((state) => {
      state.socket = socket;
    });
  },
  
  disconnectSocket: () => {
    const { socket } = get();
    if (!socket) return;
    
    unifiedWebSocketService.disconnect();
    
    set((state) => {
      state.socket = null;
      state.isConnected = false;
      state.connectionStatus = 'disconnected';
      state.lastError = null;
    });
  },
  
  emit: (event, data) => {
    const { socket, isConnected } = get();
    if (!socket || !isConnected) {
      console.warn(`Cannot emit '${event}': Not connected`);
      return;
    }
    
    socket.emit(event, data);
  },
  
  on: (event, handler) => {
    const { socket } = get();
    if (!socket) {
      console.warn(`Cannot listen to '${event}': Not connected`);
      return;
    }
    
    socket.on(event, handler);
  },
  
  off: (event, handler) => {
    const { socket } = get();
    if (!socket) return;
    
    if (handler) {
      socket.off(event, handler);
    } else {
      socket.off(event);
    }
  },
  
  once: (event, handler) => {
    const { socket } = get();
    if (!socket) {
      console.warn(`Cannot listen to '${event}': Not connected`);
      return;
    }
    
    socket.once(event, handler);
  },
});