#!/usr/bin/env node

/**
 * Test script to verify module resolution in production build
 * Specifically tests for the "Failed to resolve module specifier 'react'" error
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

async function analyzeJavaScriptBundle(jsContent, fileName) {
  console.log(`\n📦 Analyzing ${fileName}:`);
  
  // Check for bare module imports
  const bareImports = jsContent.match(/from\s+["'](?!\.\/|\/|https?:\/\/)([^"']+)["']/g);
  if (bareImports && bareImports.length > 0) {
    console.log(`⚠️  Found ${bareImports.length} bare module imports:`);
    const uniqueImports = [...new Set(bareImports.slice(0, 5))];
    uniqueImports.forEach(imp => console.log(`   ${imp}`));
    if (bareImports.length > 5) {
      console.log(`   ... and ${bareImports.length - 5} more`);
    }
    return false;
  }
  
  // Check for React presence
  const hasReact = jsContent.includes('React.') || jsContent.includes('createElement') || jsContent.includes('jsx');
  console.log(`   React code: ${hasReact ? '✅ Present' : '❌ Not found'}`);
  
  // Check for proper module format
  const hasExports = jsContent.includes('export ') || jsContent.includes('exports.');
  const hasImports = jsContent.includes('import ') || jsContent.includes('require(');
  console.log(`   Module format: ${hasExports || hasImports ? '✅ ES/CommonJS modules' : '⚠️  No module syntax'}`);
  
  // Check file size
  const sizeKB = (jsContent.length / 1024).toFixed(2);
  console.log(`   File size: ${sizeKB} KB`);
  
  return true;
}

async function testModuleResolution() {
  console.log('🧪 Testing Module Resolution in Production Build\n');
  
  let allTestsPassed = true;
  
  // Test 1: Frontend HTML loads
  console.log('1️⃣ Fetching HTML...');
  try {
    const { statusCode, data: html } = await makeRequest('https://localhost', true);
    if (statusCode === 200) {
      console.log('✅ HTML loaded successfully');
      
      // Extract all script tags
      const scriptTags = html.match(/<script[^>]*src="([^"]+)"[^>]*>/g) || [];
      const scriptUrls = scriptTags.map(tag => {
        const match = tag.match(/src="([^"]+)"/);
        return match ? match[1] : null;
      }).filter(Boolean);
      
      console.log(`\n2️⃣ Found ${scriptUrls.length} JavaScript files:`);
      scriptUrls.forEach(url => console.log(`   ${url}`));
      
      // Test main bundle
      const mainScript = scriptUrls.find(url => url.includes('index-'));
      if (mainScript) {
        console.log('\n3️⃣ Testing main bundle for module issues...');
        const { data: jsContent } = await makeRequest(`https://localhost${mainScript}`, true);
        
        const mainBundleOk = await analyzeJavaScriptBundle(jsContent, mainScript);
        if (!mainBundleOk) {
          allTestsPassed = false;
        }
      } else {
        console.log('❌ Could not find main script bundle');
        allTestsPassed = false;
      }
      
      // Check for import maps
      if (html.includes('<script type="importmap">')) {
        console.log('\n✅ Import map found in HTML');
      } else {
        console.log('\n📝 No import map found (modules should be bundled)');
      }
      
    } else {
      console.log(`❌ HTML failed to load: Status ${statusCode}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ HTML loading error: ${error.message}`);
    allTestsPassed = false;
  }
  
  // Test backend
  console.log('\n4️⃣ Testing Backend API...');
  try {
    const { statusCode } = await makeRequest('http://localhost:5001/api/auth/test');
    if (statusCode === 200) {
      console.log('✅ Backend API is responding');
    } else {
      console.log(`❌ Backend API returned status ${statusCode}`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ Backend API error: ${error.message}`);
    allTestsPassed = false;
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  if (allTestsPassed) {
    console.log('✅ Module resolution appears to be fixed!');
    console.log('\n🎯 Next steps for production deployment:');
    console.log('   1. Deploy these changes to https://spherosegapp.utia.cas.cz/');
    console.log('   2. Clear browser cache and test in incognito mode');
    console.log('   3. Check browser console for any runtime errors');
    console.log('   4. Verify React components load without module errors');
  } else {
    console.log('❌ Module resolution issues detected');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Check if all React code is properly bundled');
    console.log('   2. Verify no bare module imports remain');
    console.log('   3. Consider using import maps for external modules');
    console.log('   4. Check rollup output configuration');
  }
}

// Run the tests
testModuleResolution().catch(console.error);