# Test Result Caching Documentation

## Overview

The test caching system improves development efficiency by caching successful test results and skipping unchanged tests in subsequent runs. This can significantly reduce test execution time during development.

## How It Works

1. **Hash Calculation**: For each test file, the system calculates an MD5 hash based on:
   - The test file content
   - All imported dependencies
   - Helper functions and fixtures

2. **Cache Storage**: Test results are stored in `.test-cache/playwright-cache.json` with:
   - File hash
   - Test result (passed/failed/skipped)
   - Execution duration
   - Timestamp
   - Error messages (for failed tests)

3. **Cache Invalidation**: Tests are re-run when:
   - The test file or its dependencies change
   - The test previously failed
   - The cache entry is older than 24 hours
   - Manual cache clearing is requested

## Usage

### Running Tests with Cache

```bash
# Run tests with caching enabled (default)
npm run test:e2e

# Alternative explicit command
npm run test:e2e:cached
```

### Clearing Cache

```bash
# Clear cache and run fresh tests
npm run test:e2e:fresh

# Or use environment variable
CLEAR_TEST_CACHE=1 npm run test:e2e
```

### Disabling Cache

```bash
# Run tests without using or updating cache
npm run test:e2e:nocache

# Or use environment variable
DISABLE_TEST_CACHE=1 npm run test:e2e
```

### Viewing Cache Statistics

```bash
# Show cache statistics without running tests
npm run test:e2e:stats

# Or use environment variable
SHOW_CACHE_STATS=1 npm run test:e2e
```

## Implementation Details

### Cache Configuration

Located in `playwright-cache.config.ts`:

```typescript
const CACHE_VERSION = '1.0.0';  // Increment to invalidate all cache
const CACHE_TTL = 24 * 60 * 60 * 1000;  // 24 hours
const CACHE_DIR = '.test-cache';
```

### Using Cache in Tests

```typescript
import { test, expect, cache } from '../helpers/cache-helper';

test('cached test example', async ({ page }, testInfo) => {
  // Force fresh run for this specific test
  if (needsFreshRun) {
    cache.invalidate(testInfo);
  }
  
  // Check if using cache
  if (cache.isCached(testInfo)) {
    console.log('Using cached result');
  }
  
  // Your test code here
  await page.goto('/');
  await expect(page).toHaveTitle(/SpheroSeg/);
});
```

### Cache File Format

```json
{
  "version": "1.0.0",
  "entries": {
    "e2e/routing/public-routes.spec.ts": {
      "hash": "a1b2c3d4e5f6...",
      "timestamp": 1704974400000,
      "result": "passed",
      "duration": 3456,
      "error": null
    }
  }
}
```

## Best Practices

1. **Development vs CI**:
   - Enable caching for local development
   - Disable caching in CI/CD pipelines
   - Use `process.env.CI` to detect CI environment

2. **Cache Management**:
   - Clear cache when upgrading dependencies
   - Clear cache after major refactoring
   - Monitor cache hit rate with stats command

3. **Test Design**:
   - Keep tests independent and deterministic
   - Avoid tests that depend on external state
   - Use fixtures for consistent test data

4. **Performance Monitoring**:
   - Review cache statistics regularly
   - Identify tests that never use cache (might be flaky)
   - Monitor time saved by caching

## Troubleshooting

### Cache Not Working

1. Check if caching is disabled:
   ```bash
   echo $DISABLE_TEST_CACHE
   ```

2. Verify cache file exists:
   ```bash
   ls -la .test-cache/playwright-cache.json
   ```

3. Check file permissions:
   ```bash
   chmod 644 .test-cache/playwright-cache.json
   ```

### Tests Running Despite Cache

Possible reasons:
- File or dependency changed
- Test previously failed
- Cache entry expired (>24 hours)
- Different test parameters

### Clearing Corrupt Cache

```bash
# Remove cache directory
rm -rf .test-cache

# Or manually delete cache file
rm .test-cache/playwright-cache.json
```

## Performance Impact

Example metrics from a typical test suite:

- **First Run**: 45 seconds (all tests run)
- **Cached Run**: 2 seconds (only changed tests run)
- **Time Saved**: 95% reduction in test time
- **Cache Hit Rate**: 85% in typical development

## Configuration Options

Environment variables:
- `CLEAR_TEST_CACHE`: Clear cache before running
- `DISABLE_TEST_CACHE`: Disable cache completely
- `SHOW_CACHE_STATS`: Show statistics without running
- `TEST_CACHE_TTL`: Override cache TTL (in ms)

## Future Improvements

1. **Distributed Cache**: Share cache across team members
2. **Smart Invalidation**: Detect which tests are affected by changes
3. **Cache Compression**: Reduce cache file size
4. **Visual Regression Cache**: Cache screenshot comparisons
5. **Parallel Cache Updates**: Update cache while tests run