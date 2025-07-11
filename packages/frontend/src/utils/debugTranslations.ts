// Debug translation imports to understand the issue
export async function debugTranslationImports() {
  console.log('[debugTranslations] Starting comprehensive debug...');
  
  // Test 1: Dynamic import
  try {
    const dynamicImport = await import('@/translations/en');
    console.log('[debugTranslations] Dynamic import result:', {
      type: typeof dynamicImport,
      hasDefault: 'default' in dynamicImport,
      keys: Object.keys(dynamicImport),
      default: dynamicImport.default,
      commonExists: !!(dynamicImport.default?.common),
      sampleKey: dynamicImport.default?.common?.loadingApplication
    });
  } catch (error) {
    console.error('[debugTranslations] Dynamic import failed:', error);
  }
  
  // Test 2: Check i18next resource store
  try {
    // @ts-ignore - accessing internal i18next
    if (window.i18next && window.i18next.services?.resourceStore?.data) {
      const resourceData = window.i18next.services.resourceStore.data;
      console.log('[debugTranslations] i18next resource store:', {
        languages: Object.keys(resourceData),
        enNamespaces: resourceData.en ? Object.keys(resourceData.en) : [],
        enTranslationKeys: resourceData.en?.translation ? Object.keys(resourceData.en.translation).slice(0, 10) : [],
        commonLoadingApp: resourceData.en?.translation?.common?.loadingApplication
      });
    }
  } catch (error) {
    console.error('[debugTranslations] i18next check failed:', error);
  }
}

// Add to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).debugTranslations = debugTranslationImports;
}