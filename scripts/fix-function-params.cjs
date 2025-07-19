#!/usr/bin/env node

/**
 * Script to help fix function parameter 'any' types
 * Focuses on the most common patterns in function parameters
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Common function parameter patterns and their safer alternatives
const functionParamPatterns = [
  {
    name: 'event-handler',
    pattern: /\((\w+):\s*any\)\s*=>/g,
    suggestion: 'Use specific event type or unknown',
    fix: (match, param) => {
      // Common event parameter names
      if (['e', 'event', 'evt'].includes(param)) {
        return `(${param}: React.MouseEvent | React.ChangeEvent) =>`;
      }
      if (['error', 'err'].includes(param)) {
        return `(${param}: unknown) =>`;
      }
      if (['data', 'response', 'result'].includes(param)) {
        return `(${param}: unknown) =>`;
      }
      // For test mocks
      if (match.includes('mock') || match.includes('Mock') || match.includes('vi.fn')) {
        return match; // Keep as is for mocks
      }
      return `(${param}: unknown) =>`;
    }
  },
  {
    name: 'multiple-params',
    pattern: /\(([^)]*:\s*any[^)]*)\)\s*=>/g,
    suggestion: 'Use specific types for each parameter',
    fix: (match, params) => {
      // Skip if it's a mock function
      if (match.includes('mock') || match.includes('Mock')) {
        return match;
      }
      // Replace each 'any' with 'unknown'
      const fixed = params.replace(/:\s*any/g, ': unknown');
      return `(${fixed}) =>`;
    }
  },
  {
    name: 'function-declaration',
    pattern: /function\s+\w+\s*\(([^)]*:\s*any[^)]*)\)/g,
    suggestion: 'Use specific types in function declaration',
    fix: (match, params) => {
      const fixed = params.replace(/:\s*any/g, ': unknown');
      return match.replace(params, fixed);
    }
  },
  {
    name: 'method-declaration',
    pattern: /(\w+)\s*\(([^)]*:\s*any[^)]*)\)\s*:/g,
    suggestion: 'Use specific types in method declaration',
    fix: (match, methodName, params) => {
      const fixed = params.replace(/:\s*any/g, ': unknown');
      return `${methodName}(${fixed}):`;
    }
  },
  {
    name: 'rest-params',
    pattern: /\.\.\.(\w+):\s*any\[\]/g,
    suggestion: 'Use unknown[] for rest parameters',
    fix: (match, param) => {
      return `...${param}: unknown[]`;
    }
  }
];

// Helper to determine if we're in a test file
function isTestFile(filePath) {
  return filePath.includes('.test.') || 
         filePath.includes('.spec.') || 
         filePath.includes('__tests__') ||
         filePath.includes('test-setup');
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const findings = [];
  const isTest = isTestFile(filePath);
  
  // Check each pattern
  functionParamPatterns.forEach(({ name, pattern, suggestion, fix }) => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const line = content.split('\n')[lineNumber - 1];
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }
      
      findings.push({
        file: relativePath,
        line: lineNumber,
        pattern: name,
        code: line.trim(),
        suggestion,
        match: match[0],
        fix: fix ? fix(...match) : null,
        isTest
      });
    }
  });
  
  return findings;
}

function applyFixes(filePath, findings) {
  if (findings.length === 0) return false;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Sort by position in reverse order to maintain correct positions
  const sortedFindings = findings
    .filter(f => f.fix)
    .sort((a, b) => {
      const posA = content.indexOf(a.match);
      const posB = content.indexOf(b.match);
      return posB - posA;
    });
  
  sortedFindings.forEach(finding => {
    const before = content;
    content = content.replace(finding.match, finding.fix);
    if (before !== content) {
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  return modified;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const autoFix = args.includes('--fix');
  const skipTests = args.includes('--skip-tests');
  
  const packages = ['frontend', 'backend', 'shared'];
  const allFindings = [];
  
  packages.forEach(pkg => {
    const pattern = path.join(__dirname, `../packages/${pkg}/src/**/*.{ts,tsx}`);
    const files = glob.sync(pattern);
    
    console.log(`\nAnalyzing ${pkg} package...`);
    
    files.forEach(file => {
      if (skipTests && isTestFile(file)) {
        return;
      }
      
      const findings = analyzeFile(file);
      if (findings.length > 0) {
        allFindings.push({ file, findings });
        
        if (autoFix && !dryRun) {
          const fixed = applyFixes(file, findings);
          if (fixed) {
            console.log(`  Fixed ${findings.length} function params in ${path.relative(process.cwd(), file)}`);
          }
        }
      }
    });
  });
  
  if (!autoFix || dryRun) {
    console.log('\n=== Function Parameter Analysis ===\n');
    console.log(`Total function params with 'any' found: ${allFindings.reduce((sum, f) => sum + f.findings.length, 0)}`);
    
    // Separate test and non-test files
    const testFindings = allFindings.filter(f => f.findings.some(finding => finding.isTest));
    const nonTestFindings = allFindings.filter(f => !f.findings.some(finding => finding.isTest));
    
    console.log(`  In test files: ${testFindings.reduce((sum, f) => sum + f.findings.length, 0)}`);
    console.log(`  In source files: ${nonTestFindings.reduce((sum, f) => sum + f.findings.length, 0)}`);
    
    console.log('\nBy Pattern:');
    const byPattern = {};
    allFindings.forEach(({ findings }) => {
      findings.forEach(f => {
        byPattern[f.pattern] = (byPattern[f.pattern] || 0) + 1;
      });
    });
    
    Object.entries(byPattern).forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count}`);
    });
    
    console.log('\nExamples from source files:');
    nonTestFindings.slice(0, 5).forEach(({ file, findings }) => {
      findings.slice(0, 2).forEach(f => {
        console.log(`\n  ${f.file}:${f.line}`);
        console.log(`    Current: ${f.code}`);
        if (f.fix && f.match !== f.fix) {
          console.log(`    Suggested: ${f.code.replace(f.match, f.fix)}`);
        }
      });
    });
    
    console.log('\n\nTo apply fixes automatically (excluding test files), run:');
    console.log('  node scripts/fix-function-params.cjs --fix --skip-tests');
    console.log('\nTo preview changes without applying, run:');
    console.log('  node scripts/fix-function-params.cjs --fix --dry-run');
  }
}

if (require.main === module) {
  main();
}