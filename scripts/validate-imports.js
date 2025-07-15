#!/usr/bin/env node

/**
 * Import validation script for Spheroseg
 * Validates import statements across all packages
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const ALLOWED_EXTERNAL_DEPS = new Set([
  'react', 'react-dom', 'react-router-dom',
  '@radix-ui', '@headlessui', '@mui',
  '@tanstack/react-query', 'axios', 'zod',
  'i18next', 'react-i18next',
  'lucide-react', 'sonner',
  'socket.io-client',
  'lodash', 'date-fns', 'uuid', 'classnames', 'clsx'
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
  }

  /**
   * Validate all imports in the project
   */
  async validateAll() {
    console.log('🔍 Validating imports across all packages...\n');
    
    const packages = ['frontend', 'backend', 'shared', 'types'];
    
    for (const pkg of packages) {
      const pkgPath = path.join(PACKAGES_DIR, pkg);
      if (fs.existsSync(pkgPath)) {
        await this.validatePackage(pkg, pkgPath);
      }
    }
    
    this.printResults();
    
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
    
    for (const file of files) {
      await this.validateFile(packageName, path.join(packagePath, file), file);
    }
    
    console.log(`✅ Validated ${files.length} files in ${packageName}\n`);
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
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ImportValidator();
  validator.validateAll().catch(console.error);
}

module.exports = ImportValidator;