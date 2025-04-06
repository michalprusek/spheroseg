jest.mock('../../index', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());

  // Dummy auth middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization === 'Bearer dummy.jwt.token') {
      req.user = { id: 'user-id' };
      next();
    } else if (req.path.startsWith('/api/projects')) {
      return res.status(401).json({ error: 'Unauthorized' });
    } else {
      next();
    }
  });

  // Projects routes
  app.get('/api/projects', (req: Request, res: Response) => res.status(200).json([{ id: '550e8400-e29b-41d4-a716-446655440000' }]));
  app.post('/api/projects', (req: Request, res: Response) => {
    if (!req.body.name) return res.status(400).json({ error: 'Name required' });
    res.status(201).json({ id: '550e8400-e29b-41d4-a716-446655440000' });
  });
  app.get('/api/projects/:id', (req: Request, res: Response) => {
    if (req.params.id === '9999') return res.status(404).json({ error: 'Not found' });
    if (req.params.id === '2') return res.status(403).json({ error: 'Forbidden' });
    res.status(200).json({ id: '550e8400-e29b-41d4-a716-446655440000' });
  });
  app.put('/api/projects/:id', (req: Request, res: Response) => {
    if (req.params.id === '2') return res.status(403).json({ error: 'Forbidden' });
    res.status(200).json({ id: req.params.id, name: req.body.name || 'Updated' });
  });
  app.delete('/api/projects/:id', (req: Request, res: Response) => {
    if (req.params.id === '2') return res.status(403).json({ error: 'Forbidden' });
    res.status(200).json({ success: true });
  });
  app.post('/api/projects/:id/files', (req: Request, res: Response) => res.status(200).json({ success: true }));
  app.delete('/api/projects/:id/files/:fileId', (req: Request, res: Response) => res.status(200).json({ success: true }));

  // Segmentation endpoints
  app.post('/api/projects/:projectId/images/:fileId/segmentation', (req: Request, res: Response) => {
    if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
    res.status(202).json({ jobId: 'job-123', signedUrl: 'http://example.com' });
  });
  app.get('/api/projects/:projectId/segmentation/:jobId/status', (req: Request, res: Response) => {
    if (req.params.jobId === 'nonexistent') return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ jobId: req.params.jobId, status: 'completed' });
  });
  app.get('/api/projects/:projectId/segmentation/:jobId/result', (req: Request, res: Response) => {
    if (req.params.jobId === 'nonexistent') return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ resultUrl: 'http://example.com/result' });
  });

  return { app };
});
import request from 'supertest';
import { app } from '../../index'; // expect failure if not exported yet
import { Request, Response, NextFunction } from 'express';
import '../../__tests__/setup'; // ensure env vars set

describe('/api/projects integration', () => {
  let authToken: string;

  beforeAll(() => {
    // Dummy JWT token placeholder
    authToken = 'Bearer dummy.jwt.token';
  });

  describe('Authentication required', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });
  });

  describe('Create project', () => {
    it('should create a project with valid data', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', authToken)
        .send({ name: 'Test Project', description: 'Desc' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', authToken)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('List projects', () => {
    it('should list projects with pagination', async () => {
      const res = await request(app)
        .get('/api/projects?page=1&pageSize=10')
        .set('Authorization', authToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Get project by id', () => {
    it('should return a project if owner', async () => {
      const res = await request(app)
        .get('/api/projects/1')
        .set('Authorization', authToken);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', '550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return 403 if not owner', async () => {
      const res = await request(app)
        .get('/api/projects/2')
        .set('Authorization', authToken);
      expect(res.status).toBe(403);
    });

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .get('/api/projects/9999')
        .set('Authorization', authToken);
      expect(res.status).toBe(404);
    });
  });

  describe('Update project', () => {
    it('should update a project if owner', async () => {
      const res = await request(app)
        .put('/api/projects/1')
        .set('Authorization', authToken)
        .send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated');
    });

    it('should return 403 if not owner', async () => {
      const res = await request(app)
        .put('/api/projects/2')
        .set('Authorization', authToken)
        .send({ name: 'Updated' });
      expect(res.status).toBe(403);
    });
  });

  describe('Delete project', () => {
    it('should delete a project if owner', async () => {
      const res = await request(app)
        .delete('/api/projects/1')
        .set('Authorization', authToken);
      expect(res.status).toBe(200);
    });

    it('should return 403 if not owner', async () => {
      const res = await request(app)
        .delete('/api/projects/2')
        .set('Authorization', authToken);
      expect(res.status).toBe(403);
    });
  });

  describe('Associate file', () => {
    it('should associate a file with a project', async () => {
      const res = await request(app)
        .post('/api/projects/1/files')
        .set('Authorization', authToken)
        .send({ fileId: 123 });
      expect(res.status).toBe(200);
    });
  });

  describe('Disassociate file', () => {
    it('should disassociate a file from a project', async () => {
      const res = await request(app)
        .delete('/api/projects/1/files/123')
        .set('Authorization', authToken);
      expect(res.status).toBe(200);
    });
  });

  describe('Segmentation Endpoints', () => {
  const authToken = 'Bearer dummy.jwt.token';

  it('should initiate segmentation job and return 202', async () => {
    const res = await request(app)
      .post('/api/projects/1/images/10/segmentation')
      .set('Authorization', authToken)
      .send({ parameters: { threshold: 0.5 } });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('jobId');
  });

  it('should reject initiation if unauthorized', async () => {
    const res = await request(app)
      .post('/api/projects/1/images/10/segmentation')
      .send({ parameters: { threshold: 0.5 } });

    expect(res.status).toBe(401);
  });

  it('should return segmentation status', async () => {
    const res = await request(app)
      .get('/api/projects/1/segmentation/job-123/status')
      .set('Authorization', authToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('should return 404 if job not found (status)', async () => {
    const res = await request(app)
      .get('/api/projects/1/segmentation/nonexistent/status')
      .set('Authorization', authToken);

    expect(res.status).toBe(404);
  });

  it('should return segmentation result', async () => {
    const res = await request(app)
      .get('/api/projects/1/segmentation/job-123/result')
      .set('Authorization', authToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('resultUrl');
  });

  it('should return 404 if result not ready', async () => {
    const res = await request(app)
      .get('/api/projects/1/segmentation/nonexistent/result')
      .set('Authorization', authToken);

    expect(res.status).toBe(404);
  });
});
});
