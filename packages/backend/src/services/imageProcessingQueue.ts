/**
 * Image Processing Queue Service
 * 
 * Manages asynchronous image processing tasks with priority queues,
 * parallel processing, and intelligent task distribution.
 */

import { EventEmitter } from 'events';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';
import imageOptimizer from '../utils/imageOptimizer';
import { v4 as uuidv4 } from 'uuid';

// Task types
export enum TaskType {
  OPTIMIZE = 'optimize',
  THUMBNAIL = 'thumbnail',
  CONVERT = 'convert',
  SEGMENT = 'segment',
}

// Task priorities
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

// Task status
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Task interface
export interface ImageTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  data: Record<string, any>;
  result?: any;
  error?: Error;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retries: number;
  maxRetries: number;
}

// Queue options
interface QueueOptions {
  concurrency?: number;
  maxQueueSize?: number;
  taskTimeout?: number;
  enablePriorityQueue?: boolean;
}

/**
 * Image Processing Queue
 */
export class ImageProcessingQueue extends EventEmitter {
  private tasks: Map<string, ImageTask> = new Map();
  private pendingQueue: ImageTask[] = [];
  private processingTasks: Set<string> = new Set();
  private concurrencyLimit: ReturnType<typeof pLimit>;
  private options: Required<QueueOptions>;
  private isRunning: boolean = false;
  
  constructor(options: QueueOptions = {}) {
    super();
    
    this.options = {
      concurrency: options.concurrency || 4,
      maxQueueSize: options.maxQueueSize || 1000,
      taskTimeout: options.taskTimeout || 300000, // 5 minutes
      enablePriorityQueue: options.enablePriorityQueue !== false,
    };
    
    this.concurrencyLimit = pLimit(this.options.concurrency);
    
    // Start processing
    this.start();
  }
  
  /**
   * Add a task to the queue
   */
  async addTask(
    type: TaskType,
    data: Record<string, any>,
    options: {
      priority?: TaskPriority;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const { priority = TaskPriority.NORMAL, maxRetries = 3 } = options;
    
    // Check queue size
    if (this.pendingQueue.length >= this.options.maxQueueSize) {
      throw new Error('Queue is full');
    }
    
    const task: ImageTask = {
      id: uuidv4(),
      type,
      priority,
      status: TaskStatus.PENDING,
      data,
      createdAt: new Date(),
      retries: 0,
      maxRetries,
    };
    
    this.tasks.set(task.id, task);
    this.pendingQueue.push(task);
    
    // Sort by priority if enabled
    if (this.options.enablePriorityQueue) {
      this.sortQueueByPriority();
    }
    
    this.emit('task:added', task);
    
    // Process queue
    this.processNext();
    
    return task.id;
  }
  
  /**
   * Get task by ID
   */
  getTask(taskId: string): ImageTask | undefined {
    return this.tasks.get(taskId);
  }
  
  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.status === TaskStatus.PENDING) {
      // Remove from pending queue
      const index = this.pendingQueue.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.pendingQueue.splice(index, 1);
      }
      
