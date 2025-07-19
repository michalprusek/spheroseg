/**
 * Segmentation Queue Service
 *
 * This module provides a mock implementation of the segmentation queue for testing.
 */

import { EventEmitter } from 'events';

// Define the task interface
export interface SegmentationTask {
  id: string;
  imageId: string;
  imagePath: string;
  parameters: any;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// Mock implementation of the segmentation queue for testing
export class SegmentationQueue extends EventEmitter {
  private queue: SegmentationTask[] = [];
  private processing: SegmentationTask[] = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 2) {
    super();
    this.maxConcurrent = maxConcurrent;
  }

  // Add a task to the queue
  public addTask(
    imageId: string,
    imagePath: string,
    parameters: unknown = {},
    priority: number = 1
  ): string {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const task: SegmentationTask = {
      id: taskId,
      imageId,
      imagePath,
      parameters,
      priority,
      status: 'queued',
      createdAt: new Date(),
    };

    this.queue.push(task);
    this.sortQueue();

    // Emit event
    this.emit('task:added', task);
    this.emit('queue:updated', this.getStatus());

    // Process queue if possible
    this.processQueue();

    return taskId;
  }

  // Get the status of the queue
  public getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing.length,
      maxConcurrent: this.maxConcurrent,
      runningTasks: this.processing.map((task) => task.imageId),
      queuedTasks: this.queue.map((task) => task.imageId),
    };
  }

  // Sort the queue by priority (higher priority first)
  private sortQueue() {
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  // Process the next task in the queue
  private processQueue() {
    // If we're already processing the maximum number of tasks, do nothing
    if (this.processing.length >= this.maxConcurrent) {
      return;
    }

    // If there are no tasks in the queue, do nothing
    if (this.queue.length === 0) {
      return;
    }

    // Get the next task
    const task = this.queue.shift();
    if (!task) {
      return;
    }

    // Update task status
    task.status = 'processing';
    task.startedAt = new Date();

    // Add to processing list
    this.processing.push(task);

    // Emit event
    this.emit('task:processing', task);
    this.emit('queue:updated', this.getStatus());

    // Simulate processing (for testing)
    // Use a shorter timeout for tests
    setTimeout(() => {
      // Remove from processing list
      this.processing = this.processing.filter((t) => t.id !== task.id);

      // Update task status
      task.status = 'completed';
      task.completedAt = new Date();

      // Emit event
      this.emit('task:completed', task);
      this.emit('queue:updated', this.getStatus());

      // Process next task
      this.processQueue();
    }, 100);
  }
}

// Create a singleton instance
const segmentationQueue = new SegmentationQueue();

export default segmentationQueue;
