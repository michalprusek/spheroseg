#!/usr/bin/env node

/**
 * Script to finalize email service consolidation by updating all imports
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_SRC = path.join(__dirname, '../packages/backend/src');

// Pattern to replace
const IMPORT_PATTERN = /emailService\.unified/g;
const REPLACEMENT = 'emailService';

async function findFiles() {
  const files = await glob('**/*.{ts,js}', { 
    cwd: BACKEND_SRC,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/services/emailService.ts', // Don't modify the service itself
    ]
  });
  
  return files.map(f => path.join(BACKEND_SRC, f));
}

async function processFile(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  const originalContent = content;

  // Replace emailService.unified with emailService
  content = content.replace(IMPORT_PATTERN, REPLACEMENT);

  if (content !== originalContent) {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

async function main() {
  console.log('🔄 Finalizing email service consolidation...\n');

  try {
    const files = await findFiles();
    console.log(`Found ${files.length} files to check\n`);

    let updatedCount = 0;
    for (const file of files) {
      const updated = await processFile(file);
      if (updated) updatedCount++;
    }

    console.log(`\n✨ Finalization complete!`);
    console.log(`📊 Updated ${updatedCount} files out of ${files.length} checked`);

    if (updatedCount > 0) {
      console.log('\n✅ Email service consolidation is now complete!');
      console.log('\nNext steps:');
      console.log('1. Run tests to ensure email functionality works');
      console.log('2. Commit these changes');
    }
  } catch (error) {
    console.error('❌ Finalization failed:', error);
    process.exit(1);
  }
}

main();