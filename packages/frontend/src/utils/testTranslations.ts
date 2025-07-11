// Test file to verify translations are loading correctly
import enTranslations from '@/translations/en';

export function testTranslations() {
  console.log('[testTranslations] Testing translation structure:');
  
  // Test if the translations object exists
  console.log('EN translations exists:', !!enTranslations);
  
  // The issue: these are looking at the default export directly
  // But i18next wraps them in a 'translation' namespace
  
  // Let's check the actual structure
  console.log('EN translations type:', typeof enTranslations);
  console.log('EN translations is object:', enTranslations && typeof enTranslations === 'object');
  
  // Check if it's a module with default export
  if (enTranslations && typeof enTranslations === 'object') {
    // If it has a default property, it might be a module
    if ('default' in enTranslations) {
      console.log('Has default export, checking default:', enTranslations.default);
      const actualTranslations = enTranslations.default;
      console.log('common.loadingApplication from default:', actualTranslations?.common?.loadingApplication);
    } else {
      // Direct access
      console.log('Direct access - common exists?', !!enTranslations.common);
      console.log('Direct access - common.loadingApplication:', enTranslations.common?.loadingApplication);
      console.log('Direct access - common.delete:', enTranslations.common?.delete);
      console.log('Direct access - projects.createProject:', enTranslations.projects?.createProject);
    }
  }
  
  // Log the full structure
  console.log('Top-level keys:', Object.keys(enTranslations || {}));
  
  return enTranslations;
}