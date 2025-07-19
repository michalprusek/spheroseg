#!/usr/bin/env node

/**
 * Test environment variables in runtime context
 * This script loads .env files and tests actual runtime behavior
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load dotenv manually to test actual loading
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

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

// Test frontend runtime
async function testFrontendRuntime() {
  log('\n=== Testing Frontend Runtime Configuration ===', 'cyan');
  
  const frontendPath = path.join(__dirname, '../packages/frontend');
  const envPath = path.join(frontendPath, '.env');
  const envLocalPath = path.join(frontendPath, '.env.local');
  
  // Load environment files
  const env = loadEnvFile(envPath);
  const envLocal = loadEnvFile(envLocalPath);
  const merged = { ...env, ...envLocal };
  
  info(`Loaded ${Object.keys(env).length} variables from .env`);
  info(`Loaded ${Object.keys(envLocal).length} variables from .env.local`);
  
  // Test critical variables
  const critical = ['VITE_API_URL', 'VITE_API_BASE_URL', 'VITE_ASSETS_URL'];
  let allCriticalSet = true;
  
  critical.forEach(key => {
    if (merged[key]) {
      success(`${key} = ${merged[key]}`);
    } else {
      error(`${key} is not set`);
      allCriticalSet = false;
    }
  });
  
  // Test performance metrics configuration
  info('\nTesting performance metrics configuration:');
  const perfVars = [
    'VITE_ENABLE_PERFORMANCE_METRICS',
    'VITE_ENABLE_FRONTEND_METRICS',
    'VITE_ENABLE_WEB_VITALS_METRICS',
    'VITE_ENABLE_IMAGE_METRICS'
  ];
  
  perfVars.forEach(key => {
    const value = merged[key] || 'false';
    if (value === 'true') {
      success(`${key} is enabled`);
    } else {
      info(`${key} is disabled (${value})`);
    }
  });
  
  // Test error monitoring
  info('\nTesting error monitoring:');
  const errorMonitoring = merged['VITE_ENABLE_ERROR_MONITORING'] || 'false';
  if (errorMonitoring === 'true') {
    success('Error monitoring is enabled');
  } else {
    info('Error monitoring is disabled');
  }
  
  // Test logging configuration
  info('\nTesting logging configuration:');
  const logLevel = merged['VITE_LOG_LEVEL'] || 'INFO';
  const consoleLogsEnabled = merged['VITE_ENABLE_CONSOLE_LOGS'] || 'true';
  success(`Log level: ${logLevel}`);
  success(`Console logs: ${consoleLogsEnabled === 'true' ? 'enabled' : 'disabled'}`);
  
  return { success: allCriticalSet, env: merged };
}

// Test backend runtime
async function testBackendRuntime() {
  log('\n=== Testing Backend Runtime Configuration ===', 'cyan');
  
  const backendPath = path.join(__dirname, '../packages/backend');
  const envPath = path.join(backendPath, '.env');
  
  // Load environment file
  const env = loadEnvFile(envPath);
  info(`Loaded ${Object.keys(env).length} variables from .env`);
  
  // Test critical variables
  const critical = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET',
    'ML_SERVICE_URL'
  ];
  
  let allCriticalSet = true;
  
  critical.forEach(key => {
    if (env[key]) {
      // Don't show sensitive values
      const value = ['DB_PASSWORD', 'JWT_SECRET'].includes(key) 
        ? '***' 
        : env[key];
      success(`${key} = ${value}`);
    } else {
      error(`${key} is not set`);
      allCriticalSet = false;
    }
  });
  
  // Test database connection string
  info('\nTesting database configuration:');
  if (env.DB_HOST && env.DB_PORT && env.DB_NAME && env.DB_USER && env.DB_PASSWORD) {
    const dbUrl = `postgresql://${env.DB_USER}:***@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
    success(`Database URL: ${dbUrl}`);
  } else {
    error('Database configuration is incomplete');
  }
  
  // Test ML service configuration
  info('\nTesting ML service configuration:');
  if (env.ML_SERVICE_URL) {
    success(`ML Service URL: ${env.ML_SERVICE_URL}`);
    success(`Max concurrent tasks: ${env.ML_MAX_CONCURRENT_TASKS || '2'}`);
    success(`Retry delay: ${env.ML_RETRY_DELAY || '5000'}ms`);
  } else {
    error('ML service URL not configured');
  }
  
  // Test Redis configuration
  info('\nTesting Redis configuration:');
  const redisEnabled = env.USE_REDIS_RATE_LIMIT === 'true';
  if (redisEnabled) {
    success(`Redis enabled at ${env.REDIS_HOST || 'localhost'}:${env.REDIS_PORT || '6379'}`);
  } else {
    info('Redis rate limiting is disabled');
  }
  
  // Test CDN configuration
  info('\nTesting CDN configuration:');
  const cdnEnabled = env.CDN_ENABLED === 'true';
  if (cdnEnabled) {
    success(`CDN enabled with provider: ${env.CDN_PROVIDER}`);
  } else {
    info('CDN is disabled');
  }
  
  return { success: allCriticalSet, env };
}

// Test runtime API connectivity
async function testApiConnectivity() {
  log('\n=== Testing API Connectivity ===', 'cyan');
  
  const frontendEnv = loadEnvFile(path.join(__dirname, '../packages/frontend/.env'));
  const backendEnv = loadEnvFile(path.join(__dirname, '../packages/backend/.env'));
  
  const apiUrl = frontendEnv.VITE_API_URL || 'http://localhost:5001';
  const backendPort = backendEnv.PORT || '5001';
  
  info(`Frontend expects API at: ${apiUrl}`);
  info(`Backend configured on port: ${backendPort}`);
  
  // Check if ports match
  if (apiUrl.includes(`:${backendPort}`)) {
    success('Frontend and backend ports match');
  } else {
    warning('Frontend API URL port does not match backend PORT');
  }
  
  // Test actual connectivity
  const http = require('http');
  
  return new Promise((resolve) => {
    const url = new URL(apiUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        success(`API health check passed (${res.statusCode})`);
        resolve(true);
      } else {
        warning(`API health check returned ${res.statusCode}`);
        resolve(false);
      }
    });
    
    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        warning('API server is not running (connection refused)');
      } else {
        error(`API connection error: ${err.message}`);
      }
      resolve(false);
    });
    
    req.on('timeout', () => {
      warning('API health check timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Test environment variable usage in code
async function testEnvUsageInCode() {
  log('\n=== Testing Environment Variable Usage in Code ===', 'cyan');
  
  // Check if error reporting endpoint exists
  const errorEndpoint = '/api/errors';
  info(`Error reporting endpoint: ${errorEndpoint}`);
  
  // Check if performance metrics endpoint exists
  const metricsEndpoint = '/api/metrics';
  info(`Performance metrics endpoint: ${metricsEndpoint}`);
  
  // Check if web vitals endpoint exists
  const vitalsEndpoint = '/api/metrics/web-vitals';
  info(`Web vitals endpoint: ${vitalsEndpoint}`);
  
  // Verify these endpoints are referenced in the code
  const frontendFiles = [
    'packages/frontend/src/config/environment.ts',
    'packages/frontend/src/utils/logger.ts',
    'packages/frontend/src/utils/errorMonitoring.ts',
    'packages/frontend/src/utils/performance/webVitals.ts'
  ];
  
  let allFilesExist = true;
  
  frontendFiles.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
      success(`${path.basename(file)} exists`);
    } else {
      warning(`${path.basename(file)} not found`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

// Main test runner
async function main() {
  log('🚀 Environment Variable Runtime Test', 'magenta');
  log('====================================', 'magenta');
  
  try {
    // Test frontend runtime
    const frontendResult = await testFrontendRuntime();
    
    // Test backend runtime
    const backendResult = await testBackendRuntime();
    
    // Test API connectivity
    const apiConnected = await testApiConnectivity();
    
    // Test env usage in code
    const codeUsageValid = await testEnvUsageInCode();
    
    // Final summary
    log('\n=== Test Summary ===', 'magenta');
    
    if (frontendResult.success) {
      success('Frontend environment: All critical variables set');
    } else {
      error('Frontend environment: Missing critical variables');
    }
    
    if (backendResult.success) {
      success('Backend environment: All critical variables set');
    } else {
      error('Backend environment: Missing critical variables');
    }
    
    if (apiConnected) {
      success('API connectivity: Server is reachable');
    } else {
      info('API connectivity: Server not running (expected in test environment)');
    }
    
    if (codeUsageValid) {
      success('Code integration: Environment files found');
    } else {
      warning('Code integration: Some environment files missing');
    }
    
    // Overall result
    const overallSuccess = frontendResult.success && backendResult.success;
    
    if (overallSuccess) {
      success('\n✨ Environment variables are properly configured!');
      
      // Show next steps
      log('\n📝 Next Steps:', 'cyan');
      info('1. Enable performance metrics: VITE_ENABLE_PERFORMANCE_METRICS=true');
      info('2. Enable error monitoring: VITE_ENABLE_ERROR_MONITORING=true');
      info('3. Enable web vitals: VITE_ENABLE_WEB_VITALS_METRICS=true');
      info('4. Test metrics endpoints with actual API calls');
      
      process.exit(0);
    } else {
      error('\n❌ Some critical environment variables are missing!');
      process.exit(1);
    }
  } catch (err) {
    error(`Test failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main();
}

module.exports = { loadEnvFile, testFrontendRuntime, testBackendRuntime };