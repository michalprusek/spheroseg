const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/spheroseg'
});

// List of stuck image IDs
const stuckImageIds = [
  'cd5a4047-4dbf-40b9-87ee-51a7087da467', // f2_29.png
  '16a9f5b1-87fb-4f37-b845-89015e431e28', // e5_28.png
  '4933b66a-9985-4c77-96fb-e87fe3926b5b'  // f2_9.png
];

async function manualFix() {
  console.log('=== Manually fixing stuck images ===\n');
  
  for (const imageId of stuckImageIds) {
    try {
      console.log(`Fixing image ${imageId}...`);
      
      // 1. Check if image already has completed segmentation
      const hasCompletedResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM segmentation_results 
         WHERE image_id = $1 
         AND status = 'completed' 
         AND result_data IS NOT NULL`,
        [imageId]
      );
      
      if (hasCompletedResult.rows[0].count > 0) {
        // Image already has completed segmentation, just fix the status
        console.log(`  - Image already has completed segmentation, updating status...`);
        
        await pool.query(
          "UPDATE images SET segmentation_status = 'completed', updated_at = NOW() WHERE id = $1",
          [imageId]
        );
        
        // Mark any processing tasks as completed
        await pool.query(
          `UPDATE segmentation_tasks 
           SET status = 'completed'::task_status, 
               completed_at = NOW(), 
               updated_at = NOW()
           WHERE image_id = $1 
           AND status = 'processing'`,
          [imageId]
        );
        
        console.log(`  ✅ Fixed to 'completed' status`);
      } else {
        // No completed segmentation, reset to allow re-segmentation
        console.log(`  - No completed segmentation found, resetting to 'without_segmentation'...`);
        
        // Update image status
        await pool.query(
          "UPDATE images SET segmentation_status = 'without_segmentation', updated_at = NOW() WHERE id = $1",
          [imageId]
        );
        
        // Delete any queued results
        await pool.query(
          "DELETE FROM segmentation_results WHERE image_id = $1 AND status = 'queued'",
          [imageId]
        );
        
        // Mark any processing tasks as failed
        await pool.query(
          `UPDATE segmentation_tasks 
           SET status = 'failed'::task_status, 
               error = 'Task stuck in processing state',
               updated_at = NOW()
           WHERE image_id = $1 
           AND status IN ('processing', 'queued')`,
          [imageId]
        );
        
        console.log(`  ✅ Reset to 'without_segmentation' status`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error fixing image ${imageId}:`, error.message);
    }
  }
  
  console.log('\n=== Verification ===');
  
  // Verify the fix
  const verifyResult = await pool.query(`
    SELECT i.id, i.name, i.segmentation_status, 
           sr.status as result_status,
           st.status as task_status
    FROM images i
    LEFT JOIN segmentation_results sr ON i.id = sr.image_id
    LEFT JOIN LATERAL (
      SELECT status FROM segmentation_tasks 
      WHERE image_id = i.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ) st ON true
    WHERE i.id = ANY($1)
  `, [stuckImageIds]);
  
  console.table(verifyResult.rows);
  
  console.log('\nDone! The stuck images have been fixed.');
  console.log('Images with existing segmentation data were marked as "completed".');
  console.log('Images without segmentation data were reset to "without_segmentation".');
  console.log('You can now trigger new segmentation for the reset images.');
  
  await pool.end();
}

manualFix();