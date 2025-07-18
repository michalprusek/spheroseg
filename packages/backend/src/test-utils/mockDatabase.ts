/**
 * Mock Database Utilities for Testing
 *
 * This module provides utilities for mocking database operations in tests.
 * It includes:
 * - In-memory storage for tables
 * - Mock query functions
 * - Simplified database operations (select, insert, update, delete)
 */

import { v4 as uuidv4 } from 'uuid';

// Type definitions
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command?: string;
  oid?: number;
  fields?: Array<{
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
  }>;
}

export interface QueryConfig {
  text: string;
  values?: any[];
  name?: string;
  rowMode?: string;
  types?: {
    getTypeParser: (oid: number, format?: string) => (value: string) => any;
  };
}

export type QueryParams = string | QueryConfig;

export interface PoolClient {
  query<T = any>(queryText: QueryParams, values?: any[]): Promise<QueryResult<T>>;
  release(err?: Error): void;
}

export interface Pool {
  query<T = any>(queryText: QueryParams, values?: any[]): Promise<QueryResult<T>>;
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
  on(event: string, listener: (...args: any[]) => void): this;
}

export interface TableDefinition {
  name: string;
  columns: string[];
  primaryKey?: string;
}

// In-memory table storage
interface Tables {
  [tableName: string]: Record<string, any>[];
}

/**
 * Mock Database class that provides an in-memory database for testing
 */
export class MockDatabase {
  private tables: Tables = {};
  private queryLog: string[] = [];
  private errorPatterns: { [pattern: string]: Error } = {};
  private responseOverrides: { [pattern: string]: QueryResult } = {};

  /**
   * Create the mock database
   * @param tables Optional initial tables configuration
   */
  constructor(initialTables: { [tableName: string]: Record<string, any>[] } = {}) {
    this.tables = { ...initialTables };
  }

  /**
   * Define a table and optionally populate it with data
   * @param tableName Name of the table
   * @param data Optional initial data
   */
  public createTable(tableName: string, data: Record<string, any>[] = []): void {
    this.tables[tableName] = [...data];
  }

  /**
   * Get a reference to the table data (be careful, this allows direct modification)
   * @param tableName Name of the table
   * @returns Array of records in the table
   */
  public getTable(tableName: string): Record<string, any>[] {
    if (!this.tables[tableName]) {
      this.tables[tableName] = [];
    }
    return this.tables[tableName];
  }

  /**
   * Get the query history
   * @returns Array of query strings
   */
  public getQueryLog(): string[] {
    return [...this.queryLog];
  }

  /**
   * Clear all data but keep table structure
   */
  public clearData(): void {
    Object.keys(this.tables).forEach((tableName) => {
      this.tables[tableName] = [];
    });
    this.queryLog = [];
  }

  /**
   * Reset the database completely
   */
  public reset(): void {
    this.tables = {};
    this.queryLog = [];
    this.errorPatterns = {};
    this.responseOverrides = {};
  }

  /**
   * Configure the mock database to return an error for queries matching a pattern
   * @param pattern String pattern to match in the query
   * @param error Error to throw
   */
  public mockErrorForQuery(pattern: string, error: Error): void {
    this.errorPatterns[pattern] = error;
  }

  /**
   * Configure the mock database to return a specific response for queries matching a pattern
   * @param pattern String pattern to match in the query
   * @param response Response to return
   */
  public mockResponseForQuery(pattern: string, response: QueryResult): void {
    this.responseOverrides[pattern] = response;
  }

  /**
   * Create a mock pool object that can be used to replace the real pg.Pool
   * @returns Mock pool object
   */
  public createMockPool(): Pool {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return {
      query: (text: QueryParams, values?: any[]): Promise<QueryResult> => {
        return self.query(text, values);
      },
      connect: (): Promise<PoolClient> => {
        const client: PoolClient = {
          query: (text: QueryParams, values?: any[]): Promise<QueryResult> => {
            return self.query(text, values);
          },
          release: (): void => {
            // Do nothing
          },
        };
        return Promise.resolve(client);
      },
      end: (): Promise<void> => {
        return Promise.resolve();
      },
      on: (event: string, listener: (...args: any[]) => void): Pool => {
        // Do nothing
        return this.createMockPool();
      },
    };
  }

