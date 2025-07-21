#!/usr/bin/env node

/**
 * Migration script to update all imports from old email services to the new unified email service
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_SRC = path.join(__dirname, '../packages/backend/src');

// Patterns to replace
const IMPORT_PATTERNS = [
  // emailService imports
  {
    pattern: /from\s+['"]\.\.?\/services\/emailService['"]/g,
    replacement: "from '../services/emailService.unified'"
  },
  {
    pattern: /from\s+['"]\.\.\/\.\.\/services\/emailService['"]/g,
    replacement: "from '../../services/emailService.unified'"
  },
  {
    pattern: /from\s+['"]\.\/emailService['"]/g,
    replacement: "from './emailService.unified'"
  },
  // emailServicei18n imports
  {
    pattern: /from\s+['"]\.\.?\/services\/emailServicei18n['"]/g,
    replacement: "from '../services/emailService.unified'"
  },
  {
    pattern: /from\s+['"]\.\.\/\.\.\/services\/emailServicei18n['"]/g,
    replacement: "from '../../services/emailService.unified'"
  },
  {
    pattern: /from\s+['"]\.\/emailServicei18n['"]/g,
    replacement: "from './emailService.unified'"
  },
];

async function findFiles() {
  const files = await glob('**/*.{ts,js}', { 
    cwd: BACKEND_SRC,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/services/emailService.ts',
      '**/services/emailServicei18n.ts',
      '**/services/emailService.unified.ts',
    ]
  });
  
  return files.map(f => path.join(BACKEND_SRC, f));
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

  if (modified) {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

async function main() {
  console.log('🔄 Starting email service migration...\n');

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
      console.log('1. Test the email functionality');
      console.log('2. Remove old email service files:');
      console.log('   - packages/backend/src/services/emailService.ts');
      console.log('   - packages/backend/src/services/emailServicei18n.ts');
      console.log('3. Rename emailService.unified.ts to emailService.ts');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();