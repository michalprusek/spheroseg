import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { ChildProcess, spawn } from 'child_process';
import EventEmitter from 'events';
import { TaskQueue, Task } from '../taskQueueService';
import config from '../../config';

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('child_process');
jest.mock('../../db');
jest.mock('../../socket');
jest.mock('../../utils/logger');
jest.mock('node-fetch');
jest.mock('../taskQueueService');

// Import mocked modules to use in tests
import pool from '../../db';
import { getIO } from '../../socket';
import logger from '../../utils/logger';
import fetch from 'node-fetch';

// Import module under test (after all mocks)
import {
  triggerSegmentationTask,
  getSegmentationQueueStatus,
  cancelSegmentationTask,
  setupSegmentationQueue,
} from '../segmentationQueueService';

// Create mock task queue for testing
class MockTaskQueue extends EventEmitter {
  constructor() {
    super();
    this.registerExecutor = jest.fn();
    this.addTask = jest.fn().mockReturnValue('mock-task-id');
    this.cancelTask = jest.fn().mockReturnValue(true);
    this.getStatus = jest.fn().mockReturnValue({
      queueLength: 0,
      runningCount: 0,
      maxConcurrent: 2,
      runningTasks: [],
      queuedTasks: []
    });
  }

  registerExecutor = jest.fn();
  addTask = jest.fn();
  cancelTask = jest.fn();
  getStatus = jest.fn();
}

// Setup mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Mock path functions
  (path.resolve as jest.Mock).mockImplementation((...args) => args.join('/'));
  (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  (path.basename as jest.Mock).mockImplementation((filePath: string) => filePath.split('/').pop());
  (path.relative as jest.Mock).mockImplementation((from: string, to: string) => to.replace(from + '/', ''));
  
  // Mock fs functions
  (fs.existsSync as jest.Mock).mockReturnValue(true);
  (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
  (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ 
    polygons: [{ id: 'poly1', points: [[1, 1], [2, 2], [3, 3]] }] 
  }));
  
  // Mock spawn
  const mockChildProcess = new EventEmitter() as ChildProcess;
  mockChildProcess.stdout = new EventEmitter() as any;
  mockChildProcess.stderr = new EventEmitter() as any;
  (spawn as jest.Mock).mockReturnValue(mockChildProcess);
  
  // Mock database
  (pool.query as jest.Mock).mockImplementation((query: string, params: any[]) => {
    if (query.includes('UPDATE segmentation_results')) {
      return Promise.resolve({ rowCount: 1 });
    }
    if (query.includes('UPDATE images')) {
      return Promise.resolve({ rowCount: 1 });
    }
    if (query.includes('SELECT user_id FROM images')) {
      return Promise.resolve({ rows: [{ user_id: 'mock-user-id' }] });
    }
    if (query.includes('SELECT id, name, project_id FROM images')) {
      return Promise.resolve({ 
        rows: [{ id: 'image-id', name: 'test-image.jpg', project_id: 'project-id' }] 
      });
    }
    if (query.includes('SELECT storage_path FROM images')) {
      return Promise.resolve({ rows: [{ storage_path: '/uploads/test-image.jpg' }] });
    }
    return Promise.resolve({ rows: [] });
  });
  
  // Mock socket.io
  const mockIO = {
    to: jest.fn().mockReturnValue({
      emit: jest.fn()
    }),
    emit: jest.fn()
  };
  (getIO as jest.Mock).mockReturnValue(mockIO);
  
  // Mock node-fetch
  (fetch as unknown as jest.Mock).mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ status: 'ok' }) as jest.MockedFunction<() => Promise<any>>
  } as Response);

  // Mock TaskQueue
  const mockQueue = new MockTaskQueue();
  (TaskQueue as unknown as jest.Mock).mockImplementation(() => mockQueue);
});

