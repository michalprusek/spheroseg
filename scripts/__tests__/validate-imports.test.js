/**
 * Tests for import validation script
 */

import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

// Note: ES modules cannot use require() for dynamic imports in tests
// We'll need to test the class differently or convert to CommonJS for testing

describe('ImportValidator', () => {
  let validator;
  let mockFS;
  let mockGlob;

  beforeEach(() => {
    validator = new ImportValidator();
    mockFS = require('fs');
    mockGlob = require('glob');
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with empty errors and warnings', () => {
      expect(validator.errors).toEqual([]);
      expect(validator.warnings).toEqual([]);
      expect(validator.stats.packagesValidated).toBe(0);
      expect(validator.stats.filesValidated).toBe(0);
      expect(validator.stats.importsChecked).toBe(0);
    });
  });

  describe('extractImportPath', () => {
    it('should extract path from import statement', () => {
      const testCases = [
        { line: "import React from 'react'", expected: 'react' },
        { line: "import { useState } from 'react'", expected: 'react' },
        { line: "from 'lodash'", expected: 'lodash' },
        { line: "const fs = require('fs')", expected: 'fs' },
        { line: "import('./dynamic-import')", expected: './dynamic-import' },
      ];

      testCases.forEach(({ line, expected }) => {
        expect(validator.extractImportPath(line)).toBe(expected);
      });
    });

    it('should return null for invalid import statements', () => {
      const invalidLines = [
        'const x = 5',
        'console.log("test")',
        'import // incomplete',
      ];

      invalidLines.forEach(line => {
        expect(validator.extractImportPath(line)).toBeNull();
      });
    });
  });

  describe('isExternalDependency', () => {
    it('should identify external dependencies correctly', () => {
      const testCases = [
        { path: 'react', expected: true },
        { path: 'lodash', expected: true },
        { path: '@types/node', expected: true },
        { path: './local-file', expected: false },
        { path: '../parent-file', expected: false },
        { path: '/absolute/path', expected: false },
        { path: '@/', expected: false },
        { path: '@shared/utils', expected: false },
        { path: '@spheroseg/types', expected: false },
      ];

      testCases.forEach(({ path, expected }) => {
        expect(validator.isExternalDependency(path)).toBe(expected);
      });
    });
  });

  describe('isAllowedExternalDep', () => {
    it('should allow whitelisted dependencies', () => {
      const allowedDeps = [
        'react',
        'lodash',
        '@types/node',
        '@mui/material',
      ];

      allowedDeps.forEach(dep => {
        expect(validator.isAllowedExternalDep(dep)).toBe(true);
      });
    });

    it('should allow scoped packages with prefixes', () => {
      expect(validator.isAllowedExternalDep('@types/react')).toBe(true);
      expect(validator.isAllowedExternalDep('@mui/icons-material')).toBe(true);
    });

    it('should reject non-whitelisted dependencies', () => {
      const rejectedDeps = [
        'unknown-package',
        'malicious-lib',
        '@unauthorized/package',
      ];

      rejectedDeps.forEach(dep => {
        expect(validator.isAllowedExternalDep(dep)).toBe(false);
      });
    });
  });

  describe('validateImportLine', () => {
    beforeEach(() => {
      // Mock the extractImportPath method to control its output
      validator.extractImportPath = jest.fn();
    });

    it('should detect forbidden patterns', () => {
      validator.extractImportPath.mockReturnValue('../../backend/config');
      
      validator.validateImportLine('frontend', 'src/test.ts', 5, "import config from '../../backend/config'");
      
      expect(validator.errors).toHaveLength(1);
      expect(validator.errors[0]).toMatchObject({
        package: 'frontend',
        file: 'src/test.ts',
        line: 5,
        rule: 'forbidden-pattern'
      });
    });

    it('should warn about unauthorized external dependencies', () => {
      validator.extractImportPath.mockReturnValue('unauthorized-package');
      
      validator.validateImportLine('frontend', 'src/test.ts', 3, "import pkg from 'unauthorized-package'");
      
      expect(validator.warnings).toHaveLength(1);
      expect(validator.warnings[0]).toMatchObject({
        package: 'frontend',
        file: 'src/test.ts',
        line: 3,
        rule: 'external-dependency'
      });
    });

    it('should detect unauthorized internal package imports', () => {
      validator.extractImportPath.mockReturnValue('@spheroseg/backend');
      
      validator.validateImportLine('frontend', 'src/test.ts', 2, "import utils from '@spheroseg/backend'");
      
      expect(validator.errors).toHaveLength(1);
      expect(validator.errors[0]).toMatchObject({
        package: 'frontend',
        file: 'src/test.ts',
        line: 2,
        rule: 'internal-dependency'
      });
    });

    it('should warn about deep relative imports', () => {
      validator.extractImportPath.mockReturnValue('../../../shared/utils');
      
      validator.validateImportLine('frontend', 'src/components/test.ts', 1, "import utils from '../../../shared/utils'");
      
      expect(validator.warnings).toHaveLength(1);
      expect(validator.warnings[0]).toMatchObject({
        package: 'frontend',
        file: 'src/components/test.ts',
        line: 1,
        rule: 'deep-relative'
      });
    });

    it('should allow valid imports', () => {
      validator.extractImportPath.mockReturnValue('react');
      
      validator.validateImportLine('frontend', 'src/test.ts', 1, "import React from 'react'");
      
      expect(validator.errors).toHaveLength(0);
      expect(validator.warnings).toHaveLength(0);
    });
  });

  describe('validateFile', () => {
    beforeEach(() => {
      mockFS.readFileSync = jest.fn();
    });

    it('should process import statements in file', async () => {
      const fileContent = `
import React from 'react';
import { useState } from 'react';
const fs = require('fs');
import('../dynamic');
      `.trim();

      mockFS.readFileSync.mockReturnValue(fileContent);
      
      const validateImportLineSpy = jest.spyOn(validator, 'validateImportLine');
      
      await validator.validateFile('frontend', '/path/to/file.ts', 'file.ts');
      
      expect(validateImportLineSpy).toHaveBeenCalledTimes(4);
      expect(validator.stats.importsChecked).toBe(4);
    });

    it('should handle file read errors', async () => {
      mockFS.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await validator.validateFile('frontend', '/path/to/file.ts', 'file.ts');
      
      expect(validator.errors).toHaveLength(1);
      expect(validator.errors[0]).toMatchObject({
        package: 'frontend',
        file: 'file.ts',
        line: 0,
        message: 'Failed to read file: Permission denied'
      });
    });
  });

  describe('validatePackage', () => {
    beforeEach(() => {
      mockGlob.sync = jest.fn();
      mockFS.readFileSync = jest.fn();
    });

    it('should validate all files in package', async () => {
      const mockFiles = ['src/index.ts', 'src/utils.ts', 'src/components/Button.tsx'];
      mockGlob.sync.mockReturnValue(mockFiles);
      mockFS.readFileSync.mockReturnValue('import React from "react";');

      const validateFileSpy = jest.spyOn(validator, 'validateFile');
      
      await validator.validatePackage('frontend', '/path/to/frontend');
      
      expect(mockGlob.sync).toHaveBeenCalledWith('**/*.{ts,tsx,js,jsx}', {
        cwd: '/path/to/frontend',
        ignore: ['node_modules/**', 'dist/**', 'build/**', '__tests__/**', '*.test.*', '*.spec.*']
      });
      
      expect(validateFileSpy).toHaveBeenCalledTimes(3);
      expect(validator.stats.filesValidated).toBe(3);
    });
  });

  describe('Performance tracking', () => {
    it('should track performance statistics', async () => {
      mockFS.existsSync = jest.fn().mockReturnValue(false);
      
      const startTime = performance.now();
      await validator.validateAll();
      const endTime = performance.now();
      
      expect(validator.stats.startTime).toBeGreaterThan(0);
      expect(validator.stats.endTime).toBeGreaterThan(validator.stats.startTime);
      expect(validator.stats.endTime - validator.stats.startTime).toBeLessThan(endTime - startTime + 100); // Allow some margin
    });

    it('should calculate throughput metrics', async () => {
      validator.stats.filesValidated = 100;
      validator.stats.importsChecked = 500;
      validator.stats.startTime = 1000;
      validator.stats.endTime = 3000; // 2 seconds

      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      validator.printPerformanceStats();
      
      // Verify metrics calculation
      const avgImportsPerFile = 500 / 100; // 5.0
      const filesPerSecond = 100 / 2; // 50.0
      
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Average imports per file: 5.0'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Files per second: 50.0'));
      
      logSpy.mockRestore();
    });
  });

  describe('Integration tests', () => {
    it('should handle realistic frontend package validation', async () => {
      // Mock a realistic frontend package structure
      mockFS.existsSync = jest.fn().mockReturnValue(true);
      mockGlob.sync = jest.fn().mockReturnValue([
        'src/App.tsx',
        'src/components/Button.tsx',
        'src/utils/helpers.ts'
      ]);
      
      mockFS.readFileSync = jest.fn()
        .mockReturnValueOnce(`
          import React from 'react';
          import { Button } from '@mui/material';
          import { helper } from './utils/helpers';
        `)
        .mockReturnValueOnce(`
          import React from 'react';
          import { unauthorized } from 'bad-package';
        `)
        .mockReturnValueOnce(`
          import { config } from '../../backend/config';
        `);

      await validator.validateAll();
      
      expect(validator.stats.packagesValidated).toBeGreaterThan(0);
      expect(validator.stats.filesValidated).toBe(3);
      expect(validator.stats.importsChecked).toBeGreaterThan(0);
      expect(validator.errors.length + validator.warnings.length).toBeGreaterThan(0);
    });
  });
});