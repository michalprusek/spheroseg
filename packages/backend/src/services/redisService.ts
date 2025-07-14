import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import logger from '../utils/logger';

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    // Initialize connection if Redis URL is provided
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.connect();
    } else {
      logger.warn('Redis URL not provided, Redis features will be disabled');
    }
  }

  private async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.error('Redis connection failed after 3 retries');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 1000, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error', { error: err });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis Client Ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.info('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', { error });
      this.isConnected = false;
      throw error;
    }
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      if (!this.isConnected) {
        await this.connect();
      }
      await this.client.ping();
      return true;
    } catch (error) {
      logger.debug('Redis is not available', { error });
      return false;
    }
  }

  public async getClient(): Promise<RedisClientType | null> {
    if (!this.client) {
      return null;
    }

    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Failed to reconnect to Redis', { error });
        return null;
      }
    }

    return this.client;
  }

  public async get(key: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      if (!client) return null;
      
      return await client.get(key);
    } catch (error) {
      logger.error('Redis GET error', { error, key });
      return null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      if (ttl) {
        await client.setEx(key, ttl, value);
      } else {
        await client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', { error, key });
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error', { error, key });
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', { error, key });
      return false;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      const result = await client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE error', { error, key });
      return false;
    }
  }

  public async ttl(key: string): Promise<number> {
    try {
      const client = await this.getClient();
      if (!client) return -2;

      return await client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error', { error, key });
      return -2;
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    try {
      const client = await this.getClient();
      if (!client) return [];

      return await client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error', { error, pattern });
      return [];
    }
  }

  public async flush(): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      await client.flushAll();
      return true;
    } catch (error) {
      logger.error('Redis FLUSH error', { error });
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        this.client = null;
        this.isConnected = false;
        logger.info('Redis client disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis client', { error });
    }
  }
}

// Export singleton instance
const redisService = new RedisService();
export default redisService;