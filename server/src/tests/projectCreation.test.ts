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
    if (query.includes('INSERT INTO projects')) {
      return {
        rows: [
          {
            id: 'test-project-id',
            user_id: 'test-user-id',
            title: params[1],
            description: params[2],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };
    }
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
    return { rows: [] };
  })
}));

describe('Project Creation API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', projectsRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          title: 'Test Project',
          description: 'Test Description'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 'test-project-id');
      expect(response.body).toHaveProperty('user_id', 'test-user-id');
      expect(response.body).toHaveProperty('title', 'Test Project');
      expect(response.body).toHaveProperty('description', 'Test Description');
    });

    it('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          description: 'Test Description'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Title is required');
    });
  });

  describe('POST /api/projects/:projectId/duplicate', () => {
    it('should duplicate a project', async () => {
      const response = await request(app)
        .post('/api/projects/test-project-id/duplicate');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 'test-project-id');
      expect(response.body).toHaveProperty('user_id', 'test-user-id');
      expect(response.body).toHaveProperty('title', 'Test Project (Copy)');
      expect(response.body).toHaveProperty('description', 'Test Description');
    });

    it('should return 404 if project does not exist', async () => {
      // Mock db.query to return empty rows for project check
      const db = require('../db');
      db.query.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .post('/api/projects/non-existent-project/duplicate');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });
  });
});
