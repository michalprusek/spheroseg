/**
 * Test Utilities
 *
 * This module exports helpers and utilities for testing the backend.
 * It includes mock implementations for database, filesystem, and authentication.
 */

import { v4 as uuidv4 } from 'uuid';
import express, { Express } from 'express';
import request from 'supertest';
import { createMockDatabase, mockDbModule } from './mockDatabase';
import { createMockFileSystem, mockFsModule, setupTestFiles } from './mockFileSystem';
import { createMockAuthWithTestData, mockJwtModule, mockBcryptModule } from './mockAuth';

// Export database mocking utilities
export * from './mockDatabase';

// Export filesystem mocking utilities
export * from './mockFileSystem';

// Export authentication mocking utilities
export * from './mockAuth';

// Mock user fixture for testing
const createUserFixture = (overrides = {}) => ({
  id: uuidv4(),
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  ...overrides,
});

/**
 * Create a test Express app with common middleware
 */
export const createTestApp = () => {
  const app = express();
  app.use(express.json());
  return app;
};

/**
 * Create a supertest request with the given app
 */
export const createTestRequest = (app: Express) => {
  return request(app);
};

/**
 * Mock authenticated user for server tests
 * @deprecated Use MockAuth.createAuthenticatedRequest instead
 */
export const mockAuthenticatedUser = (user = createUserFixture()) => {
  // Mock the auth middleware
  jest.mock('../security/middleware/auth', () =>
    jest.fn((req, res, next) => {
      req.user = { userId: user.id, email: user.email };
      next();
    })
  );

  return user;
};

/**
 * Mock database pool for server tests
 * @deprecated Use MockDatabase.createMockPool instead
 */
export const mockDatabasePool = (queryResponses: Record<string, any> = {}) => {
  const mockPool = {
    query: jest.fn((query, params) => {
      const queryText = typeof query === 'string' ? query : query.text;

      // Check if there's a specific mock response for this query
      for (const [pattern, response] of Object.entries(queryResponses)) {
        if (queryText.includes(pattern)) {
          return Promise.resolve(response);
        }
      }

      // Default response
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  };

  jest.mock('../db', () => mockPool);

  return mockPool;
};

/**
 * Common test IDs for server tests
 */
export const TEST_IDS = {
  USER_ID: uuidv4(),
  PROJECT_ID: uuidv4(),
  IMAGE_ID: uuidv4(),
};

/**
 * Setup a complete test environment with database, filesystem, and auth mocks
 */
export function setupCompleteTestEnvironment() {
  // Use imported utilities

  // Setup database mock
  const mockDb = createMockDatabase();
  mockDbModule(mockDb);

  // Setup filesystem mock
  const mockFs = createMockFileSystem();
  mockFsModule(mockFs);
  setupTestFiles(mockFs);

  // Setup auth mock
  const mockAuth = createMockAuthWithTestData();
  mockJwtModule();
  mockBcryptModule();

  return {
    db: mockDb,
    fs: mockFs,
    auth: mockAuth,
    app: createTestApp(),
    request: createTestRequest,
    createTestRequest,
  };
}
