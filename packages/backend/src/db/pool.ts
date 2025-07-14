import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import { logger } from '../utils/logger';

export interface DatabasePoolConfig extends PoolConfig {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  maxUses?: number;
}

export interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
}

export class DatabasePool {
  private pool: Pool;
  private slowQueryThreshold = 1000; // 1 second

  constructor(connectionString: string, config?: DatabasePoolConfig) {
    const poolConfig: PoolConfig = {
      connectionString,
      max: config?.max || 20, // Maximum number of clients in the pool
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000, // 30 seconds
      connectionTimeoutMillis: config?.connectionTimeoutMillis || 2000, // 2 seconds
      maxUses: config?.maxUses || 7500, // Close connections after this many uses
      statement_timeout: 30000, // 30 seconds statement timeout
      query_timeout: 30000, // 30 seconds query timeout
      ...config,
    };

    this.pool = new Pool(poolConfig);
    this.setupEventHandlers();
    
    logger.info('Database pool created with configuration:', {
      max: poolConfig.max,
      idleTimeoutMillis: poolConfig.idleTimeoutMillis,
      connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
    });
  }

  private setupEventHandlers(): void {
    this.pool.on('error', (err, client) => {
      logger.error('Unexpected database pool error:', err);
    });

    this.pool.on('connect', (client) => {
      logger.debug('New client connected to pool');
    });

    this.pool.on('acquire', (client) => {
      logger.debug('Client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      logger.debug('Client removed from pool');
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    
    try {
      const result = await this.pool.query<T>(text, params);
      
      const duration = Date.now() - start;
      if (duration > this.slowQueryThreshold) {
        logger.warn(`Slow query detected (${duration}ms):`, {
          query: text.substring(0, 100),
          duration,
        });
      }

      return result;
    } catch (error) {
      logger.error('Query error:', error);
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Error rolling back transaction:', rollbackError);
      }
      logger.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  getPoolStats(): PoolStats {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  async end(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('Database pool closed');
    } catch (error) {
      logger.error('Error closing database pool:', error);
      throw error;
    }
  }
}