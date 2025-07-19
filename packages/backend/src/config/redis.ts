/**
 * Redis Configuration
 * 
 * Centralized Redis client configuration and connection management
 */

import Redis from 'ioredis';
import logger from '../utils/logger';

// Redis connection options
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  
  // Connection options
  connectTimeout: 10000,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  
  // Retry strategy
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`);
    return delay;
  },
  
  // Reconnect on error
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
};

// Create Redis client
let redis: Redis | null = null;

/**
 * Initialize Redis connection
 */
export function initializeRedis(): Redis {
  if (redis) {
    return redis;
  }
  
  const isEnabled = process.env.ENABLE_REDIS_CACHE !== 'false';
  
  if (!isEnabled) {
    logger.info('Redis caching is disabled');
    return null as any;
  }
  
  try {
    redis = new Redis(redisConfig);
    
    // Connection event handlers
    redis.on('connect', () => {
      logger.info('Redis client connected successfully');
    });
    
    redis.on('ready', () => {
      logger.info('Redis client ready to accept commands');
    });
    
    redis.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });
    
    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
    
    redis.on('reconnecting', (time: number) => {
      logger.info(`Redis client reconnecting in ${time}ms`);
    });
    
    redis.on('end', () => {
      logger.warn('Redis connection ended');
    });
    
    return redis;
  } catch (error) {
    logger.error('Failed to initialize Redis client', { error });
    return null as any;
  }
}

/**
 * Get Redis client instance
 */
export function getRedis(): Redis | null {
  if (!redis) {
    return initializeRedis();
  }
  return redis;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed');
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedis();
  if (!client) {
    return false;
  }
  
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.warn('Redis health check failed', { error });
    return false;
  }
}

// Default export
export default getRedis();