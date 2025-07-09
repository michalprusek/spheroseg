/**
 * Task Queue Service
 *
 * A generic implementation of a task queue for handling long-running tasks.
 * This implementation uses in-memory queue with configurable concurrency,
 * priorities, timeouts, and retries.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

/**
 * Task state enum
 */
export enum TaskState {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  TimedOut = 'timedout',
}

/**
 * Task executor function type
 */
export type TaskExecutor<T> = (task: Task<T>) => Promise<any>;

/**
 * Task options interface
 */
export interface TaskOptions {
  id?: string;
  priority?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Task interface
 */
export interface Task<T> {
  id: string;
  type: string;
  data: T;
  state: TaskState;
  priority: number;
  timeout: number;
  retries: number;
  retryDelay: number;
  attempts: number;
  error?: Error | null;
  result?: any;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  onProgress?: (progress: number) => void;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Task Queue options interface
 */
export interface TaskQueueOptions {
  maxConcurrent?: number;
  defaultPriority?: number;
  defaultTimeout?: number;
  defaultRetries?: number;
  defaultRetryDelay?: number;
  autoStart?: boolean;
}

/**
 * Task Queue interface
 */
export interface TaskQueue<T = any> extends EventEmitter {
  addTask(type: string, data: T, options?: TaskOptions): Task<T>;
  cancelTask(taskId: string): boolean;
  getTask(taskId: string): Task<T> | undefined;
  getPendingTasks(): Task<T>[];
  getRunningTasks(): Task<T>[];
  registerExecutor(type: string, executor: TaskExecutor<T>): void;
  unregisterExecutor(type: string): void;
  start(): void;
  stop(): void;
  clear(): void;
}

/**
 * Task Queue status interface
 */
export interface TaskQueueStatus {
  queueLength: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  timedOutCount: number;
  isRunning: boolean;
}

/**
 * Creates a new task queue instance
 *
 * @param options Task queue options
 * @returns A new task queue instance
 */
export function createTaskQueue<T = any>(options: TaskQueueOptions = {}): TaskQueue<T> {
  // Default options
  const {
    maxConcurrent = 5,
    defaultPriority = 0,
    defaultTimeout = 60000, // 1 minute
    defaultRetries = 0,
    defaultRetryDelay = 5000, // 5 seconds
    autoStart = true,
  } = options;

  // Queue state
  const queue: Task<T>[] = [];
  const runningTasks: Map<string, Task<T>> = new Map();
  const executors: Map<string, TaskExecutor<T>> = new Map();
  let isRunning = autoStart;
  let completedCount = 0;
  let failedCount = 0;
  let cancelledCount = 0;
  let timedOutCount = 0;

  // Create event emitter
  const emitter = new EventEmitter();

  /**
   * Add a task to the queue
   *
   * @param type Task type
   * @param data Task data
   * @param options Task options
   * @returns The created task
   */
  function addTask(type: string, data: T, options: TaskOptions = {}): Task<T> {
    const {
      id = uuidv4(),
      priority = defaultPriority,
      timeout = defaultTimeout,
      retries = defaultRetries,
      retryDelay = defaultRetryDelay,
    } = options;

    const task: Task<T> = {
      id,
      type,
      data,
      state: TaskState.Pending,
      priority,
      timeout,
      retries,
      retryDelay,
      attempts: 0,
      error: null,
      createdAt: new Date(),
    };

    queue.push(task);

    // Sort the queue by priority (higher priority first)
    queue.sort((a, b) => b.priority - a.priority);

    logger.debug(`Task added to queue: ${id} (${type})`, { taskId: id, type });
    emitter.emit('task:added', task);

    // Emit queue updated event
    emitQueueUpdated();

    // Start processing if running
    if (isRunning) {
      processNextTasks();
    }

    return task;
  }

  /**
   * Cancel a task
   *
   * @param taskId Task ID
   * @returns True if the task was cancelled, false otherwise
   */
  function cancelTask(taskId: string): boolean {
    // Check if task is pending
    const pendingIndex = queue.findIndex((task) => task.id === taskId);
    if (pendingIndex >= 0) {
      const task = queue[pendingIndex];
      task.state = TaskState.Cancelled;
      queue.splice(pendingIndex, 1);
      cancelledCount++;

      logger.debug(`Task cancelled from queue: ${taskId}`, { taskId });
      emitter.emit('task:cancelled', task);
      emitQueueUpdated();
      return true;
    }

    // Check if task is running
    const runningTask = runningTasks.get(taskId);
    if (runningTask) {
      runningTask.state = TaskState.Cancelled;

      // Clear timeout timer if exists
      if (runningTask.timeoutTimer) {
        clearTimeout(runningTask.timeoutTimer);
      }

      runningTasks.delete(taskId);
      cancelledCount++;

      logger.debug(`Running task cancelled: ${taskId}`, { taskId });
      emitter.emit('task:cancelled', runningTask);
      emitQueueUpdated();

      // Start another task if available
      processNextTasks();
      return true;
    }

    return false;
  }

  /**
   * Get a task by ID
   *
   * @param taskId Task ID
   * @returns The task or undefined if not found
   */
  function getTask(taskId: string): Task<T> | undefined {
    // Check running tasks first
    const runningTask = runningTasks.get(taskId);
    if (runningTask) {
      return { ...runningTask };
    }

    // Check pending tasks
    const pendingTask = queue.find((task) => task.id === taskId);
    if (pendingTask) {
      return { ...pendingTask };
    }

    return undefined;
  }

  /**
   * Get all pending tasks
   *
   * @returns Array of pending tasks
   */
  function getPendingTasks(): Task<T>[] {
    return [...queue];
  }

  /**
   * Get all running tasks
   *
   * @returns Array of running tasks
   */
  function getRunningTasks(): Task<T>[] {
    return Array.from(runningTasks.values());
  }

  /**
   * Register a task executor
   *
   * @param type Task type
   * @param executor Executor function
   */
  function registerExecutor(type: string, executor: TaskExecutor<T>): void {
    executors.set(type, executor);
    logger.debug(`Executor registered for task type: ${type}`);
  }

  /**
   * Unregister a task executor
   *
   * @param type Task type
   */
  function unregisterExecutor(type: string): void {
    executors.delete(type);
    logger.debug(`Executor unregistered for task type: ${type}`);
  }

  /**
   * Start the queue processing
   */
  function start(): void {
    if (!isRunning) {
      isRunning = true;
      logger.info('Task queue started');
      emitter.emit('queue:started');
      emitQueueUpdated();
      processNextTasks();
    }
  }

  /**
   * Stop the queue processing
   */
  function stop(): void {
    if (isRunning) {
      isRunning = false;
      logger.info('Task queue stopped');
      emitter.emit('queue:stopped');
      emitQueueUpdated();
    }
  }

  /**
   * Clear all tasks from the queue
   */
  function clear(): void {
    // Cancel all running tasks
    for (const taskId of runningTasks.keys()) {
      cancelTask(taskId);
    }

    // Clear pending queue
    const cancelledTasks = [...queue];
    queue.length = 0;

    // Update counters
    cancelledCount += cancelledTasks.length;

    // Emit events
    cancelledTasks.forEach((task) => {
      task.state = TaskState.Cancelled;
      emitter.emit('task:cancelled', task);
    });

    logger.info(`Task queue cleared, ${cancelledTasks.length} tasks cancelled`);
    emitter.emit('queue:cleared');
    emitQueueUpdated();
  }

  /**
   * Emits the current queue status
   */
  function emitQueueUpdated(): void {
    const status: TaskQueueStatus = {
      queueLength: queue.length,
      runningCount: runningTasks.size,
      completedCount,
      failedCount,
      cancelledCount,
      timedOutCount,
      isRunning,
    };

    emitter.emit('queue:updated', status);
  }

  /**
   * Process the next available tasks
   */
  function processNextTasks(): void {
    if (!isRunning) {
      return;
    }

    // Process tasks while we have capacity and pending tasks
    while (runningTasks.size < maxConcurrent && queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      // Skip cancelled tasks
      if (task.state === TaskState.Cancelled) {
        continue;
      }

      // Start the task
      startTask(task);
    }
  }

  /**
   * Start a task
   *
   * @param task The task to start
   */
  function startTask(task: Task<T>): void {
    // Get the executor for this task type
    const executor = executors.get(task.type);
    if (!executor) {
      logger.error(`No executor found for task type: ${task.type}`, {
        taskId: task.id,
      });
      task.state = TaskState.Failed;
      task.error = new Error(`No executor found for task type: ${task.type}`);
      failedCount++;
      emitter.emit('task:failed', task);
      emitQueueUpdated();
      return;
    }

    // Update task state
    task.state = TaskState.Running;
    task.attempts++;
    task.startedAt = new Date();

    // Add task to running tasks
    runningTasks.set(task.id, task);

    // Set timeout timer
    if (task.timeout > 0) {
      task.timeoutTimer = setTimeout(() => {
        handleTaskTimeout(task);
      }, task.timeout);
    }

    logger.debug(`Task started: ${task.id} (${task.type})`, {
      taskId: task.id,
      type: task.type,
    });
    emitter.emit('task:started', task);
    emitQueueUpdated();

    // Execute the task
    executor(task)
      .then((result) => {
        handleTaskCompleted(task, result);
      })
      .catch((error) => {
        handleTaskFailed(task, error);
      });
  }

  /**
   * Handle task completion
   *
   * @param task The completed task
   * @param result The task result
   */
  function handleTaskCompleted(task: Task<T>, result: any): void {
    // Clear timeout timer if exists
    if (task.timeoutTimer) {
      clearTimeout(task.timeoutTimer);
    }

    // Update task state
    task.state = TaskState.Completed;
    task.result = result;
    task.completedAt = new Date();

    // Remove from running tasks
    runningTasks.delete(task.id);

    // Update counter
    completedCount++;

    logger.debug(`Task completed: ${task.id} (${task.type})`, {
      taskId: task.id,
      type: task.type,
    });
    emitter.emit('task:completed', task, result);

    // Call onComplete callback if defined
    if (task.onComplete) {
      try {
        task.onComplete(result);
      } catch (error) {
        logger.error('Error in task onComplete callback', {
          error,
          taskId: task.id,
        });
      }
    }

    emitQueueUpdated();

    // Process next tasks
    processNextTasks();
  }

  /**
   * Handle task failure
   *
   * @param task The failed task
   * @param error The error that occurred
   */
  function handleTaskFailed(task: Task<T>, error: Error): void {
    // Clear timeout timer if exists
    if (task.timeoutTimer) {
      clearTimeout(task.timeoutTimer);
    }

    // Check if we should retry
    if (task.attempts < task.retries + 1) {
      logger.debug(`Task failed, retrying (${task.attempts}/${task.retries + 1}): ${task.id}`, {
        taskId: task.id,
        error: error.message,
        attempts: task.attempts,
        maxRetries: task.retries + 1,
      });

      // Remove from running tasks
      runningTasks.delete(task.id);

      // Reset state for retry
      task.state = TaskState.Pending;

      // Re-queue with delay
      setTimeout(() => {
        queue.push(task);
        queue.sort((a, b) => b.priority - a.priority);

        emitter.emit('task:retrying', task);
        emitQueueUpdated();

        // Process next tasks
        processNextTasks();
      }, task.retryDelay);

      return;
    }

    // Update task state
    task.state = TaskState.Failed;
    task.error = error;
    task.completedAt = new Date();

    // Remove from running tasks
    runningTasks.delete(task.id);

    // Update counter
    failedCount++;

    logger.error(`Task failed: ${task.id} (${task.type})`, {
      taskId: task.id,
      type: task.type,
      error: error.message,
    });

    emitter.emit('task:failed', task, error);

    // Call onError callback if defined
    if (task.onError) {
      try {
        task.onError(error);
      } catch (callbackError) {
        logger.error('Error in task onError callback', {
          error: callbackError,
          taskId: task.id,
        });
      }
    }

    emitQueueUpdated();

    // Process next tasks
    processNextTasks();
  }

  /**
   * Handle task timeout
   *
   * @param task The timed out task
   */
  function handleTaskTimeout(task: Task<T>): void {
    // Create timeout error
    const timeoutError = new Error(`Task timed out after ${task.timeout}ms`);

    // Update task state
    task.state = TaskState.TimedOut;
    task.error = timeoutError;
    task.completedAt = new Date();

    // Remove from running tasks
    runningTasks.delete(task.id);

    // Update counter
    timedOutCount++;

    logger.warn(`Task timed out: ${task.id} (${task.type})`, {
      taskId: task.id,
      type: task.type,
      timeout: task.timeout,
    });

    emitter.emit('task:timeout', task);

    // Call onError callback if defined
    if (task.onError) {
      try {
        task.onError(timeoutError);
      } catch (callbackError) {
        logger.error('Error in task onError callback', {
          error: callbackError,
          taskId: task.id,
        });
      }
    }

    emitQueueUpdated();

    // Process next tasks
    processNextTasks();
  }

  // Return the public API
  return Object.assign(emitter, {
    addTask,
    cancelTask,
    getTask,
    getPendingTasks,
    getRunningTasks,
    registerExecutor,
    unregisterExecutor,
    start,
    stop,
    clear,
  });
}

export default {
  createTaskQueue,
  TaskState,
};
