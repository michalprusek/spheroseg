#!/usr/bin/env node

/**
 * Script to help fix type assertions (as any) in the codebase
 * Focuses on the most common patterns and provides safer alternatives
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Common patterns for type assertions and their safer alternatives
const typeAssertionPatterns = [
  {
    name: 'window-property',
    pattern: /\(window as any\)\.(\w+)/g,
    suggestion: 'Use window type declaration or check existence',
    fix: (match, property) => {
      // For known global properties
      if (['i18next', 'gtag', '__REDUX_DEVTOOLS_EXTENSION__'].includes(property)) {
        return `window.${property}`;
      }
      return `(window as Window & { ${property}?: unknown }).${property}`;
    }
  },
  {
    name: 'global-property',
    pattern: /\(global as any\)\.(\w+)/g,
    suggestion: 'Use global type declaration',
    fix: (match, property) => {
      return `(global as typeof globalThis & { ${property}?: unknown }).${property}`;
    }
  },
  {
    name: 'error-catch',
    pattern: /catch\s*\(\s*(\w+):\s*any\s*\)/g,
    suggestion: 'Use unknown type for caught errors',
    fix: (match, variable) => {
      return `catch (${variable}: unknown)`;
    }
  },
  {
    name: 'mock-cast',
    pattern: /(\w+)\s+as\s+any(?![\w])/g,
    suggestion: 'Use proper mock types or unknown',
    fix: (match, variable) => {
      // Don't fix if it's part of a larger type expression
      if (match.includes('typeof') || match.includes('keyof')) {
        return match;
      }
      return `${variable} as unknown`;
    }
  },
  {
    name: 'response-data',
    pattern: /\((\w+)\.data\)\s+as\s+any/g,
    suggestion: 'Type the response data properly',
    fix: (match, variable) => {
      return `${variable}.data as unknown`;
    }
  }
];

// Files to skip (test files often need type assertions for mocks)
const skipPatterns = [
  '**/node_modules/**',
  '**/*.d.ts',
  '**/dist/**',
  '**/build/**'
];

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const findings = [];
  
  // Check each pattern
  typeAssertionPatterns.forEach(({ name, pattern, suggestion, fix }) => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const line = content.split('\n')[lineNumber - 1];
      
      findings.push({
        file: relativePath,
        line: lineNumber,
        pattern: name,
        code: line.trim(),
        suggestion,
        match: match[0],
        fix: fix ? fix(...match) : null
      });
    }
  });
  
  return findings;
}

function applyFixes(filePath, findings) {
  if (findings.length === 0) return false;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Apply fixes in reverse order to maintain correct positions
  findings
    .filter(f => f.fix)
    .sort((a, b) => b.line - a.line)
    .forEach(finding => {
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
  
  const packages = ['frontend', 'backend', 'shared'];
  const allFindings = [];
  
  packages.forEach(pkg => {
    const pattern = path.join(__dirname, `../packages/${pkg}/src/**/*.{ts,tsx}`);
    const files = glob.sync(pattern, { ignore: skipPatterns });
    
    console.log(`\nAnalyzing ${pkg} package...`);
    
    files.forEach(file => {
      const findings = analyzeFile(file);
      if (findings.length > 0) {
        allFindings.push({ file, findings });
        
        if (autoFix && !dryRun) {
          const fixed = applyFixes(file, findings);
          if (fixed) {
            console.log(`  Fixed ${findings.length} assertions in ${path.relative(process.cwd(), file)}`);
          }
        }
      }
    });
  });
  
  if (!autoFix || dryRun) {
    console.log('\n=== Type Assertion Analysis ===\n');
    console.log(`Total type assertions found: ${allFindings.reduce((sum, f) => sum + f.findings.length, 0)}`);
    
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
    
    console.log('\nExamples:');
    allFindings.slice(0, 5).forEach(({ file, findings }) => {
      findings.slice(0, 2).forEach(f => {
        console.log(`\n  ${f.file}:${f.line}`);
        console.log(`    Current: ${f.code}`);
        if (f.fix) {
          console.log(`    Suggested: ${f.code.replace(f.match, f.fix)}`);
        }
      });
    });
    
    console.log('\n\nTo apply fixes automatically, run:');
    console.log('  node scripts/fix-type-assertions.cjs --fix');
    console.log('\nTo preview changes without applying, run:');
    console.log('  node scripts/fix-type-assertions.cjs --fix --dry-run');
  }
}

if (require.main === module) {
  main();
}