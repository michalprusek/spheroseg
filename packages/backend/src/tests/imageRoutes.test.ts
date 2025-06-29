import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import pool from '../db';
import imageRoutes from '../routes/images';
import { errorHandler } from '../middleware/errorHandler';
import path from 'path';
import fs from 'fs';

// Import the AuthenticatedRequest interface
import { AuthenticatedRequest } from '../security/middleware/authMiddleware';

// Mock dependencies
jest.mock('../db', () => ({
  query: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock environment variables
process.env.JWT_SECRET = 'test-secret';

describe('Image Routes', () => {
  let app: express.Application;
  let server: Server;
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testProjectId = '123e4567-e89b-12d3-a456-426614174001';
  const testImageId = '123e4567-e89b-12d3-a456-426614174002';

  // Create a valid JWT token for testing
  const token = jwt.sign({ userId: testUserId }, process.env.JWT_SECRET as string);

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Add authentication middleware mock
    app.use((req: Request, res: Response, next: NextFunction) => {
      (req as AuthenticatedRequest).user = {
        userId: testUserId,
        email: 'test@example.com',
      };
      next();
    });

    // Add routes
    app.use('/api', imageRoutes);

    // Add error handler
    app.use(errorHandler);

    // Start server
    server = app.listen(0);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects/:projectId/images', () => {
    it('should return a list of images for a project', async () => {
      // Mock database response
      const mockImages = [
        {
          id: testImageId,
          project_id: testProjectId,
          user_id: testUserId,
          name: 'test-image.jpg',
          storage_path: '/uploads/test-project/test-image.jpg',
          thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
      ];

      // Mock project check
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [{ id: testProjectId }],
      }));

      // Mock image query
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: mockImages,
      }));

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(testImageId);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should return 404 if project not found', async () => {
      // Mock project check - no project found
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [],
      }));

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/projects/:projectId/images/:imageId', () => {
    it('should return a specific image', async () => {
      // Mock database responses
      const mockImage = {
        id: testImageId,
        project_id: testProjectId,
        user_id: testUserId,
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      // Mock project check
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [{ id: testProjectId }],
      }));

      // Mock image query
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [mockImage],
      }));

      // Mock file existence check
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/${testImageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testImageId);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should return 404 if image not found', async () => {
      // Mock project check
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [{ id: testProjectId }],
      }));

      // Mock image query - no image found
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [],
      }));

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/${testImageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('DELETE /api/projects/:projectId/images/:imageId', () => {
    it('should delete an image and return 204', async () => {
      // Mock database responses
      const mockImage = {
        id: testImageId,
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
      };

      // Mock project check
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [{ id: testProjectId }],
      }));

      // Mock image query
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [mockImage],
      }));

      // Mock delete query
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [],
      }));

      // Mock file existence check
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/images/${testImageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
      expect(pool.query).toHaveBeenCalledTimes(3);
      expect(fs.unlinkSync).toHaveBeenCalledTimes(2); // Both image and thumbnail
    });

    it('should return 404 if image not found', async () => {
      // Mock project check
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [{ id: testProjectId }],
      }));

      // Mock image query - no image found
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [],
      }));

      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/images/${testImageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/projects/:projectId/images/:imageId/verify', () => {
    it('should verify an image exists and return status', async () => {
      // Mock database responses
      const mockImage = {
        id: testImageId,
        storage_path: '/uploads/test-project/test-image.jpg',
      };

      // Mock project check
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [{ id: testProjectId }],
      }));

      // Mock image query
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [mockImage],
      }));

      // Mock file existence check
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/${testImageId}/verify`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should return exists:false if file does not exist', async () => {
      // Mock database responses
      const mockImage = {
        id: testImageId,
        storage_path: '/uploads/test-project/test-image.jpg',
      };

      // Mock project check
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [{ id: testProjectId }],
      }));

      // Mock image query
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [mockImage],
      }));

      // Mock file existence check - file doesn't exist
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/${testImageId}/verify`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(false);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should return 404 if image not found', async () => {
      // Mock project check
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [{ id: testProjectId }],
      }));

      // Mock image query - no image found
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [],
      }));

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/${testImageId}/verify`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });

  // Test legacy routes
  describe('Legacy Routes', () => {
    it('should redirect DELETE /api/images/:id to the new route', async () => {
      // Mock image query with project_id
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [
          {
            id: testImageId,
            project_id: testProjectId,
            storage_path: '/uploads/test-project/test-image.jpg',
            thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
          },
        ],
      }));

      const response = await request(app)
        .delete(`/api/images/${testImageId}`)
        .set('Authorization', `Bearer ${token}`)
        .redirects(0); // Don't follow redirects

      expect(response.status).toBe(307); // Temporary redirect
      expect(response.headers.location).toBe(`/api/projects/${testProjectId}/images/${testImageId}`);
    });

    it('should redirect GET /api/verify/:id to the new route', async () => {
      // Mock image query with project_id
      (pool.query as jest.Mock).mockImplementationOnce(() => ({
        rows: [
          {
            id: testImageId,
            project_id: testProjectId,
            storage_path: '/uploads/test-project/test-image.jpg',
          },
        ],
      }));

      const response = await request(app)
        .get(`/api/verify/${testImageId}`)
        .set('Authorization', `Bearer ${token}`)
        .redirects(0); // Don't follow redirects

      expect(response.status).toBe(307); // Temporary redirect
      expect(response.headers.location).toBe(`/api/projects/${testProjectId}/images/${testImageId}/verify`);
    });
  });
});
