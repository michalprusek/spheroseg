/**
 * Backend performance test utilities for optimizing test execution speed and reliability
 */

import { jest } from '@jest/globals';

// Backend performance tracking utilities
export class BackendTestPerformanceTracker {
  private static timers = new Map<string, number>();
  private static metrics = new Map<string, number[]>();

  static startTimer(testName: string): void {
    this.timers.set(testName, performance.now());
  }

  static endTimer(testName: string): number {
    const startTime = this.timers.get(testName);
    if (!startTime) {
      console.warn(`Timer not found for test: ${testName}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(testName);
    
    // Store metric
    const existing = this.metrics.get(testName) || [];
    existing.push(duration);
    this.metrics.set(testName, existing);
    
    return duration;
  }

  static getAverageTime(testName: string): number {
    const times = this.metrics.get(testName) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  static getAllMetrics(): Record<string, { average: number; runs: number; min: number; max: number }> {
    const results: Record<string, { average: number; runs: number; min: number; max: number }> = {};
    
    this.metrics.forEach((times, testName) => {
      if (times.length > 0) {
        results[testName] = {
          average: times.reduce((a, b) => a + b, 0) / times.length,
          runs: times.length,
          min: Math.min(...times),
          max: Math.max(...times),
        };
      }
    });
    
    return results;
  }

  static clearMetrics(): void {
    this.timers.clear();
    this.metrics.clear();
  }
}

// Backend test setup optimizations
export const setupBackendPerformanceTest = (testName: string) => {
  BackendTestPerformanceTracker.startTimer(testName);
  
  return {
    cleanup: () => {
      const duration = BackendTestPerformanceTracker.endTimer(testName);
      return duration;
    }
  };
};

// Mock cache for backend mocks
const backendMockCache = new Map<string, any>();

export const getCachedBackendMock = <T = any>(key: string, factory: () => T): T => {
  if (!backendMockCache.has(key)) {
    backendMockCache.set(key, factory());
  }
  return backendMockCache.get(key);
};

export const clearBackendMockCache = (): void => {
  backendMockCache.clear();
};

// Database connection pool for testing
export class TestDatabasePool {
  private static connections = new Map<string, any>();
  private static maxConnections = 5;
  
  static async getConnection(_dbName = 'test'): Promise<any> {
    const existingConnections = Array.from(this.connections.values()).filter(conn => !conn.busy);
    
    if (existingConnections.length > 0) {
      const conn = existingConnections[0];
      conn.busy = true;
      return conn;
    }
    
    if (this.connections.size >= this.maxConnections) {
      // Wait for a connection to become available
      return new Promise((resolve) => {
        const checkConnection = () => {
          const availableConn = Array.from(this.connections.values()).find(conn => !conn.busy);
          if (availableConn) {
            availableConn.busy = true;
            resolve(availableConn);
          } else {
            setTimeout(checkConnection, 10);
          }
        };
        checkConnection();
      });
    }
    
    // Create new connection (mocked)
    const conn = {
      id: `conn_${this.connections.size}`,
      busy: true,
      query: jest.fn(),
      release: () => {
        conn.busy = false;
      },
      close: () => {
        this.connections.delete(conn.id);
      }
    };
    
    this.connections.set(conn.id, conn);
    return conn;
  }
  
  static releaseConnection(conn: any): void {
    if (conn && conn.release) {
      conn.release();
    }
  }
  
  static closeAllConnections(): void {
    this.connections.forEach(conn => conn.close?.());
    this.connections.clear();
  }
}

// Memory optimization for backend tests
export const optimizeBackendTestMemory = () => {
  const clearMocks = () => {
    jest.clearAllMocks();
    clearBackendMockCache();
  };
  
  const clearConnections = () => {
    TestDatabasePool.closeAllConnections();
  };
  
  const forceGC = () => {
    if (global.gc) {
      global.gc();
    }
  };
  
  return {
    clearMocks,
    clearConnections,
    forceGC,
    clearAll: () => {
      clearMocks();
      clearConnections();
      forceGC();
    }
  };
};

// Async test utilities with timeout management for backend
export const createBackendAsyncTestWrapper = (timeout = 10000) => {
  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Backend test timeout after ${timeout}ms`));
      }, timeout);
      
      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  };
};

// Request/Response factory with caching
export class BackendTestDataFactory {
  private static cache = new Map<string, any>();
  
