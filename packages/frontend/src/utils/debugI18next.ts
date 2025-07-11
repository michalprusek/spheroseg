// Deep debug of i18next issue
export function debugI18next() {
  console.log('=== i18next Deep Debug ===');
  
  // Check if i18next exists
  const i18n = (window as any).i18next;
  if (!i18n) {
    console.error('i18next not found on window!');
    return;
  }
  
  console.log('1. i18next exists:', !!i18n);
  console.log('2. Is initialized:', i18n.isInitialized);
  console.log('3. Languages:', i18n.languages);
  console.log('4. Current language:', i18n.language);
  
  // Check resource store
  const store = i18n.services?.resourceStore;
  if (store) {
    console.log('5. Resource store exists:', !!store);
    console.log('6. Store data:', store.data);
    
    // Check EN translations
    const enData = store.data?.en;
    console.log('7. EN data exists:', !!enData);
    console.log('8. EN namespaces:', enData ? Object.keys(enData) : 'none');
    
    // Check translation namespace
    const translation = enData?.translation;
    console.log('9. Translation namespace exists:', !!translation);
    console.log('10. Translation keys (first 10):', translation ? Object.keys(translation).slice(0, 10) : 'none');
    
    // Try to access nested keys
    console.log('11. Direct access tests:');
    console.log('    - translation.common:', translation?.common);
    console.log('    - translation.common.loadingApplication:', translation?.common?.loadingApplication);
    
    // Show actual keys in common
    if (translation?.common) {
      console.log('    - Keys in common:', Object.keys(translation.common));
      console.log('    - Has loading?:', 'loading' in translation.common);
      console.log('    - Has loadingApplication?:', 'loadingApplication' in translation.common);
    }
    
    // Try getResource
    console.log('12. getResource tests:');
    console.log('    - getResource("en", "translation", "common"):', i18n.getResource('en', 'translation', 'common'));
    console.log('    - getResource("en", "translation", "common.loadingApplication"):', i18n.getResource('en', 'translation', 'common.loadingApplication'));
    
    // Try different key formats
    console.log('13. t() function tests:');
    console.log('    - t("common.loadingApplication"):', i18n.t('common.loadingApplication'));
    console.log('    - t("translation:common.loadingApplication"):', i18n.t('translation:common.loadingApplication'));
    console.log('    - t("loadingApplication", {ns: "translation", context: "common"}):', i18n.t('loadingApplication', {ns: 'translation', context: 'common'}));
    
    // Check options
    console.log('14. i18next options:', i18n.options);
  }
  
  console.log('=== End Debug ===');
}

// Auto-run after delay
if (typeof window !== 'undefined') {
  (window as any).debugI18next = debugI18next;
  
  // Run automatically after 2 seconds
  setTimeout(() => {
    console.log('Running automatic i18next debug...');
    debugI18next();
  }, 2000);
}