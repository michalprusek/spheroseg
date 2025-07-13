const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/spheroseg'
});

async function simulateStuckImage() {
  console.log('=== Simulating Stuck Image ===\n');
  
  try {
    // Find an image without segmentation
    const result = await pool.query(`
      SELECT id, name, project_id 
      FROM images 
      WHERE segmentation_status = 'without_segmentation' 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('No images without segmentation found');
      return;
    }
    
    const image = result.rows[0];
    console.log(`Using image: ${image.name} (${image.id})`);
    
    // Create a stuck task (old timestamp)
    const taskId = require('crypto').randomBytes(16).toString('hex');
    await pool.query(`
      INSERT INTO segmentation_tasks 
      (id, image_id, image_path, parameters, priority, status, created_at, updated_at, started_at)
      VALUES 
      ($1, $2, 'dummy/path.png', '{}', 5, 'processing'::task_status, 
       NOW() - INTERVAL '45 minutes', 
       NOW() - INTERVAL '45 minutes',
       NOW() - INTERVAL '44 minutes')
    `, [taskId, image.id]);
    
    // Update image status to queued
    await pool.query(
      "UPDATE images SET segmentation_status = 'queued', updated_at = NOW() - INTERVAL '45 minutes' WHERE id = $1",
      [image.id]
    );
    
    // Add segmentation result
    await pool.query(`
      INSERT INTO segmentation_results (image_id, status, created_at, updated_at)
      VALUES ($1, 'queued', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes')
      ON CONFLICT (image_id) DO UPDATE SET status = 'queued', updated_at = NOW() - INTERVAL '45 minutes'
    `, [image.id]);
    
    console.log('\n✅ Created stuck image simulation');
    console.log('Task will be automatically cleaned up in ~5 minutes');
    console.log('Or trigger manual cleanup with: curl -X POST http://localhost:5001/api/admin/cleanup-stuck-images -H "Authorization: Bearer YOUR_TOKEN"');
    
    // Check current status
    console.log('\n=== Current Status ===');
    const status = await pool.query(`
      SELECT 
        i.segmentation_status as image_status,
        sr.status as result_status,
        st.status as task_status,
        st.created_at as task_created
      FROM images i
      LEFT JOIN segmentation_results sr ON i.id = sr.image_id
      LEFT JOIN segmentation_tasks st ON i.id = st.image_id AND st.id = $2
      WHERE i.id = $1
    `, [image.id, taskId]);
    
    console.table(status.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

simulateStuckImage();