  static createMockRequest(overrides: Record<string, any> = {}) {
    const cacheKey = `request_${JSON.stringify(overrides)}`;
    return getCachedBackendMock(cacheKey, () => ({
      body: {},
      params: {},
      query: {},
      headers: {
        'content-type': 'application/json',
        'user-agent': 'test-agent'
      },
      user: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com'
      },
      ...overrides,
    }));
  }
  
  static createMockResponse(overrides: Record<string, any> = {}) {
    const cacheKey = `response_${JSON.stringify(overrides)}`;
    return getCachedBackendMock(cacheKey, () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis(),
        locals: {},
        ...overrides,
      };
      return res;
    });
  }
  
  static createMockNext() {
    return getCachedBackendMock('next_function', () => jest.fn());
  }
  
  static createMockDatabase() {
    return getCachedBackendMock('database_mock', () => ({
      query: jest.fn(),
      connect: jest.fn(),
      release: jest.fn(),
      end: jest.fn(),
    }));
  }
  
  static clearCache() {
    this.cache.clear();
  }
}

// Backend performance assertions
export const backendPerformanceAssertions = {
  expectMaxResponseTime: (maxMs: number) => (testName: string) => {
    const avgTime = BackendTestPerformanceTracker.getAverageTime(testName);
    if (avgTime > maxMs) {
      throw new Error(`Test "${testName}" average response time ${avgTime.toFixed(2)}ms exceeds maximum ${maxMs}ms`);
    }
  },
  
  expectMaxMemoryUsage: (maxMB: number) => {
    const memoryUsage = process.memoryUsage();
    const usedMB = memoryUsage.heapUsed / 1024 / 1024;
    if (usedMB > maxMB) {
      throw new Error(`Memory usage ${usedMB.toFixed(2)}MB exceeds maximum ${maxMB}MB`);
    }
  },
  
  expectDatabaseConnections: (maxConnections: number) => {
    const activeConnections = TestDatabasePool['connections'].size;
    if (activeConnections > maxConnections) {
      throw new Error(`Active database connections ${activeConnections} exceeds maximum ${maxConnections}`);
    }
  },
};

// API endpoint testing utilities
export class ApiEndpointTester {
  private _baseUrl: string;
  private _authToken: string | undefined;
  
  constructor(baseUrl = 'http://localhost:3001', authToken?: string) {
    this._baseUrl = baseUrl;
    this._authToken = authToken;
  }
  
  async get(endpoint: string, _headers: Record<string, string> = {}) {
    const { cleanup } = setupBackendPerformanceTest(`GET ${endpoint}`);
    try {
      // Mock fetch for testing
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
        text: async () => 'OK',
        headers: new Headers(),
      };
      
      return mockResponse;
    } finally {
      cleanup();
    }
  }
  
  async post(endpoint: string, data: any = {}, _headers: Record<string, string> = {}) {
    const { cleanup } = setupBackendPerformanceTest(`POST ${endpoint}`);
    try {
      // Mock fetch for testing
      const mockResponse = {
        ok: true,
        status: 201,
        json: async () => ({ success: true, data }),
        text: async () => 'Created',
        headers: new Headers(),
      };
      
      return mockResponse;
    } finally {
      cleanup();
    }
  }
  
  async put(endpoint: string, data: any = {}, _headers: Record<string, string> = {}) {
    const { cleanup } = setupBackendPerformanceTest(`PUT ${endpoint}`);
    try {
      // Mock fetch for testing
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data }),
        text: async () => 'Updated',
        headers: new Headers(),
      };
      
      return mockResponse;
    } finally {
      cleanup();
    }
  }
  
  async delete(endpoint: string, _headers: Record<string, string> = {}) {
    const { cleanup } = setupBackendPerformanceTest(`DELETE ${endpoint}`);
    try {
      // Mock fetch for testing
      const mockResponse = {
        ok: true,
        status: 204,
        json: async () => ({ success: true }),
        text: async () => 'Deleted',
        headers: new Headers(),
      };
      
      return mockResponse;
    } finally {
      cleanup();
    }
  }
}

// Concurrent test runner for backend
export const createBackendConcurrentTestRunner = (maxConcurrency = 2) => {
  const queue: Array<() => Promise<void>> = [];
  let running = 0;
  
  const runNext = async (): Promise<void> => {
    if (queue.length === 0 || running >= maxConcurrency) return;
    
    running++;
    const test = queue.shift();
    if (test) {
      try {
        await test();
      } finally {
        running--;
        runNext();
      }
    }
  };
  
  return {
    add: (test: () => Promise<void>) => {
      queue.push(test);
      runNext();
    },
    
    waitForAll: (): Promise<void> => {
      return new Promise((resolve) => {
        const checkComplete = () => {
          if (queue.length === 0 && running === 0) {
            resolve();
          } else {
            setTimeout(checkComplete, 10);
          }
        };
        checkComplete();
      });
    }
  };
};

export default {
  BackendTestPerformanceTracker,
  setupBackendPerformanceTest,
  getCachedBackendMock,
  clearBackendMockCache,
  TestDatabasePool,
  optimizeBackendTestMemory,
  createBackendAsyncTestWrapper,
  BackendTestDataFactory,
  backendPerformanceAssertions,
  ApiEndpointTester,
  createBackendConcurrentTestRunner,
};