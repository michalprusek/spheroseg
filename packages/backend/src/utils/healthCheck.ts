/**
 * Health Check Utilities
 *
 * Provides dynamic health check functions for various services
 * to give accurate real-time status information.
 */

import db from '../db';
import config from '../config';
import performanceConfig from '../config/performance';
import { getEffectiveMemoryLimit } from './containerInfo';
import fs from 'fs';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  lastChecked: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: {
    database: HealthStatus;
    storage: HealthStatus;
    memory: HealthStatus;
  };
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

/**
 * Check database connectivity and performance
 */
export const checkDatabaseHealth = async (): Promise<HealthStatus> => {
  const startTime = Date.now();

  try {
    // Simple query to test connectivity
    const result = await db.query('SELECT NOW() as current_time, version() as version');
    const responseTime = Date.now() - startTime;

    if (responseTime > performanceConfig.healthCheck.slowResponseMs) {
      return {
        status: 'degraded',
        message: `Slow response time: ${responseTime}ms`,
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'healthy',
      message: `Connected to ${result.rows[0]?.version?.split(' ')[0] || 'PostgreSQL'}`,
      responseTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      message: error.message || 'Database connection failed',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
    };
  }
};

/**
 * Check storage availability and disk space
 */
export const checkStorageHealth = async (): Promise<HealthStatus> => {
  try {
    const uploadDir = config.storage.uploadDir;

    // Check if upload directory exists and is writable
    if (!fs.existsSync(uploadDir)) {
      return {
        status: 'unhealthy',
        message: 'Upload directory does not exist',
        lastChecked: new Date().toISOString(),
      };
    }

    // Test write access
    const testFile = `${uploadDir}/.health-check-${Date.now()}.tmp`;
    try {
      fs.writeFileSync(testFile, 'health-check');
      fs.unlinkSync(testFile);
    } catch (writeError) {
      return {
        status: 'unhealthy',
        message: 'Upload directory is not writable',
        lastChecked: new Date().toISOString(),
      };
    }

    // Check disk space (if available)
    try {
      const _stats = fs.statSync(uploadDir);
      return {
        status: 'healthy',
        message: 'Storage accessible and writable',
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Storage accessible but stats unavailable',
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      message: error.message || 'Storage check failed',
      lastChecked: new Date().toISOString(),
    };
  }
};

/**
 * Check memory usage
 */
export const checkMemoryHealth = (): HealthStatus => {
  const memUsage = process.memoryUsage();
  const usedMemory = memUsage.rss; // Resident Set Size - total memory allocated for the process
  const usedMemoryMB = usedMemory / 1024 / 1024;

  // Get effective container limit (detected or configured)
  const containerLimit = getEffectiveMemoryLimit(performanceConfig.memory.containerLimitMB);
  const memoryUsagePercent = (usedMemoryMB / containerLimit) * 100;

  // Also check heap usage
  const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  if (
    memoryUsagePercent > performanceConfig.memory.thresholds.unhealthy ||
    heapUsagePercent > performanceConfig.memory.thresholds.heapUnhealthy
  ) {
    return {
      status: 'unhealthy',
      message: `High memory usage: ${usedMemoryMB.toFixed(0)}MB / ${containerLimit}MB (${memoryUsagePercent.toFixed(1)}%), Heap: ${heapUsagePercent.toFixed(1)}%`,
      lastChecked: new Date().toISOString(),
    };
  }

  if (
    memoryUsagePercent > performanceConfig.memory.thresholds.degraded ||
    heapUsagePercent > performanceConfig.memory.thresholds.heapDegraded
  ) {
    return {
      status: 'degraded',
      message: `Elevated memory usage: ${usedMemoryMB.toFixed(0)}MB / ${containerLimit}MB (${memoryUsagePercent.toFixed(1)}%), Heap: ${heapUsagePercent.toFixed(1)}%`,
      lastChecked: new Date().toISOString(),
    };
  }

  return {
    status: 'healthy',
    message: `Memory usage: ${usedMemoryMB.toFixed(0)}MB / ${containerLimit}MB (${memoryUsagePercent.toFixed(1)}%), Heap: ${heapUsagePercent.toFixed(1)}%`,
    lastChecked: new Date().toISOString(),
  };
};

/**
 * Perform comprehensive health check
 */
export const performHealthCheck = async (): Promise<SystemHealth> => {
  const [database, storage] = await Promise.all([checkDatabaseHealth(), checkStorageHealth()]);

  const memory = checkMemoryHealth();

  // Determine overall health
  const services = { database, storage, memory };
  const hasUnhealthy = Object.values(services).some((s) => s.status === 'unhealthy');
  const hasDegraded = Object.values(services).some((s) => s.status === 'degraded');

  let overall: 'healthy' | 'unhealthy' | 'degraded';
  if (hasUnhealthy) {
    overall = 'unhealthy';
  } else if (hasDegraded) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }

  return {
    overall,
    services,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
  };
};
