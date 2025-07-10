import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { testCache } from './playwright-cache.config';

/**
 * Custom Playwright reporter that updates test cache
 */
export default class TestCacheReporter implements Reporter {
  private startTime: Map<string, number> = new Map();

  onTestBegin(test: TestCase) {
    const testFile = test.location.file;
    
    // Check if test should be skipped due to cache
    if (!testCache.shouldRunTest(testFile)) {
      console.log(`⚡ Using cached result for: ${test.title}`);
      // Note: Playwright doesn't support skipping tests from reporter
      // This is just for logging, actual skipping needs to be done in test
    }
    
    this.startTime.set(test.id, Date.now());
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const testFile = test.location.file;
    const duration = Date.now() - (this.startTime.get(test.id) || 0);
    
    // Map Playwright status to our cache status
    let cacheStatus: 'passed' | 'failed' | 'skipped';
    if (result.status === 'passed') {
      cacheStatus = 'passed';
    } else if (result.status === 'skipped') {
      cacheStatus = 'skipped';
    } else {
      cacheStatus = 'failed';
    }
    
    // Extract error message if failed
    const error = result.errors.length > 0 
      ? result.errors.map(e => e.message).join('\n')
      : undefined;
    
    // Update cache
    testCache.updateTestResult(testFile, cacheStatus, duration, error);
    
    // Clean up
    this.startTime.delete(test.id);
  }

  onEnd() {
    console.log('\n📊 Test cache updated successfully');
  }
}