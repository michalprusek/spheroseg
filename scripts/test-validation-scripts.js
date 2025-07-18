#!/usr/bin/env node

/**
 * Test runner for validation scripts
 * Runs validation for pre-commit hooks and import validation
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🧪 Running validation script tests...\n');

try {
  // Test 1: Check if import validation script can run
  console.log('1. Testing import validation script...');
  try {
    execSync('node scripts/validate-imports.js --dry-run', {
      stdio: 'pipe',
      cwd: process.cwd()
    });
    console.log('   ✅ Import validation script runs without errors\n');
  } catch (error) {
    console.log('   ❌ Import validation script failed');
    console.log('   Error:', error.message, '\n');
  }

  // Test 2: Check if hook configuration files exist
  console.log('2. Testing hook configuration files...');
  const configFiles = [
    '.husky/pre-commit',
    '.husky/commit-msg',
    '.lintstagedrc.js',
    'commitlint.config.js'
  ];
  
  let configCheck = true;
  for (const file of configFiles) {
    if (fs.existsSync(file)) {
      console.log(`   ✅ ${file} exists`);
    } else {
      console.log(`   ❌ ${file} missing`);
      configCheck = false;
    }
  }
  
  if (configCheck) {
    console.log('   ✅ All hook configuration files present\n');
  } else {
    console.log('   ❌ Some hook configuration files missing\n');
  }

  // Test 3: Check if lint-staged configuration is valid
  console.log('3. Testing lint-staged configuration...');
  try {
    const lintStagedConfig = await import('../.lintstagedrc.js');
    if (lintStagedConfig.default && typeof lintStagedConfig.default === 'object') {
      console.log('   ✅ Lint-staged configuration is valid');
      console.log(`   ✅ Configured for ${Object.keys(lintStagedConfig.default).length} file patterns`);
    } else {
      console.log('   ❌ Lint-staged configuration is invalid');
    }
  } catch (error) {
    console.log('   ❌ Failed to load lint-staged configuration');
    console.log('   Error:', error.message);
  }

  console.log('\n✅ Validation script tests completed!');
  
} catch (error) {
  console.error('\n❌ Validation script tests failed!');
  console.error('Exit code:', error.status);
  process.exit(1);
}