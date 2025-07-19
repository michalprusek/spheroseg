#!/usr/bin/env node

/**
 * Migration script to update toast implementations
 * Converts direct toast() calls to use the new toastService
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

interface MigrationRule {
  pattern: RegExp;
  replacement: string;
}

const _MIGRATION_RULES: MigrationRule[] = [
  // Import migrations
  {
    pattern: /import\s+{\s*toast\s*}\s+from\s+['"]sonner['"]/g,
    replacement: "import { useToast } from '@/hooks/useToast'",
  },
  {
    pattern:
      /import\s+{\s*showSuccess,\s*showError,\s*showInfo,\s*showWarning\s*}\s+from\s+['"]@\/utils\/toastUtils['"]/g,
    replacement: "import { useToast } from '@/hooks/useToast'",
  },
  {
    pattern: /import\s+toastUtils\s+from\s+['"]@\/utils\/toastUtils['"]/g,
    replacement: "import { useToast } from '@/hooks/useToast'",
  },

  // Direct function call migrations (for non-component files)
  {
    pattern: /import\s+{\s*toast\s*}\s+from\s+['"]sonner['"]/g,
    replacement: "import toastService from '@/services/toastService'",
  },

  // Usage migrations - need to handle in components vs services differently
];

const COMPONENT_PATTERNS = {
  // In React components, convert to hook usage
  toastSuccess: /toast\.success\(/g,
  toastError: /toast\.error\(/g,
  toastInfo: /toast\.info\(/g,
  toastWarning: /toast\.warning\(/g,
  toastLoading: /toast\.loading\(/g,
  toastPromise: /toast\.promise\(/g,
  toastDismiss: /toast\.dismiss\(/g,

  // Old utility functions
  showSuccess: /showSuccess\(/g,
  showError: /showError\(/g,
  showInfo: /showInfo\(/g,
  showWarning: /showWarning\(/g,
};

const SERVICE_PATTERNS = {
  // In service files, convert to toastService
  toastSuccess: /toast\.success\(/g,
  toastError: /toast\.error\(/g,
  toastInfo: /toast\.info\(/g,
  toastWarning: /toast\.warning\(/g,
  toastLoading: /toast\.loading\(/g,
  toastPromise: /toast\.promise\(/g,
  toastDismiss: /toast\.dismiss\(/g,
};

function isReactComponent(filePath: string): boolean {
  const ext = path.extname(filePath);
  if (ext !== '.tsx' && ext !== '.jsx') return false;

  const content = fs.readFileSync(filePath, 'utf-8');
  return (
    content.includes('import React') ||
    content.includes("from 'react'") ||
    content.includes('from "react"') ||
    content.includes('export default function') ||
    content.includes('export function') ||
    content.includes('const Component') ||
    content.includes('= () =>') ||
    content.includes('= props =>')
  );
}

function migrateFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // Skip if file doesn't use toasts
  if (
    !content.includes('toast') &&
    !content.includes('showSuccess') &&
    !content.includes('showError') &&
    !content.includes('showInfo') &&
    !content.includes('showWarning')
  ) {
    return false;
  }

  const isComponent = isReactComponent(filePath);

  if (isComponent) {
    // For React components, add hook at the beginning
    if (
      content.includes('toast.') ||
      content.includes('showSuccess') ||
      content.includes('showError') ||
      content.includes('showInfo') ||
      content.includes('showWarning')
    ) {
      // Check if useToast is already imported
      if (!content.includes('useToast')) {
        // Add import
        const importRegex = /import\s+.*\s+from\s+['"].*['"]\s*;?\s*\n/;
        const lastImport = content.match(importRegex);

        if (lastImport) {
          const insertPos = content.lastIndexOf(lastImport[0]) + lastImport[0].length;
          content =
            content.slice(0, insertPos) + "import { useToast } from '@/hooks/useToast';\n" + content.slice(insertPos);
        }
      }

      // Add hook usage in component
      const componentRegex = /(?:function|const)\s+\w+\s*(?:\([^)]*\))?\s*(?::\s*\w+\s*)?\s*(?:=>)?\s*{/;
      const componentMatch = content.match(componentRegex);

      if (
        componentMatch &&
        !content.includes('const toast = useToast()') &&
        !content.includes('const { success, error, info, warning }')
      ) {
        const insertPos = content.indexOf(componentMatch[0]) + componentMatch[0].length;
        content = content.slice(0, insertPos) + '\n  const toast = useToast();\n' + content.slice(insertPos);
      }

      // Replace toast calls
      content = content.replace(/toast\.success\(/g, 'toast.success(');
      content = content.replace(/toast\.error\(/g, 'toast.error(');
      content = content.replace(/toast\.info\(/g, 'toast.info(');
      content = content.replace(/toast\.warning\(/g, 'toast.warning(');
      content = content.replace(/toast\.loading\(/g, 'toast.loading(');
      content = content.replace(/toast\.promise\(/g, 'toast.promise(');
      content = content.replace(/toast\.dismiss\(/g, 'toast.dismiss(');

      // Replace old utility functions
      content = content.replace(/showSuccess\(/g, 'toast.success(');
      content = content.replace(/showError\(/g, 'toast.error(');
      content = content.replace(/showInfo\(/g, 'toast.info(');
      content = content.replace(/showWarning\(/g, 'toast.warning(');
    }
  } else {
    // For service files, use toastService directly
    if (content.includes('toast.')) {
      // Replace import
      content = content.replace(
        /import\s+{\s*toast\s*}\s+from\s+['"]sonner['"]/g,
        "import toastService from '@/services/toastService'",
      );

      // Replace usage
      content = content.replace(/toast\.success\(/g, 'toastService.success(');
      content = content.replace(/toast\.error\(/g, 'toastService.error(');
      content = content.replace(/toast\.info\(/g, 'toastService.info(');
      content = content.replace(/toast\.warning\(/g, 'toastService.warning(');
      content = content.replace(/toast\.loading\(/g, 'toastService.loading(');
      content = content.replace(/toast\.promise\(/g, 'toastService.promise(');
      content = content.replace(/toast\.dismiss\(/g, 'toastService.dismiss(');
    }

    // Replace old utility functions
    if (
      content.includes('showSuccess') ||
      content.includes('showError') ||
      content.includes('showInfo') ||
      content.includes('showWarning')
    ) {
      content = content.replace(
        /import\s+{\s*showSuccess,\s*showError,\s*showInfo,\s*showWarning\s*}\s+from\s+['"]@\/utils\/toastUtils['"]/g,
        "import toastService from '@/services/toastService'",
      );

      content = content.replace(/showSuccess\(/g, 'toastService.success(');
      content = content.replace(/showError\(/g, 'toastService.error(');
      content = content.replace(/showInfo\(/g, 'toastService.info(');
      content = content.replace(/showWarning\(/g, 'toastService.warning(');
    }
  }

  // Clean up duplicate imports
  const lines = content.split('\n');
  const seenImports = new Set<string>();
  const cleanedLines = lines.filter((line) => {
    if (line.includes('import') && line.includes('useToast')) {
      if (seenImports.has('useToast')) {
        return false;
      }
      seenImports.add('useToast');
    }
    if (line.includes('import') && line.includes('toastService')) {
      if (seenImports.has('toastService')) {
        return false;
      }
      seenImports.add('toastService');
    }
    return true;
  });

  content = cleanedLines.join('\n');

  // Write back if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return true;
  }

  return false;
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
      '**/services/toastService.ts',
      '**/hooks/useToast.ts',
      '**/utils/toastUtils.ts',
      '**/migrate-toasts.ts',
    ],
  });

  console.log(`Found ${files.length} files to process`);

  let updatedCount = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      if (migrateFile(file)) {
        updatedCount++;
        console.log(`✓ Updated: ${path.relative(dir, file)}`);
      }
    } catch (_error) {
      errors.push(`✗ Error processing ${file}: ${_error}`);
    }
  }

  console.log(`\n✅ Updated ${updatedCount} files`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach((err) => console.log(err));
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const directory = args[0] || process.cwd();

  console.log(`🔄 Processing directory: ${directory}`);
  processDirectory(directory);

  console.log('\n📝 Next steps:');
  console.log('1. Update main.tsx to use ToastProvider instead of direct Toaster');
  console.log('2. Test toast notifications throughout the application');
  console.log('3. Remove old toastUtils.ts file');
  console.log('4. Update any custom toast styling');
}

export { migrateFile, processDirectory };
