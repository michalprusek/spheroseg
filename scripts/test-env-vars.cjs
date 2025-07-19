#!/usr/bin/env node

/**
 * Test script to verify all environment variables work correctly
 * Tests both frontend and backend environment configurations
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper functions
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

// Test environment variable loading
async function testEnvVarLoading(packagePath, envExample) {
  const results = [];
  
  try {
    // Read .env.example
    const envExamplePath = path.join(packagePath, envExample);
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    
    // Parse environment variables
    const envVars = envExampleContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const [key, defaultValue] = line.split('=');
        return { key: key.trim(), defaultValue: defaultValue?.trim() || '' };
      })
      .filter(({ key }) => key);
    
    info(`Found ${envVars.length} environment variables in ${envExample}`);
    
    // Check if .env file exists
    const envPath = path.join(packagePath, '.env');
    const envExists = fs.existsSync(envPath);
    
    if (!envExists) {
      warning('.env file does not exist, using .env.example defaults');
    }
    
    // Test each variable
    for (const { key, defaultValue } of envVars) {
      const result = {
        key,
        defaultValue,
        currentValue: process.env[key] || 'undefined',
        status: 'success'
      };
      
      // Check if variable is set
      if (process.env[key]) {
        result.status = 'set';
      } else if (defaultValue) {
        result.status = 'default';
      } else {
        result.status = 'missing';
      }
      
      results.push(result);
    }
    
    return results;
  } catch (err) {
    error(`Failed to test environment variables: ${err.message}`);
    return [];
  }
}

// Test frontend environment variables
async function testFrontendEnv() {
  log('\n=== Testing Frontend Environment Variables ===', 'cyan');
  
  const frontendPath = path.join(__dirname, '../packages/frontend');
  const results = await testEnvVarLoading(frontendPath, '.env.example');
  
  // Display results
  const summary = {
    total: results.length,
    set: 0,
    default: 0,
    missing: 0
  };
  
  results.forEach(({ key, status, defaultValue }) => {
    switch (status) {
      case 'set':
        success(`${key} is set`);
        summary.set++;
        break;
      case 'default':
        info(`${key} using default: ${defaultValue}`);
        summary.default++;
        break;
      case 'missing':
        warning(`${key} is not set and has no default`);
        summary.missing++;
        break;
    }
  });
  
  log(`\nFrontend Summary: ${summary.set} set, ${summary.default} defaults, ${summary.missing} missing`, 'cyan');
  
  return summary;
}

// Test backend environment variables
async function testBackendEnv() {
  log('\n=== Testing Backend Environment Variables ===', 'cyan');
  
  const backendPath = path.join(__dirname, '../packages/backend');
  const results = await testEnvVarLoading(backendPath, '.env.example');
  
  // Display results
  const summary = {
    total: results.length,
    set: 0,
    default: 0,
    missing: 0
  };
  
  results.forEach(({ key, status, defaultValue }) => {
    switch (status) {
      case 'set':
        success(`${key} is set`);
        summary.set++;
        break;
      case 'default':
        info(`${key} using default: ${defaultValue}`);
        summary.default++;
        break;
      case 'missing':
        warning(`${key} is not set and has no default`);
        summary.missing++;
        break;
    }
  });
  
  log(`\nBackend Summary: ${summary.set} set, ${summary.default} defaults, ${summary.missing} missing`, 'cyan');
  
  return summary;
}

// Test runtime behavior with environment variables
async function testRuntimeBehavior() {
  log('\n=== Testing Runtime Behavior ===', 'cyan');
  
  // Test 1: Log level configuration
  info('Testing log level configuration...');
  const frontendLogLevel = process.env.VITE_LOG_LEVEL || 'INFO';
  const backendLogLevel = process.env.LOG_LEVEL || 'info';
  success(`Frontend log level: ${frontendLogLevel}`);
  success(`Backend log level: ${backendLogLevel}`);
  
  // Test 2: Performance monitoring
  info('Testing performance monitoring configuration...');
  const perfMetrics = process.env.VITE_ENABLE_PERFORMANCE_METRICS === 'true';
  const webVitals = process.env.VITE_ENABLE_WEB_VITALS_METRICS === 'true';
  success(`Performance metrics: ${perfMetrics ? 'enabled' : 'disabled'}`);
  success(`Web vitals: ${webVitals ? 'enabled' : 'disabled'}`);
  
  // Test 3: Error monitoring
  info('Testing error monitoring configuration...');
  const errorMonitoring = process.env.VITE_ENABLE_ERROR_MONITORING === 'true';
  success(`Error monitoring: ${errorMonitoring ? 'enabled' : 'disabled'}`);
  
  // Test 4: API URLs
  info('Testing API URL configuration...');
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:5001';
  const apiBaseUrl = process.env.VITE_API_BASE_URL || '/api';
  success(`API URL: ${apiUrl}`);
  success(`API Base URL: ${apiBaseUrl}`);
  
  // Test 5: Database configuration
  info('Testing database configuration...');
  const dbHost = process.env.DB_HOST || 'db';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'spheroseg';
  success(`Database: ${dbHost}:${dbPort}/${dbName}`);
  
  // Test 6: Redis configuration
  info('Testing Redis configuration...');
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT || '6379';
  const redisEnabled = process.env.USE_REDIS_RATE_LIMIT === 'true';
  success(`Redis: ${redisHost}:${redisPort} (${redisEnabled ? 'enabled' : 'disabled'})`);
  
  // Test 7: CDN configuration
  info('Testing CDN configuration...');
  const cdnEnabled = process.env.CDN_ENABLED === 'true';
  const cdnProvider = process.env.CDN_PROVIDER || 'none';
  success(`CDN: ${cdnProvider} (${cdnEnabled ? 'enabled' : 'disabled'})`);
  
  return true;
}

// Test environment variable validation
async function testEnvValidation() {
  log('\n=== Testing Environment Variable Validation ===', 'cyan');
  
  const criticalVars = {
    frontend: [
      'VITE_API_URL',
      'VITE_API_BASE_URL',
      'VITE_ASSETS_URL'
    ],
    backend: [
      'NODE_ENV',
      'PORT',
      'DB_HOST',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
      'JWT_SECRET',
      'ML_SERVICE_URL'
    ]
  };
  
  let allValid = true;
  
  // Check frontend critical vars
  info('Checking critical frontend variables...');
  for (const varName of criticalVars.frontend) {
    if (process.env[varName]) {
      success(`${varName} is set`);
    } else {
      error(`${varName} is missing (critical)`);
      allValid = false;
    }
  }
  
  // Check backend critical vars
  info('Checking critical backend variables...');
  for (const varName of criticalVars.backend) {
    if (process.env[varName]) {
      success(`${varName} is set`);
    } else {
      error(`${varName} is missing (critical)`);
      allValid = false;
    }
  }
  
  return allValid;
}

// Main test runner
async function main() {
  log('🧪 Environment Variable Test Suite', 'magenta');
  log('==================================', 'magenta');
  
  try {
    // Test frontend environment
    const frontendSummary = await testFrontendEnv();
    
    // Test backend environment
    const backendSummary = await testBackendEnv();
    
    // Test runtime behavior
    await testRuntimeBehavior();
    
    // Test validation
    const validationPassed = await testEnvValidation();
    
    // Final summary
    log('\n=== Final Summary ===', 'magenta');
    
    const totalFrontend = frontendSummary.total;
    const totalBackend = backendSummary.total;
    const totalSet = frontendSummary.set + backendSummary.set;
    const totalDefault = frontendSummary.default + backendSummary.default;
    const totalMissing = frontendSummary.missing + backendSummary.missing;
    
    info(`Total environment variables: ${totalFrontend + totalBackend}`);
    success(`Variables set: ${totalSet}`);
    info(`Using defaults: ${totalDefault}`);
    if (totalMissing > 0) {
      warning(`Missing variables: ${totalMissing}`);
    }
    
    if (validationPassed && totalMissing === 0) {
      success('\n✨ All environment variables are properly configured!');
      process.exit(0);
    } else if (validationPassed) {
      warning('\n⚠️  Some non-critical variables are missing, but the app should work');
      process.exit(0);
    } else {
      error('\n❌ Critical environment variables are missing!');
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

module.exports = { testEnvVarLoading, testRuntimeBehavior, testEnvValidation };