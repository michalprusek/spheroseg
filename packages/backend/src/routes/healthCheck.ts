import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import axios from 'axios';
import os from 'os';
import { DatabasePool } from '../db/pool';
import { BullQueueService } from '../services/bullQueueService';
import { logger } from '../utils/logger';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    database: string;
    redis: string;
    queue: string;
    ml: string;
  };
}

interface DetailedHealthStatus extends HealthStatus {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  services: {
    database: any;
    redis: any;
    queue: any;
    ml: any;
  };
}

export function createHealthCheckRouter(
  dbPool: DatabasePool,
  queueService: BullQueueService,
  redisUrl: string
): Router {
  const router = Router();
  const startTime = Date.now();
  const redis = new Redis(redisUrl);
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml:5002';

  // Basic health check
  router.get('/', async (req: Request, res: Response) => {
    try {
      const health = await checkAllServices();
      const status = determineOverallStatus(health);
      
      const response: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        services: health,
      };

      res.status(status === 'unhealthy' ? 503 : 200).json(response);
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  });

  // Detailed health check
  router.get('/detailed', async (req: Request, res: Response) => {
    try {
      const detailed = await checkAllServicesDetailed();
      const status = determineOverallStatus({
        database: detailed.database.status,
        redis: detailed.redis.status,
        queue: detailed.queue.status,
        ml: detailed.ml.status,
      });

      const memory = process.memoryUsage();
      const totalMemory = os.totalmem();
      
      const response: DetailedHealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        memory: {
          used: memory.heapUsed,
          total: totalMemory,
          percentage: Math.round((memory.heapUsed / totalMemory) * 100),
        },
        services: detailed,
      };

      res.status(status === 'unhealthy' ? 503 : 200).json(response);
    } catch (error) {
      logger.error('Detailed health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  });

  // Readiness probe (for Kubernetes)
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      const dbHealthy = await checkDatabase();
      const redisHealthy = await checkRedis();
      
      const ready = dbHealthy === 'healthy' && redisHealthy === 'healthy';
      
      res.status(ready ? 200 : 503).json({
        ready,
        services: {
          database: dbHealthy,
          redis: redisHealthy,
        },
      });
    } catch (error) {
      res.status(503).json({
        ready: false,
        error: 'Readiness check failed',
      });
    }
  });

  // Liveness probe (for Kubernetes)
  router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
    });
  });

  // Individual service health checks
  router.get('/services/:service', async (req: Request, res: Response) => {
    const { service } = req.params;
    
    try {
      let result: any;
      
      switch (service) {
        case 'database':
          result = await checkDatabaseDetailed();
          break;
        case 'redis':
          result = await checkRedisDetailed();
          break;
        case 'queue':
          result = await checkQueueDetailed();
          break;
        case 'ml':
          result = await checkMLDetailed();
          break;
        default:
          return res.status(404).json({ error: `Unknown service: ${service}` });
      }

      const statusCode = result.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json({
        service,
        ...result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(503).json({
        service,
        status: 'unhealthy',
        error: errorMessage,
      });
    }
  });

  // Service check functions
  async function checkDatabase(): Promise<string> {
    try {
      await dbPool.query('SELECT NOW()');
      return 'healthy';
    } catch (error) {
      logger.error('Database health check failed:', error);
      return 'unhealthy';
    }
  }

  async function checkDatabaseDetailed() {
    try {
      await dbPool.query('SELECT NOW()');
      const poolStats = dbPool.getPoolStats();
      
      return {
        status: 'healthy',
        details: {
          pool: poolStats,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async function checkRedis(): Promise<string> {
    try {
      const pong = await redis.ping();
      return pong === 'PONG' ? 'healthy' : 'unhealthy';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return 'unhealthy';
    }
  }

  async function checkRedisDetailed() {
    try {
      await redis.ping();
      const info = await redis.info();
      
      // Parse Redis info
      const lines = info.split('\r\n');
      const version = lines.find(line => line.startsWith('redis_version:'))?.split(':')[1] || 'unknown';
      const usedMemory = lines.find(line => line.startsWith('used_memory:'))?.split(':')[1] || '0';
      
      return {
        status: 'healthy',
        details: {
          info: {
            version,
            used_memory: formatBytes(parseInt(usedMemory)),
          },
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async function checkQueue(): Promise<string> {
    try {
      const metrics = await queueService.getQueueMetrics();
      return 'healthy';
    } catch (error) {
      logger.error('Queue health check failed:', error);
      return 'unhealthy';
    }
  }

  async function checkQueueDetailed() {
    try {
      const metrics = await queueService.getQueueMetrics();
      
      return {
        status: 'healthy',
        details: {
          metrics,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async function checkML(): Promise<string> {
    try {
      const response = await axios.get(`${mlServiceUrl}/health`, { timeout: 5000 });
      return response.status === 200 ? 'healthy' : 'unhealthy';
    } catch (error) {
      logger.error('ML service health check failed:', error);
      return 'unhealthy';
    }
  }

  async function checkMLDetailed() {
    try {
      const response = await axios.get(`${mlServiceUrl}/health`, { timeout: 5000 });
      
      return {
        status: 'healthy',
        details: response.data,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async function checkAllServices() {
    const [database, redis, queue, ml] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkQueue(),
      checkML(),
    ]);

    return {
      database,
      redis,
      queue,
      ml,
    };
  }

  async function checkAllServicesDetailed() {
    const [database, redis, queue, ml] = await Promise.all([
      checkDatabaseDetailed(),
      checkRedisDetailed(),
      checkQueueDetailed(),
      checkMLDetailed(),
    ]);

    return {
      database,
      redis,
      queue,
      ml,
    };
  }

  function determineOverallStatus(services: Record<string, string>): 'healthy' | 'unhealthy' | 'degraded' {
    const critical = ['database', 'redis'];
    const nonCritical = ['queue', 'ml'];

    // If any critical service is unhealthy, the overall status is unhealthy
    if (critical.some(service => services[service] === 'unhealthy')) {
      return 'unhealthy';
    }

    // If any non-critical service is unhealthy, the overall status is degraded
    if (nonCritical.some(service => services[service] === 'unhealthy')) {
      return 'degraded';
    }

    return 'healthy';
  }

  function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  return router;
}