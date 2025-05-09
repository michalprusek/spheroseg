import { Pool, PoolConfig } from 'pg';
import config from './config';
import logger from './utils/logger';

// Determine database connection configuration
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

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', { error: err });
  process.exit(-1);
});

export default pool;