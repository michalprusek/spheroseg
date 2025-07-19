import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

// Database configuration
const dbConfig = {
  host: process.env["DB_HOST"] || 'localhost',
  port: parseInt(process.env["DB_PORT"] || '5432'),
  database: process.env["DB_NAME"] || 'spheroseg',
  user: process.env["DB_USER"] || 'postgres',
  password: process.env["DB_PASSWORD"] || 'postgres',
};

async function runMigration() {
  const pool = new Pool(dbConfig);

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'update_image_status_enum.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    logger.info('Running migration: update_image_status_enum.sql');

    // Execute the migration
    await pool.query(migrationSQL);

    logger.info('Migration completed successfully');

    // Log the updated counts
    const statusCounts = await pool.query(`
      SELECT 
        'images' as table_name,
        status,
        COUNT(*) as count
      FROM images
      GROUP BY status
      UNION ALL
      SELECT 
        'segmentation_results' as table_name,
        status,
        COUNT(*) as count
      FROM segmentation_results
      GROUP BY status
      ORDER BY table_name, status
    `);

    logger.info('Status counts after migration:');
    statusCounts.rows.forEach((row) => {
      logger.info(`  ${row.table_name}.${row.status}: ${row.count}`);
    });
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();
