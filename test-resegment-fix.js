const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/spheroseg'
});

async function checkSegmentationStatus() {
  try {
    console.log('\n=== Checking Segmentation Status ===\n');
    
    // Check images with segmentation status
    const imagesResult = await pool.query(`
      SELECT 
        id, 
        name, 
        segmentation_status,
        created_at,
        updated_at
      FROM images 
      WHERE segmentation_status IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    console.log('Recent images with segmentation status:');
    console.table(imagesResult.rows);
    
    // Check segmentation tasks
    const tasksResult = await pool.query(`
      SELECT 
        id,
        image_id,
        status,
        created_at,
        started_at,
        completed_at,
        error
      FROM segmentation_tasks
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('\nRecent segmentation tasks:');
    console.table(tasksResult.rows);
    
    // Check segmentation results
    const resultsResult = await pool.query(`
      SELECT 
        image_id,
        status,
        created_at,
        updated_at,
        CASE 
          WHEN result_data IS NOT NULL THEN 'Has data'
          ELSE 'No data'
        END as has_result
      FROM segmentation_results
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    console.log('\nRecent segmentation results:');
    console.table(resultsResult.rows);
    
    // Check for mismatched statuses
    const mismatchedResult = await pool.query(`
      SELECT 
        i.id as image_id,
        i.name,
        i.segmentation_status as image_status,
        sr.status as result_status,
        st.status::text as task_status
      FROM images i
      LEFT JOIN segmentation_results sr ON i.id = sr.image_id
      LEFT JOIN segmentation_tasks st ON i.id = st.image_id
      WHERE i.segmentation_status != sr.status 
         OR i.segmentation_status != st.status::text
         OR sr.status != st.status::text
      LIMIT 10
    `);
    
    if (mismatchedResult.rows.length > 0) {
      console.log('\n⚠️  MISMATCHED STATUSES FOUND:');
      console.table(mismatchedResult.rows);
    } else {
      console.log('\n✅ All statuses are synchronized');
    }
    
    // Check queued tasks
    const queuedResult = await pool.query(`
      SELECT COUNT(*) as queued_count
      FROM segmentation_tasks
      WHERE status = 'queued'
    `);
    
    console.log(`\n📊 Queued tasks: ${queuedResult.rows[0].queued_count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSegmentationStatus();