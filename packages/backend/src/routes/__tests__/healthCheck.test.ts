import request from 'supertest';
import express from 'express';
import { createHealthCheckRouter } from '../healthCheck';
import { DatabasePool } from '../../db/pool';
import { BullQueueService } from '../../services/bullQueueService';
import Redis from 'ioredis';
import axios from 'axios';

// Mock dependencies
jest.mock('ioredis');
jest.mock('axios');

describe('Health Check Routes', () => {
  let app: express.Application;
  let mockDbPool: jest.Mocked<DatabasePool>;
  let mockQueueService: jest.Mocked<BullQueueService>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database pool
    mockDbPool = {
      query: jest.fn(),
      getPoolStats: jest.fn().mockReturnValue({ total: 20, idle: 15, waiting: 0 }),
      transaction: jest.fn(),
      end: jest.fn(),
    } as any;

    // Mock queue service
    mockQueueService = {
      getQueueMetrics: jest.fn().mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 0,
        paused: 0,
        isPaused: false,
      }),
    } as any;

    // Mock Redis
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      info: jest.fn().mockResolvedValue('redis_version:6.2.6\r\nused_memory:1048576'),
      quit: jest.fn(),
    } as any;

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    // Create Express app with health check routes
    app = express();
    app.use(express.json());
    app.use('/health', createHealthCheckRouter(mockDbPool, mockQueueService, 'redis://localhost:6379'));
  });

  describe('GET /health', () => {
    it('should return healthy status when all services are up', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [{ now: new Date() }] } as any);
      (axios.get as jest.Mock).mockResolvedValue({ status: 200 });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        services: {
          database: 'healthy',
          redis: 'healthy',
          queue: 'healthy',
          ml: 'healthy',
        },
      });
    });

    it('should return unhealthy status when database is down', async () => {
      mockDbPool.query.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database).toBe('unhealthy');
    });

    it('should return unhealthy status when Redis is down', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [{ now: new Date() }] } as any);
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.redis).toBe('unhealthy');
    });

    it('should return degraded status when ML service is down', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [{ now: new Date() }] } as any);
      (axios.get as jest.Mock).mockRejectedValue(new Error('ML service unavailable'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.services.ml).toBe('unhealthy');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [{ now: new Date() }] } as any);
      (axios.get as jest.Mock).mockResolvedValue({ 
        status: 200,
        data: { status: 'healthy', model_loaded: true },
      });

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        },
        services: {
          database: {
            status: 'healthy',
          },
          redis: {
            status: 'healthy',
          },
          queue: {
            status: 'healthy',
          },
          ml: {
            status: 'healthy',
            details: { status: 'healthy', model_loaded: true },
          },
        },
      });
    });

    it('should include error details for failed services', async () => {
      const dbError = new Error('Database connection timeout');
      mockDbPool.query.mockRejectedValue(dbError);

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(503);
      expect(response.body.services.database).toEqual({
        status: 'unhealthy',
        error: 'Database connection timeout',
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when all critical services are healthy', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [{ now: new Date() }] } as any);

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ready: true,
        services: {
          database: 'healthy',
          redis: 'healthy',
        },
      });
    });

    it('should return not ready when database is down', async () => {
      mockDbPool.query.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.ready).toBe(false);
    });

    it('should return not ready when Redis is down', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [{ now: new Date() }] } as any);
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.ready).toBe(false);
    });
  });

  describe('GET /health/live', () => {
    it('should always return 200 OK', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        alive: true,
        timestamp: expect.any(String),
      });
    });
  });

  describe('GET /health/services/:service', () => {
    it('should return database health', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [{ now: new Date() }] } as any);

      const response = await request(app).get('/health/services/database');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        service: 'database',
        status: 'healthy',
        details: {
          pool: { total: 20, idle: 15, waiting: 0 },
        },
      });
    });

    it('should return Redis health', async () => {
      const response = await request(app).get('/health/services/redis');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        service: 'redis',
        status: 'healthy',
        details: {
          info: {
            version: '6.2.6',
            used_memory: '1.00 MB',
          },
        },
      });
    });

    it('should return queue health', async () => {
      const response = await request(app).get('/health/services/queue');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        service: 'queue',
        status: 'healthy',
        details: {
          metrics: {
            waiting: 5,
            active: 2,
            completed: 100,
            failed: 3,
          },
        },
      });
    });

    it('should return ML service health', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ 
        status: 200,
        data: { status: 'healthy', model_loaded: true },
      });

      const response = await request(app).get('/health/services/ml');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        service: 'ml',
        status: 'healthy',
        details: { status: 'healthy', model_loaded: true },
      });
    });

    it('should return 404 for unknown service', async () => {
      const response = await request(app).get('/health/services/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Unknown service: unknown',
      });
    });

    it('should return 503 for unhealthy service', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection timeout'));

      const response = await request(app).get('/health/services/redis');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        service: 'redis',
        status: 'unhealthy',
        error: 'Connection timeout',
      });
    });
  });
});