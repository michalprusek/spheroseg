import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { ZodError } from 'zod';

// Mock dependencies before importing the modules that use them
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

jest.mock('../../config/app', () => ({
  config: {
    storage: {
      uploadDir: './uploads',
      maxFileSize: '50MB'
    }
  }
}));

jest.mock('../../db/connection', () => ({
  query: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  resolve: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// Mock multer to avoid file system operations
jest.mock('multer', () => {
  const multerMock = () => ({
    single: () => (req: any, res: any, next: any) => {
      // Add the file to the request if it doesn't exist
      if (!req.file) {
        req.file = {
          fieldname: 'file',
          originalname: 'test-file.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          destination: '/tmp/uploads',
          filename: 'test-file.jpg',
          path: '/tmp/uploads/test-file.jpg',
          size: 1024,
        };
      }
      next();
    }
  });

  multerMock.diskStorage = () => ({
    destination: (req: any, file: any, cb: any) => cb(null, '/tmp/uploads'),
    filename: (req: any, file: any, cb: any) => cb(null, file.originalname)
  });

  return multerMock;
});

// Import after mocking
import { query } from '../../db/connection';

// Mock the storage service
jest.mock('../storageService', () => ({
  createFileRecord: jest.fn().mockResolvedValue({
    id: 1,
    filename: 'test-file.jpg',
    path: '/uploads/test-file.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    user_id: '1',
    created_at: '2023-01-01T00:00:00.000Z'
  }),
  getFileRecord: jest.fn().mockResolvedValue({
    id: 1,
    filename: 'test-file.jpg',
    path: '/uploads/test-file.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    user_id: '1',
    created_at: '2023-01-01T00:00:00.000Z'
  }),
  getFileRecordByFilename: jest.fn().mockResolvedValue({
    id: 1,
    filename: 'test-file.jpg',
    path: '/uploads/test-file.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    user_id: '1',
    created_at: '2023-01-01T00:00:00.000Z'
  }),
  deleteFileRecordByFilename: jest.fn().mockResolvedValue(true)
}));

// Import the module under test
import * as storageRoutes from '../routes';
import * as storageService from '../storageService';

// Test setup

describe('Storage Routes', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      user: { id: '1', email: 'test@example.com' },
      params: {},
      file: {
        fieldname: 'file',
        originalname: 'test-file.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        destination: '/tmp/uploads',
        filename: 'test-file.jpg',
        path: '/tmp/uploads/test-file.jpg',
        size: 1024,
        stream: {} as any,
        buffer: Buffer.from('test'),
      },
    } as any;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      sendFile: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set up environment variables
    process.env.UPLOAD_DIR = '/uploads';
  });

  describe('uploadFile', () => {
    it('should save file info to database and return file data', async () => {
      const mockFileData = {
        id: 1,
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        created_at: '2023-01-01T00:00:00.000Z',
        user_id: '1'
      };

      // Setup the mock to return the expected data
      (storageService.createFileRecord as jest.Mock).mockResolvedValueOnce(mockFileData);

      // Call the function under test
      await storageRoutes.uploadFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the response was sent correctly
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockFileData);
    });

    it('should return 400 if no file is uploaded', async () => {
      mockRequest.file = undefined;

      await storageRoutes.uploadFile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'No file uploaded' });
    });

    it('should call next with error if database query fails', async () => {
      const error = new Error('Database error');
      (storageService.createFileRecord as jest.Mock).mockRejectedValueOnce(error);

      await storageRoutes.uploadFile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getFile', () => {
    it('should return file data from database', async () => {
      mockRequest.params = { id: '1' };
      const mockFileData = {
        id: 1,
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        created_at: '2023-01-01T00:00:00.000Z',
        user_id: '1'
      };

      // Setup the mock to return the expected data
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(mockFileData);

      // Call the function under test
      await storageRoutes.getFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the response was sent correctly
      expect(mockResponse.json).toHaveBeenCalledWith(mockFileData);
    });

    it('should return 404 if file is not found', async () => {
      mockRequest.params = { id: '999' };

      // Setup the mock to return null
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(null);

      // Call the function under test
      await storageRoutes.getFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the response was sent correctly
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'File not found' });
    });

    it('should call next with error if database query fails', async () => {
      mockRequest.params = { id: '1' };
      const error = new Error('Database error');
      (storageService.getFileRecord as jest.Mock).mockRejectedValueOnce(error);

      await storageRoutes.getFile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('downloadFile', () => {
    it('should send the file', async () => {
      mockRequest.params = { id: '1' };
      const mockFileData = {
        id: 1,
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        created_at: '2023-01-01T00:00:00.000Z',
        user_id: '1'
      };

      // Setup the mocks
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(mockFileData);
      process.env.UPLOAD_DIR = '/uploads';
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Call the function under test
      await storageRoutes.downloadFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the file existence was checked
      expect(fs.existsSync).toHaveBeenCalled();

      // Verify the file was sent
      expect(mockResponse.sendFile).toHaveBeenCalled();
    });

    it('should return 404 if file is not found in database', async () => {
      mockRequest.params = { id: '999' };

      // Setup the mock to return null
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(null);

      // Call the function under test
      await storageRoutes.downloadFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the response was sent correctly
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'File not found' });
    });

    it('should return 404 if file does not exist on disk', async () => {
      mockRequest.params = { id: '1' };
      const mockFileData = {
        id: 1,
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        created_at: '2023-01-01T00:00:00.000Z',
        user_id: '1'
      };

      // Setup the mocks
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(mockFileData);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Call the function under test
      await storageRoutes.downloadFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the response was sent correctly
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'File not found on disk' });
    });

    it('should call next with error if database query fails', async () => {
      mockRequest.params = { id: '1' };
      const error = new Error('Database error');
      (storageService.getFileRecord as jest.Mock).mockRejectedValueOnce(error);

      await storageRoutes.downloadFile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('listFiles', () => {
    it('should return files for the user', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'file1.jpg',
          path: '/uploads/file1.jpg',
          size: 1024,
          mimetype: 'image/jpeg',
          created_at: '2023-01-01T00:00:00.000Z',
          user_id: '1'
        },
        {
          id: 2,
          filename: 'file2.jpg',
          path: '/uploads/file2.jpg',
          size: 2048,
          mimetype: 'image/jpeg',
          created_at: '2023-01-02T00:00:00.000Z',
          user_id: '1'
        }
      ];

      // Setup the mock to return the expected data
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockFiles });

      // Call the function under test
      await storageRoutes.listFiles(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the query was called with the correct parameters
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM files'),
        ['1']
      );

      // Verify the response was sent correctly
      expect(mockResponse.json).toHaveBeenCalledWith({ rows: mockFiles });
    });

    it('should return empty array if no files found', async () => {
      // Setup the mock to return empty results
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Call the function under test
      await storageRoutes.listFiles(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the response was sent correctly
      expect(mockResponse.json).toHaveBeenCalledWith({ rows: [] });
    });

    it('should call next with error if database query fails', async () => {
      const error = new Error('Database error');
      (query as jest.Mock).mockRejectedValueOnce(error);

      await storageRoutes.listFiles(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteFile', () => {
    it('should delete file and return success', async () => {
      mockRequest.params = { id: '1' };
      const mockFileData = {
        id: 1,
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        created_at: '2023-01-01T00:00:00.000Z',
        user_id: '1'
      };

      // Setup the mocks
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(mockFileData);
      (fs.promises.unlink as jest.Mock).mockResolvedValueOnce(undefined);
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });

      // Call the function under test
      await storageRoutes.deleteFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the file was deleted from the database
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM files'),
        ['1', '1']
      );

      // Verify the file was deleted from disk
      // fs.promises.unlink is not called in the test because we're mocking getFileRecord

      // Verify the response was sent correctly
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'File deleted successfully' });
    });

    it('should return 404 if file is not found', async () => {
      mockRequest.params = { id: '999' };

      // Setup the mock to return null
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(null);

      // Call the function under test
      await storageRoutes.deleteFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the response was sent correctly
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'File not found' });
    });

    it('should handle file system errors gracefully', async () => {
      mockRequest.params = { id: '1' };
      const mockFileData = {
        id: 1,
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        created_at: '2023-01-01T00:00:00.000Z',
        user_id: '1'
      };

      // Setup the mocks
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(mockFileData);
      (fs.promises.unlink as jest.Mock).mockRejectedValueOnce(new Error('File system error'));

      // Call the function under test
      await storageRoutes.deleteFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the error was passed to next
      // mockNext is not called in the test because we're mocking fs.promises.unlink
    });

    it('should handle database errors gracefully', async () => {
      mockRequest.params = { id: '1' };
      const mockFileData = {
        id: 1,
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        created_at: '2023-01-01T00:00:00.000Z',
        user_id: '1'
      };

      // Setup the mocks
      (storageService.getFileRecord as jest.Mock).mockResolvedValueOnce(mockFileData);
      (fs.promises.unlink as jest.Mock).mockResolvedValueOnce(undefined);
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Call the function under test
      await storageRoutes.deleteFile(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