  /**
   * Parse a basic SQL query to extract the operation type, table name, and conditions
   * @param queryText SQL query text
   * @returns Parsed query information
   */
  private parseQuery(queryText: string): {
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN';
    tableName: string | null;
    conditions: Record<string, any>;
    columns: string[];
    values: any[];
  } {
    queryText = queryText.trim();

    // Log the query for debugging/testing
    this.queryLog.push(queryText);

    // Default return structure
    const result = {
      operation: 'UNKNOWN' as const,
      tableName: null,
      conditions: {},
      columns: [],
      values: [],
    };

    // Check for SELECT
    if (queryText.toUpperCase().startsWith('SELECT')) {
      result.operation = 'SELECT';

      // Extract table name (very simplified)
      const fromMatch = queryText.match(/FROM\s+([^\s,;]+)/i);
      if (fromMatch) {
        result.tableName = fromMatch[1];
      }

      // Extract WHERE conditions (very simplified)
      const whereMatch = queryText.match(/WHERE\s+(.+?)(?:ORDER BY|GROUP BY|LIMIT|$)/i);
      if (whereMatch) {
        const conditions = whereMatch[1];

        // Parse basic key-value conditions
        const conditionParts = conditions.split('AND').map((part) => part.trim());
        conditionParts.forEach((condition) => {
          const match = condition.match(
            /([^\s=<>]+)\s*(=|<>|>|<|>=|<=)\s*(?:'([^']*)'|(\d+)|(\$\d+))/
          );
          if (match) {
            const [, column, operator, stringValue, numberValue, placeholder] = match;

            // For placeholder values, we'll handle them separately
            if (!placeholder) {
              result.conditions[column] = stringValue || numberValue;
            }
          }
        });
      }
    }

