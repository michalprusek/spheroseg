/**
 * Database Monitoring Tests
 */

import dbMonitoring from '../index';
import fs from 'fs';
import path from 'path';
import { exportPatternsToJson, generateGrafanaDashboard } from '../exportPatterns';

// Mock the DB pool
jest.mock('../../optimized', () => ({
  query: jest.fn().mockImplementation(async (text, params) => {
    if (text.includes('SELECT') && params[0] === 1) {
      return { rows: [{ id: 1, name: 'Test' }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }),
  connect: jest.fn().mockImplementation(async () => ({
    query: jest.fn(),
    release: jest.fn()
  })),
  on: jest.fn(),
  totalCount: 10,
  idleCount: 5,
  waitingCount: 0
}));

// Mock prom-client to avoid registering real metrics
jest.mock('prom-client', () => {
  const actual = jest.requireActual('prom-client');
  return {
    ...actual,
    Registry: jest.fn().mockImplementation(() => ({
      registerMetric: jest.fn(),
      metrics: jest.fn().mockResolvedValue('metrics data'),
      contentType: 'text/plain',
      getMetricsAsArray: jest.fn().mockReturnValue([])
    })),
    Counter: jest.fn().mockImplementation(() => ({
      inc: jest.fn()
    })),
    Gauge: jest.fn().mockImplementation(() => ({
      set: jest.fn()
    })),
    Histogram: jest.fn().mockImplementation(() => ({
      observe: jest.fn()
    }))
  };
});

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock filesystem operations
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

describe('Database Monitoring Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Query Monitoring', () => {
    it('should execute a monitored query', async () => {
      // Execute a test query
      const result = await dbMonitoring.query('SELECT * FROM users WHERE id = $1', [1]);
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(1);
    });
    
    it('should handle query errors', async () => {
      // Mock the DB pool to throw an error
      const mockPool = require('../../optimized');
      mockPool.query.mockImplementationOnce(() => {
        throw new Error('DB query error');
      });
      
      // Execute a query that will fail
      await expect(
        dbMonitoring.query('SELECT * FROM invalid_table', [])
      ).rejects.toThrow('DB query error');
    });
  });
  
  describe('Transaction Handling', () => {
    it('should handle transactions', async () => {
      // Mock client.query for transaction
      const mockPool = require('../../optimized');
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);
      
      // Execute a transaction
      await dbMonitoring.withTransaction(async (client) => {
        await client.query('INSERT INTO users (name) VALUES ($1)', ['Test User']);
        return { success: true };
      });
      
      // Verify transaction operations
      expect(mockClient.query).toHaveBeenCalledTimes(2); // BEGIN and COMMIT
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
    
    it('should rollback on transaction error', async () => {
      // Mock client.query for transaction with error
      const mockPool = require('../../optimized');
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);
      
      // Execute a transaction that will fail
      await expect(
        dbMonitoring.withTransaction(async () => {
          throw new Error('Transaction error');
        })
      ).rejects.toThrow('Transaction error');
      
      // Verify rollback was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Pattern Analysis', () => {
    it('should get top slow queries', () => {
      // Initialize internal state by performing some queries
      dbMonitoring.getTopSlowQueries(10); // This will initialize an empty array
      
      // Should return an array (empty in this test case)
      const slowQueries = dbMonitoring.getTopSlowQueries();
      expect(Array.isArray(slowQueries)).toBe(true);
    });
    
    it('should get query patterns by table', () => {
      // Should return an array (empty in this test case)
      const tableQueries = dbMonitoring.getQueryPatternsByTable('users');
      expect(Array.isArray(tableQueries)).toBe(true);
    });
    
    it('should get query frequency stats', () => {
      // Should return an object
      const frequencyStats = dbMonitoring.getQueryFrequencyStats();
      expect(typeof frequencyStats).toBe('object');
    });
    
    it('should reset pattern stats', () => {
      // This should not throw an error
      expect(() => {
        dbMonitoring.resetPatternStats();
      }).not.toThrow();
    });
  });
  
  describe('Exporting Functionality', () => {
    it('should export patterns to JSON', async () => {
      await exportPatternsToJson('/tmp/test-patterns.json');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
    
    it('should generate a Grafana dashboard', () => {
      const dashboard = generateGrafanaDashboard();
      expect(dashboard).toBeDefined();
      expect(dashboard.panels).toBeDefined();
      expect(Array.isArray(dashboard.panels)).toBe(true);
    });
  });
  
  describe('Metrics Registry', () => {
    it('should provide access to metrics registry', () => {
      expect(dbMonitoring.registry).toBeDefined();
    });
    
    it('should get metrics as string', async () => {
      const metrics = await dbMonitoring.getMetrics();
      expect(typeof metrics).toBe('string');
    });
    
    it('should provide content type for metrics', () => {
      const contentType = dbMonitoring.getContentType();
      expect(typeof contentType).toBe('string');
    });
  });
  
  describe('Configuration', () => {
    it('should allow setting slow query threshold', () => {
      // This should not throw an error
      expect(() => {
        dbMonitoring.setSlowQueryThreshold(1000);
      }).not.toThrow();
    });
    
    it('should initialize monitoring', () => {
      // This should not throw an error
      expect(() => {
        dbMonitoring.init();
      }).not.toThrow();
    });
  });
});