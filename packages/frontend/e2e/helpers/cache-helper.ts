import { test as base, type TestInfo } from '@playwright/test';
import { testCache } from '../../playwright-cache.config';
import * as path from 'path';

/**
 * Extended test with caching support
 */
export const test = base.extend({
  // Auto-fixture that checks cache before each test
  checkCache: [async ({ }, use, testInfo) => {
    const testFile = testInfo.file;
    
    // Check if test should be skipped
    if (!testCache.shouldRunTest(testFile)) {
      console.log(`⚡ Skipping cached test: ${testInfo.title}`);
      testInfo.skip();
      return;
    }
    
    await use();
  }, { auto: true }],
});

// Re-export expect for convenience
export { expect } from '@playwright/test';

// Cache control utilities
export const cache = {
  /**
   * Force re-run of specific test
   */
  invalidate(testInfo: TestInfo) {
    testCache.clearTestCache(testInfo.file);
  },
  
  /**
   * Check if test is cached
   */
  isCached(testInfo: TestInfo): boolean {
    return !testCache.shouldRunTest(testInfo.file);
  },
  
  /**
   * Get cache statistics
   */
  getStats() {
    return testCache.getStats();
  },
};