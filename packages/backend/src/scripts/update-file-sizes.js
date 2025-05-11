// Script to update file_size column for existing images from metadata.originalSize
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.database);

async function updateFileSizes() {
  const client = await pool.connect();
  
  try {
    console.log('Starting file size update script...');
    
    // Get all images that have metadata.originalSize but no file_size
    const imagesRes = await client.query(`
      SELECT id, metadata 
      FROM images 
      WHERE (file_size IS NULL OR file_size = 0) 
        AND metadata ? 'originalSize'
    `);
    
    console.log(`Found ${imagesRes.rows.length} images to update`);
    
    // Begin transaction
    await client.query('BEGIN');
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Update each image's file_size from metadata.originalSize
    for (const img of imagesRes.rows) {
      try {
        const originalSize = img.metadata.originalSize;
        
        if (originalSize && typeof originalSize === 'number') {
          await client.query(
            'UPDATE images SET file_size = $1 WHERE id = $2',
            [originalSize, img.id]
          );
          updatedCount++;
        }
      } catch (err) {
        console.error(`Error updating image ${img.id}:`, err);
        errorCount++;
      }
    }
    
    // Also update user storage totals based on file_size
    const usersRes = await client.query('SELECT id FROM users');
    
    console.log(`Updating storage totals for ${usersRes.rows.length} users`);
    
    let userUpdateCount = 0;
    
    for (const user of usersRes.rows) {
      try {
        // Calculate total storage for this user
        const storageRes = await client.query(`
          SELECT SUM(file_size) AS total 
          FROM images i 
          JOIN projects p ON i.project_id = p.id 
          WHERE p.user_id = $1
        `, [user.id]);
        
        const totalBytes = storageRes.rows[0].total || 0;
        
        // Update user storage_used_bytes
        await client.query(
          'UPDATE users SET storage_used_bytes = $1 WHERE id = $2',
          [totalBytes, user.id]
        );
        
        userUpdateCount++;
      } catch (err) {
        console.error(`Error updating user ${user.id} storage:`, err);
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`
    Update completed:
    - ${updatedCount} images updated
    - ${errorCount} errors
    - ${userUpdateCount} user storage totals updated
    `);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Script failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

// Run the script
updateFileSizes()
  .then(() => console.log('Script completed successfully'))
  .catch(err => {
    console.error('Script failed with error:', err);
    process.exit(1);
  });