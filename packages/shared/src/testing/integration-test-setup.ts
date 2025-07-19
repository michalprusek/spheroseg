/**
 * Integration Test Setup
 * 
 * Common setup for integration tests across the monorepo
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(process.cwd(), '.env.test') });

// Global test configuration
export const integrationTestConfig = {
  // Database
  database: {
    host: process.env['TEST_DB_HOST'] || 'localhost',
    port: parseInt(process.env['TEST_DB_PORT'] || '5432'),
    database: process.env['TEST_DB_NAME'] || 'spheroseg_test',
    user: process.env['TEST_DB_USER'] || 'postgres',
    password: process.env['TEST_DB_PASSWORD'] || 'postgres',
  },
  
  // API endpoints
  api: {
    baseUrl: process.env['TEST_API_URL'] || 'http://localhost:5001',
    timeout: parseInt(process.env['TEST_API_TIMEOUT'] || '5000'),
  },
  
  // ML service
  ml: {
    baseUrl: process.env['TEST_ML_URL'] || 'http://localhost:5002',
    timeout: parseInt(process.env['TEST_ML_TIMEOUT'] || '30000'),
  },
  
  // WebSocket
  websocket: {
    url: process.env['TEST_WS_URL'] || 'ws://localhost:5001',
    timeout: parseInt(process.env['TEST_WS_TIMEOUT'] || '5000'),
  },
  
  // File uploads
  upload: {
    maxSize: parseInt(process.env['TEST_UPLOAD_MAX_SIZE'] || '10485760'), // 10MB
    chunkSize: parseInt(process.env['TEST_UPLOAD_CHUNK_SIZE'] || '5242880'), // 5MB
  },
  
  // Test timeouts
  timeouts: {
    unit: 5000,
    integration: 30000,
    e2e: 60000,
  },
};

// Database connection pool for tests
let testDbPool: any = null;

export async function getTestDbPool() {
  if (!testDbPool) {
    const { Pool } = await import('pg');
    testDbPool = new Pool(integrationTestConfig.database);
  }
  return testDbPool;
}

// Database utilities
export const testDb = {
  async query(text: string, params?: any[]) {
    const pool = await getTestDbPool();
    return pool.query(text, params);
  },
  
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const pool = await getTestDbPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  
  async cleanup() {
    if (testDbPool) {
      await testDbPool.end();
      testDbPool = null;
    }
  },
};

// Test data factories
export const testFactories = {
  user: (overrides = {}) => ({
    id: `test_user_${Date.now()}_${Math.random()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    name: 'Test User',
    ...overrides,
  }),
  
  project: (userId: string, overrides = {}) => ({
    id: `test_project_${Date.now()}_${Math.random()}`,
    userId,
    name: 'Test Project',
    description: 'Test project description',
    ...overrides,
  }),
  
  image: (projectId: string, overrides = {}) => ({
    id: `test_image_${Date.now()}_${Math.random()}`,
    projectId,
    name: 'test.jpg',
    url: 'http://test.com/test.jpg',
    thumbnailUrl: 'http://test.com/thumb.jpg',
    size: 1024000,
    width: 1920,
    height: 1080,
    segmentationStatus: 'without_segmentation',
    ...overrides,
  }),
  
  segmentation: (imageId: string, overrides = {}) => ({
    id: `test_seg_${Date.now()}_${Math.random()}`,
    imageId,
    status: 'completed',
    cellCount: 10,
    metadata: {},
    ...overrides,
  }),
};

// API client for tests
export const testApi = {
  async post(endpoint: string, data: any, options: any = {}) {
    const response = await fetch(`${integrationTestConfig.api.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return response.json();
  },
  
  async get(endpoint: string, options: any = {}) {
    const response = await fetch(`${integrationTestConfig.api.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return response.json();
  },
};

// WebSocket client for tests
export class TestWebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Function>>();
  
  connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(integrationTestConfig.websocket.url);
      if (token) {
        url.searchParams.set('token', token);
      }
      
      this.ws = new WebSocket(url.toString());
      
      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
      
      this.ws.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          const handlers = this.handlers.get(type);
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };
    });
  }
  
  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }
  
  off(event: string, handler?: Function) {
    if (handler) {
      this.handlers.get(event)?.delete(handler);
    } else {
      this.handlers.delete(event);
    }
  }
  
  emit(event: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: event, data }));
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }
}

// Global setup for integration tests
export function setupIntegrationTests() {
  // Set longer timeout for integration tests
  beforeAll(async () => {
    // Ensure test database is ready
    try {
      await testDb.query('SELECT 1');
    } catch (error) {
      console.error('Test database connection failed:', error);
      throw new Error('Integration tests require a running test database');
    }
  }, integrationTestConfig.timeouts.integration);
  
  // Clean up after all tests
  afterAll(async () => {
    await testDb.cleanup();
  });
  
  // Reset test data before each test
  beforeEach(async () => {
    // Clean up common test data patterns
    await testDb.query("DELETE FROM users WHERE email LIKE '%@example.com'");
    await testDb.query("DELETE FROM projects WHERE name LIKE 'Test%'");
  });
}

// Utility to wait for a condition
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (!(await condition())) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

// Utility to create authenticated test context
export async function createAuthenticatedContext() {
  const user = testFactories.user();
  
  // Register user
  const { accessToken, refreshToken } = await testApi.post('/auth/register', {
    email: user.email,
    password: user.password,
    name: user.name,
  });
  
  return {
    user,
    accessToken,
    refreshToken,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

// Export everything
export default {
  config: integrationTestConfig,
  db: testDb,
  factories: testFactories,
  api: testApi,
  WebSocketClient: TestWebSocketClient,
  setupIntegrationTests,
  waitForCondition,
  createAuthenticatedContext,
};