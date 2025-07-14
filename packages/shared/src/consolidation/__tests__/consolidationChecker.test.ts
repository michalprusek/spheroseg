/**
 * Consolidation Checker Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConsolidationChecker, ConsolidationRule } from '../consolidationChecker';

describe('ConsolidationChecker', () => {
  let tempDir: string;
  let checker: ConsolidationChecker;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'consolidation-test-'));
    
    // Create test directory structure
    await fs.mkdir(path.join(tempDir, 'packages'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'packages', 'frontend', 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'packages', 'backend', 'src'), { recursive: true });
    
    checker = new ConsolidationChecker(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('duplicate utilities detection', () => {
    it('should detect duplicate formatDate implementations', async () => {
      // Create a file with duplicate formatDate
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'utils.ts');
      await fs.writeFile(testFile, `
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function validateEmail(email: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      expect(report.results).toHaveLength(2);
      expect(report.results[0].ruleId).toBe('no-duplicate-utils');
      expect(report.results[0].message).toContain('formatDate');
      expect(report.results[1].message).toContain('validateEmail');
      expect(report.summary.errors).toBe(2);
    });

    it('should not flag consolidated locations', async () => {
      // Create the consolidated location file
      const consolidatedFile = path.join(tempDir, 'packages', 'shared', 'src', 'utils', 'dates.ts');
      await fs.mkdir(path.dirname(consolidatedFile), { recursive: true });
      await fs.writeFile(consolidatedFile, `
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}
`);

      const report = await checker.check({ packages: ['shared'] });
      
      // Should not flag the consolidated location itself
      const dateErrors = report.results.filter(r => r.message.includes('formatDate'));
      expect(dateErrors).toHaveLength(0);
    });
  });

  describe('import pattern checking', () => {
    it('should detect incorrect imports', async () => {
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'component.tsx');
      await fs.writeFile(testFile, `
import { toast } from '../utils/notifications';
import { formatDate } from '../utils/dateHelpers';

function Component() {
  toast.success('Hello');
  return <div>{formatDate(new Date())}</div>;
}
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      const importErrors = report.results.filter(r => r.ruleId === 'consistent-imports');
      expect(importErrors.length).toBeGreaterThan(0);
      expect(importErrors[0].message).toContain('incorrect location');
    });
  });

  describe('hardcoded values detection', () => {
    it('should detect hardcoded API URLs', async () => {
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'api.ts');
      await fs.writeFile(testFile, `
const API_URL = 'http://localhost:5001/api';
const timeout = 30000;

fetch(API_URL + '/users', { timeout: 5000 });
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      const hardcodedErrors = report.results.filter(r => r.ruleId === 'no-hardcoded-values');
      expect(hardcodedErrors.length).toBeGreaterThan(0);
      expect(hardcodedErrors.some(e => e.message.includes('localhost:5001'))).toBe(true);
    });

    it('should not flag config files', async () => {
      const configFile = path.join(tempDir, 'packages', 'frontend', 'src', 'config.ts');
      await fs.writeFile(configFile, `
export const API_URL = 'http://localhost:5001/api';
export const TIMEOUT = 30000;
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      // Config files should be excluded
      const configErrors = report.results.filter(r => 
        r.file.includes('config.ts') && r.ruleId === 'no-hardcoded-values'
      );
      expect(configErrors).toHaveLength(0);
    });
  });

  describe('error handling patterns', () => {
    it('should detect console.error usage', async () => {
      const testFile = path.join(tempDir, 'packages', 'backend', 'src', 'service.ts');
      await fs.writeFile(testFile, `
try {
  doSomething();
} catch (error) {
  console.error('An error occurred:', error);
}
`);

      const report = await checker.check({ packages: ['backend'] });
      
      const consoleErrors = report.results.filter(r => 
        r.ruleId === 'consistent-error-handling' && r.message.includes('logger')
      );
      expect(consoleErrors).toHaveLength(1);
    });

    it('should detect unhandled promises', async () => {
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'async.ts');
      await fs.writeFile(testFile, `
fetchData().then(data => {
  processData(data);
});
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      const promiseErrors = report.results.filter(r => 
        r.ruleId === 'consistent-error-handling' && r.message.includes('Promise')
      );
      expect(promiseErrors).toHaveLength(1);
    });
  });

  describe('date handling patterns', () => {
    it('should detect direct date manipulation', async () => {
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'dates.ts');
      await fs.writeFile(testFile, `
const formatted = new Date().toLocaleDateString('en-US');
const iso = date.toISOString().split('T')[0];
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      const dateErrors = report.results.filter(r => r.ruleId === 'consistent-date-handling');
      expect(dateErrors.length).toBeGreaterThan(0);
      expect(dateErrors[0].severity).toBe('error');
    });

    it('should detect moment.js usage', async () => {
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'moment-usage.ts');
      await fs.writeFile(testFile, `
import moment from 'moment';
const formatted = moment().format('YYYY-MM-DD');
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      const momentErrors = report.results.filter(r => 
        r.ruleId === 'consistent-date-handling' && r.message.includes('moment')
      );
      expect(momentErrors).toHaveLength(1);
    });
  });

  describe('form validation patterns', () => {
    it('should detect Yup usage', async () => {
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'form.tsx');
      await fs.writeFile(testFile, `
import * as Yup from 'yup';

const schema = Yup.object({
  email: Yup.string().email().required(),
});
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      const yupErrors = report.results.filter(r => 
        r.ruleId === 'consistent-form-validation' && r.message.includes('Yup')
      );
      expect(yupErrors).toHaveLength(1);
    });

    it('should detect manual validation', async () => {
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'manual-validation.tsx');
      await fs.writeFile(testFile, `
function validateForm(values: FormData) {
  if (values.email.length < 5) {
    return 'Email too short';
  }
}
`);

      const report = await checker.check({ packages: ['frontend'] });
      
      const manualErrors = report.results.filter(r => 
        r.ruleId === 'consistent-form-validation' && r.message.includes('Manual')
      );
      expect(manualErrors).toHaveLength(1);
      expect(manualErrors[0].severity).toBe('info');
    });
  });

  describe('custom rules', () => {
    it('should support adding custom rules', async () => {
      const customRule: ConsolidationRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'Test custom rule',
        severity: 'warning',
        async check(context) {
          return [{
            file: 'test.ts',
            message: 'Custom rule triggered',
            severity: 'warning',
            ruleId: 'custom-rule',
          }];
        },
      };

      checker.addRule(customRule);
      const report = await checker.check();
      
      const customResults = report.results.filter(r => r.ruleId === 'custom-rule');
      expect(customResults).toHaveLength(1);
    });
  });

  describe('report formatting', () => {
    it('should format report correctly', async () => {
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'test.ts');
      await fs.writeFile(testFile, `
console.error('test');
`);

      const report = await checker.check({ packages: ['frontend'] });
      const formatted = checker.formatReport(report);
      
      expect(formatted).toContain('CONSOLIDATION CHECK REPORT');
      expect(formatted).toContain('SUMMARY:');
      expect(formatted).toContain('Errors:');
      expect(formatted).toContain('Warnings:');
    });

    it('should handle empty report', async () => {
      // Don't create any files
      const report = await checker.check({ packages: ['frontend'] });
      const formatted = checker.formatReport(report);
      
      expect(formatted).toContain('No consolidation issues found!');
    });
  });

  describe('report saving', () => {
    it('should save report to file', async () => {
      const reportPath = path.join(tempDir, 'report.json');
      
      const testFile = path.join(tempDir, 'packages', 'frontend', 'src', 'test.ts');
      await fs.writeFile(testFile, 'console.error("test");');
      
      const report = await checker.check({ packages: ['frontend'] });
      await checker.saveReport(report, reportPath);
      
      const savedReport = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
      expect(savedReport.timestamp).toBeDefined();
      expect(savedReport.results).toBeDefined();
      expect(savedReport.summary).toBeDefined();
    });
  });
});