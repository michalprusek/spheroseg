import { query, getPool } from '../connection';
import { config } from '../../config/app';

// Mock config
jest.mock('../../config/app', () => ({
  config: {
    db: {
      host: 'test-host',
      port: 5432,
      name: 'test-db',
      user: 'test-user',
      password: 'test-password'
    }
  }
}));

// Create mock objects outside the mock function so we can reference them in tests
const mockClient = {
  query: jest.fn().mockResolvedValue([]),
  release: jest.fn()
};

const mockPool = {
  query: jest.fn().mockResolvedValue([]),
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(mockClient)
};

// Mock pg
const Pool = jest.fn().mockImplementation(() => mockPool);
jest.mock('pg', () => ({
  Pool
}));

describe('Database Connection', () => {
  beforeEach(() => {
    // Reset the mocks
    jest.clearAllMocks();
    mockClient.query.mockClear();
    mockClient.release.mockClear();
    mockPool.query.mockClear();
    mockPool.on.mockClear();
    mockPool.connect.mockClear();

    // Reset the module to ensure we get a fresh instance
    jest.resetModules();

    // Re-import to reset the singleton
    jest.isolateModules(() => {
      const connection = require('../connection');
      connection.default = mockPool;
    });
  });

  describe('getPool', () => {
    it('should create a new pool with correct config', () => {
      const pool = getPool();

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.password
      }));

      expect(pool).toBeDefined();
    });

    it('should return the same pool instance on subsequent calls', () => {
      const pool1 = getPool();
      const pool2 = getPool();

      expect(Pool).toHaveBeenCalledTimes(1);
      expect(pool1).toBe(pool2);
    });
  });

  describe('query', () => {
    it('should execute query with correct parameters', async () => {
      // Setup mock client to return test data
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test' }] });

      // Call the function under test
      const result = await query('SELECT * FROM test WHERE id = $1', [1]);

      // Verify the mock was called correctly
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('should throw error if query fails', async () => {
      // Setup mock client to throw an error
      const mockError = new Error('Database error');
      mockClient.query.mockRejectedValueOnce(mockError);

      // Call the function under test and verify it throws
      await expect(query('SELECT * FROM test WHERE id = $1', [1])).rejects.toThrow(mockError);

      // Verify the client was released even though the query failed
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