    // Check for INSERT
    else if (queryText.toUpperCase().startsWith('INSERT')) {
      result.operation = 'INSERT';

      // Extract table name
      const tableMatch = queryText.match(/INTO\s+([^\s(]+)/i);
      if (tableMatch) {
        result.tableName = tableMatch[1];
      }

      // Extract columns
      const columnsMatch = queryText.match(/\(([^)]+)\)\s+VALUES/i);
      if (columnsMatch) {
        result.columns = columnsMatch[1].split(',').map((col) => col.trim());
      }

      // Extract values placeholder
      const valuesMatch = queryText.match(/VALUES\s*\(([^)]+)\)/i);
      if (valuesMatch) {
        result.values = valuesMatch[1].split(',').map((val) => val.trim());
      }
    }

    // Check for UPDATE
    else if (queryText.toUpperCase().startsWith('UPDATE')) {
      result.operation = 'UPDATE';

      // Extract table name
      const tableMatch = queryText.match(/UPDATE\s+([^\s]+)/i);
      if (tableMatch) {
        result.tableName = tableMatch[1];
      }

      // Extract SET values
      const setMatch = queryText.match(/SET\s+(.+?)(?:WHERE|$)/i);
      if (setMatch) {
        const setParts = setMatch[1].split(',').map((part) => part.trim());
        setParts.forEach((part) => {
          const match = part.match(/([^\s=]+)\s*=\s*(?:'([^']*)'|(\d+)|(\$\d+))/);
          if (match) {
            const [, column, stringValue, numberValue, placeholder] = match;

            // For placeholder values, we'll handle them separately
            if (!placeholder) {
              result.columns.push(column);
              result.values.push(stringValue || numberValue);
            }
          }
        });
      }

      // Extract WHERE conditions
      const whereMatch = queryText.match(/WHERE\s+(.+)$/i);
      if (whereMatch) {
        const conditions = whereMatch[1];

        // Parse basic key-value conditions
        const conditionParts = conditions.split('AND').map((part) => part.trim());
        conditionParts.forEach((condition) => {
          const match = condition.match(
            /([^\s=<>]+)\s*(=|<>|>|<|>=|<=)\s*(?:'([^']*)'|(\d+)|(\$\d+))/
          );
          if (match) {
            const [, column, operator, stringValue, numberValue, placeholder] = match;

            // For placeholder values, we'll handle them separately
            if (!placeholder) {
              result.conditions[column] = stringValue || numberValue;
            }
          }
        });
      }
    }

    // Check for DELETE
    else if (queryText.toUpperCase().startsWith('DELETE')) {
      result.operation = 'DELETE';

      // Extract table name
      const tableMatch = queryText.match(/FROM\s+([^\s]+)/i);
      if (tableMatch) {
        result.tableName = tableMatch[1];
      }

      // Extract WHERE conditions
      const whereMatch = queryText.match(/WHERE\s+(.+)$/i);
      if (whereMatch) {
        const conditions = whereMatch[1];

        // Parse basic key-value conditions
        const conditionParts = conditions.split('AND').map((part) => part.trim());
        conditionParts.forEach((condition) => {
          const match = condition.match(
            /([^\s=<>]+)\s*(=|<>|>|<|>=|<=)\s*(?:'([^']*)'|(\d+)|(\$\d+))/
          );
          if (match) {
            const [, column, operator, stringValue, numberValue, placeholder] = match;

            // For placeholder values, we'll handle them separately
            if (!placeholder) {
              result.conditions[column] = stringValue || numberValue;
            }
          }
        });
      }
    }

    return result;
  }

  /**
   * Execute a query against the mock database
   * @param text Query text or config
   * @param values Parameter values
   * @returns Query result
   */
  public async query(text: QueryParams, values: any[] = []): Promise<QueryResult> {
    const queryText = typeof text === 'string' ? text : text.text;

    // Check for error patterns
    for (const pattern of Object.keys(this.errorPatterns)) {
      if (queryText.includes(pattern)) {
        return Promise.reject(this.errorPatterns[pattern]);
      }
    }

    // Check for response overrides
    for (const pattern of Object.keys(this.responseOverrides)) {
      if (queryText.includes(pattern)) {
        return Promise.resolve(this.responseOverrides[pattern]);
      }
    }

    // Parse the query
    const parsedQuery = this.parseQuery(queryText);

    // Apply parameterized values
    if (values.length > 0) {
      // Replace $1, $2, etc. with the actual values
      if (parsedQuery.operation === 'SELECT' || parsedQuery.operation === 'DELETE') {
        const whereMatch = queryText.match(/WHERE\s+(.+?)(?:ORDER BY|GROUP BY|LIMIT|$)/i);
        if (whereMatch) {
          const conditions = whereMatch[1];

          // Extract conditions with placeholders
          const conditionParts = conditions.split('AND').map((part) => part.trim());

          conditionParts.forEach((condition, index) => {
            const match = condition.match(/([^\s=<>]+)\s*(=|<>|>|<|>=|<=)\s*(\$\d+)/);
            if (match) {
              const [, column, operator, placeholder] = match;
              const paramIndex = parseInt(placeholder.substring(1)) - 1;

              if (paramIndex >= 0 && paramIndex < values.length) {
                parsedQuery.conditions[column] = values[paramIndex];
              }
            }
          });
        }
      } else if (parsedQuery.operation === 'INSERT') {
        // Map placeholder values to columns
        parsedQuery.values.forEach((value, index) => {
          if (value.startsWith('$')) {
            const paramIndex = parseInt(value.substring(1)) - 1;
            if (paramIndex >= 0 && paramIndex < values.length) {
              parsedQuery.values[index] = values[paramIndex];
            }
          }
        });
      } else if (parsedQuery.operation === 'UPDATE') {
        // Handle SET values with placeholders
        const setMatch = queryText.match(/SET\s+(.+?)(?:WHERE|$)/i);
        if (setMatch) {
          const setParts = setMatch[1].split(',').map((part) => part.trim());

          setParts.forEach((part, index) => {
            const match = part.match(/([^\s=]+)\s*=\s*(\$\d+)/);
            if (match) {
              const [, column, placeholder] = match;
              const paramIndex = parseInt(placeholder.substring(1)) - 1;

              if (paramIndex >= 0 && paramIndex < values.length) {
                parsedQuery.columns.push(column);
                parsedQuery.values.push(values[paramIndex]);
              }
            }
          });
        }

        // Handle WHERE conditions with placeholders
        const whereMatch = queryText.match(/WHERE\s+(.+)$/i);
        if (whereMatch) {
          const conditions = whereMatch[1];

          const conditionParts = conditions.split('AND').map((part) => part.trim());
          conditionParts.forEach((condition, index) => {
            const match = condition.match(/([^\s=<>]+)\s*(=|<>|>|<|>=|<=)\s*(\$\d+)/);
            if (match) {
              const [, column, operator, placeholder] = match;
              const paramIndex = parseInt(placeholder.substring(1)) - 1;

              if (paramIndex >= 0 && paramIndex < values.length) {
                parsedQuery.conditions[column] = values[paramIndex];
              }
            }
          });
        }
      }
    }

    // Execute the query based on the operation
    const result: QueryResult = { rows: [], rowCount: 0 };

    // Handle SELECT queries
    if (parsedQuery.operation === 'SELECT') {
      if (parsedQuery.tableName && this.tables[parsedQuery.tableName]) {
        // Filter rows based on conditions
        result.rows = this.tables[parsedQuery.tableName].filter((row) => {
          return Object.entries(parsedQuery.conditions).every(([column, value]) => {
            return row[column] === value;
          });
        });

        result.rowCount = result.rows.length;
      }
    }

    // Handle INSERT queries
    else if (parsedQuery.operation === 'INSERT') {
      if (parsedQuery.tableName && this.tables[parsedQuery.tableName]) {
        const newRow: Record<string, any> = {};

        // Create the new row
        parsedQuery.columns.forEach((column, index) => {
          newRow[column] = parsedQuery.values[index];
        });

        // Automatically add id if not provided
        if (!newRow.id) {
          newRow.id = uuidv4();
        }

        // Add timestamps if not provided
        const now = new Date().toISOString();
        if (!newRow.created_at) {
          newRow.created_at = now;
        }
        if (!newRow.updated_at) {
          newRow.updated_at = now;
        }

        // Add the row to the table
        this.tables[parsedQuery.tableName].push(newRow);

        // Return the inserted row
        result.rows = [newRow];
        result.rowCount = 1;
      }
    }

    // Handle UPDATE queries
    else if (parsedQuery.operation === 'UPDATE') {
      if (parsedQuery.tableName && this.tables[parsedQuery.tableName]) {
        // Find rows to update
        const rowsToUpdate = this.tables[parsedQuery.tableName].filter((row) => {
          return Object.entries(parsedQuery.conditions).every(([column, value]) => {
            return row[column] === value;
          });
        });

        // Update rows
        rowsToUpdate.forEach((row) => {
          parsedQuery.columns.forEach((column, index) => {
            row[column] = parsedQuery.values[index];
          });

          // Update timestamp
          if (!parsedQuery.columns.includes('updated_at')) {
            row.updated_at = new Date().toISOString();
          }
        });

        // Return the updated rows
        result.rows = rowsToUpdate;
        result.rowCount = rowsToUpdate.length;
      }
    }

    // Handle DELETE queries
    else if (parsedQuery.operation === 'DELETE') {
      if (parsedQuery.tableName && this.tables[parsedQuery.tableName]) {
        // Find rows to delete
        const initialCount = this.tables[parsedQuery.tableName].length;

        // Remove rows matching conditions
        this.tables[parsedQuery.tableName] = this.tables[parsedQuery.tableName].filter((row) => {
          return !Object.entries(parsedQuery.conditions).every(([column, value]) => {
            return row[column] === value;
          });
        });

        // Calculate number of deleted rows
        result.rowCount = initialCount - this.tables[parsedQuery.tableName].length;
      }
    }

    return Promise.resolve(result);
  }
}

