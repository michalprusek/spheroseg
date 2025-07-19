#!/usr/bin/env node

/**
 * Test script for error reporting endpoint
 * Tests both the endpoint availability and functionality
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

// Load environment configuration
function loadEnv() {
  const envPath = path.join(__dirname, '../packages/backend/.env');
  const env = {};
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
  
  return env;
}

// Test error reporting endpoint
async function testErrorEndpoint(apiUrl) {
  return new Promise((resolve) => {
    const errorReport = {
      message: 'Test error from automated testing',
      stack: 'Error: Test error\n    at testFunction (test.js:10:5)\n    at main (test.js:20:3)',
      source: 'test-error-reporting.js',
      lineno: 10,
      colno: 5,
      timestamp: new Date().toISOString(),
      userAgent: 'Node.js Test Script',
      url: 'http://localhost:3000/test',
      severity: 'error',
      errorType: 'TestError',
      metadata: {
        test: true,
        scriptName: 'test-error-reporting.cjs',
        purpose: 'endpoint_validation'
      }
    };

    const data = JSON.stringify(errorReport);
    const url = new URL(apiUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: '/api/errors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            response,
            success: res.statusCode === 200 && response.success === true
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            response: responseData,
            success: false,
            error: 'Invalid JSON response'
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        response: null,
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 0,
        response: null,
        success: false,
        error: 'Request timeout'
      });
    });

    req.write(data);
    req.end();
  });
}

// Test error stats endpoint
async function testStatsEndpoint(apiUrl) {
  return new Promise((resolve) => {
    const url = new URL(apiUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: '/api/errors/stats',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            response,
            success: res.statusCode === 200 || res.statusCode === 404 // 404 is ok if storage not enabled
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            response: responseData,
            success: false,
            error: 'Invalid JSON response'
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        response: null,
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 0,
        response: null,
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

// Test validation
async function testValidation(apiUrl) {
  const invalidPayloads = [
    {
      name: 'Missing message',
      data: {
        timestamp: new Date().toISOString(),
        userAgent: 'Test',
        url: 'http://test.com'
      }
    },
    {
      name: 'Invalid timestamp',
      data: {
        message: 'Test error',
        timestamp: 'invalid-date',
        userAgent: 'Test',
        url: 'http://test.com'
      }
    },
    {
      name: 'Invalid URL',
      data: {
        message: 'Test error',
        timestamp: new Date().toISOString(),
        userAgent: 'Test',
        url: 'not-a-url'
      }
    },
    {
      name: 'Invalid severity',
      data: {
        message: 'Test error',
        timestamp: new Date().toISOString(),
        userAgent: 'Test',
        url: 'http://test.com',
        severity: 'critical' // Should be error/warning/info
      }
    }
  ];

  const results = [];

  for (const { name, data } of invalidPayloads) {
    const result = await new Promise((resolve) => {
      const jsonData = JSON.stringify(data);
      const url = new URL(apiUrl);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: '/api/errors',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonData)
        },
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          resolve({
            name,
            statusCode: res.statusCode,
            expectedFailure: res.statusCode === 400
          });
        });
      });

      req.on('error', () => {
        resolve({
          name,
          statusCode: 0,
          expectedFailure: false
        });
      });

      req.write(jsonData);
      req.end();
    });

    results.push(result);
  }

  return results;
}

// Main test runner
async function main() {
  log('🚀 Error Reporting Endpoint Test', 'magenta');
  log('================================', 'magenta');

  // Load environment
  const env = loadEnv();
  const apiUrl = `http://localhost:${env.PORT || '5001'}`;
  
  info(`Testing API at: ${apiUrl}`);

  // Test 1: Basic endpoint functionality
  log('\n=== Test 1: Basic Endpoint Functionality ===', 'cyan');
  const basicTest = await testErrorEndpoint(apiUrl);
  
  if (basicTest.success) {
    success('Error endpoint is working correctly');
    info(`Response: ${JSON.stringify(basicTest.response)}`);
  } else if (basicTest.error === 'ECONNREFUSED') {
    warning('API server is not running');
    info('Start the server with: docker-compose --profile dev up -d backend');
  } else {
    error(`Error endpoint test failed: ${basicTest.error || `Status ${basicTest.statusCode}`}`);
    if (basicTest.response) {
      info(`Response: ${JSON.stringify(basicTest.response)}`);
    }
  }

  // Test 2: Stats endpoint
  log('\n=== Test 2: Stats Endpoint ===', 'cyan');
  const statsTest = await testStatsEndpoint(apiUrl);
  
  if (statsTest.success) {
    if (statsTest.statusCode === 404) {
      info('Stats endpoint returned 404 (error storage not enabled)');
    } else {
      success('Stats endpoint is working');
      info(`Response: ${JSON.stringify(statsTest.response)}`);
    }
  } else {
    error(`Stats endpoint test failed: ${statsTest.error || `Status ${statsTest.statusCode}`}`);
  }

  // Test 3: Validation
  if (basicTest.statusCode !== 0) { // Only test validation if server is running
    log('\n=== Test 3: Validation Tests ===', 'cyan');
    const validationResults = await testValidation(apiUrl);
    
    let allValidationsPassed = true;
    validationResults.forEach(result => {
      if (result.expectedFailure) {
        success(`${result.name}: Correctly rejected with 400`);
      } else {
        error(`${result.name}: Should have failed with 400, got ${result.statusCode}`);
        allValidationsPassed = false;
      }
    });
    
    if (allValidationsPassed) {
      success('All validation tests passed');
    }
  }

  // Test 4: Check frontend integration
  log('\n=== Test 4: Frontend Integration Check ===', 'cyan');
  
  const frontendFiles = [
    'packages/frontend/src/utils/errorMonitoring.ts',
    'packages/frontend/src/utils/errorReporting.ts',
    'packages/frontend/src/services/errorService.ts'
  ];
  
  let frontendIntegrationExists = false;
  
  frontendFiles.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
      success(`${path.basename(file)} exists`);
      frontendIntegrationExists = true;
    }
  });
  
  if (!frontendIntegrationExists) {
    info('No frontend error reporting integration found yet');
    info('This is expected - frontend integration can be added later');
  }

  // Summary
  log('\n=== Summary ===', 'magenta');
  
  if (basicTest.success) {
    success('✨ Error reporting endpoint is fully functional!');
    
    log('\n📝 Next Steps:', 'cyan');
    info('1. Enable error storage: STORE_ERROR_REPORTS=true');
    info('2. Create error_reports table in database');
    info('3. Integrate with frontend error boundaries');
    info('4. Configure external monitoring service (optional)');
  } else if (basicTest.error === 'ECONNREFUSED') {
    warning('⚠️  Cannot test endpoint - server not running');
    info('Start the backend server and run this test again');
  } else {
    error('❌ Error reporting endpoint has issues');
    info('Check the server logs for more details');
  }
}

// Run tests
if (require.main === module) {
  main().catch(err => {
    error(`Test script failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
}

module.exports = { testErrorEndpoint, testStatsEndpoint, testValidation };