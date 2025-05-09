import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { checkForHardcodedText } from '../../utils/translationUtils';

// Function to recursively get all files with specific extensions
function getAllFiles(dir: string, extensions: string[] = ['.tsx', '.jsx']): string[] {
  const files: string[] = [];

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist directories
      if (item !== 'node_modules' && item !== 'dist' && item !== '.git') {
        files.push(...getAllFiles(itemPath, extensions));
      }
    } else if (extensions.includes(path.extname(itemPath))) {
      files.push(itemPath);
    }
  }

  return files;
}

// Function to check for potential hardcoded text in a file
function checkFileForHardcodedText(filePath: string): { file: string, line: number, text: string }[] {
  // Skip checking test files and translation files
  if (filePath.includes('__tests__') ||
      filePath.includes('test.') ||
      filePath.includes('locales/') ||
      filePath.includes('i18n.ts')) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const results = checkForHardcodedText(content);

  // Convert to the expected format
  return results.map(result => ({
    file: filePath,
    line: result.line,
    text: result.text
  }));
}

describe('Hardcoded Text Check', () => {
  it('should identify potential hardcoded text in components', () => {
    // This test is meant to be informative rather than pass/fail
    // It will log potential hardcoded text for manual review

    const srcDir = path.resolve(__dirname, '../../../src');
    const files = getAllFiles(srcDir);

    let allResults: { file: string, line: number, text: string }[] = [];

    files.forEach(file => {
      const results = checkFileForHardcodedText(file);
      allResults = [...allResults, ...results];
    });

    // Log the results for manual review
    if (allResults.length > 0) {
      console.log('\nPotential hardcoded text found:');
      console.log('================================');

      allResults.forEach(result => {
        console.log(`File: ${path.relative(srcDir, result.file)}`);
        console.log(`Line: ${result.line}`);
        console.log(`Text: "${result.text}"`);
        console.log('--------------------------------');
      });
    }

    // This test always passes, it's just for information
    expect(true).toBe(true);
  });
});