/**
 * Create and initialize a mock database with common tables
 * @returns Initialized MockDatabase instance
 */
export function createMockDatabase(): MockDatabase {
  const db = new MockDatabase();

  // Create common tables
  db.createTable('users', []);
  db.createTable('projects', []);
  db.createTable('images', []);
  db.createTable('segmentations', []);
  db.createTable('access_requests', []);
  db.createTable('project_shares', []);

  return db;
}

/**
 * Create helper functions for common database operations
 * @param db MockDatabase instance
 */
export function createDbHelpers(db: MockDatabase) {
  return {
    // User operations
    createUser: (userData: Partial<Record<string, any>> = {}): Record<string, any> => {
      const userId = userData.id || uuidv4();
      const now = new Date().toISOString();

      const user = {
        id: userId,
        email: userData.email || `user${Math.floor(Math.random() * 10000)}@example.com`,
        name: userData.name || 'Test User',
        username: userData.username || `user${Math.floor(Math.random() * 10000)}`,
        password: userData.password || 'hashed-password',
        created_at: userData.created_at || now,
        updated_at: userData.updated_at || now,
        ...userData,
      };

      db.getTable('users').push(user);
      return user;
    },

    // Project operations
    createProject: (projectData: Partial<Record<string, any>> = {}): Record<string, any> => {
      const projectId = projectData.id || uuidv4();
      const now = new Date().toISOString();

      const project = {
        id: projectId,
        name: projectData.name || 'Test Project',
        description: projectData.description || 'Test project description',
        user_id: projectData.user_id || uuidv4(),
        created_at: projectData.created_at || now,
        updated_at: projectData.updated_at || now,
        ...projectData,
      };

      db.getTable('projects').push(project);
      return project;
    },

    // Image operations
    createImage: (imageData: Partial<Record<string, any>> = {}): Record<string, any> => {
      const imageId = imageData.id || uuidv4();
      const now = new Date().toISOString();

      const image = {
        id: imageId,
        name: imageData.name || 'test-image.jpg',
        project_id: imageData.project_id || uuidv4(),
        user_id: imageData.user_id || uuidv4(),
        storage_path: imageData.storage_path || `/uploads/images/${imageId}.jpg`,
        thumbnail_path: imageData.thumbnail_path || `/uploads/thumbnails/${imageId}.jpg`,
        width: imageData.width || 800,
        height: imageData.height || 600,
        segmentationStatus: imageData.segmentationStatus || 'not_started',
        created_at: imageData.created_at || now,
        updated_at: imageData.updated_at || now,
        ...imageData,
      };

      db.getTable('images').push(image);
      return image;
    },

    // Segmentation operations
    createSegmentation: (
      segmentationData: Partial<Record<string, any>> = {}
    ): Record<string, any> => {
      const segmentationId = segmentationData.id || uuidv4();
      const now = new Date().toISOString();

      const segmentation = {
        id: segmentationId,
        image_id: segmentationData.image_id || uuidv4(),
        polygons: segmentationData.polygons || [
          {
            id: uuidv4(),
            type: 'external',
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
              { x: 200, y: 200 },
              { x: 100, y: 200 },
            ],
          },
        ],
        version: segmentationData.version || 1,
        created_at: segmentationData.created_at || now,
        updated_at: segmentationData.updated_at || now,
        ...segmentationData,
      };

      db.getTable('segmentations').push(segmentation);
      return segmentation;
    },

    // Project share operations
    createProjectShare: (shareData: Partial<Record<string, any>> = {}): Record<string, any> => {
      const shareId = shareData.id || uuidv4();
      const now = new Date().toISOString();

      const share = {
        id: shareId,
        project_id: shareData.project_id || uuidv4(),
        user_id: shareData.user_id || uuidv4(),
        permission: shareData.permission || 'view',
        created_at: shareData.created_at || now,
        updated_at: shareData.updated_at || now,
        ...shareData,
      };

      db.getTable('project_shares').push(share);
      return share;
    },

    // Access request operations
    createAccessRequest: (requestData: Partial<Record<string, any>> = {}): Record<string, any> => {
      const requestId = requestData.id || uuidv4();
      const now = new Date().toISOString();

      const request = {
        id: requestId,
        project_id: requestData.project_id || uuidv4(),
        requester_id: requestData.requester_id || uuidv4(),
        status: requestData.status || 'pending',
        message: requestData.message || 'Please grant me access to this project',
        created_at: requestData.created_at || now,
        updated_at: requestData.updated_at || now,
        ...requestData,
      };

      db.getTable('access_requests').push(request);
      return request;
    },
  };
}

/**
 * Mock Jest module for DB using the mock database
 * @param db MockDatabase instance
 */
export function mockDbModule(db: MockDatabase): void {
  jest.mock('../db', () => {
    return db.createMockPool();
  });
}

/**
 * Reset any mocked modules
 */
export function resetMocks(): void {
  jest.resetModules();
}
