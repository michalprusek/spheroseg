import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import {
  fileExists,
  fileExistsSync,
  ensureDirectoryExists,
  ensureDirectoryExistsSync,
  copyFile,
  copyFileSync,
  deleteFile,
  deleteFileSync,
  getFilesInDirectory,
  getFilesInDirectorySync,
  dbPathToFilesystemPath,
  normalizePathForDb,
  formatImageForApi,
  verifyImageFilesForApi,
  verifyImageFilesForApiSync,
  getImageMetadata,
  createThumbnail,
  convertTiffToWebFriendly,
} from '../imageUtils.unified';

// Mock dependencies
vi.mock('fs');
vi.mock('sharp');
vi.mock('../logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('imageUtils.unified', () => {
  const mockUploadDir = '/app/uploads';
  const mockDbPath = 'images/test-image.jpg';
  const mockFilePath = '/app/uploads/images/test-image.jpg';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      const result = await fileExists(mockFilePath);
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('ENOENT'));
        }
      });

      const result = await fileExists(mockFilePath);
      expect(result).toBe(false);
    });
  });

  describe('fileExistsSync', () => {
    it('should return true when file exists', () => {
      vi.mocked(fs.accessSync).mockImplementation(() => undefined);

      const result = fileExistsSync(mockFilePath);
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', () => {
      vi.mocked(fs.accessSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = fileExistsSync(mockFilePath);
      expect(result).toBe(false);
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('ENOENT'));
        }
      });

      const mkdirMock = vi.mocked(fs.mkdir);
      mkdirMock.mockImplementation((path, options, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      await ensureDirectoryExists('/app/uploads/images');
      expect(mkdirMock).toHaveBeenCalledWith(
        '/app/uploads/images',
        { recursive: true },
        expect.any(Function)
      );
    });

    it('should not create directory if it already exists', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      const mkdirMock = vi.mocked(fs.mkdir);

      await ensureDirectoryExists('/app/uploads/images');
      expect(mkdirMock).not.toHaveBeenCalled();
    });
  });

  describe('ensureDirectoryExistsSync', () => {
    it('should create directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mkdirSyncMock = vi.mocked(fs.mkdirSync);

      ensureDirectoryExistsSync('/app/uploads/images');
      expect(mkdirSyncMock).toHaveBeenCalledWith('/app/uploads/images', { recursive: true });
    });

    it('should not create directory if it already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const mkdirSyncMock = vi.mocked(fs.mkdirSync);

      ensureDirectoryExistsSync('/app/uploads/images');
      expect(mkdirSyncMock).not.toHaveBeenCalled();
    });
  });

  describe('copyFile', () => {
    it('should copy file and create target directory', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('ENOENT'));
        }
      });

      const mkdirMock = vi.mocked(fs.mkdir);
      mkdirMock.mockImplementation((path, options, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      const copyFileMock = vi.mocked(fs.copyFile);
      copyFileMock.mockImplementation((src, dest, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      await copyFile('/source/file.jpg', '/target/file.jpg');
      expect(copyFileMock).toHaveBeenCalledWith(
        '/source/file.jpg',
        '/target/file.jpg',
        expect.any(Function)
      );
    });
  });

  describe('copyFileSync', () => {
    it('should copy file and create target directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mkdirSyncMock = vi.mocked(fs.mkdirSync);
      const copyFileSyncMock = vi.mocked(fs.copyFileSync);

      copyFileSync('/source/file.jpg', '/target/file.jpg');
      expect(mkdirSyncMock).toHaveBeenCalledWith('/target', { recursive: true });
      expect(copyFileSyncMock).toHaveBeenCalledWith('/source/file.jpg', '/target/file.jpg');
    });
  });

  describe('deleteFile', () => {
    it('should delete file if it exists', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      const unlinkMock = vi.mocked(fs.unlink);
      unlinkMock.mockImplementation((path, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      await deleteFile(mockFilePath);
      expect(unlinkMock).toHaveBeenCalledWith(mockFilePath, expect.any(Function));
    });

    it('should not throw if file does not exist', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('ENOENT'));
        }
      });

      await expect(deleteFile(mockFilePath)).resolves.not.toThrow();
    });
  });

  describe('deleteFileSync', () => {
    it('should delete file if it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const unlinkSyncMock = vi.mocked(fs.unlinkSync);

      deleteFileSync(mockFilePath);
      expect(unlinkSyncMock).toHaveBeenCalledWith(mockFilePath);
    });

    it('should not throw if file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const unlinkSyncMock = vi.mocked(fs.unlinkSync);

      expect(() => deleteFileSync(mockFilePath)).not.toThrow();
      expect(unlinkSyncMock).not.toHaveBeenCalled();
    });
  });

  describe('getFilesInDirectory', () => {
    it('should return files in directory', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      const readdirMock = vi.mocked(fs.readdir);
      readdirMock.mockImplementation((path, options, callback) => {
        if (typeof callback === 'function') {
          callback(null as any, [
            { name: 'file1.jpg', isFile: () => true, isDirectory: () => false } as any,
            { name: 'file2.png', isFile: () => true, isDirectory: () => false } as any,
            { name: 'subdir', isFile: () => false, isDirectory: () => true } as any,
          ]);
        }
      });

      const files = await getFilesInDirectory('/test/dir');
      expect(files).toEqual(['/test/dir/file1.jpg', '/test/dir/file2.png']);
    });

    it('should return empty array for non-existent directory', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('ENOENT'));
        }
      });

      const files = await getFilesInDirectory('/non/existent');
      expect(files).toEqual([]);
    });

    it('should filter files when filter function is provided', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      const readdirMock = vi.mocked(fs.readdir);
      readdirMock.mockImplementation((path, options, callback) => {
        if (typeof callback === 'function') {
          callback(null as any, [
            { name: 'file1.jpg', isFile: () => true, isDirectory: () => false } as any,
            { name: 'file2.png', isFile: () => true, isDirectory: () => false } as any,
            { name: 'file3.txt', isFile: () => true, isDirectory: () => false } as any,
          ]);
        }
      });

      const files = await getFilesInDirectory('/test/dir', {
        filter: (filename) => filename.endsWith('.jpg'),
      });
      expect(files).toEqual(['/test/dir/file1.jpg']);
    });
  });

  describe('getFilesInDirectorySync', () => {
    it('should return files in directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'file1.jpg', isFile: () => true, isDirectory: () => false } as any,
        { name: 'file2.png', isFile: () => true, isDirectory: () => false } as any,
        { name: 'subdir', isFile: () => false, isDirectory: () => true } as any,
      ]);

      const files = getFilesInDirectorySync('/test/dir');
      expect(files).toEqual(['/test/dir/file1.jpg', '/test/dir/file2.png']);
    });
  });

  describe('dbPathToFilesystemPath', () => {
    it('should convert database path to filesystem path', () => {
      const result = dbPathToFilesystemPath(mockDbPath, mockUploadDir);
      expect(result).toBe(mockFilePath);
    });

    it('should handle empty paths', () => {
      expect(() => dbPathToFilesystemPath('', mockUploadDir)).toThrow();
      expect(() => dbPathToFilesystemPath(mockDbPath, '')).toThrow();
    });
  });

  describe('normalizePathForDb', () => {
    it('should normalize filesystem path for database', () => {
      const result = normalizePathForDb(mockFilePath, mockUploadDir);
      expect(result).toBe(mockDbPath);
    });

    it('should handle paths not in upload directory', () => {
      const result = normalizePathForDb('/other/path/image.jpg', mockUploadDir);
      expect(result).toBe('/other/path/image.jpg');
    });
  });

  describe('formatImageForApi', () => {
    it('should format image data for API response', async () => {
      const mockImage = {
        id: '123',
        filename: 'test.jpg',
        filepath: mockDbPath,
        width: 800,
        height: 600,
        filesize: 1000000,
        uploaded_at: new Date('2024-01-01'),
        user_id: 'user123',
        project_id: 'project123',
        segmentation_status: 'completed',
      };

      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      const formatted = await formatImageForApi(mockImage, mockUploadDir);
      expect(formatted).toHaveProperty('id', '123');
      expect(formatted).toHaveProperty('name', 'test.jpg');
      expect(formatted).toHaveProperty('url');
      expect(formatted).toHaveProperty('segmentationStatus', 'completed');
      expect(formatted).not.toHaveProperty('filepath');
    });
  });

  describe('verifyImageFilesForApi', () => {
    it('should verify image files exist', async () => {
      const mockImages = [
        {
          id: '1',
          filename: 'test1.jpg',
          filepath: 'images/test1.jpg',
          thumbnail_path: 'thumbnails/test1.jpg',
        },
        {
          id: '2',
          filename: 'test2.jpg',
          filepath: 'images/test2.jpg',
          thumbnail_path: null,
        },
      ];

      const accessMock = vi.mocked(fs.access);
      accessMock.mockImplementation((path, mode, callback) => {
        if (typeof callback === 'function') {
          callback(null as any);
        }
      });

      const verified = await verifyImageFilesForApi(mockImages, mockUploadDir);
      expect(verified).toHaveLength(2);
      expect(verified[0]).toHaveProperty('storageExists', true);
      expect(verified[0]).toHaveProperty('thumbnailExists', true);
      expect(verified[1]).toHaveProperty('storageExists', true);
      expect(verified[1]).toHaveProperty('thumbnailExists', false);
    });
  });

  describe('verifyImageFilesForApiSync', () => {
    it('should verify image files exist synchronously', () => {
      const mockImages = [
        {
          id: '1',
          filename: 'test1.jpg',
          filepath: 'images/test1.jpg',
          thumbnail_path: 'thumbnails/test1.jpg',
        },
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const verified = verifyImageFilesForApiSync(mockImages, mockUploadDir);
      expect(verified).toHaveLength(1);
      expect(verified[0]).toHaveProperty('storageExists', true);
      expect(verified[0]).toHaveProperty('thumbnailExists', true);
    });
  });
});