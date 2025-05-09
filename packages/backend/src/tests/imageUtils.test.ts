import { formatImagePaths, dbPathToFilesystemPath, normalizePathForDb, verifyImageFiles, ImageData } from '../utils/imageUtils';
import path from 'path';

describe('imageUtils', () => {
  describe('formatImagePaths', () => {
    it('should add full URLs to relative paths', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const origin = 'http://localhost:3000';
      const result = formatImagePaths(image, origin);

      expect(result.storage_path_full).toBe('http://localhost:3000/uploads/test-project/test-image.jpg');
      expect(result.thumbnail_path_full).toBe('http://localhost:3000/uploads/test-project/thumb-test-image.jpg');
      expect(result.src).toBe('http://localhost:3000/uploads/test-project/test-image.jpg');
    });

    it('should not modify absolute URLs', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: 'http://example.com/test-image.jpg',
        thumbnail_path: 'http://example.com/thumb-test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const origin = 'http://localhost:3000';
      const result = formatImagePaths(image, origin);

      expect(result.storage_path_full).toBeUndefined();
      expect(result.thumbnail_path_full).toBeUndefined();
      expect(result.src).toBeUndefined();
    });

    it('should handle missing thumbnail path', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const origin = 'http://localhost:3000';
      const result = formatImagePaths(image, origin);

      expect(result.storage_path_full).toBe('http://localhost:3000/uploads/test-project/test-image.jpg');
      expect(result.thumbnail_path_full).toBeUndefined();
      expect(result.src).toBe('http://localhost:3000/uploads/test-project/test-image.jpg');
    });
  });

  describe('dbPathToFilesystemPath', () => {
    const uploadDir = '/app/uploads';

    it('should convert database path to filesystem path', () => {
      const dbPath = '/uploads/test-project/test-image.jpg';
      const result = dbPathToFilesystemPath(dbPath, uploadDir);

      // The function should join the upload directory with the path after removing the /uploads prefix
      expect(result).toBe(path.join(uploadDir, 'test-project/test-image.jpg'));
    });

    it('should handle paths without /uploads prefix', () => {
      const dbPath = 'test-project/test-image.jpg';
      const result = dbPathToFilesystemPath(dbPath, uploadDir);

      expect(result).toBe(path.join(uploadDir, 'test-project/test-image.jpg'));
    });

    it('should return absolute paths as-is', () => {
      const absolutePath = '/absolute/path/to/image.jpg';
      const result = dbPathToFilesystemPath(absolutePath, uploadDir);

      expect(result).toBe(absolutePath);
    });

    it('should handle paths that already include the upload directory', () => {
      const dbPath = '/app/uploads/test-project/test-image.jpg';
      const result = dbPathToFilesystemPath(dbPath, uploadDir);

      expect(result).toBe(dbPath);
    });

    it('should throw an error for empty paths', () => {
      expect(() => dbPathToFilesystemPath('', uploadDir)).toThrow('Invalid database path');
    });
  });

  describe('normalizePathForDb', () => {
    const uploadDir = '/app/uploads';

    it('should convert absolute filesystem path to database path', () => {
      const absolutePath = '/app/uploads/test-project/test-image.jpg';
      const result = normalizePathForDb(absolutePath, uploadDir);

      expect(result).toBe('/uploads/test-project/test-image.jpg');
    });

    it('should handle paths with backslashes', () => {
      const absolutePath = '/app/uploads\\test-project\\test-image.jpg';
      const result = normalizePathForDb(absolutePath, uploadDir);

      expect(result).toBe('/uploads/test-project/test-image.jpg');
    });

    it('should handle paths outside the upload directory', () => {
      const absolutePath = '/var/tmp/test-image.jpg';
      const result = normalizePathForDb(absolutePath, uploadDir);

      expect(result).toBe('/var/tmp/test-image.jpg');
    });

    it('should throw an error for empty paths', () => {
      expect(() => normalizePathForDb('', uploadDir)).toThrow('Invalid path');
    });
  });

  describe('verifyImageFiles', () => {
    const uploadDir = '/app/uploads';
    const fs = require('fs');

    // Mock fs.existsSync
    const originalExistsSync = fs.existsSync;

    beforeEach(() => {
      // Reset the mock before each test
      fs.existsSync = jest.fn();
    });

    afterEach(() => {
      // Restore the original function after each test
      fs.existsSync = originalExistsSync;
    });

    it('should add file_exists and thumbnail_exists flags when both files exist', () => {
      // Setup
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      // Mock fs.existsSync to return true for both files
      fs.existsSync.mockImplementation(() => true);

      // Execute
      const result = verifyImageFiles(image, uploadDir);

      // Verify
      expect(result.file_exists).toBe(true);
      expect(result.thumbnail_exists).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledTimes(2);
    });

    it('should add file_exists=false when the image file does not exist', () => {
      // Setup
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      // Mock fs.existsSync to return false for the image file and true for the thumbnail
      fs.existsSync.mockImplementation((path) => {
        return !path.includes('test-image.jpg') || path.includes('thumb');
      });

      // Execute
      const result = verifyImageFiles(image, uploadDir);

      // Verify
      expect(result.file_exists).toBe(false);
      expect(result.thumbnail_exists).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledTimes(2);
    });

    it('should add thumbnail_exists=false when the thumbnail file does not exist', () => {
      // Setup
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      // Mock fs.existsSync to return true for the image file and false for the thumbnail
      fs.existsSync.mockImplementation((path) => {
        return !path.includes('thumb');
      });

      // Execute
      const result = verifyImageFiles(image, uploadDir);

      // Verify
      expect(result.file_exists).toBe(true);
      expect(result.thumbnail_exists).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledTimes(2);
    });

    it('should handle missing thumbnail_path', () => {
      // Setup
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);

      // Execute
      const result = verifyImageFiles(image, uploadDir);

      // Verify
      expect(result.file_exists).toBe(true);
      expect(result.thumbnail_exists).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledTimes(1); // Only called once for the main image
    });

    it('should handle missing storage_path', () => {
      // Setup
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '', // Empty storage path
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      // Execute
      const result = verifyImageFiles(image, uploadDir);

      // Verify
      expect(result.file_exists).toBe(false);
      expect(result.thumbnail_exists).toBe(false);
      expect(fs.existsSync).not.toHaveBeenCalled(); // Not called at all
    });
  });
});