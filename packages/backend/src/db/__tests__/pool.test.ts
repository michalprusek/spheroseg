import { DatabasePool } from '../pool';
import { Pool } from 'pg';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('pg');
jest.mock('../../utils/logger');

describe('DatabasePool', () => {
  let dbPool: DatabasePool;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Pool instance
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn().mockReturnThis(),
      totalCount: 10,
      idleCount: 5,
      waitingCount: 0,
    } as any;

    (Pool as unknown as jest.Mock).mockImplementation(() => mockPool);
  });

  describe('constructor', () => {
    it('should create pool with default configuration', () => {
      dbPool = new DatabasePool('postgresql://localhost/test');

      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://localhost/test',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        maxUses: 7500,
        statement_timeout: 30000,
        query_timeout: 30000,
      });
    });

    it('should create pool with custom configuration', () => {
      const config = {
        max: 50,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 5000,
        maxUses: 10000,
      };

      dbPool = new DatabasePool('postgresql://localhost/test', config);

      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://localhost/test',
        ...config,
        statement_timeout: 30000,
        query_timeout: 30000,
      });
    });

    it('should register event handlers', () => {
      dbPool = new DatabasePool('postgresql://localhost/test');

      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('acquire', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
    });
  });

  describe('query', () => {
    beforeEach(() => {
      dbPool = new DatabasePool('postgresql://localhost/test');
    });

    it('should execute query successfully', async () => {
      const mockResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };
      (mockPool.query as jest.Mock).mockResolvedValue(mockResult as any);

      const result = await dbPool.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
    });

    it('should handle query errors', async () => {
      const error = new Error('Database error');
      (mockPool.query as jest.Mock).mockRejectedValue(error);

      await expect(dbPool.query('SELECT * FROM invalid_table')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Query error:', error);
    });

    it('should log slow queries', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      
      // Mock a slow query
      (mockPool.query as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockResult as any), 2000);
        });
      });

      jest.useFakeTimers();
      const queryPromise = dbPool.query('SELECT * FROM large_table');
      jest.advanceTimersByTime(2000);
      jest.useRealTimers();

      await queryPromise;

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected')
      );
    });
  });

  describe('transaction', () => {
    let mockClient: any;

    beforeEach(() => {
      dbPool = new DatabasePool('postgresql://localhost/test');
      
      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    });

    it('should execute transaction successfully', async () => {
      const callback = jest.fn().mockResolvedValue({ success: true });

      const result = await dbPool.transaction(callback);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Transaction error');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(dbPool.transaction(callback)).rejects.toThrow('Transaction error');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Transaction error:', error);
    });

    it('should release client even if rollback fails', async () => {
      const transactionError = new Error('Transaction error');
      const rollbackError = new Error('Rollback error');
      
      const callback = jest.fn().mockRejectedValue(transactionError);
      mockClient.query.mockImplementation((query: string) => {
        if (query === 'ROLLBACK') {
          return Promise.reject(rollbackError);
        }
        return Promise.resolve();
      });

      await expect(dbPool.transaction(callback)).rejects.toThrow('Transaction error');

      expect(mockClient.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Error rolling back transaction:', rollbackError);
    });
  });

  describe('getPoolStats', () => {
    beforeEach(() => {
      dbPool = new DatabasePool('postgresql://localhost/test');
    });

    it('should return pool statistics', () => {
      const stats = dbPool.getPoolStats();

      expect(stats).toEqual({
        total: 10,
        idle: 5,
        waiting: 0,
      });
    });
  });

  describe('end', () => {
    beforeEach(() => {
      dbPool = new DatabasePool('postgresql://localhost/test');
    });

    it('should close the pool', async () => {
      await dbPool.end();

      expect(mockPool.end).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Database pool closed');
    });

    it('should handle errors when closing pool', async () => {
      const error = new Error('Close error');
      (mockPool.end as jest.Mock).mockRejectedValue(error);

      await expect(dbPool.end()).rejects.toThrow('Close error');
      expect(logger.error).toHaveBeenCalledWith('Error closing database pool:', error);
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      dbPool = new DatabasePool('postgresql://localhost/test');
    });

    it('should handle pool errors', () => {
      const errorHandler = (mockPool.on as jest.Mock).mock.calls.find(call => call[0] === 'error')?.[1];
      const error = new Error('Pool error');
      
      errorHandler?.(error, {} as any);

      expect(logger.error).toHaveBeenCalledWith('Unexpected database pool error:', error);
    });

    it('should log new connections', () => {
      const connectHandler = (mockPool.on as jest.Mock).mock.calls.find(call => call[0] === 'connect')?.[1];
      
      connectHandler?.({} as any);

      expect(logger.debug).toHaveBeenCalledWith('New client connected to pool');
    });

    it('should track client acquisition', () => {
      const acquireHandler = (mockPool.on as jest.Mock).mock.calls.find(call => call[0] === 'acquire')?.[1];
      
      acquireHandler?.({} as any);

      expect(logger.debug).toHaveBeenCalledWith('Client acquired from pool');
    });

    it('should log client removal', () => {
      const removeHandler = (mockPool.on as jest.Mock).mock.calls.find(call => call[0] === 'remove')?.[1];
      
      removeHandler?.({} as any);

      expect(logger.debug).toHaveBeenCalledWith('Client removed from pool');
    });
  });
});