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
    if (query.includes('DELETE FROM projects WHERE id')) {
      return { rows: [] };
    }
    return { rows: [] };
  })
}));

describe('Project Deletion API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', projectsRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE /api/projects/:projectId', () => {
    it('should delete a project', async () => {
      const response = await request(app)
        .delete('/api/projects/test-project-id');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Project deleted successfully');
    });

    it('should return 404 if project does not exist', async () => {
      // Mock db.query to return empty rows for project check
      const db = require('../db');
      db.query.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .delete('/api/projects/non-existent-project');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });
  });
});
