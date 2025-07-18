/**
 * Comprehensive Image Upload Flow Tests
 *
 * Tests the complete image upload and display flow including:
 * - TIFF handling
 * - WebSocket events
 * - Database consistency
 * - Cache management
 */

import request from 'supertest';
import express from 'express';
import fs from 'fs';
import { getPool } from '../db';
import * as imageUtils from '../utils/imageUtils.unified';
import { Server as SocketServer } from 'socket.io';
import imageRoutes from '../routes/images';
import diagnosticsRoutes from '../routes/diagnostics';

// Mock dependencies
jest.mock('../db');
jest.mock('../utils/logger');
jest.mock('socket.io');
jest.mock('../utils/imageUtils.unified');

describe('Image Upload Flow', () => {
  let app: express.Application;
  let io: SocketServer;
  let authToken: string;
  let projectId: string;
  let _userId: string;
  let mockPool: any;

  beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';

    // Create Express app
    app = express();
    app.use(express.json());

    // Mock Socket.IO
    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    // Add Socket.IO to app
    (app as any).io = io;

    // Mock authentication middleware
    app.use((req: any, res: any, next: () => void) => {
      req.user = { userId: 'test-user-123' };
      req.io = io;
      next();
    });

    // Register routes
    app.use('/api/projects/:projectId/images', imageRoutes);
    app.use('/api/images', imageRoutes);
    app.use('/api/diagnostics', diagnosticsRoutes);

    // Error handler
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({
        message: err.message || 'Internal Server Error',
      });
    });

    // Setup test data
    _userId = 'test-user-123';
    projectId = 'test-project-456';
    authToken = 'Bearer test-token';
  });

  beforeEach(() => {
    // Setup default mock pool
    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn(),
      }),
    };
    (getPool as jest.Mock).mockReturnValue(mockPool);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('TIFF Upload Handling', () => {
    it('should successfully upload a small TIFF file', async () => {
      // Mock file processing
      jest.spyOn(imageUtils, 'convertTiffToWebFriendly').mockResolvedValue();
      jest.spyOn(imageUtils, 'getImageMetadata').mockResolvedValue({
        width: 1024,
        height: 768,
        format: 'tiff',
      });
      jest.spyOn(imageUtils, 'createThumbnail').mockResolvedValue();

      // Mock database
      mockPool = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 'image-123' }] }),
        connect: jest.fn().mockResolvedValue({
          query: jest.fn().mockResolvedValue({ rows: [] }),
          release: jest.fn(),
        }),
      };
      (getPool as jest.Mock).mockReturnValue(mockPool);

      const response = await request(app)
        .post(`/api/projects/${projectId}/images`)
        .set('Authorization', authToken)
        .attach('images', Buffer.from('fake-tiff-data'), 'test.tiff')
        .expect(201);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('id');
      expect(imageUtils.convertTiffToWebFriendly).toHaveBeenCalled();
    });

    it('should reject large TIFF files', async () => {
      // Create a mock large file
      const largeFileSize = 150 * 1024 * 1024; // 150MB

      // Mock fs module
      const fsMock = fs as jest.Mocked<typeof fs>;
      fsMock.statSync = jest.fn().mockReturnValue({
        size: largeFileSize,
      });

      const response = await request(app)
        .post(`/api/projects/${projectId}/images`)
        .set('Authorization', authToken)
        .attach('images', Buffer.from('fake-large-tiff'), 'large.tiff')
        .expect(413);

      expect(response.body.message).toContain('file too large');
    });

    it('should handle TIFF conversion errors gracefully', async () => {
      jest
        .spyOn(imageUtils, 'convertTiffToWebFriendly')
        .mockRejectedValue(new Error('Unsupported TIFF format'));

      const response = await request(app)
        .post(`/api/projects/${projectId}/images`)
        .set('Authorization', authToken)
        .attach('images', Buffer.from('fake-tiff-data'), 'corrupt.tiff')
        .expect(415);

      expect(response.body.message).toContain('Invalid or corrupted image file format');
    });
  });

  describe('WebSocket Events', () => {
    it('should emit image:created event after successful upload', async () => {
      const mockEmit = jest.fn();
      io.to = jest.fn().mockReturnValue({ emit: mockEmit });

      // Setup successful upload mocks
      jest.spyOn(imageUtils, 'getImageMetadata').mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg',
      });
      jest.spyOn(imageUtils, 'createThumbnail').mockResolvedValue();

      await request(app)
        .post(`/api/projects/${projectId}/images`)
        .set('Authorization', authToken)
        .attach('images', Buffer.from('fake-image'), 'test.jpg')
        .expect(201);

      // Verify WebSocket event was emitted
      expect(io.to).toHaveBeenCalledWith(`project-${projectId}`);
      expect(mockEmit).toHaveBeenCalledWith(
        'image:created',
        expect.objectContaining({
          projectId,
          image: expect.any(Object),
          timestamp: expect.any(String),
        })
      );
    });

    it('should emit image:deleted event after deletion', async () => {
      const mockEmit = jest.fn();
      io.to = jest.fn().mockReturnValue({ emit: mockEmit });

      const imageId = 'test-image-789';

      await request(app)
        .delete(`/api/projects/${projectId}/images/${imageId}`)
        .set('Authorization', authToken)
        .expect(204);

      expect(io.to).toHaveBeenCalledWith(`project-${projectId}`);
      expect(mockEmit).toHaveBeenCalledWith(
        'image:deleted',
        expect.objectContaining({
          projectId,
          imageId,
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('Database Consistency', () => {
    it('should verify images are in database after upload', async () => {
      // Mock successful upload and verification
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Verification query
        .mockResolvedValueOnce({ rows: [{ id: 'image-123' }] }); // Insert query

      await request(app)
        .post(`/api/projects/${projectId}/images`)
        .set('Authorization', authToken)
        .attach('images', Buffer.from('fake-image'), 'test.jpg')
        .expect(201);

      // Verify that verification query was called
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        expect.any(Array)
      );
    });
  });

  describe('API Response Format', () => {
    it('should return images in both data and images fields', async () => {
      const mockImages = [
        { id: '1', name: 'image1.jpg', segmentation_status: 'completed' },
        { id: '2', name: 'image2.jpg', segmentation_status: 'queued' },
      ];
      mockPool.query.mockResolvedValue({
        rows: mockImages,
        rowCount: 2,
      });

      const response = await request(app)
        .get(`/api/projects/${projectId}/images`)
        .set('Authorization', authToken)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('images');
      expect(response.body).toHaveProperty('data');
      expect(response.body.images).toEqual(response.body.data);
      expect(response.body.images).toHaveLength(2);
    });
  });

  describe('Database Consistency Checks', () => {
    it('should perform consistency check', async () => {
      // Mock consistency check queries
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Total images
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Images without status
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Invalid status
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Orphaned images

      const response = await request(app)
        .get(`/api/diagnostics/project/${projectId}/consistency`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('consistency');
      expect(response.body.consistency).toMatchObject({
        totalImages: 10,
        imagesWithoutStatus: 2,
        imagesWithInvalidStatus: 1,
        orphanedImages: 0,
      });
    });

    it('should fix consistency issues', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rowCount: 2 }) // Fix without status
        .mockResolvedValueOnce({ rowCount: 1 }) // Fix invalid status
        .mockResolvedValueOnce(undefined); // COMMIT

      const response = await request(app)
        .post(`/api/diagnostics/project/${projectId}/fix-consistency`)
        .set('Authorization', authToken)
        .send({ dryRun: false })
        .expect(200);

      expect(response.body.report.fixedIssues).toBe(3);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });
});
