/**
 * Test Helper Utilities
 *
 * Common utilities for backend tests
 */

import { Pool, PoolClient } from 'pg';
import express from 'express';
import jwt from 'jsonwebtoken';

// Type-safe mock pool
export interface MockPool extends Partial<Pool> {
  query: jest.Mock;
  connect: jest.Mock;
  end?: jest.Mock;
}

export interface MockPoolClient extends Partial<PoolClient> {
  query: jest.Mock;
  release: jest.Mock;
}

export function createMockPool(): MockPool {
  const mockClient: MockPoolClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  return {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn(),
  };
}

export function createMockPoolWithTransaction(): MockPool {
  const pool = createMockPool();
  const client = pool.connect() as unknown as MockPoolClient;

  // Setup transaction methods
  client.query.mockImplementation((query: string) => {
    if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });

  return pool;
}

// Type-safe Express app setup
export function createTestApp(): express.Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock authentication middleware
  app.use((req: any, _res, next) => {
    req.user = { userId: 'test-user-123' };
    next();
  });

  return app;
}

// JWT token generation
export function generateTestToken(userId: string = 'test-user-123'): string {
  return jwt.sign({ userId, email: 'test@example.com' }, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h',
  });
}

// Type-safe Socket.IO mock
export interface MockSocketIO {
  to: jest.Mock;
  emit: jest.Mock;
  in: jest.Mock;
  of: jest.Mock;
}

export function createMockSocketIO(): MockSocketIO {
  const mock: MockSocketIO = {
    to: jest.fn(),
    emit: jest.fn(),
    in: jest.fn(),
    of: jest.fn(),
  };

  // Chain methods
  mock.to.mockReturnValue(mock);
  mock.in.mockReturnValue(mock);
  mock.of.mockReturnValue(mock);

  return mock;
}

// Database query builders
export function createCountQuery(count: number) {
  return { rows: [{ count: count.toString() }], rowCount: 1 };
}

export function createRowsQuery<T>(rows: T[]) {
  return { rows, rowCount: rows.length };
}

// Async test utilities
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition not met within timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// Performance test utilities
export function measurePerformance<T>(fn: () => T | Promise<T>): {
  result: T | Promise<T>;
  duration: number;
} {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  return { result, duration };
}

// Error matchers
export function expectErrorWithCode(error: Error & { code?: string }, code: string): void {
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
}

export function expectValidationError(error: Error & { name?: string; field?: string }, field?: string): void {
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe('ValidationError');
  if (field) {
    expect(error.message).toContain(field);
  }
}
