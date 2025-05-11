/**
 * Simplified Segmentation Queue Tests
 *
 * Tests for the segmentation queue without dependencies
 */

import { EventEmitter } from 'events';

// Create a simplified version of the SegmentationQueue for testing
class MockSegmentationQueue extends EventEmitter {
  private queue: any[] = [];
  private runningTasks: any[] = [];
  private maxConcurrent: number;

  constructor(maxConcurrent = 2) {
    super();
    this.maxConcurrent = maxConcurrent;
  }

  public addTask(imageId: string, imagePath: string, options = {}, priority = 5) {
    const task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      imageId,
      imagePath,
      options,
      priority,
      status: 'queued',
      createdAt: Date.now(),
    };

    this.emit('task:added', task);

    // If we're under the concurrent limit, start processing immediately
    if (this.runningTasks.length < this.maxConcurrent) {
      this.runningTasks.push(task);
      task.status = 'processing';
    } else {
      // Otherwise add to the queue sorted by priority (higher priority first)
      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority);
    }

    // Emit status update
    this.emit('queue:updated', this.getStatus());

    return task.id;
  }

  public getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.runningTasks.length,
      maxConcurrent: this.maxConcurrent,
      runningTasks: this.runningTasks.map((t) => t.imageId),
      queuedTasks: this.queue.map((t) => t.imageId),
    };
  }
}

describe('SegmentationQueue', () => {
  let queue: MockSegmentationQueue;

  beforeEach(() => {
    // Create a new queue for each test
    queue = new MockSegmentationQueue(2);
  });

  it('should initialize with correct settings', () => {
    const status = queue.getStatus();

    expect(status.queueLength).toBe(0);
    expect(status.processing).toBe(0);
    expect(status.maxConcurrent).toBe(2);
    expect(status.runningTasks).toEqual([]);
    expect(status.queuedTasks).toEqual([]);
  });

  it('should add tasks to the queue', () => {
    const taskId = queue.addTask('image-1', '/path/to/image.jpg');

    const status = queue.getStatus();

    // Since the queue processes tasks immediately, the task should be in processing
    expect(status.queueLength).toBe(0);
    expect(status.processing).toBe(1);
    expect(status.runningTasks).toContain('image-1');
    expect(taskId).toBeDefined();
  });

  it('should respect maxConcurrent limit', () => {
    // Add 3 tasks, but maxConcurrent is 2
    queue.addTask('image-1', '/path/to/image1.jpg');
    queue.addTask('image-2', '/path/to/image2.jpg');
    queue.addTask('image-3', '/path/to/image3.jpg');

    const status = queue.getStatus();

    // 2 tasks should be processing, 1 should be queued
    expect(status.processing).toBe(2);
    expect(status.queueLength).toBe(1);
    expect(status.runningTasks).toContain('image-1');
    expect(status.runningTasks).toContain('image-2');
    expect(status.queuedTasks).toContain('image-3');
  });

  it('should prioritize tasks correctly', () => {
    // First fill up the running tasks
    queue.addTask('image-1', '/path/to/image1.jpg');
    queue.addTask('image-2', '/path/to/image2.jpg');

    // Add 3 tasks with different priorities
    queue.addTask('image-low', '/path/to/image-low.jpg', {}, 1);
    queue.addTask('image-high', '/path/to/image-high.jpg', {}, 10);
    queue.addTask('image-medium', '/path/to/image-medium.jpg', {}, 5);

    const status = queue.getStatus();

    // Check the queue order (higher priority first)
    expect(status.queuedTasks[0]).toBe('image-high');
    expect(status.queuedTasks[1]).toBe('image-medium');
    expect(status.queuedTasks[2]).toBe('image-low');
  });

  it('should emit events when tasks are added', (done) => {
    // Listen for the task:added event
    queue.on('task:added', (task) => {
      expect(task.imageId).toBe('image-1');
      expect(task.status).toBe('queued');
      done();
    });

    // Add a task
    queue.addTask('image-1', '/path/to/image.jpg');
  });

  it('should emit events when queue is updated', (done) => {
    // Use once instead of on to ensure the callback is only called once
    queue.once('queue:updated', (status) => {
      expect(status.queueLength).toBeDefined();
      expect(status.processing).toBeDefined();
      done();
    });

    // Add a task
    queue.addTask('image-1', '/path/to/image.jpg');
  });
});
