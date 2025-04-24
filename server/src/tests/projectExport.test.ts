import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import projectsRouter from '../routes/projects';
import authMiddleware from '../middleware/authMiddleware';

// Mock dependencies
jest.mock('../middleware/authMiddleware', () => {
  return jest.fn((req, res, next) => {
    req.user = { userId: 'test-user-id' };
    next();
  });
});

jest.mock('../db', () => ({
  query: jest.fn().mockImplementation((query, params) => {
    if (query.includes('SELECT * FROM projects WHERE id')) {
      return {
        rows: [
          {
            id: 'test-project-id',
            user_id: 'test-user-id',
            title: 'Test Project',
            description: 'Test Description',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };
    }
    if (query.includes('SELECT * FROM images WHERE project_id')) {
      return {
        rows: [
          {
            id: 'test-image-id',
            project_id: 'test-project-id',
            user_id: 'test-user-id',
            name: 'test-image.jpg',
            storage_path: '/path/to/image.jpg',
            thumbnail_path: '/path/to/thumbnail.jpg',
            width: 100,
            height: 100,
            metadata: null,
            status: 'completed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };
    }
    if (query.includes('SELECT * FROM segmentation_results WHERE image_id')) {
      return {
        rows: [
          {
            id: 'test-segmentation-id',
            image_id: 'test-image-id',
            user_id: 'test-user-id',
            mask_path: '/path/to/mask.png',
            metrics: { count: 10, area: 1000 },
            status: 'completed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };
    }
    return { rows: [] };
  })
}));

describe('Project Export API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', projectsRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects/:projectId/export', () => {
    it('should return project export data', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'true'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('project');
      expect(response.body.project).toHaveProperty('id', 'test-project-id');
      expect(response.body).toHaveProperty('images');
      expect(response.body.images).toHaveLength(1);
      expect(response.body.images[0]).toHaveProperty('id', 'test-image-id');
      expect(response.body.images[0]).toHaveProperty('segmentation');
      expect(response.body.images[0].segmentation).toHaveProperty('id', 'test-segmentation-id');
    });

    it('should return 404 if project does not exist', async () => {
      // Mock db.query to return empty rows for project check
      const db = require('../db');
      db.query.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .get('/api/projects/non-existent-project/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'true'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });
  });

  describe('GET /api/projects/:projectId/export/metrics', () => {
    it('should return project metrics export data', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export/metrics');

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toMatch(/application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
    });

    it('should return 404 if project does not exist', async () => {
      // Mock db.query to return empty rows for project check
      const db = require('../db');
      db.query.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .get('/api/projects/non-existent-project/export/metrics');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });
  });
});
