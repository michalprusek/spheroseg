const fs = require('fs');
const path = require('path');

// Function to dynamically import ES modules
async function loadTranslations() {
  // Read the files as text and extract the default export
  const enContent = fs.readFileSync(path.join(__dirname, 'src/translations/en.ts'), 'utf-8');
  const zhContent = fs.readFileSync(path.join(__dirname, 'src/translations/zh.ts'), 'utf-8');
  
  // Extract the object after 'export default'
  const enMatch = enContent.match(/export default\s*({[\s\S]*});?\s*$/);
  const zhMatch = zhContent.match(/export default\s*({[\s\S]*});?\s*$/);
  
  if (!enMatch || !zhMatch) {
    throw new Error('Could not extract translation objects');
  }
  
  // Use eval to parse the objects (in a real app, use a proper parser)
  const en = eval('(' + enMatch[1] + ')');
  const zh = eval('(' + zhMatch[1] + ')');
  
  return { en, zh };
}

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

async function analyze() {
  try {
    const { en, zh } = await loadTranslations();
    
    const enKeys = getAllKeys(en).sort();
    const zhKeys = getAllKeys(zh).sort();
    
    const missingInZh = enKeys.filter(key => !zhKeys.includes(key));
    
    console.log('Total keys in English:', enKeys.length);
    console.log('Total keys in Chinese:', zhKeys.length);
    console.log('Missing keys in Chinese:', missingInZh.length);
    console.log('Coverage:', ((zhKeys.length / enKeys.length) * 100).toFixed(1) + '%');
    
    // Write missing keys to a file
    fs.writeFileSync('missing-zh-keys.txt', missingInZh.join('\n'));
    console.log('\nMissing keys written to missing-zh-keys.txt');
    
    // Show first 20 missing keys
    console.log('\nFirst 20 missing keys:');
    missingInZh.slice(0, 20).forEach(key => console.log('  -', key));
    
    if (missingInZh.length > 20) {
      console.log(`  ... and ${missingInZh.length - 20} more`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyze();