/**
 * Translation Utilities
 *
 * This module provides centralized utilities for working with translations,
 * including checking for missing keys, generating missing translations,
 * and validating translation files.
 */

import logger from '@/utils/logger';

/**
 * Interface for a translation key with its path and value
 */
export interface TranslationKey {
  path: string;
  value: string;
}

/**
 * Type representing a nested translation object with string values at leaf nodes
 */
export type TranslationObject = {
  [key: string]: string | TranslationObject;
};

/**
 * Type for a record containing only translation objects
 */
export type TranslationRecord = Record<string, TranslationObject | string>;

/**
 * Type for the function parameter used to evaluate translation content
 */
export type TranslationEvaluator = () => TranslationRecord;

/**
 * Check if all keys in the reference object exist in the target object
 *
 * @param reference Reference object (usually English translations)
 * @param target Target object to check against
 * @param path Current path in the object hierarchy
 * @returns Array of missing key paths
 */
export function checkKeysExist(reference: TranslationRecord, target: TranslationRecord, path = ''): string[] {
  const missingKeys: string[] = [];

  for (const key in reference) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof reference[key] === 'object' && reference[key] !== null) {
      // If the value is an object, recursively check its keys
      if (typeof target[key] !== 'object' || target[key] === null) {
        missingKeys.push(`${currentPath} (missing object)`);
      } else {
        missingKeys.push(...checkKeysExist(reference[key], target[key], currentPath));
      }
    } else {
      // If the value is not an object, check if the key exists in the target
      if (!(key in target)) {
        missingKeys.push(currentPath);
      }
    }
  }

  return missingKeys;
}

/**
 * Find missing keys in target compared to reference
 *
 * @param reference Reference object (usually English translations)
 * @param target Target object to check against
 * @returns Array of missing keys with their paths and values
 */
export function findMissingKeys(reference: TranslationRecord, target: TranslationRecord): TranslationKey[] {
  const missingKeys: TranslationKey[] = [];

  function findMissingKeysRecursive(refObj: TranslationRecord, targetObj: TranslationRecord, path = '') {
    for (const key in refObj) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof refObj[key] === 'object' && refObj[key] !== null) {
        // If target doesn't have this object, all nested keys are missing
        if (!targetObj[key] || typeof targetObj[key] !== 'object') {
          // Add all nested keys
          collectAllNestedKeys(refObj[key], currentPath);
        } else {
          // Recursively check nested objects
          findMissingKeysRecursive(refObj[key], targetObj[key], currentPath);
        }
      } else if (targetObj[key] === undefined) {
        // Add missing key
        missingKeys.push({
          path: currentPath,
          value: refObj[key],
        });
      }
    }
  }

  function collectAllNestedKeys(obj: TranslationRecord, basePath: string) {
    for (const key in obj) {
      const currentPath = `${basePath}.${key}`;

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        collectAllNestedKeys(obj[key], currentPath);
      } else {
        missingKeys.push({
          path: currentPath,
          value: obj[key],
        });
      }
    }
  }

  findMissingKeysRecursive(reference, target);
  return missingKeys;
}

/**
 * Generate missing translations object
 *
 * @param missingKeys Array of missing keys
 * @param reference Reference object (usually English translations)
 * @param langCode Language code for the target language
 * @returns Object with missing translations
 */
export function generateMissingTranslations(missingKeys: TranslationKey[], langCode: string): TranslationRecord {
  const result: TranslationRecord = {};

  missingKeys.forEach((key) => {
    const pathParts = key.path.split('.');
    let current = result;

    // Build the nested structure
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    // Add the leaf value
    const lastPart = pathParts[pathParts.length - 1];
    current[lastPart] = `[${langCode}] ${key.value}`;
  });

  return result;
}

/**
 * Parse translations from file content
 *
 * @param content File content as string
 * @returns Parsed translations object
 */
export function parseTranslations(content: string): TranslationRecord {
  try {
    const objMatch = content.match(/export default (\{[\s\S]*\})/);
    if (objMatch && objMatch[1]) {
      // Convert the string to a JavaScript object
      // Note: This is not safe for production, but works for our script
      return (Function(`return ${objMatch[1]}`)() as TranslationRecord);
    }
  } catch (error) {
    logger.error('Error parsing translation file:', { error });
  }
  return {};
}

/**
 * Extract all keys from a translations object
 *
 * @param obj Translations object
 * @param path Current path in the object hierarchy
 * @returns Array of key paths
 */
export function extractAllKeys(obj: TranslationRecord, path = ''): string[] {
  const keys: string[] = [];

  for (const key in obj) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Recursively extract keys from nested objects
      keys.push(...extractAllKeys(obj[key], currentPath));
    } else {
      // Add leaf key
      keys.push(currentPath);
    }
  }

  return keys;
}

/**
 * Find placeholder translations in a translations object
 *
 * @param translations Translations object
 * @param langCode Language code to check for placeholders
 * @param path Current path in the object hierarchy
 * @returns Array of placeholder translations
 */
