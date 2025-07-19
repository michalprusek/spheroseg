/**
 * WebSocket Batching Usage Examples
 *
 * This file demonstrates how to use the WebSocket batching functionality
 * in the SpherosegV4 application.
 */

import { unifiedWebSocketService } from './unifiedWebSocketService';

// Example 1: Basic connection with batching enabled
export function connectWithBatching() {
  unifiedWebSocketService.connect({
    enableBatching: true,
    auth: {
      token: localStorage.getItem('authToken') || '',
    },
    batchConfig: {
      maxBatchSize: 50, // Send batch when 50 messages accumulate
      maxBatchWaitTime: 100, // Or after 100ms, whichever comes first
      enableCompression: false, // Enable if server supports compression
    },
  });
}

// Example 2: Sending batched messages
export async function sendBatchedUpdates() {
  try {
    // These messages will be batched together
    const promises = [
      unifiedWebSocketService.sendBatched('cell:update', { cellId: 1, data: { area: 100 } }),
      unifiedWebSocketService.sendBatched('cell:update', { cellId: 2, data: { area: 150 } }),
      unifiedWebSocketService.sendBatched('cell:update', { cellId: 3, data: { area: 200 } }),
    ];

    // Wait for all acknowledgments
    const results = await Promise.all(promises);
    console.log('Batch updates sent successfully:', results);
  } catch (error) {
    console.error('Batch update failed:', error);
  }
}

// Example 3: Sending immediate priority messages
export function sendUrgentNotification(message: string) {
  // This bypasses batching and sends immediately
  unifiedWebSocketService.sendImmediate('notification:urgent', {
    message,
    timestamp: Date.now(),
    priority: 'high',
  });
}

// Example 4: Manual batch control
export function manualBatchControl() {
  // Send multiple updates
  unifiedWebSocketService.sendBatched('image:process', { imageId: 1 });
  unifiedWebSocketService.sendBatched('image:process', { imageId: 2 });
  unifiedWebSocketService.sendBatched('image:process', { imageId: 3 });

  // Force send the batch immediately (useful before navigation)
  unifiedWebSocketService.flushBatch();
}

// Example 5: Monitoring batch status
export function monitorBatchStatus() {
  const status = unifiedWebSocketService.getBatchStatus();

  console.log('Batching enabled:', status.enabled);
  console.log('Messages in queue:', status.queueLength);
  console.log('Pending acknowledgments:', status.pendingAcks);
  console.log('Server capabilities:', status.capabilities);
}

// Example 6: Handling batch events
export function setupBatchEventHandlers() {
  // Listen for specific events through the batch system
  unifiedWebSocketService.onBatchEvent('segmentation:update', (data) => {
    console.log('Received segmentation update:', data);
    // Update UI accordingly
  });

  // Listen for cell updates
  unifiedWebSocketService.onBatchEvent('cell:updated', (data) => {
    console.log('Cell updated:', data);
    // Update cell visualization
  });
}

// Example 7: Dynamic configuration updates
export function updateBatchingForHighThroughput() {
  // Adjust batching parameters for high-throughput scenarios
  unifiedWebSocketService.updateBatchConfig({
    maxBatchSize: 100, // Increase batch size
    maxBatchWaitTime: 50, // Decrease wait time for lower latency
  });
}

// Example 8: Graceful shutdown with batching
export function gracefulDisconnect() {
  // Ensure all pending messages are sent before disconnecting
  unifiedWebSocketService.flushBatch();

  // Small delay to ensure batch is processed
  setTimeout(() => {
    unifiedWebSocketService.disconnect();
  }, 100);
}

// Example 9: React Hook for batched WebSocket
export function useWebSocketBatch() {
  const sendBatchedMessage = async (event: string, data: unknown) => {
    if (!unifiedWebSocketService.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    return unifiedWebSocketService.sendBatched(event, data);
  };

  const sendImmediateMessage = (event: string, data: unknown) => {
    if (!unifiedWebSocketService.isConnected()) {
      console.error('WebSocket not connected');
      return;
    }

    unifiedWebSocketService.sendImmediate(event, data);
  };

  return {
    sendBatched: sendBatchedMessage,
    sendImmediate: sendImmediateMessage,
    flushBatch: () => unifiedWebSocketService.flushBatch(),
    getBatchStatus: () => unifiedWebSocketService.getBatchStatus(),
  };
}

// Example 10: Integration with existing services
export class ImageServiceWithBatching {
  async processMultipleImages(imageIds: string[]) {
    // Enable batching for bulk operations
    const promises = imageIds.map((id) =>
      unifiedWebSocketService.sendBatched('image:process', {
        imageId: id,
        timestamp: Date.now(),
      }),
    );

    try {
      const results = await Promise.all(promises);
      console.log(`Processed ${results.length} images in batch`);
      return results;
    } catch (error) {
      console.error('Batch processing failed:', error);
      throw error;
    }
  }

  // For critical operations, use immediate send
  deleteImage(imageId: string) {
    unifiedWebSocketService.sendImmediate('image:delete', {
      imageId,
      timestamp: Date.now(),
    });
  }
}
