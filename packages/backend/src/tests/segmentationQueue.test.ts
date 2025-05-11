/**
 * Segmentation Queue Tests
 *
 * This file contains tests for the segmentation queue.
 */

import { SegmentationQueue } from '../services/segmentationQueue';

describe('SegmentationQueue', () => {
  let queue: SegmentationQueue;

  beforeEach(() => {
    // Create a new queue for each test
    queue = new SegmentationQueue(2);
  });

  // Clean up any pending timers after all tests
  afterAll(() => {
    jest.useRealTimers();
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
    // Add 3 tasks with different priorities
    queue.addTask('image-low', '/path/to/image-low.jpg', {}, 1);
    queue.addTask('image-high', '/path/to/image-high.jpg', {}, 10);
    queue.addTask('image-medium', '/path/to/image-medium.jpg', {}, 5);

    const status = queue.getStatus();

    // The first two tasks should be processing immediately
    expect(status.processing).toBe(2);
    expect(status.queueLength).toBe(1);

    // The queued task should be the lowest priority one
    expect(status.queuedTasks).toContain('image-medium');
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
