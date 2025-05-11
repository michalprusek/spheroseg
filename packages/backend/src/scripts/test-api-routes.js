/**
 * Test API Routes Script
 * 
 * This script tests the API routes for the segmentation editor
 * to ensure they are working correctly.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:5001/api';
const PROJECT_ID = process.argv[2]; // Pass project ID as first argument
const IMAGE_ID = process.argv[3]; // Pass image ID as second argument

if (!PROJECT_ID || !IMAGE_ID) {
  console.error('Usage: node test-api-routes.js <project_id> <image_id>');
  process.exit(1);
}

// Test routes
const routesToTest = [
  // Project routes
  { method: 'GET', url: `/projects/${PROJECT_ID}`, name: 'Get Project' },
  { method: 'GET', url: `/projects/${PROJECT_ID}/images`, name: 'Get Project Images' },
  { method: 'GET', url: `/projects/${PROJECT_ID}/images/${IMAGE_ID}`, name: 'Get Project Image' },
  
  // Image routes
  { method: 'GET', url: `/images/${IMAGE_ID}`, name: 'Get Image' },
  
  // Segmentation routes
  { method: 'GET', url: `/images/${IMAGE_ID}/segmentation`, name: 'Get Image Segmentation' },
  { method: 'GET', url: `/segmentations/${IMAGE_ID}`, name: 'Get Segmentation' },
  { method: 'GET', url: `/projects/${PROJECT_ID}/segmentations/${IMAGE_ID}`, name: 'Get Project Segmentation' },
];

// Test static file routes
const staticRoutesToTest = [
  // Static file routes
  { method: 'GET', url: `/uploads/${IMAGE_ID}`, name: 'Get Image File' },
  { method: 'GET', url: `/uploads/${PROJECT_ID}/${IMAGE_ID}`, name: 'Get Project Image File' },
  { method: 'GET', url: `/api/uploads/${IMAGE_ID}`, name: 'Get API Image File' },
  { method: 'GET', url: `/api/uploads/${PROJECT_ID}/${IMAGE_ID}`, name: 'Get API Project Image File' },
];

// Function to test a route
async function testRoute(route) {
  try {
    console.log(`Testing ${route.name}: ${route.method} ${route.url}`);
    const response = await axios({
      method: route.method,
      url: `${API_BASE_URL}${route.url}`,
      validateStatus: () => true, // Don't throw on error status
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    if (response.status >= 200 && response.status < 300) {
      console.log('  Result: SUCCESS');
      if (response.data) {
        console.log('  Data:', typeof response.data === 'object' ? JSON.stringify(response.data).substring(0, 100) + '...' : response.data);
      }
    } else {
      console.log('  Result: FAILED');
      if (response.data) {
        console.log('  Error:', response.data);
      }
    }
    console.log('');
    
    return {
      route,
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.log('  Result: ERROR');
    console.log('  Error:', error.message);
    console.log('');
    
    return {
      route,
      success: false,
      error: error.message
    };
  }
}

// Function to test static file routes
async function testStaticRoute(route) {
  try {
    console.log(`Testing ${route.name}: ${route.method} ${route.url}`);
    const response = await axios({
      method: route.method,
      url: `http://localhost:5001${route.url}`,
      validateStatus: () => true, // Don't throw on error status
      responseType: 'arraybuffer'
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    if (response.status >= 200 && response.status < 300) {
      console.log('  Result: SUCCESS');
      console.log('  Content Type:', response.headers['content-type']);
      console.log('  Content Length:', response.data.length);
    } else {
      console.log('  Result: FAILED');
    }
    console.log('');
    
    return {
      route,
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      contentType: response.headers['content-type'],
      contentLength: response.data.length
    };
  } catch (error) {
    console.log('  Result: ERROR');
    console.log('  Error:', error.message);
    console.log('');
    
    return {
      route,
      success: false,
      error: error.message
    };
  }
}

// Main function
async function main() {
  console.log('=== Testing API Routes ===');
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`Image ID: ${IMAGE_ID}`);
  console.log('');
  
  // Test API routes
  const apiResults = [];
  for (const route of routesToTest) {
    const result = await testRoute(route);
    apiResults.push(result);
  }
  
  // Test static file routes
  const staticResults = [];
  for (const route of staticRoutesToTest) {
    const result = await testStaticRoute(route);
    staticResults.push(result);
  }
  
  // Print summary
  console.log('=== Test Summary ===');
  console.log(`API Routes: ${apiResults.filter(r => r.success).length}/${apiResults.length} successful`);
  console.log(`Static Routes: ${staticResults.filter(r => r.success).length}/${staticResults.length} successful`);
  
  // Print failed routes
  const failedApiRoutes = apiResults.filter(r => !r.success);
  const failedStaticRoutes = staticResults.filter(r => !r.success);
  
  if (failedApiRoutes.length > 0) {
    console.log('\nFailed API Routes:');
    failedApiRoutes.forEach(r => {
      console.log(`- ${r.route.method} ${r.route.url}`);
    });
  }
  
  if (failedStaticRoutes.length > 0) {
    console.log('\nFailed Static Routes:');
    failedStaticRoutes.forEach(r => {
      console.log(`- ${r.route.method} ${r.route.url}`);
    });
  }
}

// Run the main function
main().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
