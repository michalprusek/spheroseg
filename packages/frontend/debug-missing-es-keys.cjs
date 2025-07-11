// Debug script to find missing keys in Spanish
const fs = require('fs');
const path = require('path');

// Load translations
const enPath = path.join(__dirname, 'src/translations/en.ts');
const esPath = path.join(__dirname, 'src/translations/es.ts');

const enContent = fs.readFileSync(enPath, 'utf8');
const esContent = fs.readFileSync(esPath, 'utf8');

// Extract default export
function extractTranslations(content) {
  const match = content.match(/export default\s*({[\s\S]*});?\s*$/);
  if (!match) return null;
  
  // Replace single quotes with double quotes and remove trailing commas
  let jsonStr = match[1]
    .replace(/'/g, '"')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/\[[\s\S]*?\]/g, (match) => match); // Keep arrays intact
  
  // Handle template literals
  jsonStr = jsonStr.replace(/`([^`]*)`/g, '"$1"');
  
  // Remove comments
  jsonStr = jsonStr.replace(/\/\/.*/g, '');
  jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '');
  
  try {
    return eval('(' + jsonStr + ')');
  } catch (e) {
    console.error('Failed to parse:', e);
    return null;
  }
}

// Get all keys from an object recursively
function getAllKeys(obj, prefix = '') {
  const keys = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

const enTranslations = extractTranslations(enContent);
const esTranslations = extractTranslations(esContent);

if (!enTranslations || !esTranslations) {
  console.error('Failed to parse translations');
  process.exit(1);
}

const enKeys = new Set(getAllKeys(enTranslations));
const esKeys = new Set(getAllKeys(esTranslations));

// Find missing keys
const missingKeys = [];
for (const key of enKeys) {
  if (!esKeys.has(key)) {
    missingKeys.push(key);
  }
}

console.log('Missing keys in Spanish:');
console.log('========================');
missingKeys.sort().forEach(key => {
  console.log(`  - ${key}`);
});
console.log(`\nTotal missing: ${missingKeys.length}`);