const fs = require('fs');
const path = require('path');

const validationPath = path.join('/app/src/middleware/validationMiddleware.ts');

// Read the current file
let content = fs.readFileSync(validationPath, 'utf-8');

// Replace the validation logic to only validate req.body
const updatedContent = content.replace(
  ,
  
);

// Write back to the file
fs.writeFileSync(validationPath, updatedContent, 'utf-8');

console.log('Validation middleware updated successfully!');
