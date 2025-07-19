import { Pool, PoolConfig, QueryResult } from 'pg';
import config from '../config';
import logger from '../utils/logger';

// Connection pools for read/write splitting
let writePool: Pool | null = null;
let readPool: Pool | null = null;
let replicasEnabled = false;

// Parse database URL and create pool config
function createPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);

  return {
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password,
    ssl: url.searchParams.get('sslmode') !== 'disable' ? { rejectUnauthorized: false } : false,

    // Connection pool settings
    max: parseInt(process.env["DB_POOL_SIZE"] || '20'),
    idleTimeoutMillis: parseInt(process.env["DB_POOL_IDLE_TIMEOUT"] || '10000'),
    connectionTimeoutMillis: parseInt(process.env["DB_POOL_CONNECTION_TIMEOUT"] || '2000'),

    // Statement timeout
    statement_timeout: parseInt(process.env["DB_STATEMENT_TIMEOUT"] || '30000'),

    // Application name for monitoring
    application_name: `spheroseg-backend-${process.env["NODE_ENV"] || 'development'}`,
  };
}

// Initialize database pools
export function initializeReadReplicas(): void {
  try {
    // Check if read replicas are enabled
    replicasEnabled = process.env["ENABLE_READ_REPLICAS"] === 'true';

    if (!replicasEnabled) {
      logger.info('Read replicas disabled, using single connection pool');
      return;
    }

    // Create write pool (master database)
    const writeUrl = process.env["DATABASE_WRITE_URL"] || process.env["DATABASE_URL"];
    if (!writeUrl) {
      throw new Error('DATABASE_WRITE_URL or DATABASE_URL not configured');
    }

    writePool = new Pool(createPoolConfig(writeUrl));

    // Create read pool (replicas)
    const readUrl = process.env["DATABASE_READ_URL"] || process.env["DATABASE_URL"];
    if (!readUrl) {
      throw new Error('DATABASE_READ_URL or DATABASE_URL not configured');
    }

    readPool = new Pool(createPoolConfig(readUrl));

    // Set up error handlers
    writePool.on('error', (err) => {
      logger.error('Write pool error:', { error: err });
    });

    readPool.on('error', (err) => {
      logger.error('Read pool error:', { error: err });
    });

    // Test connections
    Promise.all([writePool.query('SELECT 1'), readPool.query('SELECT 1')])
      .then(() => {
        logger.info('Read replica pools initialized successfully');
      })
      .catch((err) => {
        logger.error('Failed to initialize read replica pools:', { error: err });
        replicasEnabled = false;
      });
  } catch (error) {
    logger.error('Error initializing read replicas:', { error });
    replicasEnabled = false;
  }
}

// Get appropriate pool based on query type
export function getPool(isReadQuery: boolean = true): Pool {
  // If replicas not enabled, return a new pool with default config
  if (!replicasEnabled) {
    return new Pool(createPoolConfig(config.db.connectionString));
  }

  // Use read pool for read queries, write pool for everything else
  if (isReadQuery && readPool) {
    return readPool;
  }

  return writePool || new Pool(createPoolConfig(config.db.connectionString));
}

// Enhanced query function with read/write routing
export async function query(
  text: string,
  params?: unknown[],
  options?: {
    useReplica?: boolean;
    forceWrite?: boolean;
  }
): Promise<QueryResult> {
  const { useReplica = true, forceWrite = false } = options || {};

  // Determine if this is a read query
  const isReadQuery = !forceWrite && useReplica && isSelectQuery(text);

  // Get appropriate pool
  const pool = getPool(isReadQuery);

  // Log which pool is being used (in development)
  if (process.env["NODE_ENV"] === 'development') {
    logger.debug(
      `Using ${isReadQuery ? 'read' : 'write'} pool for query: ${text.substring(0, 50)}...`
    );
  }

  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 100) {
      logger.warn(`Slow query (${duration}ms) on ${isReadQuery ? 'replica' : 'master'}:`, {
        query: text.substring(0, 200),
        duration,
        rows: result.rowCount,
      });
    }

    return result;
  } catch (error: unknown) {
    // If read replica fails, fallback to master
    if (isReadQuery && replicasEnabled && (error as any)?.code === 'ECONNREFUSED') {
      logger.warn('Read replica unavailable, falling back to master');
      const fallbackPool = new Pool(createPoolConfig(config.db.connectionString));
      return fallbackPool.query(text, params);
    }

    throw error;
  }
}

// Transaction helper (always uses write pool)
export async function transaction<T>(callback: (client: unknown) => Promise<T>): Promise<T> {
  const pool = getPool(false); // Always use write pool for transactions
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
}

// Check if query is a SELECT query
function isSelectQuery(sql: string): boolean {
  const trimmedSql = sql.trim().toUpperCase();

  // Check for read-only queries
  return (
    trimmedSql.startsWith('SELECT') ||
    trimmedSql.startsWith('WITH') ||
    trimmedSql.startsWith('EXPLAIN') ||
    trimmedSql.startsWith('SHOW') ||
    (trimmedSql.includes('RETURNING') === false &&
      trimmedSql.includes('SELECT') &&
      !trimmedSql.includes('INSERT') &&
      !trimmedSql.includes('UPDATE') &&
      !trimmedSql.includes('DELETE'))
  );
}

// Monitoring functions
export async function getReplicationLag(): Promise<number | null> {
  if (!replicasEnabled || !readPool) {
    return null;
  }

  try {
    const result = await readPool.query(`
      SELECT 
        EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int as lag_seconds
    `);

    return result.rows[0]?.lag_seconds || 0;
  } catch (error) {
    logger.error('Failed to get replication lag:', { error });
    return null;
  }
}

export async function getPoolStats() {
  return {
    replicas_enabled: replicasEnabled,
    write_pool: writePool
      ? {
          total: writePool.totalCount,
          idle: writePool.idleCount,
          waiting: writePool.waitingCount,
        }
      : null,
    read_pool: readPool
      ? {
          total: readPool.totalCount,
          idle: readPool.idleCount,
          waiting: readPool.waitingCount,
        }
      : null,
  };
}

// Cleanup function
export async function closeReadReplicaPools(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (writePool) {
    promises.push(writePool.end());
  }

  if (readPool) {
    promises.push(readPool.end());
  }

  await Promise.all(promises);

  writePool = null;
  readPool = null;
  replicasEnabled = false;
}
