/**
 * Socket Client Utilities
 * 
 * Provides utilities for WebSocket connections
 */

/**
 * Get the WebSocket URL based on the current environment
 */
export function getSocketUrl(): string {
  const protocol = window.location.protocol;
  const host = window.location.host.replace('0.0.0.0', 'localhost');
  
  return `${protocol}//${host}`;
}

/**
 * Get WebSocket configuration
 */
export function getSocketConfig() {
  return {
    url: getSocketUrl(),
    path: '/socket.io/',
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    autoConnect: true,
    transports: ['websocket', 'polling']
  };
}