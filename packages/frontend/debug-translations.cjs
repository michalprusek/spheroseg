const fs = require('fs');

// Read ES file
const esContent = fs.readFileSync('src/translations/es.ts', 'utf8');

// Check for specific keys
console.log('Checking ES file content:');
console.log('Contains "batch: {": ', esContent.includes('batch: {'));
console.log('Contains "mixed:": ', esContent.includes('mixed:'));
console.log('Contains "allSuccess:": ', esContent.includes('allSuccess:'));
console.log('Contains "allFailed:": ', esContent.includes('allFailed:'));
console.log('Contains "withoutSegmentation:": ', esContent.includes('withoutSegmentation:'));
console.log('Contains "processingImage:": ', esContent.includes('processingImage:'));

// Count lines
const lines = esContent.split('\n');
console.log('\nTotal lines in ES file:', lines.length);

// Find specific lines
lines.forEach((line, index) => {
  if (line.includes('batch:') || 
      line.includes('mixed:') || 
      line.includes('allSuccess:') ||
      line.includes('withoutSegmentation:') ||
      line.includes('processingImage:')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});