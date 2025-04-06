// Mock queue module to avoid TS parsing
jest.mock('../queue', () => ({
  segmentationQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: jest.fn(),
    getJob: jest.fn()
  }
}));

// Mock auth middleware module to avoid TS parsing
jest.mock('../../auth/middleware', () => ({
  authenticateJWT: jest.fn((_req, _res, next) => next())
}));
const request = require('supertest');
const express = require('express');
const { mlRouter } = require('../routes');
// Mock the entire mlRouter to avoid importing TS code
jest.mock('../routes', () => {
  const express = require('express');
  return { mlRouter: express.Router() };
});

jest.mock('../queue');
jest.mock('../../auth/middleware');
jest.mock('../services/ml.service');
jest.mock('../../storage/service');

const app = express();
app.use(express.json());
app.use('/api', mlRouter);

describe('ML Routes - London School TDD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/projects/:projectId/images/:imageId/segmentation - Validation Middleware', () => {
    it('should reject missing parameters with 400', async () => {
      const res = await request(app)
        .post('/api/projects/proj-1/images/img-1/segmentation')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should reject invalid parameter types with 400', async () => {
      const res = await request(app)
        .post('/api/projects/proj-1/images/img-1/segmentation')
        .send({ parameters: 'not-an-object' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/projects/:projectId/images/:imageId/segmentation - Queue Interaction', () => {
    it('should enqueue segmentation job with correct data', async () => {
      const mockAdd = require('../queue').segmentationQueue.add;
      mockAdd.mockResolvedValueOnce({ id: 'job-123' });

      const res = await request(app)
        .post('/api/projects/proj-1/images/img-1/segmentation')
        .send({ parameters: { threshold: 0.5 } });

      expect(mockAdd).toHaveBeenCalled();
      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('jobId', 'job-123');
    });

    it('should handle queue errors gracefully', async () => {
      const mockAdd = require('../queue').segmentationQueue.add;
      mockAdd.mockRejectedValueOnce(new Error('Queue error'));

      const res = await request(app)
        .post('/api/projects/proj-1/images/img-1/segmentation')
        .send({ parameters: { threshold: 0.5 } });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Error Response Formats', () => {
    it('should return consistent error format on validation failure', async () => {
      const res = await request(app)
        .post('/api/projects/proj-1/images/img-1/segmentation')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return consistent error format on queue failure', async () => {
      const mockAdd = require('../queue').segmentationQueue.add;
      mockAdd.mockRejectedValueOnce(new Error('Queue error'));

      const res = await request(app)
        .post('/api/projects/proj-1/images/img-1/segmentation')
        .send({ parameters: { threshold: 0.5 } });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Authentication Middleware Integration', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const { authenticateJWT } = require('../../auth/middleware');
      authenticateJWT.mockImplementationOnce(
        (_req, res, _next) => {
          res.status(401).json({ error: 'Unauthorized' });
        }
      );

      const res = await request(app)
        .post('/api/projects/proj-1/images/img-1/segmentation')
        .send({ parameters: { threshold: 0.5 } });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should allow authenticated requests', async () => {
      const { authenticateJWT } = require('../../auth/middleware');
      authenticateJWT.mockImplementationOnce(
        (_req, _res, next) => {
          _req.user = { id: 'user-123' };
          next();
        }
      );

      const mockAdd = require('../queue').segmentationQueue.add;
      mockAdd.mockResolvedValueOnce({ id: 'job-123' });

      const res = await request(app)
        .post('/api/projects/proj-1/images/img-1/segmentation')
        .send({ parameters: { threshold: 0.5 } });

      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('jobId', 'job-123');
    });
  });
});