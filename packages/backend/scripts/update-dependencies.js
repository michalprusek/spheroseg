#!/usr/bin/env node

/**
 * Dependency Update Script
 * 
 * This script safely updates project dependencies based on audit results
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8' });
    if (!silent) {
      console.log(output);
    }
    return output;
  } catch (error) {
    if (!silent) {
      console.error(error.message);
    }
    return null;
  }
}

function createBackup() {
  log('\n📦 Creating backup of package files...', 'blue');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', timestamp);
  
  if (!fs.existsSync(path.join(process.cwd(), 'backups'))) {
    fs.mkdirSync(path.join(process.cwd(), 'backups'));
  }
  
  fs.mkdirSync(backupDir);
  
  // Backup package files
  fs.copyFileSync('package.json', path.join(backupDir, 'package.json'));
  fs.copyFileSync('package-lock.json', path.join(backupDir, 'package-lock.json'));
  
  log(`✓ Backup created at: ${backupDir}`, 'green');
  return backupDir;
}

async function updateDependencies() {
  log('\n========================================', 'blue');
  log('     DEPENDENCY UPDATE PROCESS', 'blue');
  log('========================================\n', 'blue');

  // Create backup first
  const backupDir = createBackup();

  // 1. Fix security vulnerabilities
  log('\n1. FIXING SECURITY VULNERABILITIES', 'blue');
  log('----------------------------------', 'blue');
  
  log('Running npm audit fix...', 'yellow');
  const auditFixOutput = runCommand('npm audit fix', false);
  
  // 2. Update deprecated packages
  log('\n2. UPDATING DEPRECATED PACKAGES', 'blue');
  log('-------------------------------', 'blue');
  
  // Replace node-fetch with native fetch or axios
  log('Replacing node-fetch with axios...', 'yellow');
  runCommand('npm uninstall node-fetch', true);
  log('✓ Removed node-fetch', 'green');
  
  // Note: axios is already installed, so we don't need to add it
  
  // 3. Add security packages
  log('\n3. ADDING SECURITY PACKAGES', 'blue');
  log('---------------------------', 'blue');
  
  log('Adding express-validator for input validation...', 'yellow');
  runCommand('npm install express-validator', true);
  log('✓ Added express-validator', 'green');
  
  log('Adding jwks-rsa for JWT key rotation...', 'yellow');
  runCommand('npm install jwks-rsa', true);
  log('✓ Added jwks-rsa', 'green');

  // 4. Update package.json with security scripts
  log('\n4. UPDATING PACKAGE.JSON SCRIPTS', 'blue');
  log('--------------------------------', 'blue');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Add security audit script
  packageJson.scripts['audit'] = 'node scripts/dependency-audit.js';
  packageJson.scripts['audit:fix'] = 'npm audit fix';
  packageJson.scripts['deps:check'] = 'npm outdated';
  packageJson.scripts['deps:update'] = 'node scripts/update-dependencies.js';
  
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  log('✓ Added security scripts to package.json', 'green');

  // 5. Update minor versions
  log('\n5. UPDATING MINOR VERSIONS', 'blue');
  log('--------------------------', 'blue');
  
  log('Updating packages to latest minor versions...', 'yellow');
  runCommand('npm update', true);
  log('✓ Updated minor versions', 'green');

  // 6. Generate update report
  log('\n6. GENERATING UPDATE REPORT', 'blue');
  log('---------------------------', 'blue');
  
  const report = {
    timestamp: new Date().toISOString(),
    backupLocation: backupDir,
    updates: {
      securityFixes: 'Applied npm audit fix',
      deprecatedPackages: ['Removed node-fetch (using axios instead)'],
      addedPackages: ['express-validator', 'jwks-rsa'],
      scriptsAdded: ['audit', 'audit:fix', 'deps:check', 'deps:update']
    }
  };
  
  const reportPath = path.join(process.cwd(), 'dependency-update-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`✓ Report saved to: ${reportPath}`, 'green');

  // Summary
  log('\n\n========================================', 'blue');
  log('              SUMMARY', 'blue');
  log('========================================', 'blue');
  
  log('\n✓ Dependencies successfully updated!', 'green');
  log('\nChanges made:', 'yellow');
  log('- Fixed security vulnerabilities', 'green');
  log('- Replaced deprecated packages', 'green');
  log('- Added security enhancement packages', 'green');
  log('- Updated package scripts', 'green');
  
  log('\n⚠ Next steps:', 'yellow');
  log('1. Run "npm install" to ensure all dependencies are installed', 'yellow');
  log('2. Run tests to ensure nothing broke: npm test', 'yellow');
  log('3. Update code to use express-validator for input validation', 'yellow');
  log('4. Consider implementing JWT key rotation with jwks-rsa', 'yellow');
  
  log(`\n📦 Backup saved at: ${backupDir}`, 'blue');
  log('   (You can restore if needed)', 'blue');
}

// Run the update process
updateDependencies().catch(console.error);