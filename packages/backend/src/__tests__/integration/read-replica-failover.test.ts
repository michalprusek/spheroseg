/**
 * Integration tests for PostgreSQL Read Replica Failover
 *
 * Tests failover scenarios, replication lag handling, and connection pooling
 */
import { Pool, PoolClient } from 'pg';
import {
  initializeReadReplicas,
  getPool,
  query,
  transaction,
  getReplicationLag,
  getPoolStats,
  closeReadReplicaPools,
} from '../../db/readReplica';
import logger from '../../utils/logger';
import config from '../../config';

// Mock dependencies
jest.mock('pg');
jest.mock('../../utils/logger');
jest.mock('../../config', () => ({
  db: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  },
}));

describe('Read Replica Failover', () => {
  let mockWritePool: jest.Mocked<Pool>;
  let mockReadPool: jest.Mocked<Pool>;
  let mockMasterPool: jest.Mocked<Pool>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset environment variables
    process.env.ENABLE_READ_REPLICAS = 'true';
    process.env.DATABASE_WRITE_URL = 'postgresql://postgres:pass@master:5432/test';
    process.env.DATABASE_READ_URL = 'postgresql://postgres:pass@replica:5432/test';

    // Create mock pools
    mockWritePool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      totalCount: 20,
      idleCount: 15,
      waitingCount: 0,
    } as any;

    mockReadPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      totalCount: 20,
      idleCount: 18,
      waitingCount: 0,
    } as any;

    mockMasterPool = config.db as any;

    // Mock Pool constructor
    (Pool as jest.MockedClass<typeof Pool>).mockImplementation((config: any) => {
      if (config.host === 'master') {
        return mockWritePool as any;
      } else if (config.host === 'replica') {
        return mockReadPool as any;
      }
      return mockMasterPool as any;
    });
  });

  afterEach(async () => {
    await closeReadReplicaPools();
  });

  describe('Replica Failure Scenarios', () => {
    it('should fallback to master on replica connection failure', async () => {
      // Initialize read replicas
      initializeReadReplicas();

      // Mock replica failure
      mockReadPool.query.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      // Mock master success
      mockMasterPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
      } as any);

      // Attempt read query
      const result = await query('SELECT * FROM users WHERE id = $1', [1]);

      // Verify fallback occurred
      expect(mockReadPool.query).toHaveBeenCalledTimes(1);
      expect(mockMasterPool.query).toHaveBeenCalledTimes(1);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ id: 1, name: 'Test' });

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith('Read replica unavailable, falling back to master');
    });

    it('should handle replica timeout gracefully', async () => {
      initializeReadReplicas();

      // Mock replica timeout
      mockReadPool.query.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Query timeout'));
          }, 100);
        });
      });

      // Mock master success
      mockMasterPool.query.mockResolvedValueOnce({
        rows: [{ count: '42' }],
        rowCount: 1,
      } as any);

      // Attempt read query with timeout handling
      const startTime = Date.now();
      const result = await query('SELECT COUNT(*) FROM images', []);
      const duration = Date.now() - startTime;

      // Verify timeout was handled quickly
      expect(duration).toBeLessThan(200); // Should fail fast
      expect(result.rows[0].count).toBe('42');
    });

    it('should continue using master after multiple replica failures', async () => {
      initializeReadReplicas();

      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        mockReadPool.query.mockRejectedValueOnce({
          code: 'ECONNREFUSED',
          message: 'Connection refused',
        });

        mockMasterPool.query.mockResolvedValueOnce({
          rows: [{ id: i }],
          rowCount: 1,
        } as any);

        await query(`SELECT * FROM test WHERE id = $1`, [i]);
      }

      // After multiple failures, should stop trying replica
      mockMasterPool.query.mockResolvedValueOnce({
        rows: [{ id: 99 }],
        rowCount: 1,
      } as any);

      await query('SELECT * FROM test WHERE id = $1', [99]);

      // Verify replica was not attempted on last query
      expect(mockReadPool.query).toHaveBeenCalledTimes(5); // Not 6
    });
  });

  describe('Replication Lag Handling', () => {
    it('should monitor replication lag', async () => {
      initializeReadReplicas();

      // Mock replication lag query
      mockReadPool.query.mockResolvedValueOnce({
        rows: [{ lag_seconds: 2 }],
        rowCount: 1,
      } as any);

      const lag = await getReplicationLag();

      expect(lag).toBe(2);
      expect(mockReadPool.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_last_xact_replay_timestamp')
      );
    });

    it('should handle high replication lag', async () => {
      initializeReadReplicas();

      // Mock high replication lag
      mockReadPool.query.mockImplementation((sql: string) => {
        if (sql.includes('pg_last_xact_replay_timestamp')) {
          return Promise.resolve({
            rows: [{ lag_seconds: 15 }], // High lag
            rowCount: 1,
          } as any);
        }
        return Promise.resolve({ rows: [], rowCount: 0 } as any);
      });

      // Check lag
      const lag = await getReplicationLag();
      expect(lag).toBe(15);

      // For time-sensitive reads, should use master
      const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [1],
        { forceWrite: true } // Force master for consistency
      );

      expect(mockWritePool.query).toHaveBeenCalled();
      expect(mockReadPool.query).not.toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('should return null lag when replicas are disabled', async () => {
      process.env.ENABLE_READ_REPLICAS = 'false';
      initializeReadReplicas();

      const lag = await getReplicationLag();
      expect(lag).toBeNull();
    });
  });

  describe('Connection Pool Management', () => {
    it('should track pool statistics', async () => {
      initializeReadReplicas();

      const stats = await getPoolStats();

      expect(stats).toEqual({
        replicas_enabled: true,
        write_pool: {
          total: 20,
          idle: 15,
          waiting: 0,
        },
        read_pool: {
          total: 20,
          idle: 18,
          waiting: 0,
        },
      });
    });

    it('should handle pool exhaustion', async () => {
      initializeReadReplicas();

      // Simulate pool exhaustion
      mockReadPool.idleCount = 0;
      mockReadPool.waitingCount = 10;

      const stats = await getPoolStats();

      expect(stats.read_pool).toEqual({
        total: 20,
        idle: 0,
        waiting: 10,
      });

      // Should log warning about pool exhaustion
      if (stats.read_pool!.waiting > 5) {
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Connection pool'));
      }
    });

    it('should clean up pools on shutdown', async () => {
      initializeReadReplicas();

      await closeReadReplicaPools();

      expect(mockWritePool.end).toHaveBeenCalled();
      expect(mockReadPool.end).toHaveBeenCalled();
    });
  });

  describe('Query Routing', () => {
    it('should route SELECT queries to read replica', async () => {
      initializeReadReplicas();

      mockReadPool.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
      } as any);

      await query('SELECT * FROM users');

      expect(mockReadPool.query).toHaveBeenCalled();
      expect(mockWritePool.query).not.toHaveBeenCalled();
    });

    it('should route write queries to master', async () => {
      initializeReadReplicas();

      mockWritePool.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
      } as any);

      await query('INSERT INTO users (name) VALUES ($1) RETURNING *', ['Test']);

      expect(mockWritePool.query).toHaveBeenCalled();
      expect(mockReadPool.query).not.toHaveBeenCalled();
    });

    it('should handle complex queries correctly', async () => {
      initializeReadReplicas();

      // CTE read query should go to replica
      mockReadPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      await query(`
        WITH user_stats AS (
          SELECT user_id, COUNT(*) as count
          FROM images
          GROUP BY user_id
        )
        SELECT * FROM user_stats
      `);

      expect(mockReadPool.query).toHaveBeenCalled();

      // CTE with INSERT should go to master
      mockWritePool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      } as any);

      await query(`
        WITH new_user AS (
          INSERT INTO users (name) VALUES ('Test')
          RETURNING *
        )
        SELECT * FROM new_user
      `);

      expect(mockWritePool.query).toHaveBeenCalled();
    });
  });

  describe('Transaction Handling', () => {
    it('should always use write pool for transactions', async () => {
      initializeReadReplicas();

      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      } as any;

      mockWritePool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await transaction(async (client) => {
        await client.query('SELECT * FROM users');
        await client.query('UPDATE users SET name = $1', ['Test']);
      });

      expect(mockWritePool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      initializeReadReplicas();

      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      } as any;

      mockWritePool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockRejectedValueOnce(new Error('Constraint violation')); // Query fails

      await expect(
        transaction(async (client) => {
          await client.query('INSERT INTO users (email) VALUES ($1)', ['duplicate@test.com']);
        })
      ).rejects.toThrow('Constraint violation');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Monitoring Integration', () => {
    it('should expose metrics for Prometheus', async () => {
      initializeReadReplicas();

      // Mock successful queries
      mockReadPool.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      mockWritePool.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      // Perform some queries
      await query('SELECT * FROM users');
      await query('INSERT INTO logs (data) VALUES ($1)', ['test']);

      // Get pool stats for metrics
      const stats = await getPoolStats();

      // Verify metrics data structure
      expect(stats).toHaveProperty('replicas_enabled', true);
      expect(stats).toHaveProperty('write_pool');
      expect(stats).toHaveProperty('read_pool');
    });

    it('should track slow queries on replicas', async () => {
      initializeReadReplicas();

      // Mock slow query
      mockReadPool.query.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ rows: [], rowCount: 0 } as any);
          }, 150); // Slow query
        });
      });

      await query('SELECT * FROM large_table');

      // Verify slow query was logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow query'),
        expect.objectContaining({
          duration: expect.any(Number),
          rows: 0,
        })
      );
    });
  });
});
