#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Helper function to deeply get nested object value
function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// Helper function to collect all keys from an object
function collectAllKeys(obj, prefix = '') {
  const keys = [];
  for (const key in obj) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...collectAllKeys(obj[key], currentPath));
    } else {
      keys.push(currentPath);
    }
  }
  return keys;
}

// Read and parse translation files
function loadTranslationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Extract the export default object
    const match = content.match(/export default\s+(\{[\s\S]*\});?\s*$/);
    if (!match) {
      console.error(`Could not parse translation file: ${filePath}`);
      return {};
    }
    
    // Use eval to parse the object (not safe for production, but OK for analysis)
    const translations = eval(`(${match[1]})`);
    return translations;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return {};
  }
}

// Load used translation keys
function loadUsedKeys() {
  try {
    const content = fs.readFileSync('/tmp/translation_keys_final.txt', 'utf8');
    return content.split('\n').filter(key => key.trim() !== '');
  } catch (error) {
    console.error('Error reading used keys file:', error.message);
    return [];
  }
}

// Analyze translations
function analyzeTranslations() {
  const basePath = '/home/cvat/spheroseg/spheroseg/packages/frontend/src/translations';
  
  console.log('🔍 Translation Key Analysis\n');
  console.log('=' .repeat(50));
  
  // Load English translations as reference
  const enTranslations = loadTranslationFile(path.join(basePath, 'en.ts'));
  const allEnKeys = collectAllKeys(enTranslations);
  
  // Load used keys
  const usedKeys = loadUsedKeys();
  
  console.log(`📊 Statistics:`);
  console.log(`   Available EN keys: ${allEnKeys.length}`);
  console.log(`   Used keys in code: ${usedKeys.length}`);
  console.log();
  
  // Find missing keys
  const missingKeys = [];
  const unusedKeys = [];
  
  // Check which used keys are missing from EN translations
  usedKeys.forEach(key => {
    const value = getNestedValue(enTranslations, key);
    if (value === undefined) {
      missingKeys.push(key);
    }
  });
  
  // Check which EN keys are never used
  allEnKeys.forEach(key => {
    if (!usedKeys.includes(key)) {
      unusedKeys.push(key);
    }
  });
  
  // Report missing keys
  if (missingKeys.length > 0) {
    console.log('❌ MISSING TRANSLATION KEYS:');
    console.log('   These keys are used in code but not found in en.ts:');
    console.log();
    missingKeys.sort().forEach(key => {
      console.log(`   • ${key}`);
    });
    console.log();
  } else {
    console.log('✅ No missing translation keys found!');
  }
  
  // Report unused keys (only if there are a lot)
  if (unusedKeys.length > 50) {
    console.log(`⚠️  POTENTIALLY UNUSED KEYS: ${unusedKeys.length} keys found`);
    console.log('   (These keys exist in en.ts but are not used in code)');
    console.log('   Run with --show-unused to see the full list');
    console.log();
  } else if (unusedKeys.length > 0) {
    console.log('⚠️  POTENTIALLY UNUSED KEYS:');
    unusedKeys.sort().forEach(key => {
      console.log(`   • ${key}`);
    });
    console.log();
  }
  
  // Check other language files for missing translations
  const languages = ['cs', 'de', 'es', 'fr', 'zh'];
  console.log('🌍 TRANSLATION COMPLETENESS BY LANGUAGE:');
  console.log();
  
  languages.forEach(lang => {
    const langTranslations = loadTranslationFile(path.join(basePath, `${lang}.ts`));
    const langKeys = collectAllKeys(langTranslations);
    const missingInLang = allEnKeys.filter(key => getNestedValue(langTranslations, key) === undefined);
    const extraInLang = langKeys.filter(key => getNestedValue(enTranslations, key) === undefined);
    
    const completeness = ((allEnKeys.length - missingInLang.length) / allEnKeys.length * 100).toFixed(1);
    
    console.log(`   ${lang.toUpperCase()}: ${completeness}% complete (${allEnKeys.length - missingInLang.length}/${allEnKeys.length})`);
    
    if (missingInLang.length > 0 && missingInLang.length <= 10) {
      console.log(`      Missing: ${missingInLang.slice(0, 5).join(', ')}${missingInLang.length > 5 ? ` +${missingInLang.length - 5} more` : ''}`);
    }
    
    if (extraInLang.length > 0) {
      console.log(`      Extra keys: ${extraInLang.length}`);
    }
  });
  
  console.log();
  
  // Check for duplicate keys (based on container logs)
  console.log('🔄 DUPLICATE KEY ISSUES (from container logs):');
  const duplicateIssues = [
    { file: 'en.ts', key: 'project', line: 877 },
    { file: 'zh.ts', key: 'project', line: 1140 },
    { file: 'fr.ts', key: 'project', line: 1070 },
    { file: 'cs.ts', key: 'success', line: 161 },
    { file: 'cs.ts', key: 'copyrightNotice', line: 738 },
    { file: 'cs.ts', key: 'developerLabel', line: 739 },
    { file: 'cs.ts', key: 'queue', line: 960 },
    { file: 'cs.ts', key: 'modes', line: 984 },
    { file: 'cs.ts', key: 'project', line: 1222 }
  ];
  
  console.log('   Found duplicate keys in translation files:');
  duplicateIssues.forEach(issue => {
    console.log(`   • ${issue.file}:${issue.line} - Duplicate key "${issue.key}"`);
  });
  
  return {
    missingKeys,
    unusedKeys,
    duplicateIssues,
    stats: {
      totalEnKeys: allEnKeys.length,
      totalUsedKeys: usedKeys.length,
      missingCount: missingKeys.length,
      unusedCount: unusedKeys.length
    }
  };
}

// Generate missing translation template
function generateMissingTemplate(missingKeys) {
  if (missingKeys.length === 0) return;
  
  console.log('\n📝 SUGGESTED ADDITIONS TO en.ts:');
  console.log('   Add these keys to your English translation file:');
  console.log();
  
  // Group keys by top-level section
  const sections = {};
  missingKeys.forEach(key => {
    const parts = key.split('.');
    const topLevel = parts[0];
    if (!sections[topLevel]) sections[topLevel] = [];
    sections[topLevel].push(key);
  });
  
  Object.keys(sections).sort().forEach(section => {
    console.log(`   ${section}: {`);
    sections[section].forEach(key => {
      const subPath = key.substring(section.length + 1);
      console.log(`     // TODO: Add translation for "${key}"`);
      console.log(`     ${subPath}: '${key.split('.').pop()}',`);
    });
    console.log(`   },`);
    console.log();
  });
}

// Main execution
if (require.main === module) {
  const results = analyzeTranslations();
  
  if (results.missingKeys.length > 0) {
    generateMissingTemplate(results.missingKeys);
  }
  
  console.log('\n📋 SUMMARY:');
  if (results.missingKeys.length > 0) {
    console.log(`   ❌ ${results.missingKeys.length} missing translation keys found`);
  } else {
    console.log(`   ✅ No missing translation keys`);
  }
  
  if (results.duplicateIssues.length > 0) {
    console.log(`   🔄 ${results.duplicateIssues.length} duplicate key issues found`);
  }
  
  console.log(`   📊 ${results.stats.totalUsedKeys} keys used, ${results.stats.totalEnKeys} keys available`);
  
  if (results.missingKeys.length > 0 || results.duplicateIssues.length > 0) {
    console.log('\n🚨 ACTION REQUIRED: Fix the issues above to resolve translation problems.');
    process.exit(1);
  } else {
    console.log('\n✅ Translation system appears to be working correctly!');
  }
}