export function findPlaceholderTranslations(translations: TranslationRecord, langCode: string, path = ''): string[] {
  const placeholders: string[] = [];

  for (const key in translations) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof translations[key] === 'object' && translations[key] !== null) {
      // If the value is an object, recursively check its keys
      placeholders.push(...findPlaceholderTranslations(translations[key], langCode, currentPath));
    } else if (typeof translations[key] === 'string') {
      // Check if the translation is a placeholder
      const value = translations[key] as string;
      if (value.startsWith(`[${langCode}]`)) {
        placeholders.push(`${currentPath}: "${value}"`);
      }
    }
  }

  return placeholders;
}

/**
 * Generate code for missing translations
 *
 * @param missingTranslations Missing translations object
 * @param existingTranslations Existing translations object
 * @returns Generated code as string
 */
export function generateMissingCode(
  missingTranslations: TranslationRecord,
  existingTranslations: TranslationRecord,
): string {
  let code = '';

  // Process top-level sections
  for (const section in missingTranslations) {
    if (typeof missingTranslations[section] === 'object') {
      // Check if this section exists in the existing translations
      if (!existingTranslations[section]) {
        // Add the entire section
        code += `  ${section}: ${JSON.stringify(missingTranslations[section], null, 2)},\n`;
      } else if (typeof existingTranslations[section] === 'object') {
        // Process nested sections
        const nestedCode = generateNestedCode(missingTranslations[section], existingTranslations[section], section);
        if (nestedCode) {
          code += nestedCode;
        }
      }
    } else if (existingTranslations[section] === undefined) {
      // Add simple key-value
      code += `  ${section}: "${missingTranslations[section]}",\n`;
    }
  }

  return code;
}

/**
 * Generate code for nested missing translations
 *
 * @param missing Missing translations object
 * @param existing Existing translations object
 * @param parentPath Parent path
 * @returns Generated code as string
 */
export function generateNestedCode(
  missing: TranslationRecord,
  existing: TranslationRecord,
  parentPath: string,
): string {
  let code = '';

  for (const key in missing) {
    if (typeof missing[key] === 'object') {
      if (!existing[key]) {
        // Add the entire nested object
        code += `  ${parentPath}: {\n    ...${parentPath},\n    ${key}: ${JSON.stringify(missing[key], null, 2)}\n  },\n`;
      } else if (typeof existing[key] === 'object') {
        // Recursively process nested objects
        const nestedCode = generateNestedCode(missing[key], existing[key], `${parentPath}.${key}`);
        if (nestedCode) {
          code += nestedCode;
        }
      }
    } else if (existing[key] === undefined) {
      // Add the key to the parent object
      code += `  ${parentPath}: {\n    ...${parentPath},\n    ${key}: "${missing[key]}"\n  },\n`;
    }
  }

  return code;
}

/**
 * Check for potential hardcoded text in a file
 *
 * @param content File content as string
 * @returns Array of potential hardcoded text
 */
export function checkForHardcodedText(content: string): { line: number; text: string }[] {
  const lines = content.split('\n');
  const results: { line: number; text: string }[] = [];

  // Regular expression to match potential hardcoded text in JSX
  const jsxTextRegex = />([A-Za-z0-9 ,.!?;:'"()-]+)</g;
  const stringLiteralRegex = /["']([A-Za-z0-9 ,.!?;:'"()-]{3,})["']/g;

  lines.forEach((line, index) => {
    // Skip comments and imports
    if (line.trim().startsWith('//') || line.includes('import ')) {
      return;
    }

    // Check for JSX text
    let match;
    while ((match = jsxTextRegex.exec(line)) !== null) {
      const text = match[1].trim();
      // Skip if it's just whitespace, a single character, or looks like a variable
      if (text && text.length > 1 && !text.startsWith('{') && !text.includes('${')) {
        results.push({ line: index + 1, text });
      }
    }

    // Check for string literals that might be UI text
    // This has more false positives, so we're more selective
    while ((match = stringLiteralRegex.exec(line)) !== null) {
      const text = match[1].trim();
      // Skip if it looks like a variable, path, or code
      if (
        text &&
        text.length > 3 &&
        !text.includes('/') &&
        !text.includes('.') &&
        !text.includes('_') &&
        !text.includes('-') &&
        text.match(/[A-Z]/) && // Has at least one uppercase letter
        text.match(/[a-z]/) && // Has at least one lowercase letter
        !line.includes('import') &&
        !line.includes('require') &&
        !line.includes('path')
      ) {
        results.push({ line: index + 1, text });
      }
    }
  });

  return results;
}

export default {
  checkKeysExist,
  findMissingKeys,
  generateMissingTranslations,
  parseTranslations,
  extractAllKeys,
  findPlaceholderTranslations,
  generateMissingCode,
  generateNestedCode,
  checkForHardcodedText,
};
