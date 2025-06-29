# WebSocket Management Consolidation

## Overview

This document details the consolidation of WebSocket functionality across the application into a unified management system.

## Problem Statement

The application had multiple WebSocket implementations:
1. **SocketContext.tsx** - Basic context with minimal functionality
2. **useSocketConnection.ts** - Hook with connection management and auth
3. **socketClient.ts** - Service with initialization logic
4. **useSegmentationUpdates.ts** - Specialized hook with complex error handling
5. Various inline socket.io usages throughout components

Issues identified:
- Inconsistent connection management
- Duplicate reconnection logic in multiple places
- No centralized error handling
- Complex heartbeat implementations scattered
- Room management not standardized
- Event handler cleanup issues
- Memory leaks from unremoved listeners

## Solution

Created a comprehensive unified WebSocket system with three layers:
1. **UnifiedWebSocketService** - Core service with all WebSocket logic
2. **useUnifiedWebSocket** - Flexible hook for component usage
3. **UnifiedSocketContext** - Global context for app-wide functionality

## Architecture

### Service Layer

```
UnifiedWebSocketService
├── Connection Management
│   ├── Initialize/Connect/Disconnect
│   ├── Authentication integration
│   ├── Reconnection with backoff
│   └── Connection state tracking
├── Event Management
│   ├── Type-safe event registration
│   ├── Automatic cleanup tracking
│   ├── Event acknowledgments
│   └── Global event handlers
├── Room Management
│   ├── Join/Leave rooms
│   ├── Auto-rejoin after reconnect
│   ├── Room-specific events
│   └── Specialized room methods
└── Health Monitoring
    ├── Heartbeat mechanism
    ├── Latency tracking
    ├── Timeout detection
    └── Auto-recovery
```

### Hook Layer

```
useUnifiedWebSocket
├── Component-level connection
├── Automatic cleanup on unmount
├── Event subscription management
└── Specialized hooks
    ├── useProjectWebSocket
    ├── useSegmentationQueueWebSocket
    └── useNotificationWebSocket
```

### Context Layer

```
UnifiedSocketContext
├── Global connection management
├── Authentication-based lifecycle
├── Toast notifications
└── Shared socket instance
```

## Usage Examples

### Basic Connection

```typescript
import { useUnifiedWebSocket } from '@/hooks/useUnifiedWebSocket';

function MyComponent() {
  const { isConnected, emit, on } = useUnifiedWebSocket({
    autoConnect: true,
    events: {
      'my_event': (data) => {
        console.log('Received:', data);
      }
    }
  });

  const sendMessage = () => {
    emit('message', { text: 'Hello' });
  };

  return (
    <div>
      Status: {isConnected ? 'Connected' : 'Disconnected'}
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

### Room-Based Updates

```typescript
import { useProjectWebSocket } from '@/hooks/useUnifiedWebSocket';

function ProjectView({ projectId }) {
  const { isConnected, updates } = useProjectWebSocket(projectId);

  useEffect(() => {
    updates.forEach(update => {
      if (update.type === 'segmentation_completed') {
        // Handle completion
      }
    });
  }, [updates]);

  return <div>Project updates: {updates.length}</div>;
}
```

### Global Socket Context

```typescript
import { useUnifiedSocket } from '@/contexts/UnifiedSocketContext';

function GlobalComponent() {
  const { 
    isConnected, 
    joinProjectRoom, 
    leaveProjectRoom 
  } = useUnifiedSocket();

  useEffect(() => {
    if (isConnected) {
      joinProjectRoom('project123');
      
      return () => {
        leaveProjectRoom('project123');
      };
    }
  }, [isConnected]);
}
```

### Event with Acknowledgment

```typescript
const { emitWithAck } = useUnifiedWebSocket();

const saveData = async () => {
  try {
    const response = await emitWithAck('save_data', { 
      id: '123',
      data: { /* ... */ }
    });
    console.log('Saved:', response);
  } catch (error) {
    console.error('Save failed:', error);
  }
};
```

## Features

### Connection Management

1. **Automatic Authentication**
   - Connects only when authenticated
   - Disconnects on logout
   - Re-authenticates on token refresh

2. **Smart Reconnection**
   - Exponential backoff strategy
   - Maximum retry attempts
   - Server-initiated reconnect support

3. **Connection State Tracking**
   ```typescript
   interface ConnectionState {
     isConnected: boolean;
     isConnecting: boolean;
     error: Error | null;
     reconnectAttempts: number;
     lastConnectedAt: Date | null;
     lastDisconnectedAt: Date | null;
   }
   ```

### Event Management

1. **Type-Safe Events**
   - Strongly typed event handlers
   - Automatic type inference
   - Compile-time validation

2. **Automatic Cleanup**
   - Tracks all event subscriptions
   - Removes handlers on unmount
   - Prevents memory leaks

3. **Event Acknowledgments**
   - Promise-based acknowledgments
   - Timeout handling
   - Error propagation

### Room Management

1. **Auto-Rejoin**
   - Tracks joined rooms
   - Rejoins after reconnection
   - Maintains room state

2. **Specialized Rooms**
   - Project rooms with specific events
   - Segmentation queue room
   - User notification rooms

3. **Room Events**
   - Room-specific event filtering
   - Automatic event registration
   - Clean separation of concerns

### Health Monitoring

1. **Heartbeat Mechanism**
   - Regular ping/pong checks
   - Latency measurement
   - Dead connection detection

2. **Auto-Recovery**
   - Detects stale connections
   - Forces reconnection
   - Maintains service availability

## Migration Guide

### From SocketContext

```typescript
// Old
import { useSocket } from '@/contexts/SocketContext';
const { socket, isConnected } = useSocket();

// New
import { useUnifiedSocket } from '@/contexts/UnifiedSocketContext';
const { isConnected, emit, on } = useUnifiedSocket();
```

### From useSocketConnection

```typescript
// Old
import useSocketConnection from '@/hooks/useSocketConnection';
const { socket, connect, disconnect } = useSocketConnection();

// New
import { useUnifiedWebSocket } from '@/hooks/useUnifiedWebSocket';
const { connect, disconnect, emit } = useUnifiedWebSocket();
```

### From Direct Socket.IO

```typescript
// Old
import { io } from 'socket.io-client';
const socket = io(url);
socket.on('event', handler);

// New
import { useUnifiedWebSocket } from '@/hooks/useUnifiedWebSocket';
const { on } = useUnifiedWebSocket();
on('event', handler);
```

## Benefits Achieved

1. **Code Reduction**: Eliminated ~500+ lines of duplicate code
2. **Consistency**: Single connection management strategy
3. **Reliability**: Robust reconnection and error handling
4. **Performance**: Efficient event management and cleanup
5. **Type Safety**: Full TypeScript support
6. **Maintainability**: Clear separation of concerns
7. **Debugging**: Centralized logging and monitoring

## Best Practices

### 1. Use Appropriate Layer

```typescript
// Component-specific connections
useUnifiedWebSocket()

// Shared project updates
useProjectWebSocket(projectId)

// Global app connection
useUnifiedSocket() // from context
```

### 2. Clean Up Resources

```typescript
useEffect(() => {
  const cleanup = on('event', handler);
  return cleanup; // Always return cleanup
}, []);
```

### 3. Handle Connection States

```typescript
const { isConnected, isConnecting, error } = useUnifiedWebSocket();

if (error) return <ErrorDisplay error={error} />;
if (isConnecting) return <LoadingSpinner />;
if (!isConnected) return <OfflineMessage />;
```

### 4. Use Acknowledgments for Critical Operations

```typescript
try {
  const result = await emitWithAck('critical_operation', data);
  // Handle success
} catch (error) {
  // Handle failure with retry logic
}
```

## Future Improvements

1. **Message Queue**
   - Queue messages when offline
   - Send on reconnection
   - Persistence support

2. **Compression**
   - Enable perMessageDeflate
   - Reduce bandwidth usage
   - Optimize for mobile

3. **Analytics**
   - Track connection metrics
   - Monitor event frequencies
   - Performance dashboards

4. **Testing Utilities**
   - Mock WebSocket for tests
   - Event simulation helpers
   - Connection state testing

5. **Rate Limiting**
   - Client-side rate limiting
   - Backpressure handling
   - Queue overflow protection

## Debugging

### Enable Debug Logging

```typescript
// Set in browser console
localStorage.setItem('debug', 'UnifiedWebSocket*');
```

### Monitor Connection State

```typescript
const { connectionState } = useUnifiedWebSocket();
console.log('Connection details:', connectionState);
```

### Track Events

```typescript
// In development
const originalOn = webSocketService.on;
webSocketService.on = (event, handler) => {
  console.log(`Registered handler for: ${event}`);
  return originalOn.call(webSocketService, event, handler);
};
```