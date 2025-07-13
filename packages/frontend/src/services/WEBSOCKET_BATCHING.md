# WebSocket Batching Implementation

This document describes the WebSocket message batching functionality implemented for the SpherosegV4 frontend application.

## Overview

WebSocket batching is a performance optimization technique that groups multiple WebSocket messages together before sending them to the server. This reduces the overhead of individual message transmissions and improves overall application performance, especially in high-throughput scenarios.

## Architecture

### Components

1. **WebSocketBatchHandler** (`websocketBatchHandler.ts`)
   - Core batching logic
   - Message queuing and batch management
   - Capability negotiation with server
   - Acknowledgment handling
   - Event distribution for incoming batched messages

2. **UnifiedWebSocketService** (updated)
   - Integration point for batching
   - Backward-compatible API
   - Configuration management
   - Automatic fallback to non-batched mode

3. **Type Definitions** (`types/websocket.ts`)
   - TypeScript interfaces for type safety
   - Event type mappings
   - Configuration interfaces

## Usage

### Basic Setup

```typescript
import unifiedWebSocketService from './services/unifiedWebSocketService';

// Connect with batching enabled
await unifiedWebSocketService.connect({
  enableBatching: true,
  auth: { token: 'your-auth-token' },
  batchConfig: {
    maxBatchSize: 50,        // Max messages per batch
    maxBatchWaitTime: 100,   // Max wait time in ms
    enableCompression: false // Optional compression
  }
});
```

### Sending Messages

```typescript
// Batched message (will be queued)
const result = await unifiedWebSocketService.sendBatched('cell:update', {
  cellId: 123,
  data: { area: 100 }
});

// Immediate message (bypasses batching)
unifiedWebSocketService.sendImmediate('urgent:notification', {
  message: 'Critical update',
  priority: 'high'
});

// Force flush pending messages
unifiedWebSocketService.flushBatch();
```

### Event Handling

```typescript
// Listen for batched events
unifiedWebSocketService.onBatchEvent('segmentation:update', (data) => {
  console.log('Segmentation update:', data);
});

// Remove listener
unifiedWebSocketService.offBatchEvent('segmentation:update', handler);
```

### Status Monitoring

```typescript
const status = unifiedWebSocketService.getBatchStatus();
console.log({
  enabled: status.enabled,
  queueLength: status.queueLength,
  pendingAcks: status.pendingAcks,
  capabilities: status.capabilities
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableBatching` | boolean | false | Enable/disable batching |
| `maxBatchSize` | number | 50 | Maximum messages per batch |
| `maxBatchWaitTime` | number | 100 | Maximum wait time in milliseconds |
| `enableCompression` | boolean | false | Enable message compression (if supported by server) |

## Capability Negotiation

The client automatically negotiates capabilities with the server:

1. Client sends its capabilities on connection
2. Server responds with supported features
3. Client adjusts behavior based on server capabilities
4. Automatic fallback if batching is not supported

## Performance Benefits

- **Reduced Network Overhead**: Fewer WebSocket frames
- **Improved Throughput**: Multiple messages sent together
- **Lower Latency**: Configurable batch timing
- **Backward Compatible**: Automatic fallback for legacy servers

## Testing

The implementation includes comprehensive tests:

- Unit tests for WebSocketBatchHandler
- Integration tests for UnifiedWebSocketService
- Edge case handling
- Performance benchmarks

Run tests with:
```bash
npm run test -- src/services/__tests__/websocketBatchHandler.test.ts
npm run test -- src/services/__tests__/unifiedWebSocketService.batching.test.ts
```

## Best Practices

1. **Use batching for bulk operations**: Ideal for updating multiple cells or processing multiple images
2. **Use immediate send for critical messages**: User actions, urgent notifications
3. **Configure batch size based on use case**: Larger batches for bulk operations, smaller for interactive features
4. **Monitor batch status**: Track queue length and pending acknowledgments
5. **Handle errors gracefully**: Implement retry logic for failed batches

## Future Enhancements

- Message compression support
- Priority-based batching
- Adaptive batch sizing based on network conditions
- Metrics and performance monitoring
- WebSocket reconnection with batch recovery