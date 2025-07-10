#!/usr/bin/env node

/**
 * Test script to verify resegmentation status update fix
 * 
 * This script:
 * 1. Triggers resegmentation for an image
 * 2. Monitors the status updates
 * 3. Verifies that the status changes from 'queued' to 'completed'
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001';
const TEST_EMAIL = 'testuser@test.com';
const TEST_PASSWORD = 'testuser123';

let authToken = null;
let projectId = null;
let imageId = null;

async function login() {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    authToken = response.data.token;
    console.log('✓ Logged in successfully');
    return true;
  } catch (error) {
    console.error('✗ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function getFirstProject() {
  try {
    const response = await axios.get(`${API_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.projects && response.data.projects.length > 0) {
      projectId = response.data.projects[0].id;
      console.log(`✓ Found project: ${response.data.projects[0].title} (${projectId})`);
      return true;
    }
    console.error('✗ No projects found');
    return false;
  } catch (error) {
    console.error('✗ Failed to get projects:', error.response?.data || error.message);
    return false;
  }
}

async function getImageWithSegmentation() {
  try {
    const response = await axios.get(`${API_URL}/api/projects/${projectId}/images`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    // Find an image with completed segmentation
    const imageWithSegmentation = response.data.images.find(img => 
      img.segmentation_status === 'completed' || img.status === 'completed'
    );
    
    if (imageWithSegmentation) {
      imageId = imageWithSegmentation.id;
      console.log(`✓ Found image with segmentation: ${imageWithSegmentation.name} (${imageId})`);
      return true;
    }
    
    // If no segmented image, just take the first one
    if (response.data.images.length > 0) {
      imageId = response.data.images[0].id;
      console.log(`✓ Using first image: ${response.data.images[0].name} (${imageId})`);
      return true;
    }
    
    console.error('✗ No images found in project');
    return false;
  } catch (error) {
    console.error('✗ Failed to get images:', error.response?.data || error.message);
    return false;
  }
}

async function triggerResegmentation() {
  try {
    console.log(`\nTriggering resegmentation for image ${imageId}...`);
    const response = await axios.post(
      `${API_URL}/api/segmentation/${imageId}/resegment`,
      { project_id: projectId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    console.log('✓ Resegmentation triggered successfully');
    console.log('  Response:', response.data);
    return true;
  } catch (error) {
    console.error('✗ Failed to trigger resegmentation:', error.response?.data || error.message);
    return false;
  }
}

async function checkImageStatus() {
  try {
    const response = await axios.get(`${API_URL}/api/images/${imageId}/segmentation`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    return response.data.status;
  } catch (error) {
    console.error('Failed to check status:', error.message);
    return null;
  }
}

async function monitorStatus(maxAttempts = 30, interval = 2000) {
  console.log('\nMonitoring segmentation status...');
  let attempts = 0;
  let lastStatus = null;
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(async () => {
      attempts++;
      const status = await checkImageStatus();
      
      if (status !== lastStatus) {
        console.log(`  [Attempt ${attempts}] Status changed: ${lastStatus} -> ${status}`);
        lastStatus = status;
      } else {
        console.log(`  [Attempt ${attempts}] Status: ${status}`);
      }
      
      // Check if we've reached a final status
      if (status === 'completed' || status === 'failed' || status === 'without_segmentation') {
        clearInterval(checkInterval);
        console.log(`\n✓ Segmentation finished with status: ${status}`);
        resolve(status);
      }
      
      // Timeout after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.log(`\n✗ Timeout: Status remained '${status}' after ${maxAttempts} attempts`);
        resolve(status);
      }
    }, interval);
  });
}

async function checkQueueStatus() {
  try {
    const response = await axios.get(`${API_URL}/api/segmentation/queue-status/${projectId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('\nQueue Status:');
    console.log(`  Queued tasks: ${response.data.queueLength}`);
    console.log(`  Running tasks: ${response.data.runningTasks.length}`);
    console.log(`  Processing images:`, response.data.processingImages.map(img => img.name).join(', ') || 'none');
  } catch (error) {
    console.error('Failed to check queue status:', error.message);
  }
}

async function main() {
  console.log('Starting resegmentation status update test...\n');
  
  // Step 1: Login
  if (!await login()) {
    console.error('\nTest failed: Could not login');
    process.exit(1);
  }
  
  // Step 2: Get first project
  if (!await getFirstProject()) {
    console.error('\nTest failed: Could not find project');
    process.exit(1);
  }
  
  // Step 3: Get an image to resegment
  if (!await getImageWithSegmentation()) {
    console.error('\nTest failed: Could not find image');
    process.exit(1);
  }
  
  // Step 4: Check initial queue status
  await checkQueueStatus();
  
  // Step 5: Trigger resegmentation
  if (!await triggerResegmentation()) {
    console.error('\nTest failed: Could not trigger resegmentation');
    process.exit(1);
  }
  
  // Step 6: Monitor status changes
  const finalStatus = await monitorStatus();
  
  // Step 7: Check final queue status
  await checkQueueStatus();
  
  // Step 8: Verify result
  if (finalStatus === 'completed') {
    console.log('\n✅ TEST PASSED: Resegmentation completed successfully');
    process.exit(0);
  } else if (finalStatus === 'queued' || finalStatus === 'processing') {
    console.log('\n❌ TEST FAILED: Status stuck at', finalStatus);
    console.log('The fix did not resolve the issue - status is not updating properly');
    process.exit(1);
  } else {
    console.log('\n⚠️  TEST INCONCLUSIVE: Final status was', finalStatus);
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  console.error('\nUnexpected error:', error);
  process.exit(1);
});