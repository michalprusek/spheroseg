#!/usr/bin/env node

/**
 * Test script to verify Redis caching functionality
 * 
 * This script tests:
 * 1. Redis connection
 * 2. Basic cache operations (set, get, delete)
 * 3. TTL functionality
 * 4. Pattern-based operations
 * 5. Cache statistics
 */

import { initializeRedis, closeRedis } from '../config/redis';
import { cacheService, CACHE_TTL } from '../services/cacheService';
import logger from '../utils/logger';

async function testRedisCaching(): Promise<void> {
  console.log('🔧 Starting Redis cache test...\n');

  try {
    // Initialize Redis
    console.log('1. Initializing Redis connection...');
    const redis = initializeRedis();
    
    if (!redis) {
      console.error('❌ Redis is disabled or failed to initialize');
      return;
    }
    
    console.log('✅ Redis initialized successfully\n');

    // Test basic operations
    console.log('2. Testing basic cache operations...');
    
    // Set a value
    const testKey = 'test:user:123';
    const testData = {
      id: '123',
      name: 'Test User',
      email: 'test@example.com',
      created: new Date().toISOString(),
    };
    
    await cacheService.set(testKey, testData, CACHE_TTL.SHORT);
    console.log('✅ Set test data in cache');

    // Get the value
    const retrieved = await cacheService.get(testKey);
    console.log('✅ Retrieved data from cache:', retrieved);

    // Check if values match
    if (JSON.stringify(testData) === JSON.stringify(retrieved)) {
      console.log('✅ Cache data matches original\n');
    } else {
      console.error('❌ Cache data does not match original\n');
    }

    // Test TTL
    console.log('3. Testing TTL functionality...');
    const ttl = await cacheService.getTTL(testKey);
    console.log(`✅ TTL for key: ${ttl} seconds\n`);

    // Test pattern operations
    console.log('4. Testing pattern-based operations...');
    
    // Set multiple keys
    await cacheService.set('test:project:1', { id: 1, name: 'Project 1' }, CACHE_TTL.MEDIUM);
    await cacheService.set('test:project:2', { id: 2, name: 'Project 2' }, CACHE_TTL.MEDIUM);
    await cacheService.set('test:project:3', { id: 3, name: 'Project 3' }, CACHE_TTL.MEDIUM);
    
    // Get keys by pattern
    const projectKeys = await cacheService.keys('test:project:*');
    console.log(`✅ Found ${projectKeys.length} project keys`);

    // Delete by pattern
    const deletedCount = await cacheService.delPattern('test:project:*');
    console.log(`✅ Deleted ${deletedCount} keys by pattern\n`);

    // Test cache wrapper
    console.log('5. Testing cache wrapper function...');
    
    let callCount = 0;
    const expensiveOperation = async () => {
      callCount++;
      console.log('  - Executing expensive operation...');
      return { result: 'expensive data', timestamp: Date.now() };
    };

    // First call should execute the function
    const result1 = await cacheService.cached('test:expensive', expensiveOperation, CACHE_TTL.SHORT);
    console.log('  - First call result:', result1);

    // Second call should use cache
    const result2 = await cacheService.cached('test:expensive', expensiveOperation, CACHE_TTL.SHORT);
    console.log('  - Second call result:', result2);

    if (callCount === 1) {
      console.log('✅ Cache wrapper working correctly (function called only once)\n');
    } else {
      console.error(`❌ Cache wrapper issue (function called ${callCount} times)\n`);
    }

    // Get cache statistics
    console.log('6. Cache statistics:');
    const stats = await cacheService.getStats();
    console.log('  - Stats:', stats);

    // Cleanup
    console.log('\n7. Cleaning up test data...');
    await cacheService.del(testKey);
    await cacheService.del('test:expensive');
    console.log('✅ Test data cleaned up');

    // Close Redis connection
    await closeRedis();
    console.log('✅ Redis connection closed');

    console.log('\n✨ All Redis cache tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Redis cache test failed:', error);
    logger.error('Redis cache test error', { error });
    
    try {
      await closeRedis();
    } catch (closeError) {
      console.error('Failed to close Redis connection:', closeError);
    }
    
    process.exit(1);
  }
}

// Run the test
testRedisCaching()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });