import request from 'supertest';
import { app } from '../server';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { getSegmentationQueueStatus } from '../services/segmentationService';

// Mock the segmentation service
jest.mock('../services/segmentationService', () => ({
  getSegmentationQueueStatus: jest.fn()
}));

// Mock the database pool
jest.mock('../db', () => ({
  query: jest.fn()
}));

describe('Status API', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockToken = jwt.sign({ userId: mockUserId, email: 'test@example.com' }, process.env.JWT_SECRET || 'test-secret');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/queue-status', () => {
    it('should return 401 if no token is provided', async () => {
      const response = await request(app).get('/api/queue-status');
      expect(response.status).toBe(401);
    });

    it('should return queue status with image details', async () => {
      // Mock the segmentation service response
      (getSegmentationQueueStatus as jest.Mock).mockReturnValue({
        queueLength: 1,
        runningTasks: ['image-123', 'image-456'],
        queuedTasks: ['image-789']
      });

      // Mock the database response
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [
          { id: 'image-123', name: 'Test Image 1', project_id: 'project-1' },
          { id: 'image-456', name: 'Test Image 2', project_id: 'project-2' }
        ]
      });

      const response = await request(app)
        .get('/api/queue-status')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        queueLength: 1,
        runningTasks: ['image-123', 'image-456'],
        processingImages: [
          { id: 'image-123', name: 'Test Image 1', projectId: 'project-1' },
          { id: 'image-456', name: 'Test Image 2', projectId: 'project-2' }
        ]
      });

      // Verify the database was queried correctly
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT i.id, i.name, i.project_id'),
        [['image-123', 'image-456'], mockUserId]
      );
    });

    it('should handle empty running tasks', async () => {
      // Mock the segmentation service response
      (getSegmentationQueueStatus as jest.Mock).mockReturnValue({
        queueLength: 0,
        runningTasks: [],
        queuedTasks: []
      });

      const response = await request(app)
        .get('/api/queue-status')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        queueLength: 0,
        runningTasks: [],
        processingImages: []
      });

      // Verify the database was not queried
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/queue-status/:projectId', () => {
    const mockProjectId = 'project-123';

    it('should return 401 if no token is provided', async () => {
      const response = await request(app).get(`/api/queue-status/${mockProjectId}`);
      expect(response.status).toBe(401);
    });

    it('should return 404 if project is not found', async () => {
      // Mock the database response for project check
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get(`/api/queue-status/${mockProjectId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Project not found or access denied' });
    });

    it('should return project-specific queue status', async () => {
      // Mock the database response for project check
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockProjectId }]
      });

      // Mock the segmentation service response
      (getSegmentationQueueStatus as jest.Mock).mockReturnValue({
        queueLength: 2,
        runningTasks: ['image-123', 'image-456', 'image-789'],
        queuedTasks: ['image-abc']
      });

      // Mock the database response for images query
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 'image-123', name: 'Project Image 1' },
          { id: 'image-456', name: 'Project Image 2' }
        ]
      });

      const response = await request(app)
        .get(`/api/queue-status/${mockProjectId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        queueLength: 0, // This is hardcoded in the current implementation
        runningTasks: ['image-123', 'image-456'],
        processingImages: [
          { id: 'image-123', name: 'Project Image 1' },
          { id: 'image-456', name: 'Project Image 2' }
        ]
      });

      // Verify the database was queried correctly
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT i.id, i.name'),
        [['image-123', 'image-456', 'image-789'], mockProjectId]
      );
    });
  });
});
