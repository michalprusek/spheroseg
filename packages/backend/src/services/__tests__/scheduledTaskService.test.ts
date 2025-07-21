/**
 * Tests for ScheduledTaskService
 * 
 * Tests scheduled task management, cron job execution,
 * file cleanup, storage monitoring, and database maintenance
 */

import { ScheduledTaskService } from '../scheduledTaskService';
import { Pool } from 'pg';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('node-cron');
jest.mock('fs');
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../config', () => ({
  default: {
    storage: {
      uploadDir: '/test/uploads',
      tempDir: '/test/temp',
      cleanupScheduleHours: 6,
      maxStoragePerUser: 1024 * 1024 * 1024, // 1GB
      retentionDays: 30
    }
  }
}));

jest.mock('../fileCleanupService', () => ({
  default: {
    cleanupOrphanedFiles: jest.fn().mockResolvedValue({ deletedCount: 5 }),
    cleanupTempFiles: jest.fn().mockResolvedValue({ deletedCount: 3 }),
    cleanupOldFiles: jest.fn().mockResolvedValue({ deletedCount: 2 })
  }
}));

jest.mock('../../jobs/sessionCleanup', () => ({
  startSessionCleanupJob: jest.fn(() => ({
    start: jest.fn()
  })),
  startSessionStatsJob: jest.fn(() => ({
    start: jest.fn()
  }))
}));

