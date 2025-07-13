import { PlaywrightTestConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test caching configuration for Playwright
 * Caches test results based on file content hashes
 */

interface CacheEntry {
  hash: string;
  timestamp: number;
  result: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface TestCache {
  version: string;
  entries: Record<string, CacheEntry>;
}

const CACHE_DIR = path.join(__dirname, '.test-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'playwright-cache.json');
const CACHE_VERSION = '1.0.0';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Load existing cache
function loadCache(): TestCache {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache = JSON.parse(data) as TestCache;
      
      // Check cache version
      if (cache.version !== CACHE_VERSION) {
        console.log('Cache version mismatch, clearing cache');
        return { version: CACHE_VERSION, entries: {} };
      }
      
      // Clean expired entries
      const now = Date.now();
      const validEntries: Record<string, CacheEntry> = {};
      
      for (const [key, entry] of Object.entries(cache.entries)) {
        if (now - entry.timestamp < CACHE_TTL) {
          validEntries[key] = entry;
        }
      }
      
      return { version: CACHE_VERSION, entries: validEntries };
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  
  return { version: CACHE_VERSION, entries: {} };
}

// Save cache
function saveCache(cache: TestCache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

// Calculate file hash
function calculateFileHash(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    console.error(`Error hashing file ${filePath}:`, error);
    return '';
  }
}

// Get test dependencies (imported files)
function getTestDependencies(testFile: string): string[] {
  const dependencies: string[] = [testFile];
  
  try {
    const content = fs.readFileSync(testFile, 'utf-8');
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(testFile), importPath);
        const possiblePaths = [
          resolvedPath,
          `${resolvedPath}.ts`,
          `${resolvedPath}.tsx`,
          `${resolvedPath}.js`,
          `${resolvedPath}.jsx`,
          path.join(resolvedPath, 'index.ts'),
          path.join(resolvedPath, 'index.tsx'),
        ];
        
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            dependencies.push(p);
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error getting dependencies for ${testFile}:`, error);
  }
  
  return dependencies;
}

// Calculate combined hash for test and its dependencies
function calculateTestHash(testFile: string): string {
  const dependencies = getTestDependencies(testFile);
  const hashes = dependencies.map(dep => calculateFileHash(dep));
  return crypto.createHash('md5').update(hashes.join('')).digest('hex');
}

// Export cache utilities
export const testCache = {
  load: loadCache,
  save: saveCache,
  
  // Check if test needs to run
  shouldRunTest(testFile: string): boolean {
    const cache = loadCache();
    const testKey = path.relative(__dirname, testFile);
    const currentHash = calculateTestHash(testFile);
    
    const cacheEntry = cache.entries[testKey];
    if (!cacheEntry) {
      return true; // No cache entry, run test
    }
    
    if (cacheEntry.hash !== currentHash) {
      return true; // File changed, run test
    }
    
    if (cacheEntry.result === 'failed') {
      return true; // Always re-run failed tests
    }
    
    // Test is cached and passed
    console.log(`Skipping cached test: ${testKey} (passed in ${cacheEntry.duration}ms)`);
    return false;
  },
  
  // Update cache with test result
  updateTestResult(
    testFile: string,
    result: 'passed' | 'failed' | 'skipped',
    duration: number,
    error?: string
  ) {
    const cache = loadCache();
    const testKey = path.relative(__dirname, testFile);
    const hash = calculateTestHash(testFile);
    
    cache.entries[testKey] = {
      hash,
      timestamp: Date.now(),
      result,
      duration,
      error,
    };
    
    saveCache(cache);
  },
  
  // Clear cache for specific test
  clearTestCache(testFile: string) {
    const cache = loadCache();
    const testKey = path.relative(__dirname, testFile);
    delete cache.entries[testKey];
    saveCache(cache);
  },
  
  // Clear all cache
  clearAllCache() {
    saveCache({ version: CACHE_VERSION, entries: {} });
  },
  
  // Get cache statistics
  getStats() {
    const cache = loadCache();
    const stats = {
      total: Object.keys(cache.entries).length,
      passed: 0,
      failed: 0,
      skipped: 0,
      totalDuration: 0,
    };
    
    for (const entry of Object.values(cache.entries)) {
      stats[entry.result]++;
      stats.totalDuration += entry.duration;
    }
    
    return stats;
  },
};

// Export modified Playwright config with caching
export function createCachedConfig(baseConfig: PlaywrightTestConfig): PlaywrightTestConfig {
  // Initialize cache stats on load
  console.log('Initializing test cache...');
  const stats = testCache.getStats();
  console.log(`Cache stats: ${stats.total} tests cached (${stats.passed} passed, ${stats.failed} failed)`);
  
  return {
    ...baseConfig,
    
    // Keep existing reporters from base config (already includes test-cache-reporter)
  };
}