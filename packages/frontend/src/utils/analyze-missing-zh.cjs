const fs = require('fs');
const path = require('path');

// Function to flatten nested object
function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre));
    } else {
      acc[pre] = obj[k];
    }
    return acc;
  }, {});
}

// Load translations
const enPath = path.join(process.cwd(), 'src/translations/en.ts');
const zhPath = path.join(process.cwd(), 'src/translations/zh.ts');

const enContent = fs.readFileSync(enPath, 'utf-8');
const zhContent = fs.readFileSync(zhPath, 'utf-8');

// Extract default export
const enMatch = enContent.match(/export\s+default\s+(\{[\s\S]*\});?\s*$/);
const zhMatch = zhContent.match(/export\s+default\s+(\{[\s\S]*\});?\s*$/);

if (!enMatch || !zhMatch) {
  console.error('Could not parse translation files');
  process.exit(1);
}

// Parse translations
const enTranslations = new Function('return ' + enMatch[1])();
const zhTranslations = new Function('return ' + zhMatch[1])();

// Flatten objects
const enFlat = flattenObject(enTranslations);
const zhFlat = flattenObject(zhTranslations);

// Find missing keys
const enKeys = Object.keys(enFlat);
const zhKeys = Object.keys(zhFlat);

const missing = enKeys.filter(key => !zhKeys.includes(key));

console.log('Missing keys in Chinese translation:');
console.log('Total missing:', missing.length);
console.log('\nMissing keys by section:');

// Group by section
const sections = {};
missing.forEach(key => {
  const section = key.split('.')[0];
  if (!sections[section]) sections[section] = [];
  sections[section].push(key);
});

Object.entries(sections).forEach(([section, keys]) => {
  console.log('\n' + section + ' (' + keys.length + ' keys):');
  keys.slice(0, 10).forEach(key => console.log('  - ' + key));
  if (keys.length > 10) console.log('  ... and ' + (keys.length - 10) + ' more');
});

// Output all missing keys for reference
console.log('\n\nAll missing keys:');
missing.forEach(key => {
  const enValue = enFlat[key];
  console.log(`${key}: '${enValue}'`);
});