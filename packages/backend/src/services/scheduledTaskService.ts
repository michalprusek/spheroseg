/**
 * Scheduled Task Service
 *
 * Manages scheduled tasks like file cleanup, storage monitoring, and maintenance
 */

import { Pool } from 'pg';
import cron from 'node-cron';
import logger from '../utils/logger';
import config from '../config';
import fileCleanupService from './fileCleanupService';

interface ScheduledTask {
  name: string;
  schedule: string;
  task: () => Promise<void>;
  running: boolean;
}

class ScheduledTaskService {
  private tasks: Map<string, ScheduledTask> = new Map();
  private dbPool: Pool | null = null;

  /**
   * Initialize the scheduled task service
   */
  initialize(dbPool: Pool): void {
    this.dbPool = dbPool;
    this.setupTasks();
    logger.info('Scheduled task service initialized');
  }

  /**
   * Setup all scheduled tasks
   */
  private setupTasks(): void {
    if (!this.dbPool) {
      logger.error('Database pool not initialized');
      return;
    }

    // File cleanup task
    const cleanupSchedule = `0 */${config.storage.cleanupScheduleHours} * * *`; // Every N hours
    this.addTask('fileCleanup', cleanupSchedule, this.createFileCleanupTask());

    // Storage monitoring task
    this.addTask('storageMonitoring', '0 */1 * * *', this.createStorageMonitoringTask()); // Every hour

    // Database maintenance task
    this.addTask('databaseMaintenance', '0 2 * * 0', this.createDatabaseMaintenanceTask()); // Weekly at 2 AM
  }

  /**
   * Add a scheduled task
   */
  private addTask(name: string, schedule: string, taskFunction: () => Promise<void>): void {
    const task: ScheduledTask = {
      name,
      schedule,
      task: taskFunction,
      running: false,
    };

    this.tasks.set(name, task);

    // Schedule the task
    cron.schedule(schedule, async () => {
      if (task.running) {
        logger.warn(`Skipping ${name} task as it's already running`);
        return;
      }

      task.running = true;
      try {
        logger.info(`Starting scheduled task: ${name}`);
        await task.task();
        logger.info(`Completed scheduled task: ${name}`);
      } catch (error) {
        logger.error(`Error in scheduled task ${name}:`, { error });
      } finally {
        task.running = false;
      }
    });

    logger.info(`Scheduled task '${name}' added with schedule: ${schedule}`);
  }

  /**
   * Create file cleanup task
   */
  private createFileCleanupTask(): () => Promise<void> {
    return async () => {
      if (!this.dbPool) return;

      await fileCleanupService.runScheduledCleanup(this.dbPool, {
        tempFileMaxAgeHours: config.storage.tempFileMaxAgeHours,
        cleanupOrphaned: config.storage.enableOrphanedFileCleanup,
        dryRun: false,
      });
    };
  }

  /**
   * Create storage monitoring task
   */
  private createStorageMonitoringTask(): () => Promise<void> {
    return async () => {
      if (!this.dbPool) return;

      try {
        const storageInfo = await this.getStorageInfo();
        const warningThreshold = config.storage.storageWarningThreshold;
        const usageRatio = storageInfo.usedBytes / storageInfo.totalBytes;

        if (usageRatio > warningThreshold) {
          logger.warn('Storage usage warning', {
            usedBytes: storageInfo.usedBytes,
            totalBytes: storageInfo.totalBytes,
            usagePercentage: Math.round(usageRatio * 100),
            warningThreshold: Math.round(warningThreshold * 100),
          });

          // Trigger aggressive cleanup if storage is critically low
          if (usageRatio > 0.95) {
            logger.warn('Storage critically low, triggering aggressive cleanup');
            await fileCleanupService.runScheduledCleanup(this.dbPool, {
              tempFileMaxAgeHours: 1, // Clean files older than 1 hour
              cleanupOrphaned: true,
              dryRun: false,
            });
          }
        }

        // Log storage statistics
        logger.info('Storage monitoring report', {
          usedBytes: storageInfo.usedBytes,
          totalBytes: storageInfo.totalBytes,
          usagePercentage: Math.round(usageRatio * 100),
          freeBytes: storageInfo.totalBytes - storageInfo.usedBytes,
        });
      } catch (error) {
        logger.error('Error in storage monitoring task:', { error });
      }
    };
  }

  /**
   * Create database maintenance task
   */
  private createDatabaseMaintenanceTask(): () => Promise<void> {
    return async () => {
      if (!this.dbPool) return;

      try {
        logger.info('Starting database maintenance');

        // Analyze tables for better query performance
        await this.dbPool.query('ANALYZE');

        // Vacuum to reclaim space
        await this.dbPool.query('VACUUM');

        logger.info('Database maintenance completed');
      } catch (error) {
        logger.error('Error in database maintenance task:', { error });
      }
    };
  }

  /**
   * Get storage information
   */
  private async getStorageInfo(): Promise<{
    usedBytes: number;
    totalBytes: number;
  }> {
    const fs = require('fs');
    const path = require('path');

    // Calculate used storage
    let usedBytes = 0;
    const uploadDir = config.storage.uploadDir;

    if (fs.existsSync(uploadDir)) {
      usedBytes = await this.getDirectorySize(uploadDir);
    }

    return {
      usedBytes,
      totalBytes: config.storage.maxTotalStorageBytes,
    };
  }

  /**
   * Get directory size recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    const fs = require('fs');
    const path = require('path');
    let totalSize = 0;

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        totalSize += await this.getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  /**
   * Get status of all scheduled tasks
   */
  getTaskStatus(): Array<{
    name: string;
    schedule: string;
    running: boolean;
  }> {
    return Array.from(this.tasks.values()).map((task) => ({
      name: task.name,
      schedule: task.schedule,
      running: task.running,
    }));
  }

  /**
   * Run a specific task manually
   */
  async runTask(taskName: string): Promise<void> {
    const task = this.tasks.get(taskName);

    if (!task) {
      throw new Error(`Task '${taskName}' not found`);
    }

    if (task.running) {
      throw new Error(`Task '${taskName}' is already running`);
    }

    task.running = true;
    try {
      logger.info(`Manually running task: ${taskName}`);
      await task.task();
      logger.info(`Manual task completed: ${taskName}`);
    } finally {
      task.running = false;
    }
  }

  /**
   * Shutdown the scheduled task service
   */
  shutdown(): void {
    logger.info('Shutting down scheduled task service');
    // Note: node-cron tasks will automatically stop when the process exits
  }
}

export default new ScheduledTaskService();
