import { Pool, PoolConfig, PoolClient } from 'pg';
import config from '../config';
import logger from '../utils/logger';
import NodeCache from 'node-cache';

// Cache configuration
// Standard TTL: 5 minutes for schema checks, 30 seconds for data
const DEFAULT_SCHEMA_TTL = 300; // 5 minutes
const DEFAULT_DATA_TTL = 30; // 30 seconds

// Create cache instances
const schemaCache = new NodeCache({
  stdTTL: DEFAULT_SCHEMA_TTL,
  checkperiod: 120,
  useClones: false
});

export const queryCache = new NodeCache({
  stdTTL: DEFAULT_DATA_TTL,
  checkperiod: 60,
  useClones: false
});

// Database pool configuration with optimized settings
function createDbConfig(): PoolConfig {
  let dbConfig: PoolConfig;

  if (config.db.connectionString) {
    // Use connection string if provided
    dbConfig = {
      connectionString: config.db.connectionString,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined
    };
    logger.info('Database configuration using connection string');
  } else {
    // Use individual connection parameters
    dbConfig = {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined
    };
    logger.info('Database configuration using individual parameters', {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user
    });
  }

  // Optimized pool configuration
  return {
    ...dbConfig,
    // Optimal values based on typical web application needs
    max: 20, // Maximum 20 clients (adjust based on expected concurrent connections)
    idleTimeoutMillis: 30000, // How long a client can remain idle before being closed (30 seconds)
    connectionTimeoutMillis: 5000, // How long to wait for a connection (5 seconds)
    allowExitOnIdle: false // Don't allow the pool to exit if idle
  };
}

// Create database pool with optimized settings
const pool = new Pool(createDbConfig());

// Set up event listeners
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', { error: err });
  // Don't exit process, log and continue
  // process.exit(-1);
});

// Cache for table existence checks
export const checkTableExists = async (tableName: string): Promise<boolean> => {
  const cacheKey = `table_exists:${tableName}`;
  
  // Check cache first
  const cached = schemaCache.get<boolean>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      )
    `, [tableName]);
    
    const exists = result.rows[0].exists;
    
    // Store in cache
    schemaCache.set(cacheKey, exists);
    
    return exists;
  } catch (error) {
    logger.error(`Error checking if table ${tableName} exists`, { error });
    return false;
  }
};

// Cache for column existence checks
export const checkColumnExists = async (tableName: string, columnName: string): Promise<boolean> => {
  const cacheKey = `column_exists:${tableName}:${columnName}`;
  
  // Check cache first
  const cached = schemaCache.get<boolean>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      )
    `, [tableName, columnName]);
    
    const exists = result.rows[0].exists;
    
    // Store in cache
    schemaCache.set(cacheKey, exists);
    
    return exists;
  } catch (error) {
    logger.error(`Error checking if column ${columnName} exists in table ${tableName}`, { error });
    return false;
  }
};

// Function to check multiple columns at once (more efficient)
export const checkColumnsExist = async (tableName: string, columnNames: string[]): Promise<{[key: string]: boolean}> => {
  const results: {[key: string]: boolean} = {};
  const uncachedColumns: string[] = [];
  
  // First check cache for each column
  for (const columnName of columnNames) {
    const cacheKey = `column_exists:${tableName}:${columnName}`;
    const cached = schemaCache.get<boolean>(cacheKey);
    
    if (cached !== undefined) {
      results[columnName] = cached;
    } else {
      uncachedColumns.push(columnName);
    }
  }
  
  // If all columns were in cache, return results
  if (uncachedColumns.length === 0) {
    return results;
  }
  
  // Otherwise, query for uncached columns
  try {
    // One query for all uncached columns
    const query = `
      SELECT column_name, EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = column_name
      ) as exists
      FROM unnest($2::text[]) as column_name
    `;
    
    const result = await pool.query(query, [tableName, uncachedColumns]);
    
    // Process results and update cache
    for (const row of result.rows) {
      const columnName = row.column_name;
      const exists = row.exists;
      
      results[columnName] = exists;
      
      // Cache the result
      const cacheKey = `column_exists:${tableName}:${columnName}`;
      schemaCache.set(cacheKey, exists);
    }
    
    return results;
  } catch (error) {
    logger.error(`Error checking columns in table ${tableName}`, { error, columns: columnNames });
    
    // Return false for all uncached columns
    for (const columnName of uncachedColumns) {
      results[columnName] = false;
    }
    
    return results;
  }
};

