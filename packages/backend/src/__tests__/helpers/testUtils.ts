/**
 * Test Utilities
 * 
 * Common utilities and helpers for backend tests
 */

import { QueryResult, QueryResultRow } from 'pg';

/**
 * Create a properly typed mock QueryResult for database queries
 */
export function createMockQueryResult<T extends QueryResultRow = any>(
  rows: T[],
  command: string = 'SELECT'
): QueryResult<T> {
  return {
    rows,
    command,
    rowCount: rows.length,
    oid: 0,
    fields: [],
  };
}

/**
 * Create a mock user object for testing
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: '123',
    email: 'test@example.com',
    password_hash: 'hashedPassword',
    name: 'Test User',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock project object for testing
 */
export function createMockProject(overrides: Partial<any> = {}) {
  return {
    id: '456',
    name: 'Test Project',
    description: 'Test project description',
    user_id: '123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock image object for testing
 */
export function createMockImage(overrides: Partial<any> = {}) {
  return {
    id: '789',
    project_id: '456',
    filename: 'test-image.jpg',
    original_filename: 'test-image.jpg',
    file_path: '/uploads/test-image.jpg',
    file_size: 1024,
    mime_type: 'image/jpeg',
    segmentation_status: 'without_segmentation',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock Express request object
 */
export function createMockRequest(overrides: Partial<any> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: '123', email: 'test@example.com' },
    ip: '127.0.0.1',
    method: 'GET',
    url: '/test',
    path: '/test',
    ...overrides,
  };
}

/**
 * Create a mock Express response object
 */
export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    locals: {},
    statusCode: 200,
  };
  return res;
}

/**
 * Create a mock Express next function
 */
export function createMockNext() {
  return jest.fn();
}

/**
 * Sleep utility for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a test JWT token
 */
export function generateTestJWT(payload: any = { userId: '123', email: 'test@example.com' }) {
  // This is a mock JWT for testing - in real tests you'd use the actual JWT library
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(payload))}.signature`;
}

/**
 * Assert that a function throws with a specific message
 */
export async function expectToThrow(
  fn: () => Promise<any> | any,
  expectedMessage?: string
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error message to include "${expectedMessage}", but got: "${error.message}"`
      );
    }
  }
}

/**
 * Create a mock database transaction
 */
export function createMockTransaction() {
  return {
    query: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  };
}

/**
 * Create mock Redis client
 */
export function createMockRedis() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    setex: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hgetall: jest.fn(),
    hmset: jest.fn(),
    hdel: jest.fn(),
    keys: jest.fn(),
    pipeline: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    }),
  };
}

/**
 * Test data builders
 */
export const TestDataBuilder = {
  user: (overrides?: Partial<any>) => createMockUser(overrides),
  project: (overrides?: Partial<any>) => createMockProject(overrides),
  image: (overrides?: Partial<any>) => createMockImage(overrides),
  request: (overrides?: Partial<any>) => createMockRequest(overrides),
  response: () => createMockResponse(),
  next: () => createMockNext(),
};