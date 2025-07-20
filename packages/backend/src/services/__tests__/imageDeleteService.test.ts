/**
 * Image Delete Service Test Suite
 * 
 * Tests for the image deletion service including:
 * - Single image deletion
 * - Batch deletion
 * - Permission validation
 * - Transaction rollback
 * - File cleanup
 * - Storage quota updates
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { deleteImage, deleteMultipleImages, canDeleteImage } from '../imageDeleteService';
import { ApiError } from '../../utils/ApiError';
import * as db from '../../db';
import * as projectService from '../projectService';
import * as cacheService from '../cacheService';
import * as imageUtils from '../../utils/imageUtils.unified';
import logger from '../../utils/logger';
import fs from 'fs';

// Mock dependencies
vi.mock('../../db');
vi.mock('../projectService');
vi.mock('../cacheService');
vi.mock('../../utils/imageUtils.unified');
vi.mock('../../utils/logger');
vi.mock('fs');
vi.mock('../../config', () => ({
  default: {
    storage: {
      uploadDir: '/test/uploads',
    },
  },
}));

describe('ImageDeleteService', () => {
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    // Setup mock pool and client
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    };

    vi.mocked(db.getPool).mockReturnValue(mockPool as any);

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('deleteImage', () => {
    const mockImageId = 'test-image-123';
    const mockProjectId = 'test-project-456';
    const mockUserId = 'test-user-789';

    beforeEach(() => {
      // Default successful responses
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        id: mockProjectId,
        is_owner: true,
        permission: 'owner',
      } as any);

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('SELECT i.id, i.storage_path')) {
          return {
            rows: [{
              id: mockImageId,
              storage_path: 'projects/test/image.jpg',
              thumbnail_path: 'projects/test/thumb.jpg',
              file_size: '1000000',
            }],
          };
        }
        if (query.includes('information_schema.columns')) {
          return { rows: [{ column_name: 'storage_used_bytes' }] };
        }
        if (query === 'BEGIN' || query === 'COMMIT') {
          return {};
        }
        if (query.includes('DELETE FROM')) {
          return {};
        }
        if (query.includes('UPDATE users')) {
          return {};
        }
        return { rows: [] };
      });

      vi.mocked(imageUtils.dbPathToFilesystemPath).mockImplementation((path) => `/test/uploads/${path}`);
      vi.mocked(imageUtils.deleteFile).mockResolvedValue(undefined);
      vi.mocked(imageUtils.getFilesInDirectory).mockResolvedValue([]);
      vi.mocked(fs.rmdirSync).mockReturnValue(undefined);
      vi.mocked(cacheService.invalidateImageList).mockResolvedValue(undefined);
    });

    it('should delete an image successfully with owner permission', async () => {
      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result).toEqual({
        imageId: mockImageId,
        success: true,
      });

      // Verify transaction flow
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM segmentation_results WHERE image_id = $1',
        [mockImageId]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM images WHERE id = $1',
        [mockImageId]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

      // Verify file deletion
      expect(imageUtils.deleteFile).toHaveBeenCalledTimes(2);
      expect(imageUtils.deleteFile).toHaveBeenCalledWith('/test/uploads/projects/test/image.jpg');
      expect(imageUtils.deleteFile).toHaveBeenCalledWith('/test/uploads/projects/test/thumb.jpg');

      // Verify cache invalidation
      expect(cacheService.invalidateImageList).toHaveBeenCalledWith(mockProjectId);
    });

    it('should delete an image with edit permission', async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        id: mockProjectId,
        is_owner: false,
        permission: 'edit',
      } as any);

      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result.success).toBe(true);
    });

    it('should fail with view-only permission', async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        id: mockProjectId,
        is_owner: false,
        permission: 'view',
      } as any);

      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('should handle project not found', async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue(null);

      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle image not found', async () => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('SELECT i.id, i.storage_path')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should rollback transaction on error', async () => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('DELETE FROM images')) {
          throw new Error('Database error');
        }
        if (query.includes('SELECT i.id, i.storage_path')) {
          return {
            rows: [{
              id: mockImageId,
              storage_path: 'projects/test/image.jpg',
              thumbnail_path: 'projects/test/thumb.jpg',
              file_size: '1000000',
            }],
          };
        }
        return { rows: [] };
      });

      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result.success).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(imageUtils.deleteFile).not.toHaveBeenCalled();
    });

    it('should update user storage quota', async () => {
      await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET storage_used_bytes'),
        ['1000000', mockUserId]
      );
    });

    it('should handle missing storage_used_bytes column gracefully', async () => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('information_schema.columns')) {
          return { rows: [] }; // Column doesn't exist
        }
        if (query.includes('SELECT i.id, i.storage_path')) {
          return {
            rows: [{
              id: mockImageId,
              storage_path: 'projects/test/image.jpg',
              thumbnail_path: 'projects/test/thumb.jpg',
              file_size: '1000000',
            }],
          };
        }
        return { rows: [] };
      });

      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result.success).toBe(true);
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET storage_used_bytes'),
        expect.any(Array)
      );
    });

    it('should continue even if file deletion fails', async () => {
      vi.mocked(imageUtils.deleteFile).mockRejectedValue(new Error('File not found'));

      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Error deleting image file',
        expect.any(Object)
      );
    });

    it('should clean up empty project directory', async () => {
      const result = await deleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result.success).toBe(true);
      expect(imageUtils.getFilesInDirectory).toHaveBeenCalled();
      expect(fs.rmdirSync).toHaveBeenCalled();
    });

    it('should handle project- prefix in projectId', async () => {
      const result = await deleteImage(mockImageId, `project-${mockProjectId}`, mockUserId);

      expect(result.success).toBe(true);
      expect(projectService.getProjectById).toHaveBeenCalledWith(
        mockPool,
        mockProjectId, // Without prefix
        mockUserId
      );
    });
  });

  describe('deleteMultipleImages', () => {
    const mockImageIds = ['image-1', 'image-2', 'image-3'];
    const mockProjectId = 'test-project-456';
    const mockUserId = 'test-user-789';

    beforeEach(() => {
      // Mock successful project access
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        id: mockProjectId,
        is_owner: true,
        permission: 'owner',
      } as any);

      // Mock successful image queries
      mockClient.query.mockImplementation((query: string, params?: any[]) => {
        if (query.includes('SELECT i.id, i.storage_path')) {
          const imageId = params?.[0];
          return {
            rows: [{
              id: imageId,
              storage_path: `projects/test/${imageId}.jpg`,
              thumbnail_path: `projects/test/${imageId}_thumb.jpg`,
              file_size: '1000000',
            }],
          };
        }
        return { rows: [] };
      });

      vi.mocked(imageUtils.deleteFile).mockResolvedValue(undefined);
      vi.mocked(cacheService.invalidateImageList).mockResolvedValue(undefined);
    });

    it('should delete multiple images successfully', async () => {
      const results = await deleteMultipleImages(mockImageIds, mockProjectId, mockUserId);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.map(r => r.imageId)).toEqual(mockImageIds);
    });

    it('should continue processing if one image fails', async () => {
      mockClient.query.mockImplementation((query: string, params?: any[]) => {
        if (query.includes('SELECT i.id, i.storage_path')) {
          const imageId = params?.[0];
          if (imageId === 'image-2') {
            return { rows: [] }; // Image not found
          }
          return {
            rows: [{
              id: imageId,
              storage_path: `projects/test/${imageId}.jpg`,
              thumbnail_path: `projects/test/${imageId}_thumb.jpg`,
              file_size: '1000000',
            }],
          };
        }
        return { rows: [] };
      });

      const results = await deleteMultipleImages(mockImageIds, mockProjectId, mockUserId);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
      expect(results[2].success).toBe(true);
    });
  });

  describe('canDeleteImage', () => {
    const mockImageId = 'test-image-123';
    const mockProjectId = 'test-project-456';
    const mockUserId = 'test-user-789';

    it('should return true if user can delete image', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: mockImageId }],
      });

      const result = await canDeleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN projects p ON i.project_id = p.id'),
        [mockImageId, mockProjectId, mockUserId]
      );
    });

    it('should return false if user cannot delete image', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
      });

      const result = await canDeleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const result = await canDeleteImage(mockImageId, mockProjectId, mockUserId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error checking if image can be deleted',
        expect.any(Object)
      );
    });
  });
});