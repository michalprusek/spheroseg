import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import axios from 'axios';

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('@/utils/logger');
jest.mock('axios');

// Import the module under test (after mocks are set up)
import projectDuplicationService from '../projectDuplicationService';
const { duplicateProject, duplicateProjectViaApi, generateNewFilePaths, copyImageFiles } =
  projectDuplicationService;

// Setup mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Mock path functions
  (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  (path.dirname as jest.Mock).mockImplementation((filePath: unknown) => {
    const pathStr = String(filePath);
    const parts = pathStr.split('/');
    parts.pop();
    return parts.join('/');
  });

  // Mock fs functions
  (fs.existsSync as jest.Mock).mockReturnValue(true);
  (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
  (fs.copyFileSync as jest.Mock).mockImplementation(() => undefined);

  // Mock axios for API tests
  (axios.get as jest.Mock).mockImplementation((url: unknown) => {
    const urlStr = String(url);
    if (urlStr.includes('/projects/')) {
      return Promise.resolve({
        data: {
          id: 'original-project-id',
          title: 'Original Project',
          description: 'Test project',
        },
      });
    } else if (urlStr.includes('/images')) {
      return Promise.resolve({
        data: [
          {
            id: 'image-1',
            name: 'Test Image 1',
            storage_path: '/uploads/original-project-id/image1.jpg',
            thumbnail_path: '/uploads/original-project-id/thumb-image1.jpg',
            width: 800,
            height: 600,
            metadata: { foo: 'bar' },
            status: 'complete',
            segmentation_status: 'completed',
          },
        ],
      });
    }
    return Promise.resolve({ data: {} });
  });

  (axios.post as jest.Mock).mockImplementation((url: unknown) => {
    const urlStr = String(url);
    if (urlStr.includes('/projects')) {
      return Promise.resolve({
        data: {
          id: 'new-project-id',
          title: 'Original Project (Copy)',
          description: 'Test project',
        },
      });
    } else if (urlStr.includes('/images')) {
      return Promise.resolve({
        data: {
          id: 'new-image-id',
          name: 'Test Image 1 (Copy)',
          storage_path: '/uploads/new-project-id/image1-copy.jpg',
          thumbnail_path: '/uploads/new-project-id/thumb-image1-copy.jpg',
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
});

describe('projectDuplicationService', () => {
  describe('generateNewFilePaths', () => {
    it('should generate new paths with project ID', () => {
      // Mock Date.now and Math.random for predictable test results
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Act
      const result = generateNewFilePaths(
        '/uploads/original-project/image.jpg',
        '/uploads/original-project/thumb-image.jpg',
        'new-project-id'
      );

      // Assert
      expect(result.newStoragePath).toBe('/uploads/new-project-id/image-copy-12345-500000.jpg');
      expect(result.newThumbnailPath).toBe(
        '/uploads/new-project-id/thumb-thumb-image-copy-12345-500000.jpg'
      );

      // Restore spies
      dateSpy.mockRestore();
      randomSpy.mockRestore();
    });

    it('should handle missing thumbnail path', () => {
      // Mock Date.now and Math.random for predictable test results
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Act
      const result = generateNewFilePaths(
        '/uploads/original-project/image.jpg',
        undefined,
        'new-project-id'
      );

      // Assert
      expect(result.newStoragePath).toBe('/uploads/new-project-id/image-copy-12345-500000.jpg');
      expect(result.newThumbnailPath).toBeUndefined();

      // Restore spies
      dateSpy.mockRestore();
      randomSpy.mockRestore();
    });

    it('should handle complex file names with multiple dots', () => {
      // Mock Date.now and Math.random for predictable test results
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Act
      const result = generateNewFilePaths(
        '/uploads/original-project/complex.file.name.jpg',
        '/uploads/original-project/thumb-complex.file.name.jpg',
        'new-project-id'
      );

      // Assert
      expect(result.newStoragePath).toBe(
        '/uploads/new-project-id/complex.file.name-copy-12345-500000.jpg'
      );
      expect(result.newThumbnailPath).toBe(
        '/uploads/new-project-id/thumb-thumb-complex.file.name-copy-12345-500000.jpg'
      );

      // Restore spies
      dateSpy.mockRestore();
      randomSpy.mockRestore();
    });
  });

  describe('copyImageFiles', () => {
    it('should copy files from source to target', async () => {
      // Act
      await copyImageFiles(
        '/uploads/original-project/image.jpg',
        '/uploads/new-project/image-copy.jpg',
        '/base/dir'
      );

      // Assert
      expect(path.join).toHaveBeenCalledWith('/base/dir', 'uploads/original-project/image.jpg');
      expect(path.join).toHaveBeenCalledWith('/base/dir', 'uploads/new-project/image-copy.jpg');
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should create target directory if it does not exist', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockImplementation((path: unknown) => {
        // Return true for source file, false for target directory
        return String(path).includes('original-project');
      });

      // Act
      await copyImageFiles(
        '/uploads/original-project/image.jpg',
        '/uploads/new-project/image-copy.jpg',
        '/base/dir'
      );

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should handle missing source file', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Act
      await copyImageFiles(
        '/uploads/original-project/missing.jpg',
        '/uploads/new-project/missing-copy.jpg',
        '/base/dir'
      );

      // Assert
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should handle file system errors', async () => {
      // Arrange
      (fs.copyFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File system error');
      });

      // Act & Assert
      await expect(
        copyImageFiles(
          '/uploads/original-project/image.jpg',
          '/uploads/new-project/image-copy.jpg',
          '/base/dir'
        )
      ).rejects.toThrow('File system error');
    });
  });

  describe('duplicateProject', () => {
    // Create mock pool and client
    const mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient as PoolClient),
    } as unknown as Pool;

    beforeEach(() => {
      jest.clearAllMocks();

      // Mock client.query for different query patterns
      (mockClient.query as jest.Mock).mockImplementation((query, _params) => {
        if (query.includes('SELECT title, description')) {
          return Promise.resolve({
            rows: [
              {
                title: 'Original Project',
                description: 'Test project',
                thumbnail_url: '/uploads/thumbnail.jpg',
              },
            ],
          });
        } else if (query.includes('INSERT INTO projects')) {
          return Promise.resolve({
            rows: [
              {
                id: 'new-project-id',
                user_id: 'test-user',
                title: 'Original Project (Copy)',
                description: 'Test project',
                thumbnail_url: '/uploads/thumbnail.jpg',
              },
            ],
          });
        } else if (query.includes('SELECT * FROM images')) {
          return Promise.resolve({
            rows: [
              {
                id: 'image-1',
                project_id: 'original-project-id',
                user_id: 'test-user',
                name: 'Test Image',
                storage_path: '/uploads/original-project-id/image.jpg',
                thumbnail_path: '/uploads/original-project-id/thumb-image.jpg',
                width: 800,
                height: 600,
                metadata: { foo: 'bar' },
                status: 'complete',
                segmentation_status: 'completed',
                segmentation_result_path: '/uploads/original-project-id/segmentation-result.json',
              },
            ],
          });
        } else if (query.includes('INSERT INTO images')) {
          return Promise.resolve({
            rows: [
              {
                id: 'new-image-id',
                project_id: 'new-project-id',
                user_id: 'test-user',
                name: 'Test Image (Copy)',
                storage_path: '/uploads/new-project-id/image-copy.jpg',
                thumbnail_path: '/uploads/new-project-id/thumb-image-copy.jpg',
                width: 800,
                height: 600,
                metadata: { foo: 'bar' },
                status: 'pending',
                segmentation_status: 'pending',
              },
            ],
          });
        } else if (query === 'BEGIN') {
          return Promise.resolve({});
        } else if (query === 'COMMIT') {
          return Promise.resolve({});
        } else if (query === 'ROLLBACK') {
          return Promise.resolve({});
        }
        return Promise.resolve({ rows: [] });
      });
    });

    it('should duplicate a project with default options', async () => {
      // Act
      const result = await duplicateProject(mockPool, 'original-project-id', 'test-user');

      // Assert
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT title'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM images'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO images'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();

      expect(result).toEqual({
        id: 'new-project-id',
        user_id: 'test-user',
        title: 'Original Project (Copy)',
        description: 'Test project',
        thumbnail_url: '/uploads/thumbnail.jpg',
      });

      // Verify file operations were performed
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should duplicate a project with custom title', async () => {
      // Act
      const result = await duplicateProject(mockPool, 'original-project-id', 'test-user', {
        newTitle: 'Custom Project Name',
      });

      // Assert
      // Verify correct title was used
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        expect.arrayContaining(['test-user', 'Custom Project Name'])
      );

      expect(result).toEqual(
        expect.objectContaining({
          title: 'Original Project (Copy)', // From mock implementation
        })
      );
    });

    it('should duplicate a project without copying files', async () => {
      // Act
      await duplicateProject(mockPool, 'original-project-id', 'test-user', {
        copyFiles: false,
      });

      // Assert
      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should copy segmentation results when specified', async () => {
      // Arrange
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);

      // Act
      await duplicateProject(mockPool, 'original-project-id', 'test-user', {
        copySegmentations: true,
        resetStatus: false,
      });

      // Assert
      // Verify the segmentation file was copied
      expect(fs.copyFileSync).toHaveBeenCalled();

      // Verify the INSERT INTO images included segmentation data
      const insertImageCalls = (mockClient.query as jest.Mock).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO images')
      );

      expect(insertImageCalls.length).toBe(1);

      // The 10th and 11th parameters should be the segmentation status and result path
      const insertParams = insertImageCalls[0][1];
      expect(insertParams[9]).toBe('completed'); // segmentation_status
      expect(insertParams[10]).toContain('/uploads/new-project-id/segmentation-12345'); // segmentation_result_path

      dateSpy.mockRestore();
    });

    it('should handle database query errors', async () => {
      // Arrange
      (mockClient.query as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      // Act & Assert
      await expect(duplicateProject(mockPool, 'original-project-id', 'test-user')).rejects.toThrow(
        'Database error'
      );

      // Verify transaction was rolled back
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle project not found or access denied', async () => {
      // Arrange
      (mockClient.query as jest.Mock).mockImplementationOnce((query) => {
        if (query.includes('SELECT title')) {
          return Promise.resolve({ rows: [] }); // No project found
        }
        return Promise.resolve({ rows: [] });
      });

      // Act & Assert
      await expect(duplicateProject(mockPool, 'original-project-id', 'test-user')).rejects.toThrow(
        'Original project not found or access denied'
      );

      // Verify transaction was rolled back
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle file system errors during image duplication', async () => {
      // Arrange
      (fs.copyFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File system error');
      });

      // Act & Assert
      await expect(duplicateProject(mockPool, 'original-project-id', 'test-user')).rejects.toThrow(
        'File system error'
      );

      // Verify transaction was rolled back
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('duplicateProjectViaApi', () => {
    it('should duplicate a project via API', async () => {
      // Act
      const result = await duplicateProjectViaApi(
        'https://api.example.com',
        'original-project-id',
        'test-token'
      );

      // Assert
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.example.com/projects/original-project-id',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.example.com/projects',
        expect.objectContaining({
          title: 'Original Project (Copy)',
          description: 'Test project',
        }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.example.com/projects/original-project-id/images',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.example.com/projects/new-project-id/images',
        expect.objectContaining({
          name: 'Test Image 1 (Copy)',
        }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );

      expect(result).toEqual({
        id: 'new-project-id',
        title: 'Original Project (Copy)',
        description: 'Test project',
      });

      // Verify file operations were performed
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should duplicate with custom options', async () => {
      // Act
      await duplicateProjectViaApi('https://api.example.com', 'original-project-id', 'test-token', {
        newTitle: 'Custom API Title',
        copyFiles: false,
        resetStatus: false,
      });

      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.example.com/projects',
        expect.objectContaining({
          title: 'Custom API Title',
        }),
        expect.any(Object)
      );

      // Verify file operations were NOT performed
      expect(fs.copyFileSync).not.toHaveBeenCalled();

      // Verify status is preserved in API request
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/images'),
        expect.objectContaining({
          status: 'complete',
          segmentation_status: 'completed',
        }),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      // Arrange
      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('API error') as Error);

      // Act & Assert
      await expect(
        duplicateProjectViaApi('https://api.example.com', 'original-project-id', 'test-token')
      ).rejects.toThrow('API error');
    });

    it('should handle file system errors during API duplication', async () => {
      // Arrange
      (fs.copyFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File system error during API duplication');
      });

      // Act
      // This should still complete because individual image errors are caught
      const result = await duplicateProjectViaApi(
        'https://api.example.com',
        'original-project-id',
        'test-token'
      );

      // Assert
      expect(result).toEqual({
        id: 'new-project-id',
        title: 'Original Project (Copy)',
        description: 'Test project',
      });
    });

    it('should handle errors creating image records via API', async () => {
      // Arrange
      (axios.post as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/projects') && !url.includes('/images')) {
          return Promise.resolve({
            data: {
              id: 'new-project-id',
              title: 'Original Project (Copy)',
              description: 'Test project',
            },
          });
        } else if (url.includes('/images')) {
          return Promise.reject(new Error('Error creating image') as Error);
        }
        return Promise.resolve({ data: {} });
      });

      // Act
      // This should still complete because individual image errors are caught
      const result = await duplicateProjectViaApi(
        'https://api.example.com',
        'original-project-id',
        'test-token'
      );

      // Assert
      expect(result).toEqual({
        id: 'new-project-id',
        title: 'Original Project (Copy)',
        description: 'Test project',
      });
    });
  });
});
