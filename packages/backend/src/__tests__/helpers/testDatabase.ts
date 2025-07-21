/**
 * Test Database Utilities with Transaction Support
 * 
 * Provides proper database transaction handling for tests to ensure:
 * - Tests are isolated from each other
 * - Database state is rolled back after each test
 * - No test data persists in the database
 */

import { Pool, PoolClient } from 'pg';
import pool from '../../config/database';

export interface TestTransaction {
  client: PoolClient;
  query: (text: string, values?: any[]) => Promise<any>;
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
  release: () => void;
}

/**
 * Create a test transaction that will be rolled back after the test
 */
export async function createTestTransaction(): Promise<TestTransaction> {
  const client = await pool.connect();
  
  // Start transaction
  await client.query('BEGIN');
  
  // Create savepoint for nested transactions
  await client.query('SAVEPOINT test_transaction');
  
  return {
    client,
    query: (text: string, values?: any[]) => client.query(text, values),
    rollback: async () => {
      await client.query('ROLLBACK TO SAVEPOINT test_transaction');
    },
    commit: async () => {
      await client.query('RELEASE SAVEPOINT test_transaction');
    },
    release: () => {
      client.release();
    }
  };
}

/**
 * Wrapper for running tests within a database transaction
 * Automatically rolls back all changes after the test
 */
export async function withTransaction<T>(
  testFn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await testFn(client);
    await client.query('ROLLBACK');
    return result;
  } finally {
    client.release();
  }
}

/**
 * Clean up test data from specific tables
 * Used when transaction rollback is not sufficient
 */
export async function cleanupTestData(tables: string[] = []): Promise<void> {
  const defaultTables = [
    'cells',
    'segmentation_results',
    'segmentation_queue',
    'segmentation_tasks',
    'images',
    'projects',
    'user_profiles',
    'users'
  ];
  
  const tablesToClean = tables.length > 0 ? tables : defaultTables;
  
  const client = await pool.connect();
  try {
    for (const table of tablesToClean) {
      // Only delete test data (identified by email pattern or name pattern)
      switch (table) {
        case 'users':
          await client.query(
            "DELETE FROM users WHERE email LIKE '%@test.%' OR email LIKE '%test@%'"
          );
          break;
        case 'projects':
          await client.query(
            "DELETE FROM projects WHERE name LIKE 'Test %' OR name LIKE '%[TEST]%'"
          );
          break;
        default:
          // For other tables, delete based on related test users
          await client.query(`
            DELETE FROM ${table} 
            WHERE user_id IN (
              SELECT id FROM users 
              WHERE email LIKE '%@test.%' OR email LIKE '%test@%'
            )
          `);
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Create test database schema
 * Used for isolated test databases
 */
export async function createTestSchema(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create schema if not exists
    await client.query('CREATE SCHEMA IF NOT EXISTS test_schema');
    
    // Set search path to test schema
    await client.query('SET search_path TO test_schema');
    
    // Create tables (copy from production schema)
    const createTableQueries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Projects table
      `CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Images table
      `CREATE TABLE IF NOT EXISTS images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        segmentation_status VARCHAR(50) DEFAULT 'without_segmentation',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Add more tables as needed
    ];
    
    for (const query of createTableQueries) {
      await client.query(query);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Drop test schema
 * Used for cleanup after all tests
 */
export async function dropTestSchema(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('DROP SCHEMA IF EXISTS test_schema CASCADE');
  } finally {
    client.release();
  }
}

/**
 * Test data factory for creating consistent test data
 */
export class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      email: `test-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      ...overrides
    };
  }
  
  static createProject(userId: string, overrides = {}) {
    return {
      name: `Test Project ${Date.now()}`,
      description: 'Test project description',
      user_id: userId,
      ...overrides
    };
  }
  
  static createImage(projectId: string, overrides = {}) {
    return {
      project_id: projectId,
      name: `test-image-${Date.now()}.jpg`,
      file_path: `/test/path/image-${Date.now()}.jpg`,
      file_size: 1024000,
      width: 1920,
      height: 1080,
      segmentation_status: 'without_segmentation',
      ...overrides
    };
  }
}

/**
 * Database connection test helper
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Get test pool with specific configuration
 */
export function getTestPool(config = {}): Pool {
  return new Pool({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: process.env.TEST_DB_NAME || 'spheroseg_test',
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
    max: 5, // Limit connections for tests
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 5000,
    ...config
  });
}