import en from './src/translations/en.ts';
import es from './src/translations/es.ts';

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

const enKeys = new Set(getAllKeys(en));
const esKeys = new Set(getAllKeys(es));

const missingKeys = [];
for (const key of enKeys) {
  if (!esKeys.has(key)) {
    missingKeys.push(key);
  }
}

console.log('Missing keys in Spanish:');
console.log('========================');
missingKeys.sort().forEach(key => {
  console.log(`  ${key}`);
});
console.log(`\nTotal missing: ${missingKeys.length}`);