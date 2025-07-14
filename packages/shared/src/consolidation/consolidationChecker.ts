/**
 * Automated Consolidation Checker
 * 
 * This module provides automated checks to ensure code follows consolidation patterns
 * and maintains consistency across the codebase.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

// ===========================
// Types
// ===========================

export interface ConsolidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (context: CheckContext) => Promise<CheckResult[]>;
}

export interface CheckContext {
  rootDir: string;
  packageDir: string;
  files: string[];
}

export interface CheckResult {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  ruleId: string;
  suggestion?: string;
}

export interface ConsolidationReport {
  timestamp: string;
  totalFiles: number;
  filesChecked: number;
  results: CheckResult[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

// ===========================
// Consolidation Rules
// ===========================

/**
 * Rule: Check for duplicate utility implementations
 */
const duplicateUtilsRule: ConsolidationRule = {
  id: 'no-duplicate-utils',
  name: 'No Duplicate Utilities',
  description: 'Ensure utilities are not duplicated across the codebase',
  severity: 'error',
  async check(context: CheckContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const utilPatterns = [
      { pattern: /export\s+(?:async\s+)?function\s+formatDate/g, util: 'formatDate', consolidated: '@spheroseg/shared/utils/dates' },
      { pattern: /export\s+(?:async\s+)?function\s+validateEmail/g, util: 'validateEmail', consolidated: '@spheroseg/shared/validation' },
      { pattern: /export\s+(?:async\s+)?function\s+debounce/g, util: 'debounce', consolidated: '@/utils/performanceOptimizations' },
      { pattern: /export\s+(?:async\s+)?function\s+throttle/g, util: 'throttle', consolidated: '@/utils/performanceOptimizations' },
      { pattern: /toast\.(success|error|info|warning)\(/g, util: 'toast notifications', consolidated: '@/utils/toast' },
    ];

    for (const file of context.files) {
      if (file.includes('node_modules') || file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(context.rootDir, file), 'utf-8');
        
        for (const { pattern, util, consolidated } of utilPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const lines = content.substring(0, match.index!).split('\n');
            const line = lines.length;
            
            // Skip if it's the consolidated location itself
            if (!file.includes(consolidated.replace('@', 'src').replace('@spheroseg/', ''))) {
              results.push({
                file,
                line,
                message: `Duplicate implementation of '${util}' found. Use consolidated version from '${consolidated}'`,
                severity: 'error',
                ruleId: 'no-duplicate-utils',
                suggestion: `Import ${util} from '${consolidated}' instead of implementing it locally`,
              });
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return results;
  },
};

/**
 * Rule: Check for consistent import patterns
 */
const importPatternRule: ConsolidationRule = {
  id: 'consistent-imports',
  name: 'Consistent Import Patterns',
  description: 'Ensure imports follow established patterns',
  severity: 'warning',
  async check(context: CheckContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const consolidatedModules = [
      { module: 'toast', correctImport: '@/utils/toast' },
      { module: 'formatDate', correctImport: '@spheroseg/shared/utils/dates' },
      { module: 'imageProcessing', correctImport: '@/utils/imageProcessing' },
      { module: 'exportData', correctImport: '@/utils/export.consolidated' },
      { module: 'lazyWithRetry', correctImport: '@/utils/codeSplitting.consolidated' },
    ];

    for (const file of context.files) {
      if (file.includes('node_modules') || file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(context.rootDir, file), 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          for (const { module, correctImport } of consolidatedModules) {
            // Check for incorrect imports
            const importRegex = new RegExp(`import.*{.*${module}.*}.*from\\s+['"](?!${correctImport.replace('/', '\\/')}).*['"]`);
            if (importRegex.test(line)) {
              results.push({
                file,
                line: index + 1,
                message: `Import '${module}' from incorrect location. Use '${correctImport}'`,
                severity: 'warning',
                ruleId: 'consistent-imports',
                suggestion: `Change import to: import { ${module} } from '${correctImport}'`,
              });
            }
          }
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return results;
  },
};

/**
 * Rule: Check for hardcoded values that should use configuration
 */
const hardcodedValuesRule: ConsolidationRule = {
  id: 'no-hardcoded-values',
  name: 'No Hardcoded Configuration Values',
  description: 'Ensure configuration values are not hardcoded',
  severity: 'warning',
  async check(context: CheckContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const hardcodedPatterns = [
      { pattern: /localhost:\d{4}/g, config: 'API_URL from environment' },
      { pattern: /['"]https?:\/\/[^'"]+api[^'"]+['"]/g, config: 'API endpoints from config' },
      { pattern: /timeout:\s*\d{4,}/g, config: 'timeout values from performance config' },
      { pattern: /limit:\s*\d{3,}/g, config: 'limit values from config' },
      { pattern: /['"]AIza[^'"]+['"]/g, config: 'API keys from environment' },
    ];

    for (const file of context.files) {
      if (file.includes('node_modules') || file.includes('.test.') || file.includes('.spec.') || 
          file.includes('config') || file.includes('.env')) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(context.rootDir, file), 'utf-8');
        
        for (const { pattern, config } of hardcodedPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const lines = content.substring(0, match.index!).split('\n');
            const line = lines.length;
            
            results.push({
              file,
              line,
              message: `Hardcoded value '${match[0]}' found. Use ${config}`,
              severity: 'warning',
              ruleId: 'no-hardcoded-values',
              suggestion: `Move this value to configuration and import it`,
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return results;
  },
};

/**
 * Rule: Check for consistent error handling patterns
 */
const errorHandlingRule: ConsolidationRule = {
  id: 'consistent-error-handling',
  name: 'Consistent Error Handling',
  description: 'Ensure error handling follows established patterns',
  severity: 'warning',
  async check(context: CheckContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    for (const file of context.files) {
      if (file.includes('node_modules') || file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(context.rootDir, file), 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Check for console.error instead of logger
          if (/console\.(error|log)\(/.test(line) && !file.includes('logger')) {
            results.push({
              file,
              line: index + 1,
              message: 'Use logger instead of console for error logging',
              severity: 'warning',
              ruleId: 'consistent-error-handling',
              suggestion: `Import logger from '@/utils/logger' and use logger.error()`,
            });
          }

          // Check for unhandled promise rejections
          if (/\.then\([^)]*\)(?!\s*\.catch)/.test(line)) {
            results.push({
              file,
              line: index + 1,
              message: 'Promise without .catch() handler',
              severity: 'warning',
              ruleId: 'consistent-error-handling',
              suggestion: 'Add .catch() handler or use async/await with try/catch',
            });
          }
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return results;
  },
};

/**
 * Rule: Check for consistent date handling
 */
const dateHandlingRule: ConsolidationRule = {
  id: 'consistent-date-handling',
  name: 'Consistent Date Handling',
  description: 'Ensure date operations use consolidated utilities',
  severity: 'error',
  async check(context: CheckContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const datePatterns = [
      { pattern: /new\s+Date\(\)\.toLocaleDateString\(/g, suggestion: 'Use formatDate from @spheroseg/shared/utils/dates' },
      { pattern: /moment\(/g, suggestion: 'Use date-fns functions from @spheroseg/shared/utils/dates' },
      { pattern: /dayjs\(/g, suggestion: 'Use date-fns functions from @spheroseg/shared/utils/dates' },
      { pattern: /\.toISOString\(\)\.split\(/g, suggestion: 'Use formatters from @spheroseg/shared/utils/dates' },
    ];

    for (const file of context.files) {
      if (file.includes('node_modules') || file.includes('.test.') || file.includes('dates.')) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(context.rootDir, file), 'utf-8');
        
        for (const { pattern, suggestion } of datePatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const lines = content.substring(0, match.index!).split('\n');
            const line = lines.length;
            
            results.push({
              file,
              line,
              message: `Direct date manipulation found. ${suggestion}`,
              severity: 'error',
              ruleId: 'consistent-date-handling',
              suggestion,
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return results;
  },
};

/**
 * Rule: Check for form validation patterns
 */
const formValidationRule: ConsolidationRule = {
  id: 'consistent-form-validation',
  name: 'Consistent Form Validation',
  description: 'Ensure forms use Zod schemas from shared validation',
  severity: 'warning',
  async check(context: CheckContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    for (const file of context.files) {
      if (file.includes('node_modules') || file.includes('.test.') || file.includes('validation')) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(context.rootDir, file), 'utf-8');
        
        // Check for Yup usage
        if (/import.*yup/i.test(content) || /Yup\./g.test(content)) {
          results.push({
            file,
            message: 'Yup validation found. Use Zod schemas from @spheroseg/shared/validation',
            severity: 'warning',
            ruleId: 'consistent-form-validation',
            suggestion: 'Replace Yup with Zod schemas from shared validation module',
          });
        }

        // Check for manual validation
        if (/if\s*\([^)]*\.length\s*<\s*\d+\)/.test(content) && /form|input|field/i.test(content)) {
          results.push({
            file,
            message: 'Manual form validation found. Consider using Zod schemas',
            severity: 'info',
            ruleId: 'consistent-form-validation',
            suggestion: 'Use validation schemas from @spheroseg/shared/validation',
          });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return results;
  },
};

// ===========================
// Main Checker Class
// ===========================

export class ConsolidationChecker {
  private rules: ConsolidationRule[] = [
    duplicateUtilsRule,
    importPatternRule,
    hardcodedValuesRule,
    errorHandlingRule,
    dateHandlingRule,
    formValidationRule,
  ];

  constructor(private rootDir: string) {}

  /**
   * Add a custom rule
   */
  addRule(rule: ConsolidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Run all consolidation checks
   */
  async check(options: {
    packages?: string[];
    include?: string[];
    exclude?: string[];
  } = {}): Promise<ConsolidationReport> {
    const startTime = Date.now();
    const results: CheckResult[] = [];

    // Default packages to check
    const packages = options.packages || ['frontend', 'backend', 'shared'];
    
    for (const pkg of packages) {
      const packageDir = path.join(this.rootDir, 'packages', pkg);
      
      // Get all TypeScript and JavaScript files
      const pattern = path.join(packageDir, '**/*.{ts,tsx,js,jsx}');
      const files = await glob(pattern, {
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          ...(options.exclude || []),
        ],
      });

      const relativeFiles = files.map(f => path.relative(this.rootDir, f));
      
      const context: CheckContext = {
        rootDir: this.rootDir,
        packageDir,
        files: relativeFiles,
      };

      // Run each rule
      for (const rule of this.rules) {
        try {
          const ruleResults = await rule.check(context);
          results.push(...ruleResults);
        } catch (error) {
          console.error(`Error running rule ${rule.id}:`, error);
        }
      }
    }

    // Generate report
    const report: ConsolidationReport = {
      timestamp: new Date().toISOString(),
      totalFiles: results.length,
      filesChecked: new Set(results.map(r => r.file)).size,
      results: results.sort((a, b) => {
        // Sort by severity (error > warning > info) then by file
        const severityOrder = { error: 0, warning: 1, info: 2 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return a.file.localeCompare(b.file);
      }),
      summary: {
        errors: results.filter(r => r.severity === 'error').length,
        warnings: results.filter(r => r.severity === 'warning').length,
        info: results.filter(r => r.severity === 'info').length,
      },
    };

    return report;
  }

  /**
   * Format report for console output
   */
  formatReport(report: ConsolidationReport): string {
    const output: string[] = [];
    
    output.push('='.repeat(80));
    output.push('CONSOLIDATION CHECK REPORT');
    output.push('='.repeat(80));
    output.push(`Timestamp: ${report.timestamp}`);
    output.push(`Files checked: ${report.filesChecked}`);
    output.push('');
    output.push('SUMMARY:');
    output.push(`  Errors:   ${report.summary.errors}`);
    output.push(`  Warnings: ${report.summary.warnings}`);
    output.push(`  Info:     ${report.summary.info}`);
    output.push('');

    if (report.results.length > 0) {
      output.push('ISSUES:');
      output.push('-'.repeat(80));
      
      let currentFile = '';
      for (const result of report.results) {
        if (result.file !== currentFile) {
          output.push('');
          output.push(`FILE: ${result.file}`);
          currentFile = result.file;
        }
        
        const location = result.line ? `:${result.line}${result.column ? `:${result.column}` : ''}` : '';
        const severity = result.severity.toUpperCase().padEnd(7);
        output.push(`  ${severity} ${location} [${result.ruleId}]`);
        output.push(`    ${result.message}`);
        if (result.suggestion) {
          output.push(`    💡 ${result.suggestion}`);
        }
      }
    } else {
      output.push('✅ No consolidation issues found!');
    }

    output.push('');
    output.push('='.repeat(80));
    
    return output.join('\n');
  }

  /**
   * Save report to file
   */
  async saveReport(report: ConsolidationReport, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(
      outputPath,
      JSON.stringify(report, null, 2),
      'utf-8'
    );
  }
}

// ===========================
// CLI Helper
// ===========================

export async function runConsolidationCheck(rootDir: string, options: {
  json?: boolean;
  output?: string;
  packages?: string[];
  fix?: boolean;
} = {}): Promise<void> {
  const checker = new ConsolidationChecker(rootDir);
  const report = await checker.check({ packages: options.packages });

  if (options.output) {
    await checker.saveReport(report, options.output);
    console.log(`Report saved to: ${options.output}`);
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(checker.formatReport(report));
  }

  // Exit with error code if there are errors
  if (report.summary.errors > 0) {
    process.exit(1);
  }
}

// Export everything
export default ConsolidationChecker;