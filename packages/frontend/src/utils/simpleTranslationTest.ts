// Simple test to debug translation import issue
const testImport = () => {
  console.log('[simpleTest] Testing direct require/import...');
  
  // Test 1: Direct property access
  try {
    const en = require('@/translations/en');
    console.log('[simpleTest] Require result:', {
      type: typeof en,
      isObject: en && typeof en === 'object',
      hasDefault: en && 'default' in en,
      directCommon: en?.common,
      defaultCommon: en?.default?.common,
      keys: en ? Object.keys(en).slice(0, 10) : []
    });
    
    // If it has default, use that
    const translations = en.default || en;
    console.log('[simpleTest] Actual translations:', {
      hasCommon: !!translations.common,
      commonKeys: translations.common ? Object.keys(translations.common).slice(0, 5) : [],
      loadingApp: translations.common?.loadingApplication,
      deleteKey: translations.common?.delete
    });
  } catch (error) {
    console.error('[simpleTest] Require failed:', error);
  }
};

// Run immediately
testImport();

export { testImport };