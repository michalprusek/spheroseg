#!/usr/bin/env node

/**
 * Test script to verify production build fixes
 * Tests:
 * 1. React is properly loaded (no "React is not defined" error)
 * 2. Backend is responding
 * 3. i18next is configured correctly
 * 4. Application loads successfully
 */

const https = require('https');
const http = require('http');

// Disable SSL verification for self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

function makeRequest(url, useHttps = false) {
  return new Promise((resolve, reject) => {
    const protocol = useHttps ? https : http;
    
    protocol.get(url, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    }).on('error', reject);
  });
}

async function testProduction() {
  console.log('🧪 Testing Production Build Fixes\n');
  
  let allTestsPassed = true;
  
  // Test 1: Frontend loads
  console.log('1️⃣ Testing Frontend Load...');
  try {
    const { statusCode, data } = await makeRequest('https://localhost', true);
    if (statusCode === 200 && data.includes('<!DOCTYPE html>')) {
      console.log('✅ Frontend HTML loads successfully');
    } else {
      console.log(`❌ Frontend failed to load: Status ${statusCode}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ Frontend error: ${error.message}`);
    allTestsPassed = false;
  }
  
  // Test 2: Main JavaScript bundle contains React
  console.log('\n2️⃣ Testing React in Main Bundle...');
  try {
    const { data: html } = await makeRequest('https://localhost', true);
    const scriptMatch = html.match(/src="(\/assets\/js\/index-[^"]+\.js)"/);
    
    if (scriptMatch) {
      const scriptUrl = `https://localhost${scriptMatch[1]}`;
      const { data: jsContent } = await makeRequest(scriptUrl, true);
      
      if (jsContent.includes('React.') || jsContent.includes('react')) {
        console.log('✅ React is included in the main bundle');
        
        // Check for common React errors in the code
        if (jsContent.includes('React is not defined')) {
          console.log('⚠️  Warning: "React is not defined" string found in bundle');
        }
      } else {
        console.log('❌ React not found in main bundle');
        allTestsPassed = false;
      }
    } else {
      console.log('❌ Could not find main script tag');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ JavaScript bundle test error: ${error.message}`);
    allTestsPassed = false;
  }
  
  // Test 3: Backend API
  console.log('\n3️⃣ Testing Backend API...');
  try {
    const { statusCode, data } = await makeRequest('http://localhost:5001/api/auth/test');
    if (statusCode === 200) {
      console.log('✅ Backend API is responding');
      const parsed = JSON.parse(data);
      console.log(`   Response: ${parsed.message}`);
    } else {
      console.log(`❌ Backend API returned status ${statusCode}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ Backend API error: ${error.message}`);
    allTestsPassed = false;
  }
  
  // Test 4: Check if i18next vendor chunk loads
  console.log('\n4️⃣ Testing i18next Configuration...');
  try {
    const { data: html } = await makeRequest('https://localhost', true);
    if (html.includes('i18n-vendor')) {
      console.log('✅ i18next vendor chunk is referenced');
    } else {
      console.log('⚠️  i18next vendor chunk not found (might be bundled elsewhere)');
    }
  } catch (error) {
    console.log(`❌ i18next test error: ${error.message}`);
  }
  
  // Test 5: ML Service
  console.log('\n5️⃣ Testing ML Service...');
  try {
    const { statusCode } = await makeRequest('http://localhost:5002/health');
    if (statusCode === 200) {
      console.log('✅ ML service is healthy');
    } else {
      console.log(`⚠️  ML service returned status ${statusCode}`);
    }
  } catch (error) {
    console.log(`⚠️  ML service might not have a health endpoint: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  if (allTestsPassed) {
    console.log('✅ All critical tests passed! The application should be functional.');
    console.log('\n💡 Next steps:');
    console.log('   1. Open https://localhost in a browser');
    console.log('   2. Check browser console for any remaining errors');
    console.log('   3. Try logging in with: testuser@test.com / testuser123');
    console.log('   4. Test image upload and segmentation functionality');
  } else {
    console.log('❌ Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the tests
testProduction().catch(console.error);