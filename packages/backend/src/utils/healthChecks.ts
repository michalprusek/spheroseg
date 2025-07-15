/**
 * @fileoverview Health Check Utilities
 * 
 * Provides comprehensive health check functions for external services and dependencies
 * including database, Redis, and ML service connectivity monitoring.
 * 
 * @module healthChecks
 * @version 1.0.0
 * @author SpheroSeg Team
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import axios from 'axios';
import config from '../config';
import logger from './logger';

// Database connection pool for health checks
let dbPool: Pool | null = null;

// Redis client for health checks
let redisClient: Redis | null = null;

// Initialize database pool
function getDbPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      ssl: config.db.ssl,
      max: 1, // Only need one connection for health checks
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return dbPool;
}

// Initialize Redis client
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redisClient;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const pool = getDbPool();
    const client = await pool.connect();
    
    try {
      // Simple query to check connectivity
      const result = await client.query('SELECT 1 as health_check, NOW() as timestamp');
      const latency = Date.now() - startTime;
      
      if (result.rows.length === 1) {
        return {
          status: 'healthy',
          latency,
          details: {
            timestamp: result.rows[0].timestamp,
            poolSize: pool.totalCount,
            idleConnections: pool.idleCount,
            waitingClients: pool.waitingCount,
          },
        };
      } else {
        return {
          status: 'unhealthy',
          latency,
          error: 'Unexpected query result',
        };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error('Database health check failed', error);
    
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const client = getRedisClient();
    
    // Connect if not already connected
    if (client.status !== 'ready') {
      await client.connect();
    }
    
    // Test Redis connectivity with ping
    const pong = await client.ping();
    const latency = Date.now() - startTime;
    
    if (pong === 'PONG') {
      return {
        status: 'healthy',
        latency,
        details: {
          status: client.status,
          db: config.redis.db,
        },
      };
    } else {
      return {
        status: 'unhealthy',
        latency,
        error: 'Redis ping failed',
      };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error('Redis health check failed', error);
    
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Check ML service health
 */
export async function checkMLServiceHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const response = await axios.get(`${config.ml.serviceUrl}/health`, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const latency = Date.now() - startTime;
    
    if (response.status === 200) {
      return {
        status: 'healthy',
        latency,
        details: {
          statusCode: response.status,
          serviceUrl: config.ml.serviceUrl,
          data: response.data,
        },
      };
    } else {
      return {
        status: 'degraded',
        latency,
        error: `HTTP ${response.status}`,
        details: {
          statusCode: response.status,
          serviceUrl: config.ml.serviceUrl,
        },
      };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error('ML service health check failed', error);
    
    if (axios.isAxiosError(error)) {
      return {
        status: 'unhealthy',
        latency,
        error: error.message,
        details: {
          code: error.code,
          status: error.response?.status,
          serviceUrl: config.ml.serviceUrl,
        },
      };
    }
    
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Unknown ML service error',
    };
  }
}

/**
 * Check overall system health
 */
export async function checkSystemHealth(): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    ml: HealthCheckResult;
  };
  summary: {
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
  };
}> {
  const [database, redis, ml] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkMLServiceHealth(),
  ]);
  
  const services = { database, redis, ml };
  const results = Object.values(services);
  
  const summary = {
    totalChecks: results.length,
    healthyChecks: results.filter(r => r.status === 'healthy').length,
    degradedChecks: results.filter(r => r.status === 'degraded').length,
    unhealthyChecks: results.filter(r => r.status === 'unhealthy').length,
  };
  
  // Determine overall health
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  
  if (summary.unhealthyChecks > 0) {
    overall = 'unhealthy';
  } else if (summary.degradedChecks > 0) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }
  
  return {
    overall,
    services,
    summary,
  };
}

/**
 * Cleanup function for health check connections
 */
export async function cleanupHealthChecks(): Promise<void> {
  const promises: Promise<void>[] = [];
  
  if (dbPool) {
    promises.push(dbPool.end());
    dbPool = null;
  }
  
  if (redisClient) {
    promises.push(redisClient.quit());
    redisClient = null;
  }
  
  await Promise.allSettled(promises);
}

// Cleanup on process exit
process.on('beforeExit', cleanupHealthChecks);
process.on('SIGTERM', cleanupHealthChecks);
process.on('SIGINT', cleanupHealthChecks);