/**
 * Optimized Query Service
 *
 * Advanced database query optimization with connection pooling,
 * prepared statements, query analysis, and intelligent caching
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import logger from '../utils/logger';
import AdvancedCacheService from './advancedCacheService';

interface QueryOptions {
  useCache?: boolean;
  cacheStrategy?: 'HOT' | 'WARM' | 'COLD' | 'STATIC';
  cacheTTL?: number;
  usePreparedStatement?: boolean;
  timeout?: number;
  retries?: number;
  readReplica?: boolean;
}

interface QueryMetrics {
  totalQueries: number;
  averageTime: number;
  slowQueries: number;
  cacheHits: number;
  connectionPoolSize: number;
  preparedStatements: Map<string, number>;
}

interface PreparedStatement {
  name: string;
  text: string;
  params: number;
  lastUsed: number;
  usageCount: number;
}

class OptimizedQueryService {
  private cache: AdvancedCacheService;
  private metrics: QueryMetrics = {
    totalQueries: 0,
    averageTime: 0,
    slowQueries: 0,
    cacheHits: 0,
    connectionPoolSize: 0,
    preparedStatements: new Map(),
  };
  private preparedStatements = new Map<string, PreparedStatement>();
  private queryTimeHistory: number[] = [];
  private slowQueryThreshold = 1000; // 1 second

  constructor(private pool: Pool) {
    this.cache = new AdvancedCacheService(pool);
    this.startMetricsCollection();
  }

  /**
   * Execute optimized query with caching and performance monitoring
   */
  async query<T = any>(
    text: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const queryId = this.generateQueryId(text);

    const {
      useCache = true,
      cacheStrategy = 'WARM',
      usePreparedStatement = true,
      timeout = 30000,
      retries = 2,
      readReplica = false,
    } = options;

    try {
      // Try cache first for SELECT queries
      if (useCache && this.isSelectQuery(text)) {
        const cacheKey = this.generateCacheKey(text, params);
        const cached = await this.cache.get<QueryResult<T>>(cacheKey, cacheStrategy);

        if (cached) {
          this.metrics.cacheHits++;
          logger.debug('Query cache hit', { queryId, cacheKey });
          return cached;
        }
      }

      // Execute query with optimizations
      let result: QueryResult<T>;

      if (usePreparedStatement && this.shouldUsePreparedStatement(text)) {
        result = await this.executePreparedQuery<T>(text, params, timeout);
      } else {
        result = await this.executeDirectQuery<T>(text, params, timeout, retries);
      }

      // Cache result for SELECT queries
      if (useCache && this.isSelectQuery(text) && result.rows.length > 0) {
        const cacheKey = this.generateCacheKey(text, params);
        await this.cache.set(cacheKey, result, cacheStrategy);
      }

      // Update metrics
      this.updateMetrics(startTime, text);

      return result;
    } catch (error) {
      logger.error('Optimized query error', {
        queryId,
        text: text.substring(0, 100),
        params: params.slice(0, 5),
        error,
      });
      throw error;
    }
  }

  /**
   * Execute query with prepared statement
   */
  private async executePreparedQuery<T>(
    text: string,
    params: any[],
    timeout: number
  ): Promise<QueryResult<T>> {
    const preparedName = this.getOrCreatePreparedStatement(text, params.length);

    const client = await this.pool.connect();
    try {
      // Set query timeout
      await client.query(`SET statement_timeout = ${timeout}`);

      // Check if prepared statement exists
      const stmt = this.preparedStatements.get(preparedName);
      if (stmt) {
        stmt.usageCount++;
        stmt.lastUsed = Date.now();
      }

      return await client.query<T>(preparedName, params);
    } finally {
      client.release();
    }
  }

  /**
   * Execute direct query with retry logic
   */
  private async executeDirectQuery<T>(
    text: string,
    params: any[],
    timeout: number,
    retries: number
  ): Promise<QueryResult<T>> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = await this.pool.connect();
        try {
          await client.query(`SET statement_timeout = ${timeout}`);
          return await client.query<T>(text, params);
        } finally {
          client.release();
        }
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries && this.isRetryableError(error)) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          logger.warn('Query failed, retrying', {
            attempt: attempt + 1,
            delay,
            error: error.message,
          });
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError!;
  }

  /**
   * Batch execute multiple queries in a transaction
   */
  async executeBatch<T = any>(
    queries: { text: string; params?: any[] }[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>[]> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const results: QueryResult<T>[] = [];

      for (const query of queries) {
        const result = await client.query<T>(query.text, query.params || []);
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute query with streaming for large result sets
   */
  async queryStream<T = any>(
    text: string,
    params: any[] = [],
    batchSize: number = 1000
  ): Promise<AsyncIterable<T[]>> {
    const client = await this.pool.connect();

    return {
      async *[Symbol.asyncIterator]() {
        try {
          let offset = 0;
          let hasMore = true;

          while (hasMore) {
            const paginatedQuery = `${text} LIMIT ${batchSize} OFFSET ${offset}`;
            const result = await client.query<T>(paginatedQuery, params);

            if (result.rows.length === 0) {
              hasMore = false;
            } else {
              yield result.rows;
              offset += batchSize;
              hasMore = result.rows.length === batchSize;
            }
          }
        } finally {
          client.release();
        }
      },
    };
  }

  /**
   * Get or create prepared statement
   */
  private getOrCreatePreparedStatement(text: string, paramCount: number): string {
    const hash = this.hashQuery(text);
    const name = `prep_${hash}`;

    if (!this.preparedStatements.has(name)) {
      this.preparedStatements.set(name, {
        name,
        text,
        params: paramCount,
        lastUsed: Date.now(),
        usageCount: 0,
      });

      // Create prepared statement asynchronously
      this.createPreparedStatement(name, text).catch((error) => {
        logger.error('Failed to create prepared statement', { name, error });
      });
    }

    return name;
  }

  /**
   * Create prepared statement
   */
  private async createPreparedStatement(name: string, text: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`PREPARE ${name} AS ${text}`);
      this.metrics.preparedStatements.set(name, Date.now());
      logger.debug('Prepared statement created', { name });
    } finally {
      client.release();
    }
  }

  /**
   * Generate cache key for query and parameters
   */
  private generateCacheKey(text: string, params: any[]): string {
    const queryHash = this.hashQuery(text);
    const paramsHash = this.hashParams(params);
    return `query:${queryHash}:${paramsHash}`;
  }

  /**
   * Generate unique query ID for logging
   */
  private generateQueryId(text: string): string {
    return this.hashQuery(text).substring(0, 8);
  }

  /**
   * Hash query text for consistent identification
   */
  private hashQuery(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Hash parameters for cache key
   */
  private hashParams(params: any[]): string {
    const paramString = JSON.stringify(params);
    return this.hashQuery(paramString);
  }

  /**
   * Check if query is a SELECT statement
   */
  private isSelectQuery(text: string): boolean {
    return /^\s*SELECT/i.test(text.trim());
  }

  /**
   * Check if query should use prepared statement
   */
  private shouldUsePreparedStatement(text: string): boolean {
    // Use prepared statements for complex queries with parameters
    const isComplex = text.length > 100 || text.includes('JOIN') || text.includes('WHERE');
    const hasParams = text.includes('$');
    return isComplex && hasParams;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'connection terminated',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some((retryable) => errorMessage.includes(retryable));
  }

  /**
   * Update query metrics
   */
  private updateMetrics(startTime: number, queryText: string): void {
    const duration = Date.now() - startTime;

    this.metrics.totalQueries++;
    this.queryTimeHistory.push(duration);

    // Keep only last 1000 query times for average calculation
    if (this.queryTimeHistory.length > 1000) {
      this.queryTimeHistory.shift();
    }

    this.metrics.averageTime =
      this.queryTimeHistory.reduce((a, b) => a + b, 0) / this.queryTimeHistory.length;

    if (duration > this.slowQueryThreshold) {
      this.metrics.slowQueries++;
      logger.warn('Slow query detected', {
        duration,
        query: queryText.substring(0, 100),
      });
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectConnectionPoolMetrics();
      this.cleanupPreparedStatements();
    }, 60000); // Every minute
  }

  /**
   * Collect connection pool metrics
   */
  private collectConnectionPoolMetrics(): void {
    this.metrics.connectionPoolSize = this.pool.totalCount;

    // Log metrics periodically
    if (this.metrics.totalQueries % 100 === 0 && this.metrics.totalQueries > 0) {
      logger.info('Query metrics', {
        totalQueries: this.metrics.totalQueries,
        averageTime: Math.round(this.metrics.averageTime),
        slowQueries: this.metrics.slowQueries,
        cacheHits: this.metrics.cacheHits,
        connectionPoolSize: this.metrics.connectionPoolSize,
        preparedStatements: this.preparedStatements.size,
      });
    }
  }

  /**
   * Cleanup unused prepared statements
   */
  private cleanupPreparedStatements(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [name, stmt] of this.preparedStatements.entries()) {
      if (now - stmt.lastUsed > maxAge && stmt.usageCount < 5) {
        this.preparedStatements.delete(name);
        this.deallocatePreparedStatement(name).catch((error) => {
          logger.error('Failed to deallocate prepared statement', { name, error });
        });
      }
    }
  }

  /**
   * Deallocate prepared statement
   */
  private async deallocatePreparedStatement(name: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`DEALLOCATE ${name}`);
      this.metrics.preparedStatements.delete(name);
      logger.debug('Prepared statement deallocated', { name });
    } finally {
      client.release();
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current metrics
   */
  getMetrics(): QueryMetrics & { cacheMetrics: any } {
    return {
      ...this.metrics,
      cacheMetrics: this.cache.getMetrics(),
    };
  }

  /**
   * Analyze query performance
   */
  async analyzeQuery(text: string, params: any[] = []): Promise<any> {
    const client = await this.pool.connect();
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${text}`;
      const result = await client.query(explainQuery, params);
      return result.rows[0]['QUERY PLAN'][0];
    } finally {
      client.release();
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateCache(pattern: string): Promise<void> {
    await this.cache.invalidatePattern(pattern);
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    await this.cache.shutdown();

    // Deallocate all prepared statements
    for (const name of this.preparedStatements.keys()) {
      try {
        await this.deallocatePreparedStatement(name);
      } catch (error) {
        logger.error('Error deallocating prepared statement on shutdown', { name, error });
      }
    }
  }
}

export default OptimizedQueryService;