      task.status = TaskStatus.CANCELLED;
      task.completedAt = new Date();
      this.emit('task:cancelled', task);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get queue statistics
   */
  getStats() {
    const stats = {
      total: this.tasks.size,
      pending: this.pendingQueue.length,
      processing: this.processingTasks.size,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    
    for (const task of this.tasks.values()) {
      switch (task.status) {
        case TaskStatus.COMPLETED:
          stats.completed++;
          break;
        case TaskStatus.FAILED:
          stats.failed++;
          break;
        case TaskStatus.CANCELLED:
          stats.cancelled++;
          break;
      }
    }
    
    return stats;
  }
  
  /**
   * Start processing queue
   */
  start() {
    this.isRunning = true;
    this.processNext();
  }
  
  /**
   * Stop processing queue
   */
  stop() {
    this.isRunning = false;
  }
  
  /**
   * Process next task in queue
   */
  private async processNext() {
    if (!this.isRunning) return;
    if (this.pendingQueue.length === 0) return;
    if (this.processingTasks.size >= this.options.concurrency) return;
    
    const task = this.pendingQueue.shift();
    if (!task) return;
    
    // Add to processing set
    this.processingTasks.add(task.id);
    
    // Process with concurrency limit
    this.concurrencyLimit(async () => {
      await this.processTask(task);
    }).finally(() => {
      this.processingTasks.delete(task.id);
      this.processNext(); // Process next task
    });
    
    // Try to process more tasks if we have capacity
    if (this.processingTasks.size < this.options.concurrency) {
      this.processNext();
    }
  }
  
  /**
   * Process a single task
   */
  private async processTask(task: ImageTask) {
    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    this.emit('task:started', task);
    
    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.options.taskTimeout);
      });
      
      // Process based on task type
      const processPromise = this.executeTask(task);
      
      // Race between process and timeout
      task.result = await Promise.race([processPromise, timeoutPromise]);
      
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      this.emit('task:completed', task);
      
    } catch (error) {
      task.error = error as Error;
      task.retries++;
      
      if (task.retries < task.maxRetries) {
        // Retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, task.retries), 30000);
        logger.warn('Task failed, retrying', {
          taskId: task.id,
          type: task.type,
          retries: task.retries,
          delay,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        setTimeout(() => {
          task.status = TaskStatus.PENDING;
          this.pendingQueue.push(task);
          this.processNext();
        }, delay);
        
      } else {
        task.status = TaskStatus.FAILED;
        task.completedAt = new Date();
        logger.error('Task failed after all retries', {
          taskId: task.id,
          type: task.type,
          retries: task.retries,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.emit('task:failed', task);
      }
    }
  }
  
  /**
   * Execute task based on type
   */
  private async executeTask(task: ImageTask): Promise<any> {
    const { type, data } = task;
    
    switch (type) {
      case TaskType.OPTIMIZE:
        return await imageOptimizer.optimizeForWeb(
          data.sourcePath,
          data.targetPath,
          data.options
        );
        
      case TaskType.THUMBNAIL:
        return await imageOptimizer.generateResponsiveThumbnails(
          data.sourcePath,
          data.outputDir,
          data.options
        );
        
      case TaskType.CONVERT:
        return await imageOptimizer.convertToWebFormat(
          data.sourcePath,
          data.targetDir,
          data.options
        );
        
      case TaskType.SEGMENT:
        // This would call the ML service
        // For now, just return a placeholder
        return { message: 'Segmentation task queued' };
        
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  }
  
  /**
   * Sort queue by priority
   */
  private sortQueueByPriority() {
    this.pendingQueue.sort((a, b) => {
      // Higher priority first
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then by creation time (FIFO)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }
  
  /**
   * Clean up old completed tasks
   */
  cleanupOldTasks(olderThanMs: number = 3600000) {
    const now = Date.now();
    const tasksToDelete: string[] = [];
    
    for (const [id, task] of this.tasks) {
      if (
        task.status === TaskStatus.COMPLETED &&
        task.completedAt &&
        now - task.completedAt.getTime() > olderThanMs
      ) {
        tasksToDelete.push(id);
      }
    }
    
    for (const id of tasksToDelete) {
      this.tasks.delete(id);
    }
    
    logger.debug('Cleaned up old tasks', { count: tasksToDelete.length });
  }
}

// Singleton instance
let queueInstance: ImageProcessingQueue | null = null;

/**
 * Get or create queue instance
 */
export function getImageProcessingQueue(options?: QueueOptions): ImageProcessingQueue {
  if (!queueInstance) {
    queueInstance = new ImageProcessingQueue(options);
    
    // Clean up old tasks periodically
    setInterval(() => {
      queueInstance?.cleanupOldTasks();
    }, 300000); // Every 5 minutes
  }
  
  return queueInstance;
}

export default {
  getImageProcessingQueue,
  TaskType,
  TaskPriority,
  TaskStatus,
};