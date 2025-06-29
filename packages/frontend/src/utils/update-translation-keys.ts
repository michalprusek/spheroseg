#!/usr/bin/env node

/**
 * Utility to automatically update translation keys in React components
 * from flat structure to nested structure
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Common translation key mappings
const COMMON_MAPPINGS: Record<string, string> = {
  // Direct t() calls
  "t('save')": "t('common.actions.save')",
  "t('cancel')": "t('common.actions.cancel')",
  "t('delete')": "t('common.actions.delete')",
  "t('edit')": "t('common.actions.edit')",
  "t('create')": "t('common.actions.create')",
  "t('search')": "t('common.actions.search')",
  "t('back')": "t('common.actions.back')",
  "t('close')": "t('common.actions.close')",
  "t('view')": "t('common.actions.view')",
  "t('share')": "t('common.actions.share')",
  "t('export')": "t('common.actions.export')",
  "t('upload')": "t('common.actions.upload')",
  "t('download')": "t('common.actions.download')",
  "t('duplicate')": "t('common.actions.duplicate')",
  "t('tryAgain')": "t('common.actions.retry')",
  "t('reset')": "t('common.actions.reset')",
  "t('clear')": "t('common.actions.clear')",
  "t('selectAll')": "t('common.actions.selectAll')",
  "t('removeAll')": "t('common.actions.removeAll')",
  "t('saveChanges')": "t('common.actions.saveChanges')",
  "t('uploadImages')": "t('common.actions.uploadImages')",
  "t('backToHome')": "t('common.actions.backToHome')",
  
  // Status
  "t('loading')": "t('common.status.loading')",
  "t('processing')": "t('common.status.processing')",
  "t('saving')": "t('common.status.saving')",
  "t('uploading')": "t('common.status.uploading')",
  "t('completed')": "t('common.status.completed')",
  "t('failed')": "t('common.status.failed')",
  "t('pending')": "t('common.status.pending')",
  "t('queued')": "t('common.status.queued')",
  "t('success')": "t('common.status.success')",
  "t('error')": "t('common.status.error')",
  "t('active')": "t('common.status.active')",
  "t('archived')": "t('common.status.archived')",
  "t('draft')": "t('common.status.draft')",
  
  // Form fields
  "t('email')": "t('common.form.email')",
  "t('password')": "t('common.form.password')",
  "t('confirmPassword')": "t('common.form.confirmPassword')",
  "t('firstName')": "t('common.form.firstName')",
  "t('lastName')": "t('common.form.lastName')",
  "t('username')": "t('common.form.username')",
  "t('name')": "t('common.form.name')",
  "t('title')": "t('common.form.title')",
  "t('description')": "t('common.form.description')",
  "t('organization')": "t('common.form.organization')",
  "t('location')": "t('common.form.location')",
  "t('bio')": "t('common.form.bio')",
  
  // Messages
  "t('saveSuccess')": "t('common.messages.saveSuccess')",
  "t('deleteSuccess')": "t('common.messages.deleteSuccess')",
  "t('updateSuccess')": "t('common.messages.updateSuccess')",
  "t('uploadSuccess')": "t('common.messages.uploadSuccess')",
  "t('createSuccess')": "t('common.messages.createSuccess')",
  "t('validationFailed')": "t('common.messages.validationFailed')",
  "t('unauthorized')": "t('common.messages.unauthorized')",
  "t('forbidden')": "t('common.messages.forbidden')",
  "t('notFound')": "t('common.messages.notFound')",
  
  // Auth
  "t('signIn')": "t('auth.actions.signIn')",
  "t('signUp')": "t('auth.actions.signUp')",
  "t('signOut')": "t('auth.actions.signOut')",
  "t('signingIn')": "t('auth.messages.signingIn')",
  "t('forgotPassword')": "t('auth.actions.forgotPassword')",
  "t('resetPassword')": "t('auth.actions.resetPassword')",
  "t('createAccount')": "t('auth.actions.createAccount')",
  "t('requestAccess')": "t('auth.actions.requestAccess')",
  
  // With quotes variations
  't("save")': 't("common.actions.save")',
  't("cancel")': 't("common.actions.cancel")',
  't("delete")': 't("common.actions.delete")',
  't("edit")': 't("common.actions.edit")',
  't("create")': 't("common.actions.create")',
  't("loading")': 't("common.status.loading")',
  't("error")': 't("common.status.error")',
  't("success")': 't("common.status.success")',
  
  // Template literal variations
  't(`save`)': 't(`common.actions.save`)',
  't(`cancel`)': 't(`common.actions.cancel`)',
  't(`delete`)': 't(`common.actions.delete`)',
  't(`loading`)': 't(`common.status.loading`)',
  't(`error`)': 't(`common.status.error`)',
  't(`success`)': 't(`common.status.success`)',
};

// Context-aware mappings (need to check file path or component name)
const CONTEXT_MAPPINGS = {
  projects: {
    "t('title')": "t('projects.titles.page')",
    "t('description')": "t('projects.labels.description')",
    "t('status')": "t('projects.labels.status')",
    "t('loading')": "t('projects.messages.loading')",
    "t('error')": "t('projects.messages.error')",
  },
  auth: {
    "t('title')": "t('auth.titles.signIn')",
    "t('description')": "t('auth.descriptions.signIn')",
    "t('loading')": "t('auth.messages.signingIn')",
    "t('error')": "t('auth.messages.invalidCredentials')",
  },
  settings: {
    "t('title')": "t('settings.titles.page')",
    "t('description')": "t('settings.descriptions.appearance')",
    "t('loading')": "t('settings.messages.savingChanges')",
    "t('error')": "t('settings.messages.profileLoadError')",
  },
  segmentation: {
    "t('title')": "t('segmentation.titles.editor')",
    "t('loading')": "t('segmentation.messages.loading')",
    "t('error')": "t('segmentation.messages.saveSegmentationFailed')",
  },
};

function detectContext(filePath: string): string {
  const pathLower = filePath.toLowerCase();
  
  if (pathLower.includes('project')) return 'projects';
  if (pathLower.includes('auth') || pathLower.includes('login') || pathLower.includes('signup')) return 'auth';
  if (pathLower.includes('settings') || pathLower.includes('profile')) return 'settings';
  if (pathLower.includes('segment')) return 'segmentation';
  
  return 'common';
}

function updateTranslationKeys(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Skip if file doesn't use translations
  if (!content.includes('useTranslation') && !content.includes('t(')) {
    return false;
  }
  
  // Apply common mappings
  for (const [oldKey, newKey] of Object.entries(COMMON_MAPPINGS)) {
    content = content.replace(new RegExp(escapeRegExp(oldKey), 'g'), newKey);
  }
  
  // Apply context-aware mappings
  const context = detectContext(filePath);
  const contextMappings = CONTEXT_MAPPINGS[context as keyof typeof CONTEXT_MAPPINGS];
  
  if (contextMappings) {
    for (const [oldKey, newKey] of Object.entries(contextMappings)) {
      // Only replace if not already replaced by common mappings
      if (!content.includes(newKey)) {
        content = content.replace(new RegExp(escapeRegExp(oldKey), 'g'), newKey);
      }
    }
  }
  
  // Handle complex cases with regex
  // t('projectsPage.XXX') -> t('projects.XXX')
  content = content.replace(/t\(['"`]projectsPage\.([^'"`]+)['"`]\)/g, (match, key) => {
    // Map specific projectsPage keys
    const mappings: Record<string, string> = {
      'title': 'projects.titles.page',
      'description': 'projects.descriptions.page',
      'createNew': 'projects.actions.createNew',
      'createProject': 'projects.actions.create',
      'projectName': 'projects.labels.name',
      'projectDescription': 'projects.labels.description',
      'projectCreated': 'projects.messages.created',
      'projectDeleted': 'projects.messages.deleted',
      'noProjects': 'projects.messages.noProjects',
      'loading': 'projects.messages.loading',
      'error': 'projects.messages.error',
    };
    
    const newKey = mappings[key];
    if (newKey) {
      return `t('${newKey}')`;
    }
    
    // Generic conversion
    return `t('projects.${key}')`;
  });
  
  // Write back if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findUnmappedKeys(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const unmapped: string[] = [];
  
  // Find all t() calls
  const regex = /t\(['"`]([^'"`]+)['"`]\)/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    // Check if it's already using nested structure
    if (!key.includes('.')) {
      unmapped.push(key);
    }
  }
  
  return [...new Set(unmapped)]; // Remove duplicates
}

function processDirectory(dir: string) {
  const pattern = path.join(dir, '**/*.{tsx,ts,jsx,js}');
  const files = glob.sync(pattern, {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/translations/**',
    ],
  });
  
  console.log(`Found ${files.length} files to process`);
  
  let updatedCount = 0;
  const allUnmappedKeys = new Set<string>();
  
  for (const file of files) {
    // First find unmapped keys
    const unmappedKeys = findUnmappedKeys(file);
    unmappedKeys.forEach(key => allUnmappedKeys.add(key));
    
    // Then update the file
    if (updateTranslationKeys(file)) {
      updatedCount++;
      console.log(`Updated: ${path.relative(dir, file)}`);
    }
  }
  
  console.log(`\nUpdated ${updatedCount} files`);
  
  if (allUnmappedKeys.size > 0) {
    console.log('\nUnmapped keys found (need manual review):');
    Array.from(allUnmappedKeys).sort().forEach(key => {
      console.log(`  - ${key}`);
    });
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const directory = args[0] || process.cwd();
  
  console.log(`Processing directory: ${directory}`);
  processDirectory(directory);
}

export { updateTranslationKeys, findUnmappedKeys, processDirectory };