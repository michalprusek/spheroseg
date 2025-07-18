#!/usr/bin/env node

/**
 * Async version of import checker for better performance
 * Uses Promise-based file operations and parallel processing
 * Converted to ES module syntax
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { performance, PerformanceObserver } from 'perf_hooks';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const SRC_DIR = path.join(__dirname, '..', 'src');
const BATCH_SIZE = 50; // Process files in batches for better performance

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

async function checkFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
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
        const resolvedPath = await resolveImportPath(filePath, importPath);
        if (resolvedPath && (await fileExists(resolvedPath))) {
          try {
            const actualCase = await fs.realpath(resolvedPath);
            const expectedCase = resolvedPath;
            if (actualCase !== expectedCase && process.platform !== 'win32') {
              errors.push({
                file: relativePath,
                line: getLineNumber(content, match.index),
                message: `Import path case mismatch: "${importPath}"`,
              });
            }
          } catch (err) {
            // Ignore realpath errors
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error.message);
  }
}

async function resolveImportPath(fromFile, importPath) {
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
      if (await fileExists(withExt)) {
        return withExt;
      }
    }

    // Try as directory with index file
    for (const ext of EXTENSIONS) {
      const indexFile = path.join(resolved, `index${ext}`);
      if (await fileExists(indexFile)) {
        return indexFile;
      }
    }
  }

  return null;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getLineNumber(content, index) {
  const lines = content.substring(0, index).split('\n');
  return lines.length;
}

async function findFiles(dir, files = []) {
  try {
    const items = await fs.readdir(dir);

    const statPromises = items.map(async (item) => {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory() && !item.includes('node_modules') && !item.startsWith('.')) {
        await findFiles(fullPath, files);
      } else if (stat.isFile() && EXTENSIONS.includes(path.extname(item))) {
        files.push(fullPath);
      }
    });

    await Promise.all(statPromises);
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

async function processBatch(batch, totalFiles, startIndex) {
  const promises = batch.map((file) => checkFile(file));
  await Promise.all(promises);

  const endIndex = startIndex + batch.length;
  process.stdout.write(`Checked ${endIndex}/${totalFiles} files\r`);
}

// Main execution
async function main() {
  console.log('Checking imports (async)...\n');

  const startTime = Date.now();

  try {
    const files = await findFiles(SRC_DIR);
    console.log(`Found ${files.length} files to check\n`);

    // Process files in batches
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await processBatch(batch, files.length, i);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n\nChecked ${files.length} files in ${duration}s\n`);

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
      await execAsync('npm run lint -- --rule "import/no-unresolved: error" --rule "import/named: error"', {
        stdio: 'inherit',
      });
    } catch (error) {
      process.exit(1);
    }

    // Exit with error if any errors found
    if (errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Performance monitoring
if (process.env.PERF_MONITOR) {
  const perfObserver = new PerformanceObserver((items) => {
    console.log('\nPerformance Metrics:');
    items.getEntries().forEach((entry) => {
      console.log(`  ${entry.name}: ${entry.duration.toFixed(2)}ms`);
    });
  });

  perfObserver.observe({ entryTypes: ['measure'] });

  performance.mark('import-check-start');
  main().then(() => {
    performance.mark('import-check-end');
    performance.measure('Total Import Check', 'import-check-start', 'import-check-end');
  });
} else {
  main();
}
