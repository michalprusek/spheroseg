#!/usr/bin/env node

/**
 * Script to remove console.log statements from production code
 * Replaces them with proper logger calls
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const PATHS_TO_PROCESS = [
  'packages/frontend/src/**/*.{ts,tsx}',
  'packages/backend/src/**/*.{ts,tsx}',
];

const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/__tests__/**',
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  '**/test/**',
  '**/tests/**',
  '**/logger.ts',
  '**/logger.tsx',
];

// Counters
let filesProcessed = 0;
let consoleStatementsRemoved = 0;
let filesModified = 0;

// Console statement patterns
const consolePatterns = [
  // Remove console.log, console.debug, console.info in production
  { pattern: /console\.(log|debug|info)\s*\([^)]*\);?\s*/g, replacement: '' },
  
  // Replace console.error with logger.error
  { pattern: /console\.error\s*\(([^)]+)\);?/g, replacement: 'logger.error($1);' },
  
  // Replace console.warn with logger.warn
  { pattern: /console\.warn\s*\(([^)]+)\);?/g, replacement: 'logger.warn($1);' },
  
  // Remove console.trace
  { pattern: /console\.trace\s*\([^)]*\);?\s*/g, replacement: '' },
  
  // Remove console.time and console.timeEnd
  { pattern: /console\.time(End)?\s*\([^)]*\);?\s*/g, replacement: '' },
];

// Check if file needs logger import
function needsLoggerImport(content) {
  return content.includes('logger.error') || content.includes('logger.warn');
}

// Add logger import if needed
function addLoggerImport(content, isBackend) {
  if (!needsLoggerImport(content)) return content;
  
  // Check if logger is already imported
  if (content.includes("from '@/utils/logger'") || 
      content.includes('from "../utils/logger"') ||
      content.includes("from './utils/logger'")) {
    return content;
  }
  
  const importStatement = isBackend 
    ? "import logger from '../utils/logger';\n"
    : "import logger from '@/utils/logger';\n";
  
  // Add import after other imports
  const importMatch = content.match(/^(import[\s\S]*?from\s+['"][^'"]+['"];?\s*\n)+/m);
  if (importMatch) {
    const lastImportEnd = importMatch.index + importMatch[0].length;
    return content.slice(0, lastImportEnd) + importStatement + content.slice(lastImportEnd);
  }
  
  // If no imports found, add at the beginning
  return importStatement + content;
}

// Process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    // Apply console statement replacements
    consolePatterns.forEach(({ pattern, replacement }) => {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        consoleStatementsRemoved += matches.length;
        modified = true;
      }
    });
    
    if (modified) {
      // Add logger import if needed
      const isBackend = filePath.includes('packages/backend/');
      content = addLoggerImport(content, isBackend);
      
      // Write the modified content back
      fs.writeFileSync(filePath, content, 'utf8');
      filesModified++;
      console.log(`✓ Processed: ${filePath}`);
    }
    
    filesProcessed++;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

// Main execution
console.log('🔍 Searching for console statements...\n');

PATHS_TO_PROCESS.forEach(pattern => {
  const files = glob.sync(pattern, { 
    ignore: EXCLUDE_PATTERNS,
    nodir: true 
  });
  
  files.forEach(processFile);
});

// Summary
console.log('\n📊 Summary:');
console.log(`   Files processed: ${filesProcessed}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Console statements removed: ${consoleStatementsRemoved}`);

if (filesModified > 0) {
  console.log('\n⚠️  Important: Please review the changes and ensure:');
  console.log('   1. Logger imports are correctly added');
  console.log('   2. No critical debugging statements were removed');
  console.log('   3. Run tests to ensure no breakage');
}

process.exit(0);