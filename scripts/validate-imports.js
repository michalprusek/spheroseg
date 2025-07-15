#!/usr/bin/env node

/**
 * Import validation script for Spheroseg
 * Validates import statements across all packages
 * Converted to ES modules with performance monitoring
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for CommonJS modules  
const globModule = await import('glob');
const glob = globModule.default;

// Configuration
const PACKAGES_DIR = path.join(__dirname, '..', 'packages');

// Updated external dependencies whitelist (security audit)
const ALLOWED_EXTERNAL_DEPS = new Set([
  // Core React ecosystem
  'react', 'react-dom', 'react-router-dom',
  
  // UI Component Libraries
  '@radix-ui', '@headlessui', '@mui',
  
  // Data & State Management
  '@tanstack/react-query', 'axios', 'zod',
  
  // Internationalization
  'i18next', 'react-i18next',
  
  // Icons & UI
  'lucide-react', 'sonner',
  
  // Networking
  'socket.io-client',
  
  // Utilities
  'lodash', 'date-fns', 'uuid', 'classnames', 'clsx',
  
  // Development & Testing
  'vitest', '@testing-library', 'jest',
  
  // Build & Bundling
  'vite', 'webpack', 'rollup',
  
  // TypeScript
  'typescript', '@types',
  
  // Linting & Formatting
  'eslint', 'prettier',
  
  // Security additions
  'bcryptjs', 'jsonwebtoken', 'helmet',
  
  // Performance monitoring
  'web-vitals'
]);

const IMPORT_RULES = {
  // Frontend package rules
  frontend: {
    allowedInternal: ['@spheroseg/shared', '@spheroseg/types'],
    forbiddenPatterns: [
      /\.\.\/\.\.\/backend/, // No direct backend imports
      /\.\.\/\.\.\/ml/,      // No direct ML imports
    ],
    requiredAliases: {
      '@/': './src/',
      '@shared/': './src/shared/',
    }
  },
  
  // Backend package rules  
  backend: {
    allowedInternal: ['@spheroseg/shared', '@spheroseg/types'],
    forbiddenPatterns: [
      /\.\.\/\.\.\/frontend/, // No direct frontend imports
      /\.\.\/\.\.\/ml/,       // No direct ML imports (use HTTP)
    ],
  },
  
  // Shared package rules
  shared: {
    allowedInternal: ['@spheroseg/types'],
    forbiddenPatterns: [
      /\.\.\/\.\.\/frontend/, // Shared can't depend on frontend
      /\.\.\/\.\.\/backend/,  // Shared can't depend on backend
      /\.\.\/\.\.\/ml/,       // Shared can't depend on ML
    ],
  },
  
  // Types package rules
  types: {
    allowedInternal: [],
    forbiddenPatterns: [
      /\.\.\/\.\.\/frontend/, // Types can't depend on anything
      /\.\.\/\.\.\/backend/,
      /\.\.\/\.\.\/ml/,
      /\.\.\/\.\.\/shared/,
    ],
  }
};

class ImportValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stats = {
      packagesValidated: 0,
      filesValidated: 0,
      importsChecked: 0,
      startTime: 0,
      endTime: 0
    };
  }

  /**
   * Validate all imports in the project with performance monitoring
   */
  async validateAll() {
    console.time('import-validation');
    this.stats.startTime = performance.now();
    
    console.log('🔍 Validating imports across all packages...\n');
    
    const packages = ['frontend', 'backend', 'shared', 'types'];
    
    for (const pkg of packages) {
      const pkgPath = path.join(PACKAGES_DIR, pkg);
      if (fs.existsSync(pkgPath)) {
        await this.validatePackage(pkg, pkgPath);
        this.stats.packagesValidated++;
      }
    }
    
    this.stats.endTime = performance.now();
    this.printResults();
    this.printPerformanceStats();
    
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  /**
   * Validate imports in a specific package
   */
  async validatePackage(packageName, packagePath) {
    console.log(`📦 Validating ${packageName} package...`);
    
    const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
      cwd: packagePath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '__tests__/**', '*.test.*', '*.spec.*']
    });
    
    const packageStartTime = performance.now();
    
    for (const file of files) {
      await this.validateFile(packageName, path.join(packagePath, file), file);
      this.stats.filesValidated++;
    }
    
    const packageEndTime = performance.now();
    const packageDuration = ((packageEndTime - packageStartTime) / 1000).toFixed(2);
    
    console.log(`✅ Validated ${files.length} files in ${packageName} (${packageDuration}s)\n`);
  }

  /**
   * Validate imports in a specific file
   */
  async validateFile(packageName, filePath, relativePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Check import/require statements
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ') || 
            trimmed.includes('require(') || trimmed.includes('import(')) {
          this.validateImportLine(packageName, relativePath, index + 1, trimmed);
          this.stats.importsChecked++;
        }
      });
    } catch (error) {
      this.errors.push({
        package: packageName,
        file: relativePath,
        line: 0,
        message: `Failed to read file: ${error.message}`
      });
    }
  }

  /**
   * Validate a single import line
   */
  validateImportLine(packageName, file, lineNumber, line) {
    const rules = IMPORT_RULES[packageName];
    if (!rules) return;
    
    // Extract import path
    const importPath = this.extractImportPath(line);
    if (!importPath) return;
    
    // Check forbidden patterns
    for (const pattern of rules.forbiddenPatterns) {
      if (pattern.test(importPath)) {
        this.errors.push({
          package: packageName,
          file,
          line: lineNumber,
          message: `Forbidden import pattern: ${importPath}`,
          rule: 'forbidden-pattern'
        });
      }
    }
    
    // Check external dependencies
    if (this.isExternalDependency(importPath)) {
      if (!this.isAllowedExternalDep(importPath)) {
        this.warnings.push({
          package: packageName,
          file,
          line: lineNumber,
          message: `Potentially unauthorized external dependency: ${importPath}`,
          rule: 'external-dependency'
        });
      }
    }
    
    // Check internal package imports
    if (importPath.startsWith('@spheroseg/')) {
      const targetPackage = importPath.split('/')[1];
      if (!rules.allowedInternal.includes(`@spheroseg/${targetPackage}`)) {
        this.errors.push({
          package: packageName,
          file,
          line: lineNumber,
          message: `Unauthorized internal package import: ${importPath}`,
          rule: 'internal-dependency'
        });
      }
    }
    
    // Check relative imports (should use aliases where configured)
    if (packageName === 'frontend' && importPath.startsWith('../')) {
      const depth = (importPath.match(/\.\.\//g) || []).length;
      if (depth > 2) {
        this.warnings.push({
          package: packageName,
          file,
          line: lineNumber,
          message: `Deep relative import detected, consider using path aliases: ${importPath}`,
          rule: 'deep-relative'
        });
      }
    }
  }

  /**
   * Extract import path from import statement
   */
  extractImportPath(line) {
    // Handle various import formats
    const patterns = [
      /import.*from\s+['"]([^'"]+)['"]/,  // import X from 'path'
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/, // import('path')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/, // require('path')
      /from\s+['"]([^'"]+)['"]/, // from 'path'
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Check if import is an external dependency
   */
  isExternalDependency(importPath) {
    return !importPath.startsWith('.') && 
           !importPath.startsWith('/') && 
           !importPath.startsWith('@/') &&
           !importPath.startsWith('@shared/') &&
           !importPath.startsWith('@spheroseg/');
  }

  /**
   * Check if external dependency is allowed
   */
  isAllowedExternalDep(importPath) {
    // Check exact matches
    if (ALLOWED_EXTERNAL_DEPS.has(importPath)) {
      return true;
    }
    
    // Check prefixes (for scoped packages)
    for (const allowed of ALLOWED_EXTERNAL_DEPS) {
      if (importPath.startsWith(allowed + '/')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('📊 Import Validation Results\n');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ No import issues found!');
      return;
    }
    
    if (this.errors.length > 0) {
      console.log(`❌ ${this.errors.length} errors found:\n`);
      this.errors.forEach(error => {
        console.log(`  ${error.package}/${error.file}:${error.line}`);
        console.log(`    ${error.message}\n`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`⚠️  ${this.warnings.length} warnings found:\n`);
      this.warnings.forEach(warning => {
        console.log(`  ${warning.package}/${warning.file}:${warning.line}`);
        console.log(`    ${warning.message}\n`);
      });
    }
  }

  /**
   * Print performance statistics
   */
  printPerformanceStats() {
    const duration = this.stats.endTime - this.stats.startTime;
    const durationSeconds = (duration / 1000).toFixed(2);
    
    console.log('\n📈 Performance Statistics:');
    console.log(`  Total duration: ${durationSeconds}s`);
    console.log(`  Packages validated: ${this.stats.packagesValidated}`);
    console.log(`  Files validated: ${this.stats.filesValidated}`);
    console.log(`  Import statements checked: ${this.stats.importsChecked}`);
    console.log(`  Average imports per file: ${(this.stats.importsChecked / this.stats.filesValidated || 0).toFixed(1)}`);
    console.log(`  Files per second: ${(this.stats.filesValidated / (duration / 1000) || 0).toFixed(1)}\n`);
    
    console.timeEnd('import-validation');
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ImportValidator();
  validator.validateAll().catch(console.error);
}

export default ImportValidator;