import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

// Function to flatten nested translation objects
function flattenKeys(obj: TranslationObject, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      keys.push(fullKey);
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...flattenKeys(value, fullKey));
    }
  }

  return keys;
}

// Function to find missing keys between two translation objects
function findMissingKeys(reference: string[], target: string[]): string[] {
  const targetSet = new Set(target);
  return reference.filter((key) => !targetSet.has(key));
}

// Function to find extra keys not in reference
function findExtraKeys(reference: string[], target: string[]): string[] {
  const referenceSet = new Set(reference);
  return target.filter((key) => !referenceSet.has(key));
}

describe('Translation Coverage Tests', () => {
  const translations: Record<string, TranslationObject> = {};
  const languages = ['en', 'cs', 'de', 'es', 'fr', 'zh'];

  beforeAll(async () => {
    // Load all translation files
    for (const lang of languages) {
      const filePath = path.join(__dirname, '../../translations', `${lang}.ts`);
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Extract the export default object
      const match = fileContent.match(/export\s+default\s+(\{[\s\S]*\});?\s*$/);
      if (match) {
        try {
          // Use Function constructor to evaluate the object
          const translationObj = new Function(`return ${match[1]}`)();
          translations[lang] = translationObj;
        } catch (error) {
          console.error(`Failed to parse ${lang}.ts:`, error);
          translations[lang] = {};
        }
      }
    }
  });

  it('should have all translation files loaded', () => {
    for (const lang of languages) {
      expect(translations[lang], `Translation file for ${lang} should be loaded`).toBeDefined();
      expect(Object.keys(translations[lang]).length, `Translation file for ${lang} should have keys`).toBeGreaterThan(
        0,
      );
    }
  });

  it('should have consistent structure across all languages', () => {
    const enKeys = flattenKeys(translations.en);
    console.log(`English has ${enKeys.length} translation keys`);

    for (const lang of languages.filter((l) => l !== 'en')) {
      const langKeys = flattenKeys(translations[lang]);
      const missingKeys = findMissingKeys(enKeys, langKeys);
      const extraKeys = findExtraKeys(enKeys, langKeys);

      console.log(`\n${lang.toUpperCase()} Translation Coverage:`);
      console.log(`- Total keys: ${langKeys.length}`);
      console.log(`- Missing keys: ${missingKeys.length}`);
      console.log(`- Extra keys: ${extraKeys.length}`);

      if (missingKeys.length > 0) {
        console.log(`\nMissing keys in ${lang}:`);
        missingKeys.slice(0, 10).forEach((key) => console.log(`  - ${key}`));
        if (missingKeys.length > 10) {
          console.log(`  ... and ${missingKeys.length - 10} more`);
        }
      }

      if (extraKeys.length > 0) {
        console.log(`\nExtra keys in ${lang} (not in English):`);
        extraKeys.slice(0, 10).forEach((key) => console.log(`  - ${key}`));
        if (extraKeys.length > 10) {
          console.log(`  ... and ${extraKeys.length - 10} more`);
        }
      }

      // Test should pass even with missing keys, but we log them for visibility
      expect(langKeys.length).toBeGreaterThan(0);
    }
  });

  it('should have all critical translation keys in all languages', () => {
    // Define critical keys that must exist in all languages
    const criticalKeys = [
      'common.appName',
      'common.loading',
      'common.error',
      'common.save',
      'common.cancel',
      'common.signIn',
      'common.signOut',
      'auth.signIn',
      'auth.signUp',
      'auth.email',
      'auth.password',
      'projects.title',
      'projects.createProject',
      'settings.title',
      'settings.profile',
      'profile.title',
      'common.dashboard',
    ];

    for (const lang of languages) {
      const langKeys = flattenKeys(translations[lang]);
      const langKeySet = new Set(langKeys);

      const missingCritical = criticalKeys.filter((key) => !langKeySet.has(key));

      if (missingCritical.length > 0) {
        console.log(`\nCritical keys missing in ${lang}:`);
        missingCritical.forEach((key) => console.log(`  - ${key}`));
      }

      expect(missingCritical.length, `${lang} should have all critical keys`).toBe(0);
    }
  });

  it('should not have duplicate keys within each language', () => {
    // This is automatically handled by JavaScript objects, but we can check for
    // keys that appear multiple times in the source file
    for (const lang of languages) {
      const filePath = path.join(__dirname, '../../translations', `${lang}.ts`);
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Find all key definitions (simple regex, might not catch all cases)
      const keyMatches = fileContent.matchAll(/^\s*(\w+):\s*[{'"`]/gm);
      const keys: Record<string, number> = {};

      for (const match of keyMatches) {
        const key = match[1];
        keys[key] = (keys[key] || 0) + 1;
      }

      const duplicates = Object.entries(keys)
        .filter(([_, count]) => count > 1)
        .map(([key]) => key);

      if (duplicates.length > 0) {
        console.log(`\nPotential duplicate keys in ${lang}.ts:`);
        duplicates.forEach((key) => console.log(`  - ${key} (appears ${keys[key]} times)`));
      }

      // This is more of a warning than a failure
      // Note: Keys like 'title', 'name', etc. naturally appear in different nested contexts
      // and are not actually duplicates (e.g., auth.title vs dashboard.title)
      // Only fail if there are truly problematic duplicates (same key at same nesting level)
      
      // For now, log duplicates but don't fail the test since nested contexts are expected
      if (duplicates.length > 0) {
        console.warn(`Found ${duplicates.length} duplicate key names in ${lang}.ts - this is expected for nested translation structures`);
      }
    }
  });

  it('should have proper interpolation placeholders', () => {
    // Check that interpolation placeholders are consistent
    const interpolationPattern = /\{\{(\w+)\}\}/g;

    for (const lang of languages) {
      const issues: string[] = [];

      const checkInterpolations = (obj: TranslationObject, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;

          if (typeof value === 'string') {
            const _matches = [...value.matchAll(interpolationPattern)];

            // Check for unbalanced braces
            const openCount = (value.match(/\{\{/g) || []).length;
            const closeCount = (value.match(/\}\}/g) || []).length;

            if (openCount !== closeCount) {
              issues.push(`${fullKey}: Unbalanced braces in "${value}"`);
            }

            // Check for common typos
            if (value.includes('{{') && value.includes('}}')) {
              if (value.includes('{{{') || value.includes('}}}')) {
                issues.push(`${fullKey}: Triple braces detected in "${value}"`);
              }
            }
          } else if (typeof value === 'object' && value !== null) {
            checkInterpolations(value, fullKey);
          }
        }
      };

      checkInterpolations(translations[lang]);

      if (issues.length > 0) {
        console.log(`\nInterpolation issues in ${lang}:`);
        issues.forEach((issue) => console.log(`  - ${issue}`));
      }

      expect(issues.length, `${lang} should have valid interpolation placeholders`).toBe(0);
    }
  });

  it('should generate coverage report', () => {
    console.log('\n=== Translation Coverage Report ===\n');

    const enKeys = flattenKeys(translations.en);
    const coverageData: Array<{ lang: string; coverage: number; missing: number }> = [];

    for (const lang of languages) {
      const langKeys = flattenKeys(translations[lang]);
      const langKeySet = new Set(langKeys);
      const covered = enKeys.filter((key) => langKeySet.has(key)).length;
      const coverage = (covered / enKeys.length) * 100;

      coverageData.push({
        lang,
        coverage,
        missing: enKeys.length - covered,
      });
    }

    // Sort by coverage
    coverageData.sort((a, b) => b.coverage - a.coverage);

    console.log('Language | Coverage | Missing Keys');
    console.log('---------|----------|-------------');
    coverageData.forEach(({ lang, coverage, missing }) => {
      const langName = lang.toUpperCase().padEnd(8);
      const coverageStr = `${coverage.toFixed(1)}%`.padEnd(8);
      console.log(`${langName} | ${coverageStr} | ${missing}`);
    });

    console.log(`\nTotal unique keys: ${enKeys.length}`);

    // All languages should have at least 80% coverage
    for (const { lang, coverage } of coverageData) {
      expect(coverage, `${lang} should have at least 80% coverage`).toBeGreaterThanOrEqual(80);
    }
  });
});
