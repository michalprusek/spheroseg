/**
 * Mock Types for Testing
 *
 * This file provides type definitions for mocks used in tests
 */

import { QueryResult } from 'pg';

/**
 * Create a mock QueryResult object for testing
 */
export function createMockQueryResult<T = any>(rows: T[]): QueryResult<T> {
  return {
    rows,
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
  };
}

/**
 * Type for mocked database query function
 */
export type MockedQuery = jest.MockedFunction<
  (text: string, values?: any[]) => Promise<QueryResult<any>>
>;

/**
 * Type for mocked bcrypt compare function
 */
export type MockedBcryptCompare = jest.MockedFunction<
  (data: string | Buffer, encrypted: string) => Promise<boolean>
>;

/**
 * Type for mocked bcrypt hash function
 */
export type MockedBcryptHash = jest.MockedFunction<
  (data: string | Buffer, saltOrRounds: string | number) => Promise<string>
>;
