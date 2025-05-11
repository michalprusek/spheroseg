/**
 * Database initialization script
 *
 * This script initializes the database schema and creates necessary tables.
 */
import fs from 'fs';
import path from 'path';
import pool from '../db';
import logger from '../utils/logger';

async function initializeDatabase() {
  try {
    logger.info('Starting database initialization...');

    // Read schema SQL file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema SQL
    await pool.query(schemaSql);

    logger.info('Database schema initialized successfully');
    return true;
  } catch (error) {
    logger.error('Error initializing database schema:', { error });
    return false;
  }
}

// Execute if this script is run directly
if (require.main === module) {
  initializeDatabase()
    .then((success) => {
      if (success) {
        logger.info('Database initialization completed successfully');
        process.exit(0);
      } else {
        logger.error('Database initialization failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('Unexpected error during database initialization:', {
        error,
      });
      process.exit(1);
    });
}

export default initializeDatabase;
