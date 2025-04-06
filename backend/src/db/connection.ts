import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/app';

let pool: Pool;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
};

// Initialize pool
pool = getPool();

export const connectToDatabase = async (): Promise<void> => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Connected to PostgreSQL database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
};

export const query = async <T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> => {
  const client = await pool.connect();
  try {
    const result: QueryResult<T> = await client.query<T>(text, params);
    return result.rows;
  } finally {
    client.release();
  }
};

export default pool;