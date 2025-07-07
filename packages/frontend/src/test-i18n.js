#!/usr/bin/env node

/**
 * Test script to verify i18n translation loading
 * Run with: node src/test-i18n.js
 */

const fs = require('fs');
const path = require('path');

console.log('Testing i18n Translation Loading...\n');

// Check if locale directories exist
const localesPath = path.join(__dirname, '../public/locales');
console.log(`1. Checking locales directory: ${localesPath}`);

if (!fs.existsSync(localesPath)) {
    console.error('   ❌ Locales directory does not exist!');
    console.log('   Creating directory...');
    fs.mkdirSync(localesPath, { recursive: true });
} else {
    console.log('   ✅ Locales directory exists');
}

// Check available languages
console.log('\n2. Checking available languages:');
const languages = fs.readdirSync(localesPath).filter(file => {
    return fs.statSync(path.join(localesPath, file)).isDirectory();
});

if (languages.length === 0) {
    console.error('   ❌ No language directories found!');
} else {
    languages.forEach(lang => {
        console.log(`   ✅ ${lang}`);
        
        // Check translation files for each language
        const langPath = path.join(localesPath, lang);
        const files = fs.readdirSync(langPath).filter(file => file.endsWith('.json'));
        
        files.forEach(file => {
            const filePath = path.join(langPath, file);
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const keyCount = countKeys(content);
                console.log(`      - ${file}: ${keyCount} keys`);
            } catch (error) {
                console.error(`      - ${file}: ❌ Invalid JSON!`);
            }
        });
    });
}

// Check if translations can be loaded via HTTP
console.log('\n3. Testing HTTP access to translations:');
console.log('   To test HTTP access, the frontend server must be running.');
console.log('   Expected URLs:');
languages.forEach(lang => {
    console.log(`   - http://localhost:3000/locales/${lang}/common.json`);
    console.log(`   - http://localhost:3000/locales/${lang}/errors.json`);
});

// Check translation service configuration
console.log('\n4. Checking localizationService configuration:');
const servicePath = path.join(__dirname, 'services/localizationService.ts');
if (fs.existsSync(servicePath)) {
    console.log('   ✅ localizationService.ts exists');
    const content = fs.readFileSync(servicePath, 'utf8');
    
    // Check for backend configuration
    if (content.includes("loadPath: '/locales/{{lng}}/{{ns}}.json'")) {
        console.log('   ✅ Backend loadPath is correctly configured');
    } else {
        console.error('   ❌ Backend loadPath might be misconfigured');
    }
    
    // Check for namespaces
    const nsMatch = content.match(/ns:\s*\[(.*?)\]/);
    if (nsMatch) {
        console.log(`   ✅ Configured namespaces: ${nsMatch[1]}`);
    }
} else {
    console.error('   ❌ localizationService.ts not found!');
}

// Provide recommendations
console.log('\n5. Recommendations:');
console.log('   - Ensure the frontend dev server serves the public directory');
console.log('   - Check browser console for 404 errors when loading translations');
console.log('   - Verify CORS settings if translations are served from a different domain');
console.log('   - Use browser DevTools Network tab to monitor translation file requests');
console.log('   - Enable i18next debug mode by setting debug: true in initialization');

console.log('\n6. Testing in browser:');
console.log('   Open http://localhost:3000/translation-test.html to test translations');
console.log('   (Make sure the frontend dev server is running)');

// Helper function to count keys in nested object
function countKeys(obj, count = 0) {
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            count = countKeys(obj[key], count);
        } else {
            count++;
        }
    }
    return count;
}