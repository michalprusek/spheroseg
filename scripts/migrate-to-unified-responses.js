#!/usr/bin/env node

/**
 * Script to migrate backend routes to use unified response handlers
 * 
 * This script helps automate the migration of routes from direct res.json() 
 * to using the unified response helpers.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to replace
const replacements = [
  // Success responses
  {
    pattern: /return\s+res\.json\(([\s\S]*?)\);/g,
    replacement: 'return sendSuccess(res, $1);',
    description: 'Replace res.json() with sendSuccess()'
  },
  {
    pattern: /return\s+res\.status\(200\)\.json\(([\s\S]*?)\);/g,
    replacement: 'return sendSuccess(res, $1);',
    description: 'Replace res.status(200).json() with sendSuccess()'
  },
  {
    pattern: /return\s+res\.status\(201\)\.json\(([\s\S]*?)\);/g,
    replacement: 'return sendCreated(res, $1);',
    description: 'Replace res.status(201).json() with sendCreated()'
  },
  
  // Error responses
  {
    pattern: /return\s+res\.status\(400\)\.json\(\{\s*message:\s*['"`](.*?)['"`]\s*\}\);/g,
    replacement: 'return sendBadRequest(res, \'$1\');',
    description: 'Replace res.status(400).json() with sendBadRequest()'
  },
  {
    pattern: /return\s+res\.status\(401\)\.json\(\{\s*message:\s*['"`](.*?)['"`]\s*\}\);/g,
    replacement: 'return sendUnauthorized(res, \'$1\');',
    description: 'Replace res.status(401).json() with sendUnauthorized()'
  },
  {
    pattern: /return\s+res\.status\(403\)\.json\(\{\s*message:\s*['"`](.*?)['"`]\s*\}\);/g,
    replacement: 'return sendForbidden(res, \'$1\');',
    description: 'Replace res.status(403).json() with sendForbidden()'
  },
  {
    pattern: /return\s+res\.status\(404\)\.json\(\{\s*message:\s*['"`](.*?)['"`]\s*\}\);/g,
    replacement: 'return sendNotFound(res, \'$1\');',
    description: 'Replace res.status(404).json() with sendNotFound()'
  },
  {
    pattern: /return\s+res\.status\(409\)\.json\(\{\s*message:\s*['"`](.*?)['"`]\s*\}\);/g,
    replacement: 'return sendConflict(res, \'$1\');',
    description: 'Replace res.status(409).json() with sendConflict()'
  },
  {
    pattern: /return\s+res\.status\(500\)\.json\(\{\s*message:\s*['"`](.*?)['"`]\s*\}\);/g,
    replacement: 'return sendServerError(res, \'$1\');',
    description: 'Replace res.status(500).json() with sendServerError()'
  },
];

// Check if import statement exists
function hasResponseHelperImport(content) {
  return content.includes('from \'../utils/responseHelpers\'') || 
         content.includes('from "../utils/responseHelpers"');
}

// Add import statement if not present
function addResponseHelperImport(content) {
  if (hasResponseHelperImport(content)) {
    return content;
  }
  
  // Find the last import statement
  const importRegex = /^import\s+.*?;$/gm;
  const imports = content.match(importRegex);
  
  if (imports && imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    const importStatement = `import { 
  sendSuccess, 
  sendCreated,
  sendError, 
  sendNotFound, 
  sendUnauthorized,
  sendBadRequest,
  sendForbidden,
  sendConflict,
  sendServerError,
  sendPaginated,
  asyncHandler
} from '../utils/responseHelpers';`;
    
    return content.replace(lastImport, lastImport + '\n' + importStatement);
  }
  
  return content;
}

// Process a single file
function processFile(filePath) {
  console.log(`\nProcessing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const changes = [];
  
  // Apply replacements
  replacements.forEach(({ pattern, replacement, description }) => {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      content = content.replace(pattern, replacement);
      modified = true;
      changes.push(`  - ${description}: ${matches.length} occurrence(s)`);
    }
  });
  
  // Add import if modifications were made
  if (modified) {
    content = addResponseHelperImport(content);
    
    console.log(`  Modified: ${changes.length} change(s)`);
    changes.forEach(change => console.log(change));
    
    // Write back to file
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    console.log('  No changes needed');
  }
  
  return modified;
}

// Main function
function main() {
  const routesDir = path.join(__dirname, '../packages/backend/src/routes');
  const pattern = path.join(routesDir, '*.ts');
  
  console.log('Starting migration to unified response handlers...');
  console.log(`Looking for route files in: ${routesDir}`);
  
  const files = glob.sync(pattern);
  console.log(`Found ${files.length} route files`);
  
  let modifiedCount = 0;
  
  files.forEach(file => {
    if (processFile(file)) {
      modifiedCount++;
    }
  });
  
  console.log(`\nMigration complete!`);
  console.log(`Modified ${modifiedCount} out of ${files.length} files`);
  console.log('\nNote: Please review the changes and ensure all imports are correct.');
  console.log('Some complex cases may need manual adjustment.');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { processFile, addResponseHelperImport };