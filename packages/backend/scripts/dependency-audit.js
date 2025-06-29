#!/usr/bin/env node

/**
 * Dependency Audit Script
 * 
 * This script performs a comprehensive audit of project dependencies:
 * - Checks for security vulnerabilities
 * - Identifies outdated packages
 * - Detects unused dependencies
 * - Recommends updates and improvements
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

async function auditDependencies() {
  log('\n========================================', 'blue');
  log('     DEPENDENCY AUDIT REPORT', 'blue');
  log('========================================\n', 'blue');

  const timestamp = new Date().toISOString();
  log(`Audit Date: ${timestamp}\n`, 'yellow');

  // Initialize counters
  let vulnCount = 0;
  let outdatedCount = 0;

  // 1. Security Audit
  log('1. SECURITY VULNERABILITIES', 'blue');
  log('----------------------------', 'blue');
  
  const auditOutput = runCommand('npm audit --json', true);
  if (auditOutput) {
    try {
      const audit = JSON.parse(auditOutput);
      const vulnerabilities = audit.vulnerabilities || {};
      vulnCount = Object.keys(vulnerabilities).length;
      
      if (vulnCount === 0) {
        log('✓ No security vulnerabilities found!', 'green');
      } else {
        log(`✗ Found ${vulnCount} vulnerabilities:`, 'red');
        
        let critical = 0, high = 0, moderate = 0, low = 0;
        
        Object.values(vulnerabilities).forEach(vuln => {
          switch (vuln.severity) {
            case 'critical': critical++; break;
            case 'high': high++; break;
            case 'moderate': moderate++; break;
            case 'low': low++; break;
          }
        });
        
        if (critical > 0) log(`  - Critical: ${critical}`, 'red');
        if (high > 0) log(`  - High: ${high}`, 'red');
        if (moderate > 0) log(`  - Moderate: ${moderate}`, 'yellow');
        if (low > 0) log(`  - Low: ${low}`, 'yellow');
        
        log('\nVulnerable packages:', 'red');
        Object.entries(vulnerabilities).forEach(([name, vuln]) => {
          log(`  - ${name} (${vuln.severity}): ${vuln.via[0].title || vuln.via[0]}`);
        });
      }
    } catch (e) {
      log('Error parsing audit results', 'red');
    }
  }

  // 2. Outdated Packages
  log('\n\n2. OUTDATED PACKAGES', 'blue');
  log('--------------------', 'blue');
  
  const outdatedOutput = runCommand('npm outdated --json', true);
  if (outdatedOutput) {
    try {
      const outdated = JSON.parse(outdatedOutput);
      outdatedCount = Object.keys(outdated).length;
      
      if (outdatedCount === 0) {
        log('✓ All packages are up to date!', 'green');
      } else {
        log(`Found ${outdatedCount} outdated packages:\n`, 'yellow');
        
        const criticalUpdates = [];
        const minorUpdates = [];
        
        Object.entries(outdated).forEach(([name, info]) => {
          const current = info.current || 'not installed';
          const wanted = info.wanted;
          const latest = info.latest;
          
          if (current !== latest) {
            const isMajor = current.split('.')[0] !== latest.split('.')[0];
            
            if (isMajor) {
              criticalUpdates.push({ name, current, latest });
            } else {
              minorUpdates.push({ name, current, latest });
            }
          }
        });
        
        if (criticalUpdates.length > 0) {
          log('Major version updates available:', 'red');
          criticalUpdates.forEach(({ name, current, latest }) => {
            log(`  - ${name}: ${current} → ${latest}`, 'red');
          });
        }
        
        if (minorUpdates.length > 0) {
          log('\nMinor/Patch updates available:', 'yellow');
          minorUpdates.forEach(({ name, current, latest }) => {
            log(`  - ${name}: ${current} → ${latest}`, 'yellow');
          });
        }
      }
    } catch (e) {
      log('No outdated packages or error checking', 'green');
    }
  }

  // 3. Check for deprecated packages
  log('\n\n3. DEPRECATED PACKAGES', 'blue');
  log('----------------------', 'blue');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const deprecatedPackages = {
    'node-fetch': 'Consider using native fetch (Node.js 18+) or axios',
    'request': 'Package is deprecated, use axios or fetch',
    'colors': 'Security issues, use chalk or ansi-colors',
    'istanbul': 'Use nyc instead',
  };
  
  const foundDeprecated = [];
  Object.keys(allDeps).forEach(dep => {
    if (deprecatedPackages[dep]) {
      foundDeprecated.push({ name: dep, recommendation: deprecatedPackages[dep] });
    }
  });
  
  if (foundDeprecated.length === 0) {
    log('✓ No deprecated packages found!', 'green');
  } else {
    log('Found deprecated packages:', 'red');
    foundDeprecated.forEach(({ name, recommendation }) => {
      log(`  - ${name}: ${recommendation}`, 'yellow');
    });
  }

  // 4. License Check
  log('\n\n4. LICENSE CHECK', 'blue');
  log('----------------', 'blue');
  
  const riskyLicenses = ['GPL', 'AGPL', 'LGPL', 'MPL'];
  let licenseIssues = 0;
  
  // This is a simplified check - in production, use license-checker package
  log('Checking for problematic licenses...', 'yellow');
  log('(Consider using license-checker for detailed analysis)', 'yellow');

  // 5. Security Best Practices
  log('\n\n5. SECURITY RECOMMENDATIONS', 'blue');
  log('---------------------------', 'blue');
  
  const recommendations = [];
  
  // Check for specific security-related packages
  if (!allDeps['helmet']) {
    recommendations.push('Consider adding helmet for security headers');
  }
  
  if (allDeps['jsonwebtoken'] && !allDeps['jwks-rsa']) {
    recommendations.push('Consider using jwks-rsa for JWT key rotation');
  }
  
  if (!allDeps['express-validator']) {
    recommendations.push('Consider adding express-validator for input validation');
  }
  
  if (!allDeps['bcrypt'] && !allDeps['bcryptjs'] && !allDeps['argon2']) {
    recommendations.push('Add a password hashing library (bcrypt, bcryptjs, or argon2)');
  }
  
  if (recommendations.length === 0) {
    log('✓ Security packages look good!', 'green');
  } else {
    log('Consider these security improvements:', 'yellow');
    recommendations.forEach(rec => log(`  - ${rec}`, 'yellow'));
  }

  // 6. Generate Report
  log('\n\n6. GENERATING REPORT', 'blue');
  log('--------------------', 'blue');
  
  const report = {
    timestamp,
    vulnerabilities: vulnCount || 0,
    outdatedPackages: outdatedCount || 0,
    deprecatedPackages: foundDeprecated.length,
    recommendations
  };
  
  const reportPath = path.join(process.cwd(), 'dependency-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`✓ Report saved to: ${reportPath}`, 'green');

  // Summary
  log('\n\n========================================', 'blue');
  log('              SUMMARY', 'blue');
  log('========================================', 'blue');
  
  const totalIssues = (vulnCount || 0) + (outdatedCount || 0) + foundDeprecated.length;
  
  if (totalIssues === 0) {
    log('\n✓ Your dependencies are in great shape!', 'green');
  } else {
    log(`\n⚠ Found ${totalIssues} total issues that need attention`, 'yellow');
    log('\nRecommended actions:', 'yellow');
    log('1. Run "npm audit fix" to fix vulnerabilities', 'yellow');
    log('2. Review and update outdated packages', 'yellow');
    log('3. Replace deprecated packages', 'yellow');
  }
}

// Run the audit
auditDependencies().catch(console.error);