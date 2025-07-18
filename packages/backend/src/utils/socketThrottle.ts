/**
 * WebSocket Event Throttling Utility
 * 
 * Provides throttling and batching mechanisms for WebSocket events
 * to prevent overwhelming clients with too many real-time updates.
 */

import logger from './logger';

interface ThrottledEvent {
  event: string;
  data: unknown;
  timestamp: number;
}

interface EventBatch {
  events: ThrottledEvent[];
  timer?: NodeJS.Timeout;
}

export class SocketThrottler {
  private eventQueues: Map<string, EventBatch> = new Map();
  private lastEmitTimes: Map<string, number> = new Map();
  
  constructor(
    private readonly batchInterval: number = 100, // ms
    private readonly minInterval: number = 50, // ms between individual events
    private readonly maxBatchSize: number = 10
  ) {}

  /**
   * Throttle an event emission
   * @param key Unique key for this event type/room combination
   * @param emitFn Function that performs the actual emission
   * @param event Event name
   * @param data Event data
   */
  throttle(
    key: string,
    emitFn: () => void,
    event: string,
    data: unknown
  ): void {
    const now = Date.now();
    const lastEmit = this.lastEmitTimes.get(key) || 0;
    
    // If enough time has passed, emit immediately
    if (now - lastEmit >= this.minInterval) {
      emitFn();
      this.lastEmitTimes.set(key, now);
      return;
    }
    
    // Otherwise, add to batch queue
    this.addToBatch(key, event, data, emitFn);
  }

  /**
   * Add event to batch queue
   */
  private addToBatch(
    key: string,
    event: string,
    data: unknown,
    _emitFn: () => void
  ): void {
    let batch = this.eventQueues.get(key);
    
    if (!batch) {
      batch = { events: [] };
      this.eventQueues.set(key, batch);
    }
    
    // Add event to batch
    batch.events.push({
      event,
      data,
      timestamp: Date.now()
    });
    
    // If batch is getting too large, emit immediately
    if (batch.events.length >= this.maxBatchSize) {
      this.flushBatch(key);
      return;
    }
    
    // Set timer to flush batch after interval
    if (!batch.timer) {
      batch.timer = setTimeout(() => {
        this.flushBatch(key);
      }, this.batchInterval);
    }
  }

  /**
   * Flush a batch of events
   */
  private flushBatch(key: string): void {
    const batch = this.eventQueues.get(key);
    if (!batch || batch.events.length === 0) return;
    
    // Clear timer
    if (batch.timer) {
      clearTimeout(batch.timer);
      batch.timer = undefined;
    }
    
    // Get unique events (last occurrence of each event type wins)
    const uniqueEvents = this.deduplicateEvents(batch.events);
    
    logger.debug('Flushing event batch', {
      key,
      originalCount: batch.events.length,
      uniqueCount: uniqueEvents.length
    });
    
    // Clean up
    this.eventQueues.delete(key);
    this.lastEmitTimes.set(key, Date.now());
  }

  /**
   * Deduplicate events in a batch
   * For events with the same imageId, keep only the latest
   */
  private deduplicateEvents(events: ThrottledEvent[]): ThrottledEvent[] {
    const eventMap = new Map<string, ThrottledEvent>();
    
    for (const event of events) {
      const data = event.data as Record<string, unknown>;
      const uniqueKey = data.imageId 
        ? `${event.event}:${data.imageId}`
        : `${event.event}:${JSON.stringify(event.data)}`;
      
      eventMap.set(uniqueKey, event);
    }
    
    return Array.from(eventMap.values());
  }

  /**
   * Clear all pending batches
   */
  clearAll(): void {
    for (const [_key, batch] of this.eventQueues) {
      if (batch.timer) {
        clearTimeout(batch.timer);
      }
    }
    this.eventQueues.clear();
    this.lastEmitTimes.clear();
  }
}

// Create singleton instance
export const socketThrottler = new SocketThrottler();

/**
 * Create a throttled emit function
 */
export function createThrottledEmit(
  emitFn: (event: string, data: unknown) => void,
  roomOrSocket: string
): (event: string, data: unknown) => void {
  return (event: string, data: unknown) => {
    const key = `${roomOrSocket}:${event}`;
    
    socketThrottler.throttle(
      key,
      () => emitFn(event, data),
      event,
      data
    );
  };
}