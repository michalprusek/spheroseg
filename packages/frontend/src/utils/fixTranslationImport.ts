// Fix for translation import issues
// The problem: Static imports of .ts files with default exports can be wrapped by bundlers

export function getTranslationModule(module: any): any {
  // Handle various module formats
  if (!module) return {};
  
  // If it's already the translations object (has expected keys)
  if (module.common || module.projects || module.statsOverview) {
    return module;
  }
  
  // If it has a default export
  if (module.default) {
    return module.default;
  }
  
  // If it's a __esModule with default
  if (module.__esModule && module.default) {
    return module.default;
  }
  
  // Otherwise return as is
  return module;
}

// Test the fix
export function testTranslationFix() {
  try {
    // Use require to get the raw module
    const enModule = require('@/translations/en');
    const translations = getTranslationModule(enModule);
    
    console.log('[fixTest] Module analysis:', {
      moduleType: typeof enModule,
      hasDefault: 'default' in (enModule || {}),
      has__esModule: '__esModule' in (enModule || {}),
      directKeys: Object.keys(enModule || {}).slice(0, 10),
      translationKeys: Object.keys(translations || {}).slice(0, 10),
      commonExists: !!translations.common,
      testKey: translations.common?.loadingApplication
    });
    
    return translations;
  } catch (error) {
    console.error('[fixTest] Error:', error);
    return {};
  }
}