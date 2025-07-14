#!/usr/bin/env tsx
/**
 * Consolidation Check Script
 * 
 * Run automated checks to ensure code follows consolidation patterns
 * 
 * Usage:
 *   npm run check:consolidation
 *   npm run check:consolidation -- --json
 *   npm run check:consolidation -- --output report.json
 *   npm run check:consolidation -- --packages frontend,backend
 */

import { program } from 'commander';
import * as path from 'path';
import { runConsolidationCheck } from '@spheroseg/shared/consolidation';

// Get the root directory (parent of scripts)
const rootDir = path.resolve(__dirname, '..');

program
  .name('check-consolidation')
  .description('Check code for consolidation patterns and consistency')
  .option('-j, --json', 'Output report as JSON')
  .option('-o, --output <path>', 'Save report to file')
  .option('-p, --packages <packages>', 'Comma-separated list of packages to check', 'frontend,backend,shared')
  .option('-f, --fix', 'Attempt to fix issues automatically (not implemented yet)')
  .parse(process.argv);

const options = program.opts();

// Parse packages
const packages = options.packages.split(',').map((p: string) => p.trim());

// Run the check
runConsolidationCheck(rootDir, {
  json: options.json,
  output: options.output,
  packages,
  fix: options.fix,
}).catch(error => {
  console.error('Error running consolidation check:', error);
  process.exit(1);
});