/**
 * Database-related type definitions
 */

// PostgreSQL supported parameter types
export type QueryParameter = 
  | string 
  | number 
  | boolean 
  | Date 
  | Buffer 
  | null 
  | undefined
  | QueryParameter[]; // Arrays of any of the above

// Query parameter array
export type QueryParameters = ReadonlyArray<QueryParameter>;

// Query result row - can be customized per query
export type QueryRow = Record<string, unknown>;

// Batch query definition
export interface BatchQuery {
  text: string;
  params?: QueryParameters;
}

// Query execution options
export interface QueryExecutionOptions {
  timeout?: number;
  retries?: number;
  readReplica?: boolean;
}

// Database transaction interface
export interface DatabaseTransaction {
  query<T extends QueryRow = QueryRow>(
    text: string,
    params?: QueryParameters
  ): Promise<T[]>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// Connection pool stats
export interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
}