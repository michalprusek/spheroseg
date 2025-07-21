#!/usr/bin/env node

/**
 * Test script to verify email service consolidation is working
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_SRC = path.join(__dirname, '../packages/backend/src');

async function checkFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkImports() {
  console.log('🔍 Checking email service consolidation...\n');

  // Check if unified email service exists
  const unifiedServicePath = path.join(BACKEND_SRC, 'services/emailService.unified.ts');
  const unifiedExists = await checkFileExists(unifiedServicePath);
  console.log(`✅ Unified email service exists: ${unifiedExists}`);

  // Check if old services still exist
  const oldService1 = path.join(BACKEND_SRC, 'services/emailService.ts');
  const oldService2 = path.join(BACKEND_SRC, 'services/emailServicei18n.ts');
  
  const old1Exists = await checkFileExists(oldService1);
  const old2Exists = await checkFileExists(oldService2);
  
  console.log(`⚠️  Old emailService.ts exists: ${old1Exists}`);
  console.log(`⚠️  Old emailServicei18n.ts exists: ${old2Exists}`);

  // Check import patterns in key files
  const filesToCheck = [
    'services/authService.ts',
    'services/projectShareService.ts',
    'routes/accessRequests.ts'
  ];

  console.log('\n📋 Checking imports in key files:');
  
  for (const file of filesToCheck) {
    const filePath = path.join(BACKEND_SRC, file);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const hasUnifiedImport = content.includes('emailService.unified');
      const hasOldImport = content.includes('emailService\'') || content.includes('emailService"') || content.includes('emailServicei18n');
      
      console.log(`\n${file}:`);
      console.log(`  - Uses unified service: ${hasUnifiedImport ? '✅' : '❌'}`);
      console.log(`  - Has old imports: ${hasOldImport ? '⚠️ Yes' : '✅ No'}`);
      
      // Check specific functions
      if (hasUnifiedImport) {
        const functions = ['sendProjectInvitation', 'sendPasswordReset', 'sendVerificationEmail', 'sendAccessRequest', 'sendNewPasswordEmail'];
        const usedFunctions = functions.filter(fn => content.includes(fn));
        if (usedFunctions.length > 0) {
          console.log(`  - Functions used: ${usedFunctions.join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`  ❌ Error reading file: ${error.message}`);
    }
  }

  console.log('\n📊 Summary:');
  if (unifiedExists && !old1Exists && !old2Exists) {
    console.log('✅ Email service consolidation is complete!');
  } else if (unifiedExists && (old1Exists || old2Exists)) {
    console.log('⚠️  Consolidation is partially complete. Old files still need to be removed.');
  } else {
    console.log('❌ Email service consolidation needs attention.');
  }

  if (old1Exists || old2Exists) {
    console.log('\n🔧 Next steps:');
    console.log('1. Test email functionality thoroughly');
    console.log('2. Remove old email service files:');
    if (old1Exists) console.log('   - rm packages/backend/src/services/emailService.ts');
    if (old2Exists) console.log('   - rm packages/backend/src/services/emailServicei18n.ts');
    console.log('3. Rename emailService.unified.ts to emailService.ts');
    console.log('4. Update all imports from emailService.unified to emailService');
  }
}

checkImports().catch(console.error);