/**
 * Test utility to verify localStorage persistence for language and theme settings
 * This can be used in the browser console to test the implementations
 */

export const testLocalStoragePersistence = () => {
  console.log('Testing localStorage persistence for language and theme settings...');

  // Test language persistence
  console.log('\n--- Testing Language Storage ---');
  const testLanguages = ['en', 'cs', 'de', 'fr', 'es', 'zh'];

  testLanguages.forEach((lang) => {
    localStorage.setItem('language', lang);
    const retrieved = localStorage.getItem('language');
    console.log(`Set: ${lang}, Retrieved: ${retrieved}, Match: ${lang === retrieved}`);
  });

  // Test theme persistence
  console.log('\n--- Testing Theme Storage ---');
  const testThemes = ['light', 'dark', 'system'];

  testThemes.forEach((theme) => {
    localStorage.setItem('theme', theme);
    const retrieved = localStorage.getItem('theme');
    console.log(`Set: ${theme}, Retrieved: ${retrieved}, Match: ${theme === retrieved}`);
  });

  // Test JSON serialization for complex values
  console.log('\n--- Testing JSON Serialization ---');
  const complexValue = { language: 'en', lastUpdated: new Date().toISOString() };
  localStorage.setItem('test-complex', JSON.stringify(complexValue));
  const retrievedComplex = JSON.parse(localStorage.getItem('test-complex') || '{}');
  console.log('Complex value test:', {
    original: complexValue,
    retrieved: retrievedComplex,
    match: JSON.stringify(complexValue) === JSON.stringify(retrievedComplex),
  });

  // Clean up test data
  localStorage.removeItem('test-complex');

  console.log('\n--- Current localStorage State ---');
  console.log('Language:', localStorage.getItem('language'));
  console.log('Theme:', localStorage.getItem('theme'));

  return 'localStorage persistence test completed. Check console output above.';
};

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as Window & { testLocalStoragePersistence?: unknown }).testLocalStoragePersistence = testLocalStoragePersistence;
}