describe('segmentationQueueService', () => {
  describe('triggerSegmentationTask', () => {
    it('should add a task to the queue with correct parameters', async () => {
      // Arrange
      const imageId = 'test-image-id';
      const imagePath = '/uploads/test-image.jpg';
      const parameters = { threshold: 0.5 };
      const priority = 2;
      
      // Act
      const result = await triggerSegmentationTask(imageId, imagePath, parameters, priority);
      
      // Assert
      expect(result).toBe('mock-task-id');
      const mockQueue = new TaskQueue() as any;
      expect(mockQueue.addTask).toHaveBeenCalledWith(
        'segmentation',
        {
          imageId,
          imagePath,
          parameters
        },
        {
          id: imageId,
          priority,
          forceRequeue: false
        }
      );
    });
    
    it('should handle force resegmentation correctly', async () => {
      // Arrange
      const imageId = 'test-image-id';
      const imagePath = '/uploads/test-image.jpg';
      const parameters = { force_resegment: true };
      
      // Act
      await triggerSegmentationTask(imageId, imagePath, parameters);
      
      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
        ['processing', null, imageId]
      );
      
      const mockQueue = new TaskQueue() as any;
      expect(mockQueue.addTask).toHaveBeenCalledWith(
        'segmentation',
        {
          imageId,
          imagePath,
          parameters
        },
        {
          id: imageId,
          priority: 1,
          forceRequeue: true
        }
      );
    });
    
    it('should handle errors when adding task to queue', async () => {
      // Arrange
      const mockQueue = new TaskQueue() as any;
      mockQueue.addTask.mockImplementation(() => {
        throw new Error('Queue error');
      });
      
      const imageId = 'test-image-id';
      const imagePath = '/uploads/test-image.jpg';
      
      // Act & Assert
      await expect(triggerSegmentationTask(imageId, imagePath, {}))
        .rejects.toThrow('Queue error');
        
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('getSegmentationQueueStatus', () => {
    it('should return queue status with image details for running tasks', async () => {
      // Arrange
      const mockQueue = new TaskQueue() as any;
      mockQueue.getStatus.mockReturnValue({
        queueLength: 1,
        runningCount: 1,
        maxConcurrent: 2,
        runningTasks: ['image-id'],
        queuedTasks: ['queued-id']
      });
      
      // Act
      const result = await getSegmentationQueueStatus();
      
      // Assert
      expect(result).toEqual({
        queueLength: 1,
        runningCount: 1,
        maxConcurrent: 2,
        runningTasks: ['image-id'],
        queuedTasks: ['queued-id'],
        processingImages: [
          {
            id: 'image-id',
            name: 'test-image.jpg',
            projectId: 'project-id'
          }
        ]
      });
      
      expect(pool.query).toHaveBeenCalledWith(
        `SELECT id, name, project_id FROM images WHERE id = ANY($1::uuid[])`,
        [['image-id']]
      );
    });
    
    it('should return basic status when no running tasks', async () => {
      // Arrange
      const mockQueue = new TaskQueue() as any;
      mockQueue.getStatus.mockReturnValue({
        queueLength: 1,
        runningCount: 0,
        maxConcurrent: 2,
        runningTasks: [],
        queuedTasks: ['queued-id']
      });
      
      // Act
      const result = await getSegmentationQueueStatus();
      
      // Assert
      expect(result).toEqual({
        queueLength: 1,
        runningCount: 0,
        maxConcurrent: 2,
        runningTasks: [],
        queuedTasks: ['queued-id']
      });
      
      expect(pool.query).not.toHaveBeenCalled();
    });
    
    it('should handle database errors gracefully', async () => {
      // Arrange
      const mockQueue = new TaskQueue() as any;
      mockQueue.getStatus.mockReturnValue({
        queueLength: 1,
        runningCount: 1,
        maxConcurrent: 2,
        runningTasks: ['image-id'],
        queuedTasks: ['queued-id']
      });
      
      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error') as Error);
      
      // Act
      const result = await getSegmentationQueueStatus();
      
      // Assert
      expect(result).toEqual({
        queueLength: 1,
        runningCount: 1,
        maxConcurrent: 2,
        runningTasks: ['image-id'],
        queuedTasks: ['queued-id']
      });
      
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('cancelSegmentationTask', () => {
    it('should cancel a task in the queue', () => {
      // Arrange
      const imageId = 'test-image-id';
      
      // Act
      const result = cancelSegmentationTask(imageId);
      
      // Assert
      expect(result).toBe(true);
      const mockQueue = new TaskQueue() as any;
      expect(mockQueue.cancelTask).toHaveBeenCalledWith(imageId);
    });
  });
  
  describe('executeSegmentationTask', () => {
    // Get a reference to the executeSegmentationTask function
    let executeSegmentationTask: (task: Task<any>) => Promise<void>;
    
    beforeEach(() => {
      // Extract executeSegmentationTask from registerExecutor mock calls
      const mockQueue = new TaskQueue() as any;
      
      // Call setupSegmentationQueue to trigger registration
      setupSegmentationQueue();
      
      // Extract the callback from the registerExecutor call
      const calls = mockQueue.registerExecutor.mock.calls;
      executeSegmentationTask = calls[0][1];
    });
    
    it('should execute segmentation task successfully', async () => {
      // Arrange
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: { threshold: 0.5 }
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      const mockChildProcess = spawn('python', []) as any;
      
      // Act
      const promise = executeSegmentationTask(task);
      
      // Simulate successful process
      mockChildProcess.stdout.emit('data', 'Processing image');
      mockChildProcess.stderr.emit('data', 'Warning: Using default parameters');
      mockChildProcess.emit('close', 0);
      
      await promise;
      
      // Assert
      expect(spawn).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledWith(
        `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
        expect.any(Array)
      );
      
      // Verify socket notification
      const mockIO = getIO();
      expect(mockIO.to).toHaveBeenCalledWith('mock-user-id');
      expect(mockIO.to('mock-user-id').emit).toHaveBeenCalledWith(
        'segmentation_update',
        expect.objectContaining({
          imageId: 'test-image-id',
          status: 'completed'
        })
      );
    });
    
    it('should handle process error', async () => {
      // Arrange
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {}
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      const mockChildProcess = spawn('python', []) as any;
      
      // Act
      const promise = executeSegmentationTask(task);
      
      // Simulate error
      mockChildProcess.emit('error', new Error('Process error'));
      
      try {
        await promise;
        fail('Promise should have been rejected');
      } catch (error) {
        // Assert
        expect(pool.query).toHaveBeenCalledWith(
          `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
          ['failed', null, 'test-image-id']
        );
        
        // Verify socket notification
        const mockIO = getIO();
        expect(mockIO.to).toHaveBeenCalledWith('mock-user-id');
        expect(mockIO.to('mock-user-id').emit).toHaveBeenCalledWith(
          'segmentation_update',
          expect.objectContaining({
            imageId: 'test-image-id',
            status: 'failed',
            error: 'Failed to start script: Process error'
          })
        );
      }
    });
    
    it('should handle non-zero exit code', async () => {
      // Arrange
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {}
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      const mockChildProcess = spawn('python', []) as any;
      
      // Act
      const promise = executeSegmentationTask(task);
      
      // Simulate error exit code
      mockChildProcess.stderr.emit('data', 'Error in segmentation');
      mockChildProcess.emit('close', 1);
      
      try {
        await promise;
        fail('Promise should have been rejected');
      } catch (error) {
        // Assert
        expect(pool.query).toHaveBeenCalledWith(
          `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
          ['failed', null, 'test-image-id']
        );
        
        // Verify error message contains stderr output
        const mockIO = getIO();
        expect(mockIO.to('mock-user-id').emit).toHaveBeenCalledWith(
          'segmentation_update',
          expect.objectContaining({
            error: expect.stringContaining('Error in segmentation')
          })
        );
      }
    });
    
    it('should handle missing image file', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        // Return true for all paths except the image path
        return !path.includes('test-image.jpg');
      });
      
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {}
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      // Act
      try {
        await executeSegmentationTask(task);
        fail('Promise should have been rejected');
      } catch (error: any) {
        // Assert
        expect(error.message).toContain('Image file not found');
        expect(pool.query).toHaveBeenCalledWith(
          `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
          ['failed', null, 'test-image-id']
        );
      }
    });
    
    it('should handle JSON parsing errors', async () => {
      // Arrange
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {}
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      // Mock readFileSync to return invalid JSON
      (fs.readFileSync as jest.Mock).mockReturnValueOnce('invalid json');
      
      const mockChildProcess = spawn('python', []) as any;
      
      // Act
      const promise = executeSegmentationTask(task);
      
      // Simulate successful process completion
      mockChildProcess.emit('close', 0);
      
      try {
        await promise;
        fail('Promise should have been rejected');
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(SyntaxError);
        expect(pool.query).toHaveBeenCalledWith(
          `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
          ['failed', null, 'test-image-id']
        );
        
        // Verify error message contains syntax error
        const mockIO = getIO();
        expect(mockIO.to('mock-user-id').emit).toHaveBeenCalledWith(
          'segmentation_update',
          expect.objectContaining({
            error: expect.stringContaining('SyntaxError')
          })
        );
      }
    });
    
    it('should pass parameters correctly to Python script', async () => {
      // Arrange
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {
            threshold: 0.7,
            model_type: 'custom',
            smoothing: true,
            maxPolygons: 10
          }
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      const mockChildProcess = spawn('python', []) as any;
      
      // Act
      const promise = executeSegmentationTask(task);
      mockChildProcess.emit('close', 0);
      await promise;
      
      // Assert
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String), // script path
          '--image_path', expect.any(String),
          '--output_path', expect.any(String),
          '--checkpoint_path', expect.any(String),
          '--output_dir', expect.any(String),
          '--model_type', 'custom',
          '--threshold', '0.7',
          '--smoothing', 'true',
          '--max_polygons', '10'
        ])
      );
    });
  });
  
  describe('setupSegmentationQueue', () => {
    it('should setup queue successfully', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      // Act
      const result = await setupSegmentationQueue();
      
      // Assert
      expect(result).toBe(true);
      const mockQueue = new TaskQueue() as any;
      expect(mockQueue.registerExecutor).toHaveBeenCalledWith(
        'segmentation',
        expect.any(Function)
      );
      expect(logger.info).toHaveBeenCalledWith('Segmentation queue setup complete');
    });
    
    it('should fail if script does not exist', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return !path.includes('resunet_segmentation.py');
      });
      
      // Act
      const result = await setupSegmentationQueue();
      
      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Segmentation script not found')
      );
    });
    
    it('should fail if checkpoint does not exist', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return !path.includes('checkpoint_epoch_9.pth.tar');
      });
      
      // Act
      const result = await setupSegmentationQueue();
      
      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint not found')
      );
    });
    
    it('should check ML service health if URL is provided', async () => {
      // Arrange
      process.env.ML_SERVICE_URL = 'http://ml-service:5000';
      
      // Act
      await setupSegmentationQueue();
      
      // Assert
      expect(fetch).toHaveBeenCalledWith('http://ml-service:5000/health');
      
      // Cleanup
      delete process.env.ML_SERVICE_URL;
    });
    
    it('should fail if ML service health check fails', async () => {
      // Arrange
      process.env.ML_SERVICE_URL = 'http://ml-service:5000';
      (fetch as unknown as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);
      
      // Act
      const result = await setupSegmentationQueue();
      
      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('ML service health check failed')
      );
      
      // Cleanup
      delete process.env.ML_SERVICE_URL;
    });
    
    it('should handle errors during setup', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('File system error');
      });
      
      // Act
      const result = await setupSegmentationQueue();
      
      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error setting up segmentation queue:',
        expect.objectContaining({
          error: 'File system error'
        })
      );
    });
  });
  
  describe('updateSegmentationStatus', () => {
    // Get a reference to the updateSegmentationStatus function
    let updateSegmentationStatus: Function;
    
    beforeEach(() => {
      // Extract updateSegmentationStatus using a workaround
      // Since it's a private function, we need to monkey-patch the module
      const mockTask = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {}
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      // Add a proxy method to access the private function
      const service = require('../segmentationQueueService');
      updateSegmentationStatus = service.__test_only_updateSegmentationStatus ||
        service.__test_updateSegmentationStatus ||
        service.updateSegmentationStatus;
      
      // If still not available, use the actual function from the service by calling 
      // a public API method like setupSegmentationQueue() that internally calls it
      if (!updateSegmentationStatus) {
        // As a fallback, we'll use executeSegmentationTask to indirectly test updateSegmentationStatus
        const mockQueue = new TaskQueue() as any;
        setupSegmentationQueue();
        const calls = mockQueue.registerExecutor.mock.calls;
        const executeSegmentationTask = calls[0][1];
        
        // Now executeSegmentationTask is available, we can proceed with tests
        // using it as a proxy to updateSegmentationStatus
      }
    });
    
    it('should update status and notify client', async () => {
      // If updateSegmentationStatus is not directly accessible,
      // test it indirectly through executeSegmentationTask
      
      // Arrange
      const mockQueue = new TaskQueue() as any;
      setupSegmentationQueue();
      const calls = mockQueue.registerExecutor.mock.calls;
      const executeSegmentationTask = calls[0][1];
      
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {}
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      const mockChildProcess = spawn('python', []) as any;
      
      // Act - this will indirectly call updateSegmentationStatus
      const promise = executeSegmentationTask(task);
      mockChildProcess.emit('close', 0);
      
      await promise;
      
      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
        ['completed', expect.any(Object), 'test-image-id']
      );
      
      expect(pool.query).toHaveBeenCalledWith(
        `UPDATE images SET status = $1, updated_at = NOW() WHERE id = $2`,
        ['completed', 'test-image-id']
      );
      
      const mockIO = getIO();
      expect(mockIO.to).toHaveBeenCalledWith('mock-user-id');
      expect(mockIO.to('mock-user-id').emit).toHaveBeenCalledWith(
        'segmentation_update',
        expect.objectContaining({
          imageId: 'test-image-id',
          status: 'completed'
        })
      );
    });
    
    it('should handle database errors', async () => {
      // Arrange
      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error') as Error);
      
      const mockQueue = new TaskQueue() as any;
      setupSegmentationQueue();
      const calls = mockQueue.registerExecutor.mock.calls;
      const executeSegmentationTask = calls[0][1];
      
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {}
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      const mockChildProcess = spawn('python', []) as any;
      
      // Act
      const promise = executeSegmentationTask(task);
      mockChildProcess.emit('close', 0);
      
      await promise;
      
      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database error'),
        expect.anything()
      );
    });
    
    it('should handle socket notification errors', async () => {
      // Arrange
      const mockIO = getIO() as any;
      mockIO.to.mockImplementation(() => {
        throw new Error('Socket error');
      });
      
      const mockQueue = new TaskQueue() as any;
      setupSegmentationQueue();
      const calls = mockQueue.registerExecutor.mock.calls;
      const executeSegmentationTask = calls[0][1];
      
      const task = {
        id: 'test-task-id',
        type: 'segmentation',
        data: {
          imageId: 'test-image-id',
          imagePath: '/uploads/test-image.jpg',
          parameters: {}
        },
        priority: 1,
        status: 'processing' as const,
        addedAt: new Date()
      };
      
      const mockChildProcess = spawn('python', []) as any;
      
      // Act
      const promise = executeSegmentationTask(task);
      mockChildProcess.emit('close', 0);
      
      await promise;
      
      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending socket notification'),
        expect.anything()
      );
    });
  });
});