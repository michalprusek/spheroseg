/**
 * Database Performance Monitoring Source
 * 
 * Monitors PostgreSQL database performance including connection pool,
 * query performance, lock analysis, and transaction statistics.
 */

import pool from '../../db';
import logger from '../../utils/logger';
import { MonitoringSource } from '../unified/performanceCoordinator';
import { PerformanceMetric } from '../optimized/performanceOptimizer';

interface DatabaseConfig {
  includeSlowQueries: boolean;
  slowQueryThresholdMs: number;
  includeLockAnalysis: boolean;
  includeConnectionStats: boolean;
  includeTableStats: boolean;
  includeIndexStats: boolean;
}

class DatabaseSource implements MonitoringSource {
  public readonly id = 'database';
  public readonly name = 'Database Performance Monitor';
  public readonly priority = 'high' as const;
  public enabled = true;
  public intervalMs = 60000; // 1 minute
  public lastCollection?: number;

  private config: DatabaseConfig;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = {
      includeSlowQueries: true,
      slowQueryThresholdMs: 1000,
      includeLockAnalysis: true,
      includeConnectionStats: true,
      includeTableStats: true,
      includeIndexStats: false, // Can be resource intensive
      ...config,
    };
  }

  public async collectMetrics(): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = [];
    const timestamp = Date.now();

    try {
      // Connection pool metrics
      await this.collectConnectionMetrics(metrics, timestamp);

      // Basic database stats
      await this.collectBasicStats(metrics, timestamp);

      // Query performance metrics
      if (this.config.includeSlowQueries) {
        await this.collectQueryMetrics(metrics, timestamp);
      }

      // Lock analysis
      if (this.config.includeLockAnalysis) {
        await this.collectLockMetrics(metrics, timestamp);
      }

      // Table statistics
      if (this.config.includeTableStats) {
        await this.collectTableStats(metrics, timestamp);
      }

      // Index statistics
      if (this.config.includeIndexStats) {
        await this.collectIndexStats(metrics, timestamp);
      }

    } catch (error) {
      logger.error('Error collecting database metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      metrics.push({
        id: `db_error_${timestamp}`,
        name: 'database_collection_error',
        value: 1,
        unit: 'count',
        category: 'database',
        timestamp,
        source: this.id,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    return metrics;
  }

  private async collectConnectionMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      // Connection pool stats
      const poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      };

      Object.entries(poolStats).forEach(([key, value]) => {
        metrics.push({
          id: `connection_${key}_${timestamp}`,
          name: `connection_${key}`,
          value: value,
          unit: 'count',
          category: 'database',
          timestamp,
          source: this.id,
        });
      });

      // Connection pool utilization
      const utilization = pool.totalCount > 0 ? 
        ((pool.totalCount - pool.idleCount) / pool.totalCount) * 100 : 0;

      metrics.push({
        id: `connection_utilization_${timestamp}`,
        name: 'connection_pool_utilization',
        value: utilization,
        unit: 'percentage',
        category: 'database',
        timestamp,
        source: this.id,
      });

    } catch (error) {
      logger.error('Error collecting connection metrics', { error });
    }
  }

  private async collectBasicStats(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      // Database size
      const sizeResult = await pool.query(`
        SELECT pg_database_size(current_database()) as database_size;
      `);

      if (sizeResult.rows.length > 0) {
        metrics.push({
          id: `database_size_${timestamp}`,
          name: 'database_size',
          value: parseInt(sizeResult.rows[0].database_size),
          unit: 'bytes',
          category: 'database',
          timestamp,
          source: this.id,
        });
      }

      // Transaction stats
      const txnStatsResult = await pool.query(`
        SELECT 
          xact_commit,
          xact_rollback,
          blks_read,
          blks_hit,
          tup_returned,
          tup_fetched,
          tup_inserted,
          tup_updated,
          tup_deleted
        FROM pg_stat_database 
        WHERE datname = current_database();
      `);

      if (txnStatsResult.rows.length > 0) {
        const stats = txnStatsResult.rows[0];
        
        Object.entries(stats).forEach(([key, value]) => {
          metrics.push({
            id: `db_stat_${key}_${timestamp}`,
            name: `database_${key}`,
            value: parseInt(value) || 0,
            unit: 'count',
            category: 'database',
            timestamp,
            source: this.id,
          });
        });

        // Calculate cache hit ratio
        const totalReads = (parseInt(stats.blks_read) || 0) + (parseInt(stats.blks_hit) || 0);
        const cacheHitRatio = totalReads > 0 ? 
          ((parseInt(stats.blks_hit) || 0) / totalReads) * 100 : 0;

        metrics.push({
          id: `cache_hit_ratio_${timestamp}`,
          name: 'database_cache_hit_ratio',
          value: cacheHitRatio,
          unit: 'percentage',
          category: 'database',
          timestamp,
          source: this.id,
        });
      }

      // Active connections
      const connectionsResult = await pool.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = current_database();
      `);

      if (connectionsResult.rows.length > 0) {
        const connStats = connectionsResult.rows[0];
        
        Object.entries(connStats).forEach(([key, value]) => {
          metrics.push({
            id: `connection_${key}_${timestamp}`,
            name: `database_${key}`,
            value: parseInt(value) || 0,
            unit: 'count',
            category: 'database',
            timestamp,
            source: this.id,
          });
        });
      }

    } catch (error) {
      logger.error('Error collecting basic database stats', { error });
    }
  }

  private async collectQueryMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      // Check if pg_stat_statements extension is available
      const extensionCheck = await pool.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as has_pg_stat_statements;
      `);

      if (extensionCheck.rows[0]?.has_pg_stat_statements) {
        // Get query performance stats
        const queryStatsResult = await pool.query(`
          SELECT 
            count(*) as total_queries,
            sum(calls) as total_calls,
            avg(mean_exec_time) as avg_execution_time,
            max(max_exec_time) as max_execution_time,
            sum(total_exec_time) as total_execution_time,
            count(*) FILTER (WHERE mean_exec_time > $1) as slow_queries
          FROM pg_stat_statements
          WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database());
        `, [this.config.slowQueryThresholdMs]);

        if (queryStatsResult.rows.length > 0) {
          const stats = queryStatsResult.rows[0];
          
          Object.entries(stats).forEach(([key, value]) => {
            const numValue = parseFloat(value) || 0;
            metrics.push({
              id: `query_${key}_${timestamp}`,
              name: `query_${key}`,
              value: numValue,
              unit: key.includes('time') ? 'ms' : 'count',
              category: 'database',
              timestamp,
              source: this.id,
            });
          });
        }

        // Get top slow queries
        const slowQueriesResult = await pool.query(`
          SELECT 
            left(query, 100) as query_snippet,
            calls,
            mean_exec_time,
            total_exec_time
          FROM pg_stat_statements
          WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND mean_exec_time > $1
          ORDER BY mean_exec_time DESC
          LIMIT 5;
        `, [this.config.slowQueryThresholdMs]);

        if (slowQueriesResult.rows.length > 0) {
          slowQueriesResult.rows.forEach((row, index) => {
            metrics.push({
              id: `slow_query_${index}_${timestamp}`,
              name: 'slow_query_execution_time',
              value: parseFloat(row.mean_exec_time),
              unit: 'ms',
              category: 'database',
              timestamp,
              source: this.id,
              metadata: {
                query_snippet: row.query_snippet,
                calls: row.calls,
                total_time: row.total_exec_time,
              },
            });
          });
        }
      }

    } catch (error) {
      logger.error('Error collecting query metrics', { error });
    }
  }

  private async collectLockMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      // Current locks
      const locksResult = await pool.query(`
        SELECT 
          mode,
          count(*) as lock_count
        FROM pg_locks 
        WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
        GROUP BY mode;
      `);

      locksResult.rows.forEach(row => {
        metrics.push({
          id: `lock_${row.mode}_${timestamp}`,
          name: 'database_locks',
          value: parseInt(row.lock_count),
          unit: 'count',
          category: 'database',
          timestamp,
          source: this.id,
          metadata: {
            lock_mode: row.mode,
          },
        });
      });

      // Blocking queries
      const blockingResult = await pool.query(`
        SELECT count(*) as blocking_queries
        FROM pg_stat_activity
        WHERE state = 'active' 
          AND query != '<IDLE>'
          AND query_start < NOW() - INTERVAL '30 seconds'
          AND datname = current_database();
      `);

      if (blockingResult.rows.length > 0) {
        metrics.push({
          id: `blocking_queries_${timestamp}`,
          name: 'blocking_queries',
          value: parseInt(blockingResult.rows[0].blocking_queries),
          unit: 'count',
          category: 'database',
          timestamp,
          source: this.id,
        });
      }

    } catch (error) {
      logger.error('Error collecting lock metrics', { error });
    }
  }

  private async collectTableStats(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      // Table statistics for key application tables
      const tableStatsResult = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND tablename IN ('users', 'images', 'segmentation_results', 'segmentation_queue')
        ORDER BY (n_tup_ins + n_tup_upd + n_tup_del) DESC;
      `);

      tableStatsResult.rows.forEach(row => {
        // Calculate scan efficiency
        const totalScans = (row.seq_scan || 0) + (row.idx_scan || 0);
        const indexScanRatio = totalScans > 0 ? ((row.idx_scan || 0) / totalScans) * 100 : 0;

        metrics.push({
          id: `table_index_scan_ratio_${row.tablename}_${timestamp}`,
          name: 'table_index_scan_ratio',
          value: indexScanRatio,
          unit: 'percentage',
          category: 'database',
          timestamp,
          source: this.id,
          metadata: {
            table: row.tablename,
            schema: row.schemaname,
          },
        });

        // Dead tuple ratio
        const totalTuples = (row.live_tuples || 0) + (row.dead_tuples || 0);
        const deadTupleRatio = totalTuples > 0 ? ((row.dead_tuples || 0) / totalTuples) * 100 : 0;

        metrics.push({
          id: `table_dead_tuple_ratio_${row.tablename}_${timestamp}`,
          name: 'table_dead_tuple_ratio',
          value: deadTupleRatio,
          unit: 'percentage',
          category: 'database',
          timestamp,
          source: this.id,
          metadata: {
            table: row.tablename,
            live_tuples: row.live_tuples,
            dead_tuples: row.dead_tuples,
          },
        });

        // Table activity metrics
        ['inserts', 'updates', 'deletes', 'live_tuples'].forEach(metric => {
          metrics.push({
            id: `table_${metric}_${row.tablename}_${timestamp}`,
            name: `table_${metric}`,
            value: parseInt(row[metric]) || 0,
            unit: 'count',
            category: 'database',
            timestamp,
            source: this.id,
            metadata: {
              table: row.tablename,
            },
          });
        });
      });

    } catch (error) {
      logger.error('Error collecting table stats', { error });
    }
  }

  private async collectIndexStats(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      // Index usage statistics
      const indexStatsResult = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('users', 'images', 'segmentation_results', 'segmentation_queue')
        ORDER BY idx_scan DESC;
      `);

      indexStatsResult.rows.forEach(row => {
        metrics.push({
          id: `index_scans_${row.indexname}_${timestamp}`,
          name: 'index_scans',
          value: parseInt(row.idx_scan) || 0,
          unit: 'count',
          category: 'database',
          timestamp,
          source: this.id,
          metadata: {
            index: row.indexname,
            table: row.tablename,
            tuples_read: row.idx_tup_read,
            tuples_fetched: row.idx_tup_fetch,
          },
        });
      });

      // Unused indexes (potential optimization targets)
      const unusedIndexesResult = await pool.query(`
        SELECT count(*) as unused_indexes
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
          AND idx_scan = 0
          AND indexname NOT LIKE '%_pkey';
      `);

      if (unusedIndexesResult.rows.length > 0) {
        metrics.push({
          id: `unused_indexes_${timestamp}`,
          name: 'unused_indexes',
          value: parseInt(unusedIndexesResult.rows[0].unused_indexes),
          unit: 'count',
          category: 'database',
          timestamp,
          source: this.id,
        });
      }

    } catch (error) {
      logger.error('Error collecting index stats', { error });
    }
  }
}

export default DatabaseSource;