// Mock fs
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ScheduledTaskService', () => {
  let scheduledTaskService: ScheduledTaskService;
  let mockPool: jest.Mocked<Pool>;
  let mockLogger: any;
  let cronScheduleMock: jest.Mock;
  let scheduledCallbacks: Map<string, () => Promise<void>>;

  beforeAll(() => {
    jest.useFakeTimers();
    mockLogger = require('../../utils/logger').default;
    
    // Capture cron.schedule callbacks
    scheduledCallbacks = new Map();
    cronScheduleMock = jest.fn((schedule: string, callback: () => Promise<void>) => {
      scheduledCallbacks.set(schedule, callback);
    });
    (cron.schedule as jest.Mock) = cronScheduleMock;
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    scheduledCallbacks.clear();
    
    // Mock pool
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn()
    } as any;
    
    // Mock fs methods
    mockFs.promises = {
      readdir: jest.fn(),
      stat: jest.fn(),
      unlink: jest.fn(),
      access: jest.fn()
    } as any;
    
    mockFs.statSync = jest.fn(() => ({
      size: 1024 * 1024, // 1MB
      isDirectory: jest.fn().mockReturnValue(false),
      isFile: jest.fn().mockReturnValue(true)
    })) as any;
    
    scheduledTaskService = new ScheduledTaskService();
  });

  describe('Initialization', () => {
    it('should initialize with database pool', () => {
      scheduledTaskService.initialize(mockPool);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled task service initialized');
      expect(cronScheduleMock).toHaveBeenCalled();
    });

    it('should setup all scheduled tasks', () => {
      scheduledTaskService.initialize(mockPool);
      
      // Should schedule file cleanup task
      expect(cronScheduleMock).toHaveBeenCalledWith(
        '0 */6 * * *', // Every 6 hours
        expect.any(Function)
      );
      
      // Should schedule storage monitoring task
      expect(cronScheduleMock).toHaveBeenCalledWith(
        '0 */1 * * *', // Every hour
        expect.any(Function)
      );
      
      // Should schedule database maintenance task
      expect(cronScheduleMock).toHaveBeenCalledWith(
        '0 2 * * 0', // Weekly at 2 AM
        expect.any(Function)
      );
    });

    it('should handle missing database pool', () => {
      scheduledTaskService.initialize(null as any);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Database pool not initialized');
      expect(cronScheduleMock).not.toHaveBeenCalled();
    });
  });

  describe('File Cleanup Task', () => {
    beforeEach(() => {
      scheduledTaskService.initialize(mockPool);
    });

    it('should run file cleanup task', async () => {
      const fileCleanupService = require('../fileCleanupService').default;
      
      // Get the file cleanup callback
      const cleanupCallback = scheduledCallbacks.get('0 */6 * * *');
      expect(cleanupCallback).toBeDefined();
      
      // Run the task
      await cleanupCallback!();
      
      expect(fileCleanupService.cleanupOrphanedFiles).toHaveBeenCalled();
      expect(fileCleanupService.cleanupTempFiles).toHaveBeenCalled();
      expect(fileCleanupService.cleanupOldFiles).toHaveBeenCalled();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('File cleanup completed'),
        expect.objectContaining({
          orphaned: 5,
          temp: 3,
          old: 2,
          total: 10
        })
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const fileCleanupService = require('../fileCleanupService').default;
      fileCleanupService.cleanupOrphanedFiles.mockRejectedValueOnce(
        new Error('Cleanup failed')
      );
      
      const cleanupCallback = scheduledCallbacks.get('0 */6 * * *');
      await cleanupCallback!();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in scheduled task fileCleanup:',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Storage Monitoring Task', () => {
    beforeEach(() => {
      scheduledTaskService.initialize(mockPool);
    });

    it('should monitor storage usage', async () => {
      // Mock database response
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { user_id: 'user1', total_size: '524288000' }, // 500MB
          { user_id: 'user2', total_size: '1073741824' } // 1GB (at limit)
        ]
      });
      
      const monitoringCallback = scheduledCallbacks.get('0 */1 * * *');
      await monitoringCallback!();
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SUM(file_size)')
      );
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'User approaching storage limit',
        expect.objectContaining({
          userId: 'user2',
          usage: 1073741824,
          limit: 1073741824,
          percentage: 100
        })
      );
    });

    it('should check total storage usage', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock fs for directory size calculation
      mockFs.promises.readdir = jest.fn().mockResolvedValue(['file1.jpg', 'file2.jpg']);
      mockFs.promises.stat = jest.fn().mockResolvedValue({
        size: 1024 * 1024, // 1MB per file
        isDirectory: () => false,
        isFile: () => true
      });
      
      const monitoringCallback = scheduledCallbacks.get('0 */1 * * *');
      await monitoringCallback!();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Storage monitoring completed',
        expect.objectContaining({
          totalStorageUsed: expect.any(Number),
          uploadDirSize: expect.any(Number),
          tempDirSize: expect.any(Number)
        })
      );
    });
  });

  describe('Database Maintenance Task', () => {
    beforeEach(() => {
      scheduledTaskService.initialize(mockPool);
    });

    it('should perform database maintenance', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      
      const maintenanceCallback = scheduledCallbacks.get('0 2 * * 0');
      await maintenanceCallback!();
      
      // Should run VACUUM ANALYZE
      expect(mockPool.query).toHaveBeenCalledWith('VACUUM ANALYZE images');
      expect(mockPool.query).toHaveBeenCalledWith('VACUUM ANALYZE segmentation_results');
      expect(mockPool.query).toHaveBeenCalledWith('VACUUM ANALYZE cells');
      
      // Should update statistics
      expect(mockPool.query).toHaveBeenCalledWith('ANALYZE');
      
      // Should clean old sessions
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_sessions'),
        expect.any(Array)
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Database maintenance completed'
      );
    });

    it('should handle maintenance errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('VACUUM failed'));
      
      const maintenanceCallback = scheduledCallbacks.get('0 2 * * 0');
      await maintenanceCallback!();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in scheduled task databaseMaintenance:',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Task Management', () => {
    it('should prevent concurrent execution of the same task', async () => {
      scheduledTaskService.initialize(mockPool);
      
      // Create a slow task
      let taskRunning = false;
      const slowTask = jest.fn(async () => {
        taskRunning = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        taskRunning = false;
      });
      
      // Replace the task function
      const task = (scheduledTaskService as any).tasks.get('fileCleanup');
      task.task = slowTask;
      
      const cleanupCallback = scheduledCallbacks.get('0 */6 * * *');
      
      // Start first execution
      const execution1 = cleanupCallback!();
      
      // Try to start second execution while first is running
      await cleanupCallback!();
      
      await execution1;
      
      expect(slowTask).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping fileCleanup task as it\'s already running'
      );
    });

    it('should get task status', () => {
      scheduledTaskService.initialize(mockPool);
      
      const status = scheduledTaskService.getTaskStatus();
      
      expect(status).toHaveLength(3); // 3 tasks
      expect(status[0]).toMatchObject({
        name: 'fileCleanup',
        schedule: '0 */6 * * *',
        running: false
      });
    });

    it('should run task manually', async () => {
      scheduledTaskService.initialize(mockPool);
      const fileCleanupService = require('../fileCleanupService').default;
      
      await scheduledTaskService.runTask('fileCleanup');
      
      expect(fileCleanupService.cleanupOrphanedFiles).toHaveBeenCalled();
    });

    it('should handle manual run of non-existent task', async () => {
      scheduledTaskService.initialize(mockPool);
      
      await expect(
        scheduledTaskService.runTask('nonExistentTask')
      ).rejects.toThrow('Task not found: nonExistentTask');
    });
  });

  describe('Custom Tasks', () => {
    it('should add custom scheduled task', async () => {
      scheduledTaskService.initialize(mockPool);
      
      const customTask = jest.fn().mockResolvedValue(undefined);
      
      scheduledTaskService.addCustomTask(
        'customTask',
        '*/5 * * * *', // Every 5 minutes
        customTask
      );
      
      expect(cronScheduleMock).toHaveBeenCalledWith(
        '*/5 * * * *',
        expect.any(Function)
      );
      
      // Run the custom task
      const customCallback = scheduledCallbacks.get('*/5 * * * *');
      await customCallback!();
      
      expect(customTask).toHaveBeenCalled();
    });

    it('should remove custom task', () => {
      scheduledTaskService.initialize(mockPool);
      
      scheduledTaskService.addCustomTask(
        'customTask',
        '*/5 * * * *',
        jest.fn()
      );
      
      scheduledTaskService.removeTask('customTask');
      
      const status = scheduledTaskService.getTaskStatus();
      const customTask = status.find(t => t.name === 'customTask');
      expect(customTask).toBeUndefined();
    });
  });

  describe('Shutdown', () => {
    it('should stop all tasks on shutdown', () => {
      scheduledTaskService.initialize(mockPool);
      
      scheduledTaskService.shutdown();
      
      const status = scheduledTaskService.getTaskStatus();
      expect(status).toHaveLength(0);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Scheduled task service shut down'
      );
    });
  });
});