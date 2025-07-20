#!/usr/bin/env node

/**
 * Migration script to update all imports from old API clients to the new unified API client
 * This script will:
 * 1. Replace imports from '@/lib/apiClient' to '@/services/api/client'
 * 2. Replace imports from '@/lib/apiClient.enhanced' to '@/services/api/client'
 * 3. Replace imports from '@/lib/uploadClient' to use uploadClient from '@/services/api/client'
 * 4. Update any axios-specific usage to the new fetch-based API
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_SRC = path.join(__dirname, '../packages/frontend/src');

// Patterns to replace
const IMPORT_PATTERNS = [
  // Basic apiClient imports
  {
    pattern: /import\s+apiClient\s+from\s+['"]@\/lib\/apiClient['"]/g,
    replacement: "import apiClient from '@/services/api/client'"
  },
  {
    pattern: /import\s+\{\s*default\s+as\s+apiClient\s*\}\s+from\s+['"]@\/lib\/apiClient['"]/g,
    replacement: "import apiClient from '@/services/api/client'"
  },
  // Enhanced apiClient imports
  {
    pattern: /import\s+(?:enhancedApiClient|apiClient)\s+from\s+['"]@\/lib\/apiClient\.enhanced['"]/g,
    replacement: "import apiClient from '@/services/api/client'"
  },
  // Upload client imports
  {
    pattern: /import\s+uploadClient\s+from\s+['"]@\/lib\/uploadClient['"]/g,
    replacement: "import { uploadClient } from '@/services/api/client'"
  },
  // Named exports from apiClient
  {
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]@\/lib\/apiClient['"]/g,
    replacement: (match, exports) => {
      // Check if it includes apiClient in the named exports
      if (exports.includes('apiClient')) {
        const otherExports = exports.split(',')
          .map(e => e.trim())
          .filter(e => e !== 'apiClient' && e !== 'default as apiClient')
          .join(', ');
        
        if (otherExports) {
          return `import apiClient, { ${otherExports} } from '@/services/api/client'`;
        } else {
          return `import apiClient from '@/services/api/client'`;
        }
      }
      return `import { ${exports} } from '@/services/api/client'`;
    }
  },
  // Combined imports (default + named)
  {
    pattern: /import\s+apiClient\s*,\s*\{\s*([^}]+)\s*\}\s+from\s+['"]@\/lib\/apiClient['"]/g,
    replacement: "import apiClient, { $1 } from '@/services/api/client'"
  },
];

// Axios-specific method replacements
const AXIOS_REPLACEMENTS = [
  // Replace axios response.data with just response (since our API returns the data directly)
  {
    pattern: /(\w+)\.data\.data/g,
    replacement: '$1.data'
  },
  // Replace axios error.response?.data with error.data
  {
    pattern: /error\.response\?\.data/g,
    replacement: 'error.data'
  },
  {
    pattern: /error\.response\.data/g,
    replacement: 'error.data'
  },
  // Replace axios error.response?.status with error.status
  {
    pattern: /error\.response\?\.status/g,
    replacement: 'error.status'
  },
  {
    pattern: /error\.response\.status/g,
    replacement: 'error.status'
  },
];

async function findFiles() {
  const files = await glob('**/*.{ts,tsx}', { 
    cwd: FRONTEND_SRC,
    ignore: [
      '**/node_modules/**',
      '**/__tests__/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/lib/apiClient*.ts', // Don't modify the old files themselves
      '**/services/api/client.ts', // Don't modify the new unified client
    ]
  });
  
  return files.map(f => path.join(FRONTEND_SRC, f));
}

async function processFile(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Apply import replacements
  for (const { pattern, replacement } of IMPORT_PATTERNS) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  // Only apply axios replacements if we modified imports
  if (modified) {
    for (const { pattern, replacement } of AXIOS_REPLACEMENTS) {
      content = content.replace(pattern, replacement);
    }
  }

  if (modified) {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

async function main() {
  console.log('🔄 Starting API client migration...\n');

  try {
    const files = await findFiles();
    console.log(`Found ${files.length} files to check\n`);

    let updatedCount = 0;
    for (const file of files) {
      const updated = await processFile(file);
      if (updated) updatedCount++;
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`📊 Updated ${updatedCount} files out of ${files.length} checked`);

    if (updatedCount > 0) {
      console.log('\n⚠️  Next steps:');
      console.log('1. Run "npm run lint:fix" to fix any formatting issues');
      console.log('2. Run "npm run test" to ensure all tests pass');
      console.log('3. Review the changes and test the application');
      console.log('4. Remove old API client files:');
      console.log('   - packages/frontend/src/lib/apiClient.ts');
      console.log('   - packages/frontend/src/lib/apiClient.enhanced.ts');
      console.log('   - packages/frontend/src/lib/uploadClient.ts');
      console.log('   - packages/frontend/src/api/apiClient.ts (if it only re-exports)');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();