// Transaction helper with automatic rollback on error
export const withTransaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
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
};

// Cached query function
export const cachedQuery = async (
  queryText: string, 
  params: any[] = [], 
  options: { 
    ttl?: number, 
    cacheKey?: string,
    bypassCache?: boolean
  } = {}
) => {
  const { ttl = DEFAULT_DATA_TTL, bypassCache = false } = options;
  
  // Generate cache key if not provided
  const cacheKey = options.cacheKey || 
    `query:${queryText}:${params.map(p => p?.toString?.() || JSON.stringify(p)).join(':')}`;
  
  // Check cache unless bypass is requested
  if (!bypassCache) {
    const cached = queryCache.get(cacheKey);
    if (cached !== undefined) {
      logger.debug('Query cache hit', { cacheKey });
      return cached;
    }
  }
  
  // Execute query
  try {
    const result = await pool.query(queryText, params);
    
    // Cache the result
    queryCache.set(cacheKey, result, ttl);
    
    return result;
  } catch (error) {
    logger.error('Error executing cached query', { error, queryText, params });
    throw error;
  }
};

// Function to clear specific cache entries based on a pattern
export const clearCacheByPattern = (pattern: string) => {
  const keys = queryCache.keys();
  const keysToDelete = keys.filter(key => key.includes(pattern));
  
  if (keysToDelete.length > 0) {
    queryCache.del(keysToDelete);
    logger.debug(`Cleared ${keysToDelete.length} cache entries with pattern: ${pattern}`);
  }
};

// Automatically invalidate cache after write operations
export const invalidatingQuery = async (
  queryText: string, 
  params: any[] = [], 
  invalidationPatterns: string[] = []
) => {
  const result = await pool.query(queryText, params);
  
  // If this is a write operation (INSERT, UPDATE, DELETE), invalidate related cache
  if (queryText.trim().toUpperCase().match(/^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)/)) {
    // Clear cache based on passed invalidation patterns
    for (const pattern of invalidationPatterns) {
      clearCacheByPattern(pattern);
    }
    
    // Also attempt to determine affected tables and clear those caches
    const tables = extractTablesFromQuery(queryText);
    for (const table of tables) {
      clearCacheByPattern(`query:.*${table}.*`);
    }
  }
  
  return result;
};

// Helper to extract table names from query
function extractTablesFromQuery(queryText: string): string[] {
  const tables: string[] = [];
  
  // Extract tables mentioned after FROM and JOIN
  const fromRegex = /\bFROM\s+([a-zA-Z0-9_]+)/gi;
  const joinRegex = /\bJOIN\s+([a-zA-Z0-9_]+)/gi;
  
  let match;
  while (match = fromRegex.exec(queryText)) {
    tables.push(match[1].toLowerCase());
  }
  
  while (match = joinRegex.exec(queryText)) {
    tables.push(match[1].toLowerCase());
  }
  
  return [...new Set(tables)]; // Remove duplicates
}

// Setup schema information on startup
export const initializeSchemaCache = async () => {
  try {
    logger.info('Initializing schema cache...');
    
    // Cache common tables
    const commonTables = ['projects', 'images', 'project_shares', 'users', 'segmentation_results'];
    for (const table of commonTables) {
      await checkTableExists(table);
    }
    
    // Cache common columns
    const columnsToCheck = {
      projects: ['id', 'title', 'description', 'user_id', 'created_at', 'updated_at'],
      images: ['id', 'project_id', 'name', 'thumbnail_path', 'created_at', 'updated_at'],
    };
    
    for (const [table, columns] of Object.entries(columnsToCheck)) {
      // Only check columns if table exists
      if (await checkTableExists(table)) {
        await checkColumnsExist(table, columns);
      }
    }
    
    logger.info('Schema cache initialized');
  } catch (error) {
    logger.error('Error initializing schema cache', { error });
  }
};

// Execute schema cache initialization
initializeSchemaCache();

// Re-export the regular pool for backward compatibility
export default pool;