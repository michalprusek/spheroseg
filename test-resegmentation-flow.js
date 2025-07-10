const axios = require('axios');
const { Pool } = require('pg');

// Configuration
const API_URL = 'http://localhost:5001/api';
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/spheroseg'
});

// You'll need to get a valid auth token from login
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN';

async function getImageForResegmentation() {
  // Find an image that has already been segmented
  const result = await pool.query(`
    SELECT i.id, i.name, i.project_id, i.segmentation_status
    FROM images i
    WHERE i.segmentation_status = 'completed'
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    throw new Error('No completed segmentation found for testing');
  }
  
  return result.rows[0];
}

async function checkDatabaseStatus(imageId) {
  console.log('\n=== Checking Database Status ===');
  
  // Check images table
  const imageResult = await pool.query(
    'SELECT id, name, segmentation_status FROM images WHERE id = $1',
    [imageId]
  );
  console.log('Image status:', imageResult.rows[0]);
  
  // Check segmentation_results table
  const resultsResult = await pool.query(
    'SELECT image_id, status, updated_at FROM segmentation_results WHERE image_id = $1',
    [imageId]
  );
  console.log('Segmentation result:', resultsResult.rows[0] || 'No record');
  
  // Check segmentation_tasks table
  const tasksResult = await pool.query(
    'SELECT id, image_id, status, created_at, started_at, completed_at FROM segmentation_tasks WHERE image_id = $1 ORDER BY created_at DESC',
    [imageId]
  );
  console.log('Segmentation tasks:', tasksResult.rows);
  
  console.log('================================\n');
}

async function triggerResegmentation(imageId) {
  console.log(`\nTriggering resegmentation for image: ${imageId}`);
  
  try {
    const response = await axios.post(
      `${API_URL}/images/${imageId}/segmentation`,
      {
        force_resegment: true,
        model_type: 'resunet'
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error triggering resegmentation:', error.response?.data || error.message);
    throw error;
  }
}

async function waitForCompletion(imageId, maxWaitTime = 60000) {
  console.log(`\nWaiting for segmentation to complete (max ${maxWaitTime/1000} seconds)...`);
  
  const startTime = Date.now();
  let lastStatus = null;
  
  while (Date.now() - startTime < maxWaitTime) {
    const result = await pool.query(
      'SELECT segmentation_status FROM images WHERE id = $1',
      [imageId]
    );
    
    const currentStatus = result.rows[0].segmentation_status;
    
    if (currentStatus !== lastStatus) {
      console.log(`Status changed to: ${currentStatus}`);
      lastStatus = currentStatus;
    }
    
    if (currentStatus === 'completed' || currentStatus === 'failed') {
      return currentStatus;
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Timeout waiting for segmentation to complete');
}

async function main() {
  try {
    // Get an image to test with
    const image = await getImageForResegmentation();
    console.log('Testing with image:', image);
    
    // Check initial status
    console.log('\n=== INITIAL STATUS ===');
    await checkDatabaseStatus(image.id);
    
    // Trigger resegmentation
    await triggerResegmentation(image.id);
    
    // Wait a bit for the task to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check status after triggering
    console.log('\n=== AFTER TRIGGERING ===');
    await checkDatabaseStatus(image.id);
    
    // Wait for completion
    const finalStatus = await waitForCompletion(image.id);
    
    // Check final status
    console.log('\n=== FINAL STATUS ===');
    await checkDatabaseStatus(image.id);
    
    console.log(`\n✅ Resegmentation completed with status: ${finalStatus}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
main();