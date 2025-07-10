#!/usr/bin/env node

/**
 * Script to check for common import issues in the codebase
 * Runs as a pre-commit hook to catch issues early
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const SRC_DIR = path.join(__dirname, '..', 'src');

// Patterns to check
const IMPORT_PATTERNS = {
  // Check for missing file extensions in relative imports
  missingExtension: /from\s+['"](\.{1,2}\/[^'"]+)(?<!\.tsx?)(?<!\.jsx?)(?<!\.js)['"];?$/gm,
  
  // Check for incorrect casing in imports
  incorrectCasing: /from\s+['"]([^'"]+)['"];?$/gm,
  
  // Check for circular dependencies (basic check)
  circularImport: /from\s+['"]([^'"]+)['"];?$/gm,
};

const errors = [];
const warnings = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // Check for missing file extensions
  const missingExtMatches = content.matchAll(IMPORT_PATTERNS.missingExtension);
  for (const match of missingExtMatches) {
    const importPath = match[1];
    if (!importPath.includes('node_modules') && !importPath.startsWith('@')) {
      warnings.push({
        file: relativePath,
        line: getLineNumber(content, match.index),
        message: `Relative import "${importPath}" might be missing file extension`,
      });
    }
  }
  
  // Check for incorrect casing
  const casingMatches = content.matchAll(IMPORT_PATTERNS.incorrectCasing);
  for (const match of casingMatches) {
    const importPath = match[1];
    if (importPath.startsWith('.') || importPath.startsWith('@/')) {
      const resolvedPath = resolveImportPath(filePath, importPath);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        const actualCase = fs.realpathSync(resolvedPath);
        const expectedCase = resolvedPath;
        if (actualCase !== expectedCase && process.platform !== 'win32') {
          errors.push({
            file: relativePath,
            line: getLineNumber(content, match.index),
            message: `Import path case mismatch: "${importPath}"`,
          });
        }
      }
    }
  }
}

function resolveImportPath(fromFile, importPath) {
  const dir = path.dirname(fromFile);
  
  if (importPath.startsWith('@/')) {
    // Handle alias imports
    return path.join(SRC_DIR, importPath.slice(2));
  } else if (importPath.startsWith('.')) {
    // Handle relative imports
    const resolved = path.join(dir, importPath);
    
    // Try with different extensions
    for (const ext of EXTENSIONS) {
      const withExt = resolved + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }
    
    // Try as directory with index file
    for (const ext of EXTENSIONS) {
      const indexFile = path.join(resolved, `index${ext}`);
      if (fs.existsSync(indexFile)) {
        return indexFile;
      }
    }
  }
  
  return null;
}

function getLineNumber(content, index) {
  const lines = content.substring(0, index).split('\n');
  return lines.length;
}

function findFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.includes('node_modules') && !item.startsWith('.')) {
      findFiles(fullPath, files);
    } else if (stat.isFile() && EXTENSIONS.includes(path.extname(item))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
console.log('Checking imports...\n');

const files = findFiles(SRC_DIR);
let checkedCount = 0;

for (const file of files) {
  checkFile(file);
  checkedCount++;
  
  // Show progress
  if (checkedCount % 50 === 0) {
    process.stdout.write(`Checked ${checkedCount}/${files.length} files\r`);
  }
}

console.log(`\nChecked ${checkedCount} files\n`);

// Report results
if (errors.length > 0) {
  console.error('❌ Import Errors Found:\n');
  errors.forEach(({ file, line, message }) => {
    console.error(`  ${file}:${line} - ${message}`);
  });
}

if (warnings.length > 0) {
  console.warn('\n⚠️  Import Warnings:\n');
  warnings.forEach(({ file, line, message }) => {
    console.warn(`  ${file}:${line} - ${message}`);
  });
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All imports look good!');
}

// Run ESLint for more comprehensive checks
console.log('\nRunning ESLint import checks...\n');
try {
  execSync('npm run lint -- --rule "import/no-unresolved: error" --rule "import/named: error"', {
    stdio: 'inherit',
  });
} catch (error) {
  process.exit(1);
}

// Exit with error if any errors found
if (errors.length > 0) {
  process.exit(1);
}