/**
 * Example of using test caching in Playwright tests
 */

import { test, expect, cache } from '../helpers/cache-helper';

test.describe('Cached Test Examples', () => {
  // This test will be cached after first successful run
  test('basic cached test', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SpheroSeg/);
    
    // Test will be skipped on subsequent runs if:
    // 1. Test file hasn't changed
    // 2. Imported dependencies haven't changed
    // 3. Test passed previously
    // 4. Cache hasn't expired (24 hours)
  });

  // Force test to always run by invalidating cache
  test('always run test', async ({ page }, testInfo) => {
    // Invalidate cache for this specific test
    cache.invalidate(testInfo);
    
    await page.goto('/about');
    await expect(page.locator('h1')).toContainText('About');
  });

  // Conditionally run based on environment
  test('conditional cached test', async ({ page }, testInfo) => {
    // Skip cache in CI environment
    if (process.env.CI) {
      cache.invalidate(testInfo);
    }
    
    await page.goto('/sign-in');
    await expect(page.locator('form')).toBeVisible();
  });

  // Check if test is using cache
  test('cache status test', async ({ page }, testInfo) => {
    if (cache.isCached(testInfo)) {
      console.log('This test is using cached results');
    } else {
      console.log('This test is running fresh');
    }
    
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });
});

// Print cache statistics after all tests
test.afterAll(() => {
  const stats = cache.getStats();
  console.log('\nCache Statistics:');
  console.log(`Total tests cached: ${stats.total}`);
  console.log(`Passed: ${stats.passed}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Time saved: ${(stats.totalDuration / 1000).toFixed(2)}s`);
});

/**
 * Usage:
 * 
 * 1. Run tests normally:
 *    npm run test:e2e
 * 
 * 2. Clear cache and run:
 *    CLEAR_TEST_CACHE=1 npm run test:e2e
 * 
 * 3. Disable cache:
 *    DISABLE_TEST_CACHE=1 npm run test:e2e
 * 
 * 4. Show cache statistics:
 *    SHOW_CACHE_STATS=1 npm run test:e2e
 * 
 * 5. Run specific test without cache:
 *    npm run test:e2e -- --grep "always run test"
 */