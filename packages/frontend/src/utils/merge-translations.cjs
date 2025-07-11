const fs = require('fs');
const path = require('path');

// Function to merge two objects deeply
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
          result[key] = deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      } else {
        // If key doesn't exist in target or is a primitive, add/overwrite it
        if (!(key in result)) {
          result[key] = source[key];
        }
        // If key exists in both, keep the first occurrence (original)
      }
    }
  }
  
  return result;
}

// Read the English translation file
const filePath = path.join(__dirname, '../translations/en.ts');
const content = fs.readFileSync(filePath, 'utf-8');

// Parse the file content to extract the object
const match = content.match(/export\s+default\s+(\{[\s\S]*\});?\s*$/);
if (!match) {
  console.error('Could not parse translation file');
  process.exit(1);
}

// Use Function constructor to evaluate the object
let translations;
try {
  translations = new Function(`return ${match[1]}`)();
} catch (error) {
  console.error('Error parsing translations:', error);
  process.exit(1);
}

// Find duplicate keys
const duplicates = new Set();
const lines = content.split('\n');
const keyPattern = /^\s*(\w+):\s*\{/;
const keyOccurrences = {};

lines.forEach((line, index) => {
  const match = line.match(keyPattern);
  if (match) {
    const key = match[1];
    if (!keyOccurrences[key]) {
      keyOccurrences[key] = [];
    }
    keyOccurrences[key].push(index + 1);
  }
});

// Find actual duplicates
for (const [key, occurrences] of Object.entries(keyOccurrences)) {
  if (occurrences.length > 1) {
    duplicates.add(key);
    console.log(`Duplicate key "${key}" found at lines: ${occurrences.join(', ')}`);
  }
}

// Now we need to manually extract and merge the duplicate sections
// This is a complex operation that requires parsing the actual structure

// For now, let's output the duplicates found
console.log('\nTotal duplicate top-level keys:', duplicates.size);
console.log('Duplicates:', Array.from(duplicates).join(', '));

// Create a cleaned version by keeping only the first occurrence of each key
const cleanedLines = [];
const seenKeys = new Set();
let insideObject = false;
let currentKey = null;
let braceCount = 0;
let skipSection = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const keyMatch = line.match(keyPattern);
  
  if (keyMatch && braceCount === 1) {
    currentKey = keyMatch[1];
    if (seenKeys.has(currentKey)) {
      console.log(`Skipping duplicate section: ${currentKey} at line ${i + 1}`);
      skipSection = true;
    } else {
      seenKeys.add(currentKey);
      skipSection = false;
    }
  }
  
  // Count braces to track nesting
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  // Skip lines in duplicate sections
  if (!skipSection || braceCount === 0) {
    cleanedLines.push(line);
  }
  
  // Reset when we exit a top-level section
  if (braceCount === 1 && line.includes('},')) {
    skipSection = false;
  }
}

// Write the cleaned content to a new file
const outputPath = path.join(__dirname, '../translations/en-cleaned.ts');
fs.writeFileSync(outputPath, cleanedLines.join('\n'), 'utf-8');

console.log(`\nCleaned translation file written to: ${outputPath}`);
console.log('Please review the file and rename it to en.ts after verification.');