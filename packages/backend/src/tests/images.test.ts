import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import imagesRouter from '../routes/images';
import authMiddleware from '../middleware/authMiddleware';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('../middleware/authMiddleware', () => {
  return jest.fn((req, res, next) => {
    req.user = { userId: 'test-user-id' };
    next();
  });
});

jest.mock('multer', () => {
  const multerMock = () => ({
    array: () => (req, res, next) => {
      req.files = [
        {
          fieldname: 'images',
          originalname: 'test-image.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          destination: '/tmp',
          filename: 'test-image-123456.jpg',
          path: '/tmp/test-image-123456.jpg',
          size: 12345
        }
      ];
      next();
    }
  });
  multerMock.diskStorage = () => ({});
  return multerMock;
});

jest.mock('../db', () => ({
  query: jest.fn().mockImplementation((query, params) => {
    if (query.includes('SELECT id FROM projects')) {
      return { rows: [{ id: 'test-project-id' }] };
    }
    if (query.includes('INSERT INTO images')) {
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
            metadata: params[7]
          }
        ]
      };
    }
    return { rows: [] };
  })
}));

// Mock fs functions
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Images API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
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
      const db = require('../db');
      db.query.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .post('/api/projects/non-existent-project/images')
        .set('Content-Type', 'multipart/form-data')
        .attach('images', Buffer.from('test image content'), 'test-image.jpg');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });
  });

  describe('GET /api/projects/:projectId/images', () => {
    it('should get images for a project', async () => {
      // Mock db.query to return test images
      const db = require('../db');
      db.query.mockImplementationOnce(() => ({
        rows: [
          {
            id: 'test-image-id',
            project_id: 'test-project-id',
            user_id: 'test-user-id',
            name: 'test-image.jpg',
            storage_path: '/tmp/test-image.jpg',
            thumbnail_path: '/tmp/test-image-thumb.jpg',
            width: 100,
            height: 100,
            metadata: null,
            status: 'completed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      }));

      const response = await request(app)
        .get('/api/projects/test-project-id/images');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('id', 'test-image-id');
      expect(response.body[0]).toHaveProperty('project_id', 'test-project-id');
    });
  });
});
