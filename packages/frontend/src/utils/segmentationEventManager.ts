/**
 * Centralized Segmentation Event Manager
 * 
 * This module provides a centralized way to handle segmentation-related events
 * and prevents duplicate event dispatching that can cause multiple notifications.
 */

import logger from './logger';

interface EventRecord {
  timestamp: number;
  status: string;
}

class SegmentationEventManager {
  private eventHistory: Map<string, EventRecord> = new Map();
  private readonly DEDUPE_WINDOW = 2000; // 2 seconds
  private readonly MAX_HISTORY_SIZE = 1000;

  /**
   * Dispatch a segmentation status update event
   * @param imageId The image ID
   * @param status The segmentation status
   * @param resultPath Optional result path
   * @param error Optional error message
   * @param forceQueueUpdate Whether to force queue update
   * @returns true if event was dispatched, false if it was deduplicated
   */
  dispatchStatusUpdate(
    imageId: string,
    status: string,
    resultPath?: string | null,
    error?: string,
    forceQueueUpdate: boolean = false
  ): boolean {
    const eventKey = `${imageId}-${status}`;
    const currentTime = Date.now();
    
    // Check if this event was recently dispatched
    const lastEvent = this.eventHistory.get(eventKey);
    if (lastEvent && currentTime - lastEvent.timestamp < this.DEDUPE_WINDOW) {
      logger.debug(`Deduplicating event for ${eventKey}`);
      return false;
    }

    // Record this event
    this.eventHistory.set(eventKey, { timestamp: currentTime, status });

    // Clean up old entries if history is too large
    if (this.eventHistory.size > this.MAX_HISTORY_SIZE) {
      this.cleanupOldEvents();
    }

    // Dispatch the event
    try {
      const event = new CustomEvent('image-status-update', {
        detail: {
          imageId,
          status,
          resultPath,
          error,
          forceQueueUpdate,
          timestamp: currentTime,
        },
      });
      window.dispatchEvent(event);
      logger.debug(`Dispatched status update for image ${imageId} with status ${status}`);
      return true;
    } catch (error) {
      logger.error('Failed to dispatch image-status-update event:', error);
      return false;
    }
  }

  /**
   * Clean up events older than the dedupe window
   */
  private cleanupOldEvents(): void {
    const cutoffTime = Date.now() - this.DEDUPE_WINDOW * 2;
    const entriesToDelete: string[] = [];

    for (const [key, record] of this.eventHistory) {
      if (record.timestamp < cutoffTime) {
        entriesToDelete.push(key);
      }
    }

    for (const key of entriesToDelete) {
      this.eventHistory.delete(key);
    }

    logger.debug(`Cleaned up ${entriesToDelete.length} old event records`);
  }

  /**
   * Clear all event history
   */
  clearHistory(): void {
    this.eventHistory.clear();
  }

  /**
   * Get the size of the event history
   */
  getHistorySize(): number {
    return this.eventHistory.size;
  }
}

// Export singleton instance
export const segmentationEventManager = new SegmentationEventManager();

// Export for convenience
export const dispatchSegmentationStatusUpdate = segmentationEventManager.dispatchStatusUpdate.bind(
  segmentationEventManager
);