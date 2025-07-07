# i18next Translation Loading Verification Guide

## Overview
This guide helps you verify that i18next translations are being properly loaded in your SpherosegV4 application.

## Current Setup Status

### ✅ What's Already Configured
1. **Translation Files Created**:
   - `/packages/frontend/public/locales/en/common.json` - English common translations
   - `/packages/frontend/public/locales/en/errors.json` - English error messages
   - `/packages/frontend/public/locales/cs/common.json` - Czech common translations
   - `/packages/frontend/public/locales/cs/errors.json` - Czech error messages

2. **Localization Service**:
   - `/packages/frontend/src/services/localizationService.ts` - Main service configured
   - Configured to load from `/locales/{{lng}}/{{ns}}.json`
   - Debug mode enabled for console logging

3. **Test Files Created**:
   - `/packages/frontend/public/translation-test.html` - Standalone HTML test page
   - `/packages/frontend/src/components/TranslationTest.tsx` - React component for testing
   - `/packages/frontend/src/test-i18n.js` - Node.js verification script

### ❌ Missing Dependencies
The following npm packages need to be installed:
```bash
npm install i18next react-i18next i18next-http-backend i18next-browser-languagedetector
```

## How to Verify Translations Are Loading

### 1. Install Missing Dependencies
```bash
cd /home/cvat/spheroseg/packages/frontend
npm install i18next react-i18next i18next-http-backend i18next-browser-languagedetector
```

### 2. Run the Node.js Verification Script
```bash
node src/test-i18n.js
```
This will check:
- If locale directories exist
- If translation files are valid JSON
- Configuration in localizationService.ts

### 3. Test in Browser (Standalone HTML)
1. Start the frontend development server:
   ```bash
   docker-compose up -d frontend-dev
   ```

2. Access the test page:
   ```
   http://localhost:3000/translation-test.html
   ```

3. Check the browser console (F12) for:
   - i18next initialization logs
   - Any 404 errors loading translation files
   - Debug messages showing loaded translations

### 4. Test in React Application
If you have a running React app, add the TranslationTest component to a route:
```tsx
import { TranslationTest } from '@/components/TranslationTest';

// Add to your routes
<Route path="/translation-test" element={<TranslationTest />} />
```

## What to Check in Browser Console

### Success Indicators
✅ You should see:
- `i18next: initialized` with language and namespace info
- HTTP 200 responses for `/locales/en/common.json` and `/locales/en/errors.json`
- Translation test showing actual translated text instead of keys

### Common Issues and Solutions

#### Issue 1: 404 Errors for Translation Files
**Symptom**: Network tab shows 404 for `/locales/en/common.json`
**Solution**: 
- Ensure the dev server serves the `public` directory
- Check that files exist at `/packages/frontend/public/locales/`
- Verify the server is running on the correct port

#### Issue 2: Translations Show Keys Instead of Values
**Symptom**: You see `test.message` instead of the actual translation
**Solution**:
- Check if the HTTP backend is installed
- Verify the `loadPath` in configuration matches file structure
- Check for JSON syntax errors in translation files

#### Issue 3: CORS Errors
**Symptom**: Console shows CORS policy errors
**Solution**:
- Ensure translations are served from the same domain
- Configure CORS headers if serving from different domain
- Use relative paths in `loadPath` configuration

## Updated localizationService.ts

If the original service has issues, use the fixed version:
```bash
cp src/services/localizationService-fixed.ts src/services/localizationService.ts
```

Key changes in the fixed version:
- Added `import HttpBackend from 'i18next-http-backend'`
- Added `.use(HttpBackend)` before initialization
- Enabled debug mode with `debug: true`

## Quick Debug Checklist

1. **Check Dependencies**:
   ```bash
   npm list i18next react-i18next i18next-http-backend
   ```

2. **Verify File Structure**:
   ```bash
   ls -la public/locales/en/
   ```

3. **Test HTTP Access**:
   ```bash
   curl http://localhost:3000/locales/en/common.json
   ```

4. **Check Browser Console**:
   - Open DevTools (F12)
   - Look for i18next debug messages
   - Check Network tab for translation file requests

5. **Verify Service Configuration**:
   - Check `loadPath` matches your file structure
   - Ensure namespaces match your JSON files
   - Verify language codes are correct

## Next Steps

Once translations are loading correctly:
1. Add more translation namespaces (forms, navigation, segmentation)
2. Implement language switching in the UI
3. Add translations for all supported languages
4. Set up translation management workflow
5. Consider using translation management tools

## Example Translation Structure

```json
// common.json
{
  "app": {
    "name": "SpherosegV4",
    "welcome": "Welcome to {{appName}}",
    "loading": "Loading..."
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit"
  }
}

// errors.json
{
  "validation": {
    "required": "This field is required",
    "email": "Invalid email address"
  },
  "api": {
    "networkError": "Network error. Please try again.",
    "serverError": "Server error occurred"
  }
}
```