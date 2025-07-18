import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import * as db from '../db';

// Mock config
jest.mock('../config', () => ({
  env: 'test',
  isDevelopment: false,
  isProduction: false,
  isTest: true,
  server: {
    port: 3000,
    host: 'localhost',
    corsOrigins: ['http://localhost:3000'],
    publicUrl: 'http://localhost:3000',
  },
  storage: {
    uploadDir: '/tmp/uploads',
    avatarDir: '/tmp/uploads/avatars',
    processingDir: '/tmp/uploads/processing',
    thumbSize: 200,
  },
  baseUrl: 'http://localhost:3000',
}));

// Mock database
jest.mock('../db', () => ({
  query: jest.fn().mockImplementation((query, params) => {
    if (String(query).includes('SELECT id FROM projects')) {
      return { rows: [{ id: 'test-project-id' }] };
    }
    if (String(query).includes('INSERT INTO images')) {
      return {
        rows: [
          {
            id: 'test-image-id',
            project_id: params[0],
            user_id: params[1],
            name: params[2],
            storage_path: params[3],
            thumbnail_path: params[4],
            width: params[5],
            height: params[6],
            metadata: params[7],
          },
        ],
      };
    }
    return { rows: [] };
  }),
  connect: jest.fn().mockReturnValue({
    query: jest.fn().mockImplementation((query, params) => {
      if (String(query).includes('INSERT INTO images')) {
        return {
          rows: [
            {
              id: 'test-image-id',
              project_id: params[0],
              user_id: params[1],
              name: params[2],
              storage_path: params[3],
              thumbnail_path: params[4],
              width: params[5],
              height: params[6],
              metadata: params[7],
            },
          ],
        };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
    query: jest.fn().mockResolvedValue({ rows: [] }),
  }),
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock sharp module
jest.mock('sharp', () =>
  jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'jpeg' }),
    resize: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({}),
  }))
);

// Mock multer module
jest.mock('multer', () => {
  const multerMock = jest.fn(() => ({
    array: jest.fn(() => (req, res, next) => {
      req.files = [
        {
          fieldname: 'images',
          originalname: 'test-image.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          destination: '/tmp/uploads/test-project-id',
          filename: 'test-image-123456.jpg',
          path: '/tmp/uploads/test-project-id/test-image-123456.jpg',
          size: 12345,
        },
      ];
      next();
    }),
  }));
  multerMock.diskStorage = jest.fn();
  return multerMock;
});

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock authentication middleware
jest.mock('../security/middleware/auth', () => {
  return jest.fn((req, res, next) => {
    req.user = { userId: 'test-user-id' };
    next();
  });
});

// Mock imageUtils
jest.mock('../utils/imageUtils.unified', () => ({
  default: {
    fileExists: jest.fn().mockResolvedValue(true),
    ensureDirectoryExists: jest.fn().mockResolvedValue(undefined),
    getImageMetadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'jpeg' }),
    createThumbnail: jest.fn().mockResolvedValue(undefined),
    dbPathToFilesystemPath: jest
      .fn()
      .mockReturnValue('/tmp/uploads/test-project-id/test-image.jpg'),
    normalizePathForDb: jest.fn().mockReturnValue('/uploads/test-project-id/test-image.jpg'),
    formatImageForApi: jest.fn().mockImplementation((image) => ({
      ...image,
      storage_path: `http://localhost:3000/uploads/test-project-id/test-image.jpg`,
      thumbnail_path: `http://localhost:3000/uploads/test-project-id/thumb-test-image.jpg`,
    })),
    verifyImageFilesForApi: jest
      .fn()
      .mockImplementation((image) => ({ ...image, file_exists: true })),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  },
  fileExists: jest.fn().mockResolvedValue(true),
  getImageMetadata: jest.fn().mockResolvedValue({ width: 800, height: 600, format: 'jpeg' }),
  createThumbnail: jest.fn().mockResolvedValue(undefined),
  dbPathToFilesystemPath: jest.fn().mockReturnValue('/tmp/uploads/test-project-id/test-image.jpg'),
  normalizePathForDb: jest.fn().mockReturnValue('/uploads/test-project-id/test-image.jpg'),
}));

// Import after all mocks have been defined
import imagesRouter from '../routes/images';
// import authMiddleware from '../security/middleware/auth';

describe('Image Upload API', () => {
  let app: express.Application;

  beforeEach(() => {
    // Nastavení Express aplikace
    app = express();
    app.use(express.json());
    app.use('/api', imagesRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/projects/:projectId/images', () => {
    it('should upload images to a project', async () => {
      const response = await request(app)
        .post('/api/projects/test-project-id/images')
        .set('Content-Type', 'multipart/form-data')
        .attach('images', Buffer.from('test image content'), 'test-image.jpg');

      expect(response.status).toBe(201);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('id', 'test-image-id');
      expect(response.body[0]).toHaveProperty('project_id', 'test-project-id');
      expect(response.body[0]).toHaveProperty('user_id', 'test-user-id');
      expect(response.body[0]).toHaveProperty('name', 'test-image.jpg');
    });

    it('should return 404 if project does not exist', async () => {
      // Mock db.query to return empty rows for project check
      // Použijeme typově bezpečnou implementaci
      (db.query as jest.Mock).mockImplementationOnce((_query: unknown) => {
        // Testujeme SELECT projekt
        return { rows: [] };
      });

      const response = await request(app)
        .post('/api/projects/non-existent-project/images')
        .set('Content-Type', 'multipart/form-data')
        .attach('images', Buffer.from('test image content'), 'test-image.jpg');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });
  });
});
