#!/usr/bin/env node

/**
 * Script to analyze and categorize TypeScript 'any' types in the codebase
 * Helps prioritize which ones to fix first based on impact and risk
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Categories of any types and their risk levels
const categories = {
  'api-response': { risk: 'HIGH', description: 'API responses typed as any' },
  'event-handler': { risk: 'MEDIUM', description: 'Event handlers with any parameters' },
  'error-catch': { risk: 'LOW', description: 'Error catch blocks (expected with useUnknownInCatchVariables)' },
  'type-assertion': { risk: 'HIGH', description: 'Type assertions using as any' },
  'function-param': { risk: 'HIGH', description: 'Function parameters typed as any' },
  'variable-type': { risk: 'MEDIUM', description: 'Variables explicitly typed as any' },
  'array-any': { risk: 'HIGH', description: 'Arrays typed as any[]' },
  'object-any': { risk: 'HIGH', description: 'Objects with any properties' },
  'generic-any': { risk: 'MEDIUM', description: 'Generic types using any' },
  'other': { risk: 'MEDIUM', description: 'Other any usages' }
};

// Patterns to categorize any types
const patterns = [
  { regex: /\b(response|data|result):\s*any\b/g, category: 'api-response' },
  { regex: /\bon\w+\s*:\s*\([^)]*:\s*any[^)]*\)/g, category: 'event-handler' },
  { regex: /\bcatch\s*\([^)]*:\s*any\)/g, category: 'error-catch' },
  { regex: /\bas\s+any\b/g, category: 'type-assertion' },
  { regex: /\(([^)]*:\s*any[^)]*)\)\s*=>/g, category: 'function-param' },
  { regex: /\(([^)]*:\s*any[^)]*)\)\s*{/g, category: 'function-param' },
  { regex: /:\s*any\[\]/g, category: 'array-any' },
  { regex: /\{\s*\[key:\s*string\]:\s*any/g, category: 'object-any' },
  { regex: /<any>/g, category: 'generic-any' },
  { regex: /:\s*any\b/g, category: 'variable-type' }
];

// Files to prioritize (critical paths)
const priorityFiles = [
  'services/', 'api/', 'auth/', 'utils/responseHelpers', 
  'hooks/', 'context/', 'types/', 'validators/'
];

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const findings = [];
  
  // Skip test files and type definition files
  if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.endsWith('.d.ts')) {
    return findings;
  }
  
  // Check each pattern
  patterns.forEach(({ regex, category }) => {
    const matches = content.matchAll(regex);
    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const line = content.split('\n')[lineNumber - 1];
      
      // Skip if it's in a comment
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }
      
      findings.push({
        file: relativePath,
        line: lineNumber,
        category,
        risk: categories[category].risk,
        code: line.trim(),
        isPriority: priorityFiles.some(pf => relativePath.includes(pf))
      });
    }
  });
  
  return findings;
}

function generateReport(findings) {
  const byCategory = {};
  const byRisk = { HIGH: [], MEDIUM: [], LOW: [] };
  const priorityFindings = findings.filter(f => f.isPriority);
  
  // Group by category and risk
  findings.forEach(finding => {
    if (!byCategory[finding.category]) {
      byCategory[finding.category] = [];
    }
    byCategory[finding.category].push(finding);
    byRisk[finding.risk].push(finding);
  });
  
  // Generate report
  console.log('\n=== TypeScript Any Type Analysis Report ===\n');
  
  console.log('Summary:');
  console.log(`Total any types found: ${findings.length}`);
  console.log(`High risk: ${byRisk.HIGH.length}`);
  console.log(`Medium risk: ${byRisk.MEDIUM.length}`);
  console.log(`Low risk: ${byRisk.LOW.length}`);
  console.log(`Priority files affected: ${priorityFindings.length}\n`);
  
  console.log('By Category:');
  Object.entries(byCategory).forEach(([category, items]) => {
    console.log(`\n${category} (${categories[category].risk} risk): ${items.length} occurrences`);
    console.log(`Description: ${categories[category].description}`);
    
    // Show top 5 examples
    items.slice(0, 5).forEach(item => {
      console.log(`  ${item.file}:${item.line}`);
      console.log(`    ${item.code}`);
    });
    
    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more`);
    }
  });
  
  // Save detailed report to file
  const detailedReport = {
    summary: {
      total: findings.length,
      byRisk: {
        high: byRisk.HIGH.length,
        medium: byRisk.MEDIUM.length,
        low: byRisk.LOW.length
      },
      priorityFiles: priorityFindings.length
    },
    findings: findings.sort((a, b) => {
      // Sort by priority, then risk, then file
      if (a.isPriority !== b.isPriority) return b.isPriority ? 1 : -1;
      if (a.risk !== b.risk) {
        const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return riskOrder[a.risk] - riskOrder[b.risk];
      }
      return a.file.localeCompare(b.file);
    })
  };
  
  fs.writeFileSync('any-types-report.json', JSON.stringify(detailedReport, null, 2));
  console.log('\nDetailed report saved to: any-types-report.json');
}

function main() {
  const packages = ['frontend', 'backend', 'shared'];
  const allFindings = [];
  
  packages.forEach(pkg => {
    const pattern = path.join(__dirname, `../packages/${pkg}/src/**/*.{ts,tsx}`);
    const files = glob.sync(pattern);
    
    console.log(`\nAnalyzing ${pkg} package...`);
    console.log(`Found ${files.length} TypeScript files`);
    
    files.forEach(file => {
      const findings = analyzeFile(file);
      allFindings.push(...findings);
    });
  });
  
  generateReport(allFindings);
  
  // Generate fix priority list
  console.log('\n=== Fix Priority Recommendation ===\n');
  console.log('1. Start with HIGH risk items in priority files (API, services, auth)');
  console.log('2. Fix type assertions (as any) - these bypass type safety');
  console.log('3. Fix API response types - critical for data flow');
  console.log('4. Fix function parameters - affects type inference');
  console.log('5. Handle remaining by risk level\n');
}

if (require.main === module) {
  main();
}