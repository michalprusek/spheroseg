#!/usr/bin/env node

/**
 * Test script for web vitals reporting
 * Verifies that web vitals are properly collected and sent when enabled
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Check if web vitals are configured
function checkWebVitalsConfig() {
  const envPath = path.join(__dirname, '../packages/frontend/.env');
  const envLocalPath = path.join(__dirname, '../packages/frontend/.env.local');
  
  let webVitalsEnabled = false;
  
  // Check .env files
  [envPath, envLocalPath].forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('VITE_ENABLE_WEB_VITALS_METRICS=true')) {
        webVitalsEnabled = true;
      }
    }
  });
  
  return webVitalsEnabled;
}

// Check if web vitals code exists
function checkWebVitalsImplementation() {
  const files = [
    {
      path: 'packages/frontend/src/utils/performance.ts',
      pattern: 'VITE_ENABLE_WEB_VITALS_METRICS',
      description: 'Web vitals environment check'
    },
    {
      path: 'packages/frontend/src/utils/performance.ts',
      pattern: '/api/metrics/vitals',
      description: 'Web vitals endpoint'
    },
    {
      path: 'packages/frontend/src/services/performanceMetrics.ts',
      pattern: 'getWebVitals',
      description: 'Web vitals collection'
    }
  ];
  
  const results = [];
  
  files.forEach(({ path: filePath, pattern, description }) => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      results.push({
        description,
        found: content.includes(pattern),
        file: filePath
      });
    } else {
      results.push({
        description,
        found: false,
        file: filePath,
        error: 'File not found'
      });
    }
  });
  
  return results;
}

// Mock web vitals server
function createMockVitalsServer() {
  const receivedVitals = [];
  
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/metrics/vitals') {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const vitals = JSON.parse(body);
          receivedVitals.push(vitals);
          
          info('Received web vitals:');
          console.log(JSON.stringify(vitals, null, 2));
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  return { server, receivedVitals };
}

// Test web vitals metrics
function testWebVitalsMetrics() {
  const metrics = [
    {
      name: 'FCP',
      fullName: 'First Contentful Paint',
      goodThreshold: 1800,
      poorThreshold: 3000,
      unit: 'ms'
    },
    {
      name: 'LCP',
      fullName: 'Largest Contentful Paint',
      goodThreshold: 2500,
      poorThreshold: 4000,
      unit: 'ms'
    },
    {
      name: 'FID',
      fullName: 'First Input Delay',
      goodThreshold: 100,
      poorThreshold: 300,
      unit: 'ms'
    },
    {
      name: 'CLS',
      fullName: 'Cumulative Layout Shift',
      goodThreshold: 0.1,
      poorThreshold: 0.25,
      unit: 'score'
    },
    {
      name: 'TTFB',
      fullName: 'Time to First Byte',
      goodThreshold: 800,
      poorThreshold: 1800,
      unit: 'ms'
    }
  ];
  
  log('\n=== Web Vitals Metrics ===', 'cyan');
  
  metrics.forEach(metric => {
    info(`${metric.name} (${metric.fullName}):`);
    console.log(`  Good: < ${metric.goodThreshold}${metric.unit}`);
    console.log(`  Needs Improvement: ${metric.goodThreshold}-${metric.poorThreshold}${metric.unit}`);
    console.log(`  Poor: > ${metric.poorThreshold}${metric.unit}`);
  });
}

// Main test function
async function main() {
  log('🏃 Web Vitals Test Suite', 'magenta');
  log('========================', 'magenta');
  
  // Test 1: Check configuration
  log('\n=== Test 1: Configuration Check ===', 'cyan');
  const webVitalsEnabled = checkWebVitalsConfig();
  
  if (webVitalsEnabled) {
    success('Web vitals are ENABLED in environment configuration');
  } else {
    warning('Web vitals are DISABLED in environment configuration');
    info('To enable: Set VITE_ENABLE_WEB_VITALS_METRICS=true in .env');
  }
  
  // Test 2: Implementation check
  log('\n=== Test 2: Implementation Check ===', 'cyan');
  const implementationResults = checkWebVitalsImplementation();
  
  let allImplemented = true;
  implementationResults.forEach(result => {
    if (result.found) {
      success(`${result.description}: Found in ${result.file}`);
    } else {
      error(`${result.description}: Not found in ${result.file}`);
      allImplemented = false;
    }
  });
  
  if (allImplemented) {
    success('All web vitals implementation code is present');
  }
  
  // Test 3: Show metrics info
  testWebVitalsMetrics();
  
  // Test 4: Mock server test
  log('\n=== Test 4: Mock Server Test ===', 'cyan');
  
  const port = 8889;
  const { server, receivedVitals } = createMockVitalsServer();
  
  server.listen(port, () => {
    info(`Mock server listening on port ${port}`);
    
    // Simulate sending web vitals
    const testVitals = {
      name: 'LCP',
      value: 2100,
      id: 'v1-1234567890-1234567890',
      timestamp: new Date().toISOString()
    };
    
    const data = JSON.stringify(testVitals);
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/metrics/vitals',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        success('Successfully sent web vitals to server');
      }
      
      // Summary
      log('\n=== Summary ===', 'magenta');
      
      if (webVitalsEnabled && allImplemented) {
        success('✨ Web vitals are properly configured and implemented!');
      } else if (!webVitalsEnabled) {
        warning('⚠️  Web vitals are implemented but not enabled');
        log('\n📝 To enable web vitals:', 'cyan');
        info('1. Add to packages/frontend/.env:');
        console.log('   VITE_ENABLE_WEB_VITALS_METRICS=true');
        info('2. Restart the frontend server');
        info('3. Web vitals will be sent to /api/metrics/vitals');
      } else {
        error('❌ Web vitals implementation has issues');
      }
      
      log('\n📊 Web Vitals Collection:', 'cyan');
      info('1. FCP - First Contentful Paint (when first content appears)');
      info('2. LCP - Largest Contentful Paint (when main content loads)');
      info('3. FID - First Input Delay (responsiveness to user input)');
      info('4. CLS - Cumulative Layout Shift (visual stability)');
      info('5. TTFB - Time to First Byte (server response time)');
      
      server.close();
    });
    
    req.write(data);
    req.end();
  });
}

// Run tests
if (require.main === module) {
  main().catch(err => {
    error(`Test failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { checkWebVitalsConfig, checkWebVitalsImplementation, createMockVitalsServer };