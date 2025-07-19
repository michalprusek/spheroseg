import express, { Request, Response, Router } from 'express';
import pool from '../db';
import logger from '../utils/logger';
import config from '../config';
import performanceConfig from '../config/performance';
import { getContainerMemoryInfo } from '../utils/containerInfo';
import axios from 'axios';
import os from 'os';

const router: Router = express.Router();

interface HealthCheckComponent {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  responseTime?: number;
  details?: any;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  components: {
    api: HealthCheckComponent;
    database: HealthCheckComponent;
    mlService: HealthCheckComponent;
    memory: HealthCheckComponent;
    fileSystem: HealthCheckComponent;
  };
}

// GET /api/health - Basic health check endpoint
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const includeDetails = req.query.details === 'true';
  
  try {
    // Run all checks in parallel
    const [dbCheck, mlCheck, memoryCheck, fsCheck] = await Promise.all([
      checkDatabase(),
      checkMLService(),
      checkMemory(),
      checkFileSystem()
    ]);

    // Determine overall health status
    const components = {
      api: { status: 'healthy' as const, responseTime: Date.now() - startTime },
      database: dbCheck,
      mlService: mlCheck,
      memory: memoryCheck,
      fileSystem: fsCheck
    };

    const statuses = Object.values(components).map(c => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime(),
      environment: config.env || process.env.NODE_ENV || 'development',
      components
    };

    // Remove details if not requested
    if (!includeDetails) {
      Object.values(response.components).forEach(component => {
        delete component.details;
      });
    }

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);

    // Log health check result
    if (overallStatus !== 'healthy') {
      logger.warn('Health check completed with issues', response);
    }
  } catch (error) {
    logger.error('Health check failed', { error });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime(),
      environment: config.env || process.env.NODE_ENV || 'development',
      components: {
        api: { status: 'unhealthy', message: 'Health check error' },
        database: { status: 'unknown' },
        mlService: { status: 'unknown' },
        memory: { status: 'unknown' },
        fileSystem: { status: 'unknown' }
      },
      error: error.message
    });
  }
});

// GET /api/health/live - Kubernetes liveness probe
router.get('/live', async (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
});

// GET /api/health/ready - Kubernetes readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check only critical dependencies for readiness
    const dbCheck = await checkDatabase();
    
    if (dbCheck.status === 'unhealthy') {
      res.status(503).json({ 
        status: 'not_ready',
        reason: 'Database not available',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    res.status(200).json({ 
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions for health checks

async function checkDatabase(): Promise<HealthCheckComponent> {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT 1 as health_check');
    const responseTime = Date.now() - start;
    
    // Check response time
    if (responseTime > performanceConfig.healthCheck.dbTimeoutMs) {
      return {
        status: 'degraded',
        message: 'Database response slow',
        responseTime,
        details: { threshold: performanceConfig.healthCheck.dbTimeoutMs }
      };
    }
    
    return {
      status: 'healthy',
      message: 'Database connected',
      responseTime
    };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      responseTime: Date.now() - start,
      details: { error: error.message }
    };
  }
}

async function checkMLService(): Promise<HealthCheckComponent> {
  const start = Date.now();
  try {
    const mlServiceUrl = config.ml?.serviceUrl || process.env.ML_SERVICE_URL || 'http://ml:5002';
    
    // First check if checkpoint exists
    if (!config.segmentation?.checkpointExists) {
      return {
        status: 'degraded',
        message: 'ML checkpoint missing',
        responseTime: 0,
        details: { checkpointPath: config.segmentation?.checkpointPath }
      };
    }
    
    // Try to reach ML service
    const response = await axios.get(`${mlServiceUrl}/health`, {
      timeout: 5000
    });
    
    const responseTime = Date.now() - start;
    
    if (response.status !== 200) {
      return {
        status: 'degraded',
        message: 'ML service not healthy',
        responseTime,
        details: { statusCode: response.status }
      };
    }
    
    return {
      status: 'healthy',
      message: 'ML service available',
      responseTime
    };
  } catch (error) {
    // ML service being down is degraded, not unhealthy
    return {
      status: 'degraded',
      message: 'ML service unreachable',
      responseTime: Date.now() - start,
      details: { error: error.message }
    };
  }
}

async function checkMemory(): Promise<HealthCheckComponent> {
  try {
    const memInfo = getContainerMemoryInfo();
    const heapUsed = process.memoryUsage().heapUsed;
    const heapTotal = process.memoryUsage().heapTotal;
    const heapPercentage = (heapUsed / heapTotal) * 100;
    
    const details = {
      container: {
        used: memInfo.used,
        limit: memInfo.limit,
        percentage: memInfo.percentage
      },
      heap: {
        used: heapUsed,
        total: heapTotal,
        percentage: heapPercentage
      }
    };
    
    // Check thresholds
    if (memInfo.percentage > performanceConfig.memory.thresholds.unhealthy ||
        heapPercentage > performanceConfig.memory.thresholds.heapUnhealthy) {
      return {
        status: 'unhealthy',
        message: 'Memory usage critical',
        details
      };
    }
    
    if (memInfo.percentage > performanceConfig.memory.thresholds.degraded ||
        heapPercentage > performanceConfig.memory.thresholds.heapDegraded) {
      return {
        status: 'degraded',
        message: 'Memory usage high',
        details
      };
    }
    
    return {
      status: 'healthy',
      message: 'Memory usage normal',
      details
    };
  } catch (error) {
    // If we can't check memory, that's degraded not unhealthy
    return {
      status: 'degraded',
      message: 'Unable to check memory',
      details: { error: error.message }
    };
  }
}

async function checkFileSystem(): Promise<HealthCheckComponent> {
  const start = Date.now();
  try {
    // Check if uploads directory exists and is writable
    const fs = require('fs').promises;
    const uploadDir = '/uploads';
    
    // Check if directory exists
    await fs.access(uploadDir, fs.constants.F_OK);
    
    // Check if we can write
    const testFile = `${uploadDir}/.health-check-${Date.now()}.tmp`;
    await fs.writeFile(testFile, 'health check');
    await fs.unlink(testFile);
    
    return {
      status: 'healthy',
      message: 'File system writable',
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'File system not writable',
      responseTime: Date.now() - start,
      details: { error: error.message }
    };
  }
}

export default router;
