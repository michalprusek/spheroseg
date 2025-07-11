const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/spheroseg'
});

async function findImageWithCompletedSegmentation() {
  const result = await pool.query(`
    SELECT i.id, i.name, i.project_id, i.segmentation_status
    FROM images i
    WHERE i.segmentation_status = 'completed'
    AND i.project_id = 'e9464e37-7967-410d-9742-6e4e45e55190'
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    throw new Error('No completed segmentation found in the test project');
  }
  
  return result.rows[0];
}

async function manuallyTriggerResegmentation(imageId) {
  console.log(`\n=== Manually triggering resegmentation for image ${imageId} ===`);
  
  // First, update the image status to 'queued'
  await pool.query(
    "UPDATE images SET segmentation_status = 'queued', updated_at = NOW() WHERE id = $1",
    [imageId]
  );
  
  // Insert or update segmentation_results
  await pool.query(
    `INSERT INTO segmentation_results (image_id, status, created_at, updated_at) 
     VALUES ($1, 'queued', NOW(), NOW())
     ON CONFLICT (image_id) 
     DO UPDATE SET status = 'queued', updated_at = NOW()`,
    [imageId]
  );
  
  // Get image path
  const imageResult = await pool.query(
    'SELECT storage_path FROM images WHERE id = $1',
    [imageId]
  );
  
  const imagePath = imageResult.rows[0].storage_path;
  
  // Create a new segmentation task
  const taskId = require('crypto').randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO segmentation_tasks 
     (id, image_id, image_path, parameters, priority, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'queued', NOW(), NOW())`,
    [taskId, imageId, imagePath, {model_type: 'resunet'}, 5]
  );
  
  console.log('✅ Created segmentation task:', taskId);
  
  return taskId;
}

async function checkAllStatuses(imageId) {
  console.log('\n=== Current Status ===');
  
  // Check images table
  const imageResult = await pool.query(
    'SELECT id, name, segmentation_status, updated_at FROM images WHERE id = $1',
    [imageId]
  );
  console.log('Image:', imageResult.rows[0]);
  
  // Check segmentation_results table
  const resultsResult = await pool.query(
    'SELECT image_id, status, updated_at, result_data IS NOT NULL as has_data FROM segmentation_results WHERE image_id = $1',
    [imageId]
  );
  console.log('Segmentation Result:', resultsResult.rows[0] || 'No record');
  
  // Check segmentation_tasks table
  const tasksResult = await pool.query(
    `SELECT id, status, created_at, started_at, completed_at, 
            CASE WHEN result IS NOT NULL THEN 'Has data' ELSE 'No data' END as has_result
     FROM segmentation_tasks 
     WHERE image_id = $1 
     ORDER BY created_at DESC 
     LIMIT 3`,
    [imageId]
  );
  console.log('Recent Tasks:');
  console.table(tasksResult.rows);
}

async function waitForProcessing(imageId, maxWaitTime = 30000) {
  console.log(`\n=== Waiting for ML service to pick up the task (max ${maxWaitTime/1000} seconds) ===`);
  
  const startTime = Date.now();
  let lastStatus = null;
  
  while (Date.now() - startTime < maxWaitTime) {
    const result = await pool.query(
      'SELECT status FROM segmentation_tasks WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1',
      [imageId]
    );
    
    if (result.rows.length > 0) {
      const currentStatus = result.rows[0].status;
      
      if (currentStatus !== lastStatus) {
        console.log(`Task status changed to: ${currentStatus}`);
        lastStatus = currentStatus;
      }
      
      if (currentStatus === 'processing') {
        return true;
      }
    }
    
    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

async function waitForCompletion(imageId, maxWaitTime = 60000) {
  console.log(`\n=== Waiting for segmentation to complete (max ${maxWaitTime/1000} seconds) ===`);
  
  const startTime = Date.now();
  let lastImageStatus = null;
  let lastTaskStatus = null;
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check both image status and task status
    const imageResult = await pool.query(
      'SELECT segmentation_status FROM images WHERE id = $1',
      [imageId]
    );
    
    const taskResult = await pool.query(
      'SELECT status FROM segmentation_tasks WHERE image_id = $1 ORDER BY created_at DESC LIMIT 1',
      [imageId]
    );
    
    const currentImageStatus = imageResult.rows[0].segmentation_status;
    const currentTaskStatus = taskResult.rows[0]?.status;
    
    if (currentImageStatus !== lastImageStatus || currentTaskStatus !== lastTaskStatus) {
      console.log(`Status: Image=${currentImageStatus}, Task=${currentTaskStatus}`);
      lastImageStatus = currentImageStatus;
      lastTaskStatus = currentTaskStatus;
    }
    
    // Check if both are completed
    if (currentImageStatus === 'completed' && currentTaskStatus === 'completed') {
      return 'completed';
    }
    
    // Check if either failed
    if (currentImageStatus === 'failed' || currentTaskStatus === 'failed') {
      return 'failed';
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Timeout waiting for segmentation to complete');
}

async function main() {
  try {
    // Find an image to test with
    const image = await findImageWithCompletedSegmentation();
    console.log('Testing with image:', image);
    
    // Check initial status
    console.log('\n=== INITIAL STATUS ===');
    await checkAllStatuses(image.id);
    
    // Manually trigger resegmentation
    const taskId = await manuallyTriggerResegmentation(image.id);
    
    // Check status after triggering
    console.log('\n=== AFTER TRIGGERING ===');
    await checkAllStatuses(image.id);
    
    // Wait for ML service to pick up the task
    const wasPickedUp = await waitForProcessing(image.id);
    
    if (!wasPickedUp) {
      console.log('\n❌ ML service did not pick up the task. Is it running?');
      console.log('Check with: docker-compose logs -f ml');
      return;
    }
    
    // Wait for completion
    const finalStatus = await waitForCompletion(image.id);
    
    // Check final status
    console.log('\n=== FINAL STATUS ===');
    await checkAllStatuses(image.id);
    
    console.log(`\n✅ Resegmentation completed with status: ${finalStatus}`);
    
    // Check for any mismatches
    const mismatchResult = await pool.query(`
      SELECT 
        i.id as image_id,
        i.segmentation_status as image_status,
        sr.status as result_status,
        st.status::text as task_status
      FROM images i
      LEFT JOIN segmentation_results sr ON i.id = sr.image_id
      LEFT JOIN segmentation_tasks st ON i.id = st.image_id AND st.created_at = (
        SELECT MAX(created_at) FROM segmentation_tasks WHERE image_id = i.id
      )
      WHERE i.id = $1
    `, [image.id]);
    
    const mismatch = mismatchResult.rows[0];
    if (mismatch.image_status === mismatch.result_status && 
        mismatch.image_status === mismatch.task_status) {
      console.log('\n✅ All statuses are synchronized correctly!');
    } else {
      console.log('\n⚠️  Status mismatch detected:');
      console.table([mismatch]);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
main();