#!/usr/bin/env ts-node
/**
 * Migration script to rename existing .jpg thumbnails to .png
 * This is needed after changing the thumbnail generation to use PNG format
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Pool } from 'pg';
import logger from '../utils/logger';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/spheroseg';
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

async function migrateJpgThumbnailsToPng() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  let totalMigrated = 0;
  let totalFailed = 0;

  try {
    logger.info('Starting thumbnail migration from .jpg to .png');

    // Get all images with thumbnail paths
    const result = await pool.query(`
      SELECT id, thumbnail_path 
      FROM images 
      WHERE thumbnail_path IS NOT NULL 
      AND thumbnail_path LIKE '%.jpg'
    `);

    logger.info(`Found ${result.rows.length} images with .jpg thumbnails to migrate`);

    for (const row of result.rows) {
      const { id, thumbnail_path } = row;

      try {
        // Convert database path to filesystem path
        const oldPath = path.join(UPLOADS_DIR, thumbnail_path);
        const newPath = oldPath.replace(/\.jpg$/, '.png');
        const newDbPath = thumbnail_path.replace(/\.jpg$/, '.png');

        // Check if old file exists
        try {
          await fs.access(oldPath);
        } catch {
          logger.warn(`Thumbnail file not found: ${oldPath}, skipping`);
          continue;
        }

        // Check if new file already exists
        try {
          await fs.access(newPath);
          logger.info(`PNG thumbnail already exists: ${newPath}, updating database only`);
        } catch {
          // Rename the file
          await fs.rename(oldPath, newPath);
          logger.debug(`Renamed: ${oldPath} -> ${newPath}`);
        }

        // Update database
        await pool.query('UPDATE images SET thumbnail_path = $1 WHERE id = $2', [newDbPath, id]);

        totalMigrated++;

        if (totalMigrated % 100 === 0) {
          logger.info(`Progress: ${totalMigrated} thumbnails migrated`);
        }
      } catch (error) {
        logger.error(`Failed to migrate thumbnail for image ${id}:`, error);
        totalFailed++;
      }
    }

    logger.info(`Migration completed: ${totalMigrated} thumbnails migrated, ${totalFailed} failed`);

    // Verify migration
    const remainingJpg = await pool.query(`
      SELECT COUNT(*) 
      FROM images 
      WHERE thumbnail_path IS NOT NULL 
      AND thumbnail_path LIKE '%.jpg'
    `);

    logger.info(`Remaining .jpg thumbnails in database: ${remainingJpg.rows[0].count}`);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateJpgThumbnailsToPng()
    .then(() => {
      logger.info('Thumbnail migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Thumbnail migration failed:', error);
      process.exit(1);
    });
}

export { migrateJpgThumbnailsToPng };
