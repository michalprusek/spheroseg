import { Pool } from 'pg';
import * as fs from 'fs';
import path from 'path';
import { cleanupProjectFiles } from '../fileCleanupService';
import imageUtils from '../../utils/imageUtils.unified';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../utils/imageUtils.unified', () => ({
  dbPathToFilesystemPath: jest.fn((path) => `/mock/upload/dir/${path}`),
  fileExists: jest.fn(),
  deleteFile: jest.fn(),
  getFilesInDirectory: jest.fn(),
}));

jest.mock('fs', () => ({
  rmdirSync: jest.fn(),
  promises: {
    unlink: jest.fn(),
  },
}));

describe('fileCleanupService', () => {
  // Create mock pool with query method
  const mockPool = {
    query: jest.fn(),
  } as unknown as Pool;
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanupProjectFiles', () => {
    it('should clean up all files associated with a project', async () => {
      // Setup mock data
      const projectId = 'test-project-id';
      const mockImages = [
        { id: 'img1', storage_path: 'test-project-id/image1.jpg', thumbnail_path: 'test-project-id/thumb-image1.jpg' },
        { id: 'img2', storage_path: 'test-project-id/image2.jpg', thumbnail_path: 'test-project-id/thumb-image2.jpg' },
      ];
      const mockSegmentation = [
        { 
          image_id: 'img1', 
          mask_path: 'test-project-id/mask1.png', 
          visualization_path: 'test-project-id/viz1.png' 
        },
      ];

      // Mock image query response
      mockPool.query.mockImplementation((query, params) => {
        if (query.includes('FROM images')) {
          return { rows: mockImages };
        } else if (query.includes('FROM segmentation_results')) {
          return { rows: mockSegmentation };
        }
        return { rows: [] };
      });

      // Mock successful file operations
      (imageUtils.fileExists as jest.Mock).mockResolvedValue(true);
      (imageUtils.deleteFile as jest.Mock).mockResolvedValue(undefined);
      (imageUtils.getFilesInDirectory as jest.Mock).mockResolvedValue([
        '/mock/upload/dir/test-project-id/extra-file.txt'
      ]);

      // Execute cleanup
      const result = await cleanupProjectFiles(mockPool, projectId);

      // Verify database queries
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM images'),
        [projectId]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM segmentation_results'),
        [['img1', 'img2']]
      );

      // Verify files deleted
      expect(imageUtils.deleteFile).toHaveBeenCalledTimes(7); // 2 original + 2 thumbnails + 2 segmentation + 1 extra
      expect(fs.rmdirSync).toHaveBeenCalledWith(
        '/mock/upload/dir/test-project-id',
        { recursive: true }
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.deletedFiles.length).toBe(7);
      expect(result.failedFiles.length).toBe(0);
    });

    it('should handle missing files gracefully', async () => {
      // Setup mock data
      const projectId = 'test-project-id';
      const mockImages = [
        { id: 'img1', storage_path: 'test-project-id/image1.jpg', thumbnail_path: null },
      ];

      // Mock image query response
      mockPool.query.mockImplementation((query) => {
        if (query.includes('FROM images')) {
          return { rows: mockImages };
        }
        return { rows: [] };
      });

      // Mock file operations
      (imageUtils.fileExists as jest.Mock).mockResolvedValue(true);
      (imageUtils.deleteFile as jest.Mock).mockRejectedValueOnce(new Error('File not found'));
      (imageUtils.getFilesInDirectory as jest.Mock).mockResolvedValue([]);

      // Execute cleanup
      const result = await cleanupProjectFiles(mockPool, projectId);

      // Verify image deletion attempt
      expect(imageUtils.deleteFile).toHaveBeenCalledWith(
        '/mock/upload/dir/test-project-id/image1.jpg'
      );

      // Verify result includes failed file
      expect(result.success).toBe(false);
      expect(result.failedFiles.length).toBe(1);
      expect(result.failedFiles[0].error).toBe('File not found');
    });

    it('should support dry run mode', async () => {
      // Setup mock data
      const projectId = 'test-project-id';
      const mockImages = [
        { id: 'img1', storage_path: 'test-project-id/image1.jpg', thumbnail_path: 'test-project-id/thumb-image1.jpg' },
      ];

      // Mock image query response
      mockPool.query.mockImplementation((query) => {
        if (query.includes('FROM images')) {
          return { rows: mockImages };
        }
        return { rows: [] };
      });

      // Mock file operations
      (imageUtils.fileExists as jest.Mock).mockResolvedValue(true);

      // Execute cleanup in dry run mode
      const result = await cleanupProjectFiles(mockPool, projectId, { dryRun: true });

      // Verify no actual deletion
      expect(imageUtils.deleteFile).not.toHaveBeenCalled();
      expect(fs.rmdirSync).not.toHaveBeenCalled();

      // Verify result
      expect(result.dryRun).toBe(true);
      expect(result.deletedFiles.length).toBe(2); // These are files that would be deleted
    });
  });
});