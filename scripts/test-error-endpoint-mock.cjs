#!/usr/bin/env node

/**
 * Mock test for error reporting endpoint
 * This demonstrates what the endpoint should do when it's working
 */

const http = require('http');

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

// Create a mock server to simulate the error endpoint
function createMockServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/errors') {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const errorReport = JSON.parse(body);
          
          // Log the received error
          console.log('');
          info('Received error report:');
          console.log(JSON.stringify(errorReport, null, 2));
          
          // Simulate validation
          if (!errorReport.message || !errorReport.timestamp || !errorReport.userAgent || !errorReport.url) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: 'Invalid error report data',
              code: 'VALIDATION_ERROR'
            }));
            return;
          }
          
          // Simulate successful response
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: { reported: true },
            message: 'Error report received'
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid JSON',
            code: 'PARSE_ERROR'
          }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/api/errors/stats') {
      // Simulate stats endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          counts: [
            { severity: 'error', error_type: 'TypeError', count: 5, unique_users: 3, unique_pages: 2 },
            { severity: 'warning', error_type: 'NetworkError', count: 2, unique_users: 1, unique_pages: 1 }
          ],
          recent: [
            {
              message: 'Cannot read property "x" of undefined',
              url: 'http://localhost:3000/dashboard',
              severity: 'error',
              server_timestamp: new Date().toISOString()
            }
          ],
          total24h: 7,
          total1h: 2,
          timestamp: new Date().toISOString()
        }
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Not found',
        code: 'NOT_FOUND'
      }));
    }
  });
  
  return server;
}

// Test the mock endpoint
async function testMockEndpoint(port) {
  const errorReport = {
    message: 'Test error from mock testing',
    stack: 'Error: Test error\n    at testFunction (test.js:10:5)',
    timestamp: new Date().toISOString(),
    userAgent: 'Mozilla/5.0 (Test)',
    url: 'http://localhost:3000/test',
    severity: 'error',
    errorType: 'TestError'
  };

  const data = JSON.stringify(errorReport);
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/errors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const response = JSON.parse(responseData);
        console.log('');
        info('Response received:');
        console.log(JSON.stringify(response, null, 2));
        resolve({ success: res.statusCode === 200 });
      });
    });

    req.write(data);
    req.end();
  });
}

// Main function
async function main() {
  log('🎭 Mock Error Reporting Endpoint Test', 'magenta');
  log('=====================================', 'magenta');
  
  info('This demonstrates how the error reporting endpoint should work');
  
  // Create mock server
  const port = 8888;
  const server = createMockServer();
  
  server.listen(port, async () => {
    success(`Mock server listening on port ${port}`);
    
    // Test the endpoint
    log('\n=== Testing Error Reporting ===', 'cyan');
    const result = await testMockEndpoint(port);
    
    if (result.success) {
      success('Error report was successfully processed');
    } else {
      error('Error report failed');
    }
    
    // Test stats endpoint
    log('\n=== Testing Stats Endpoint ===', 'cyan');
    
    const statsReq = http.get(`http://localhost:${port}/api/errors/stats`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const stats = JSON.parse(data);
        info('Stats response:');
        console.log(JSON.stringify(stats, null, 2));
        
        // Summary
        log('\n=== Summary ===', 'magenta');
        success('✨ This is how the error reporting endpoint should work!');
        
        log('\n📝 Implementation Details:', 'cyan');
        info('1. POST /api/errors - Receives client-side error reports');
        info('2. Validates required fields (message, timestamp, userAgent, url)');
        info('3. Logs errors for immediate visibility');
        info('4. Optionally stores in database if STORE_ERROR_REPORTS=true');
        info('5. Optionally forwards to external monitoring service');
        info('6. GET /api/errors/stats - Returns error statistics');
        
        log('\n🔧 To fix the actual endpoint:', 'cyan');
        info('1. Fix TypeScript compilation errors in the backend');
        info('2. Ensure the routes are properly imported and mounted');
        info('3. Test with: node scripts/test-error-reporting.cjs');
        
        server.close();
      });
    });
  });
}

// Run the mock test
if (require.main === module) {
  main().catch(err => {
    error(`Mock test failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { createMockServer, testMockEndpoint };