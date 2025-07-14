#!/usr/bin/env node

/**
 * Post-build script to fix React module resolution in production
 * This ensures React is available globally and modules are properly resolved
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');

// Read the index.html
const indexPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Inject React globals before the main script
const reactGlobalsScript = `
    <script>
      // Production fix: Ensure React is available globally
      (function() {
        if (typeof window !== 'undefined') {
          // These will be populated by the bundled code
          window.React = window.React || {};
          window.ReactDOM = window.ReactDOM || {};
          window.ReactJSXRuntime = window.ReactJSXRuntime || {};
          
          // Polyfill for module loading
          if (!window.process) {
            window.process = { env: { NODE_ENV: 'production' } };
          }
        }
      })();
    </script>
`;

// Find the main script tag and inject our script before it
html = html.replace(/<script\s+type="module"/, reactGlobalsScript + '\n    <script type="module"');

// Write the updated HTML
fs.writeFileSync(indexPath, html);

console.log('✅ Fixed React globals in production build');

// Now process all JS files to fix module imports
const jsDir = path.join(distDir, 'assets/js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

jsFiles.forEach(file => {
  const filePath = path.join(jsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if this file has React imports that need fixing
  if (content.includes('from"react"') || content.includes('from "react"')) {
    console.log(`📝 Processing ${file}...`);
    
    // Replace module imports with global references
    content = content.replace(/import\s*\*\s*as\s+(\w+)\s+from\s*["']react["']/g, 'const $1 = window.React');
    content = content.replace(/import\s+(\w+)\s+from\s*["']react["']/g, 'const $1 = window.React');
    content = content.replace(/import\s*{\s*([^}]+)\s*}\s*from\s*["']react["']/g, (match, imports) => {
      const importList = imports.split(',').map(i => i.trim());
      return importList.map(imp => `const ${imp} = window.React.${imp}`).join('; ');
    });
    
    // Do the same for react-dom
    content = content.replace(/import\s*\*\s*as\s+(\w+)\s+from\s*["']react-dom["']/g, 'const $1 = window.ReactDOM');
    content = content.replace(/import\s+(\w+)\s+from\s*["']react-dom["']/g, 'const $1 = window.ReactDOM');
    
    fs.writeFileSync(filePath, content);
    console.log(`   ✅ Fixed imports in ${file}`);
  }
});

console.log('✅ Production build post-processing complete');