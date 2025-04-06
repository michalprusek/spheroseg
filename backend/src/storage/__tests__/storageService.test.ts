import * as storageService from '../storageService';
import { query } from '../../db/connection';

jest.mock('../../db/connection');

describe('Storage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSignedUrl', () => {
    it('should return a signed URL with token when STORAGE_ACCESS_TOKEN is set', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        STORAGE_BASE_URL: 'https://storage.example.com',
        STORAGE_ACCESS_TOKEN: 'test-token'
      };

      const url = await storageService.getSignedUrl('file-123');
      expect(url).toBe('https://storage.example.com/files/file-123?token=test-token');

      process.env = originalEnv;
    });

    it('should return a URL without token when STORAGE_ACCESS_TOKEN is not set', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        STORAGE_BASE_URL: 'https://storage.example.com',
        STORAGE_ACCESS_TOKEN: ''
      };

      const url = await storageService.getSignedUrl('file-123');
      expect(url).toBe('https://storage.example.com/files/file-123');

      process.env = originalEnv;
    });

    it('should use default base URL if STORAGE_BASE_URL is not set', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        STORAGE_BASE_URL: '',
        STORAGE_ACCESS_TOKEN: 'test-token'
      };

      const url = await storageService.getSignedUrl('file-123');
      expect(url).toBe('https://storage.local/files/file-123?token=test-token');

      process.env = originalEnv;
    });
  });

  describe('createFileRecord', () => {
    it('should insert a file record and return it', async () => {
      const mockFileData = {
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      };

      const mockResult = {
        id: 'file-123',
        ...mockFileData,
        user_id: 'user-123',
        is_public: false,
        storage_path: '/uploads/test-file.jpg'
      };

      (query as jest.Mock).mockResolvedValueOnce([mockResult]);

      const result = await storageService.createFileRecord(mockFileData, 'user-123');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO files'),
        expect.arrayContaining([
          mockFileData.filename,
          mockFileData.filename,
          mockFileData.path,
          mockFileData.size,
          mockFileData.mimetype,
          'user-123',
          false,
          ''
        ])
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw an error if the query fails', async () => {
      const mockFileData = {
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      };

      const error = new Error('Database error');
      (query as jest.Mock).mockRejectedValueOnce(error);

      await expect(storageService.createFileRecord(mockFileData, 'user-123')).rejects.toThrow(error);
    });
  });

  describe('getFileRecord', () => {
    it('should return a file record by id', async () => {
      const mockResult = {
        id: 'file-123',
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        user_id: 'user-123',
        is_public: false,
        storage_path: '/uploads/test-file.jpg'
      };

      (query as jest.Mock).mockResolvedValueOnce([mockResult]);

      const result = await storageService.getFileRecord('file-123');

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM files WHERE id = $1',
        ['file-123']
      );
      expect(result).toEqual(mockResult);
    });

    it('should include user ID in query if provided', async () => {
      const mockResult = {
        id: 'file-123',
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        user_id: 'user-123',
        is_public: false,
        storage_path: '/uploads/test-file.jpg'
      };

      (query as jest.Mock).mockResolvedValueOnce([mockResult]);

      const result = await storageService.getFileRecord('file-123', 'user-123');

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM files WHERE id = $1 AND user_id = $2',
        ['file-123', 'user-123']
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null if no file is found', async () => {
      (query as jest.Mock).mockResolvedValueOnce([]);

      const result = await storageService.getFileRecord('file-123');

      expect(result).toBeNull();
    });
  });

  describe('getFilesByUser', () => {
    it('should return files for a user with default pagination', async () => {
      const mockFiles = [
        {
          id: 'file-123',
          filename: 'test-file-1.jpg',
          user_id: 'user-123'
        },
        {
          id: 'file-456',
          filename: 'test-file-2.jpg',
          user_id: 'user-123'
        }
      ];

      (query as jest.Mock).mockResolvedValueOnce(mockFiles);
      (query as jest.Mock).mockResolvedValueOnce([{ count: '2' }]);

      const result = await storageService.getFilesByUser('user-123');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM files WHERE user_id = $1'),
        expect.arrayContaining(['user-123', 10, 0])
      );
      expect(result).toEqual({
        files: mockFiles,
        total: 2
      });
    });

    it('should include category ID in query if provided', async () => {
      const mockFiles = [
        {
          id: 'file-123',
          filename: 'test-file-1.jpg',
          user_id: 'user-123',
          category_id: 'category-123'
        }
      ];

      (query as jest.Mock).mockResolvedValueOnce(mockFiles);
      (query as jest.Mock).mockResolvedValueOnce([{ count: '1' }]);

      const result = await storageService.getFilesByUser('user-123', 10, 0, 'category-123');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM files WHERE user_id = $1 AND category_id = $2'),
        expect.arrayContaining(['user-123', 'category-123', 10, 0])
      );
      expect(result).toEqual({
        files: mockFiles,
        total: 1
      });
    });

    it('should handle custom pagination parameters', async () => {
      const mockFiles = [
        {
          id: 'file-789',
          filename: 'test-file-3.jpg',
          user_id: 'user-123'
        }
      ];

      (query as jest.Mock).mockResolvedValueOnce(mockFiles);
      (query as jest.Mock).mockResolvedValueOnce([{ count: '3' }]);

      const result = await storageService.getFilesByUser('user-123', 1, 2);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM files WHERE user_id = $1'),
        expect.arrayContaining(['user-123', 1, 2])
      );
      expect(result).toEqual({
        files: mockFiles,
        total: 3
      });
    });
  });

  describe('deleteFileRecord', () => {
    it('should delete a file record', async () => {
      (query as jest.Mock).mockResolvedValueOnce([]);

      await storageService.deleteFileRecord('file-123');

      expect(query).toHaveBeenCalledWith(
        'DELETE FROM files WHERE id = $1',
        ['file-123']
      );
    });
  });

  describe('addFileTag', () => {
    it('should add a tag to a file', async () => {
      (query as jest.Mock).mockResolvedValueOnce([]);

      await storageService.addFileTag('file-123', 'tag-123');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO file_tags'),
        ['file-123', 'tag-123']
      );
    });
  });

  describe('removeFileTag', () => {
    it('should remove a tag from a file', async () => {
      (query as jest.Mock).mockResolvedValueOnce([]);

      await storageService.removeFileTag('file-123', 'tag-123');

      expect(query).toHaveBeenCalledWith(
        'DELETE FROM file_tags WHERE file_id = $1 AND tag_id = $2',
        ['file-123', 'tag-123']
      );
    });
  });

  describe('updateFileMetadata', () => {
    it('should update file metadata', async () => {
      const mockResult = {
        id: 'file-123',
        filename: 'updated-file.jpg',
        description: 'Updated description'
      };

      (query as jest.Mock).mockResolvedValueOnce([mockResult]);

      const updates = {
        filename: 'updated-file.jpg',
        description: 'Updated description'
      };

      const result = await storageService.updateFileMetadata('file-123', updates);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE files SET'),
        expect.arrayContaining(['updated-file.jpg', 'Updated description', 'file-123'])
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw an error if no fields to update', async () => {
      await expect(storageService.updateFileMetadata('file-123', {})).rejects.toThrow('No fields to update');
    });
  });

  describe('getFileRecordByFilename', () => {
    it('should return a file record by filename and user ID', async () => {
      const mockResult = {
        id: 'file-123',
        filename: 'test-file.jpg',
        user_id: 'user-123'
      };

      (query as jest.Mock).mockResolvedValueOnce([mockResult]);

      const result = await storageService.getFileRecordByFilename('test-file.jpg', 'user-123');

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM files WHERE filename = $1 AND user_id = $2',
        ['test-file.jpg', 'user-123']
      );
      expect(result).toEqual(mockResult);
    });

    it('should include project ID in query if provided', async () => {
      const mockResult = {
        id: 'file-123',
        filename: 'test-file.jpg',
        user_id: 'user-123',
        project_id: 'project-123'
      };

      (query as jest.Mock).mockResolvedValueOnce([mockResult]);

      const result = await storageService.getFileRecordByFilename('test-file.jpg', 'user-123', 'project-123');

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM files WHERE filename = $1 AND user_id = $2 AND project_id = $3',
        ['test-file.jpg', 'user-123', 'project-123']
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null if no file is found', async () => {
      (query as jest.Mock).mockResolvedValueOnce([]);

      const result = await storageService.getFileRecordByFilename('test-file.jpg', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('deleteFileRecordByFilename', () => {
    it('should delete a file record by filename and user ID', async () => {
      (query as jest.Mock).mockResolvedValueOnce([]);

      await storageService.deleteFileRecordByFilename('test-file.jpg', 'user-123');

      expect(query).toHaveBeenCalledWith(
        'DELETE FROM files WHERE filename = $1 AND user_id = $2',
        ['test-file.jpg', 'user-123']
      );
    });

    it('should include project ID in query if provided', async () => {
      (query as jest.Mock).mockResolvedValueOnce([]);

      await storageService.deleteFileRecordByFilename('test-file.jpg', 'user-123', 'project-123');

      expect(query).toHaveBeenCalledWith(
        'DELETE FROM files WHERE filename = $1 AND user_id = $2 AND project_id = $3',
        ['test-file.jpg', 'user-123', 'project-123']
      );
    });
  });
});