# Cache Warming and Invalidation Guide

## Overview

SpherosegV4 implements an advanced cache management system with automatic warming, intelligent invalidation patterns, and multiple caching strategies. The system improves performance by preloading frequently accessed data and ensures data consistency through smart invalidation.

## Features

- **Cache Warming**: Preload critical data on startup and at regular intervals
- **Intelligent Invalidation**: Pattern-based and tag-based cache invalidation
- **Multiple Strategies**: Cache-aside, write-through, refresh-ahead, and more
- **Compression**: Automatic compression for large cached values
- **Distributed Invalidation**: Multi-instance cache coherence via Redis pub/sub
- **Circuit Breaker**: Return stale data during failures
- **Performance Monitoring**: Hit rates, miss rates, and cache statistics

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Application    │────▶│ Cache Manager   │────▶│     Redis       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       ▼                        ▼
         │              ┌─────────────────┐     ┌─────────────────┐
         └─────────────▶│Cache Strategies │     │  Pub/Sub Bus    │
                        └─────────────────┘     └─────────────────┘
```

## Cache Configurations

### User Cache
```javascript
{
  name: 'advanced_users',
  ttl: 3600, // 1 hour
  warmOnStartup: true,
  warmingInterval: 30, // Every 30 minutes
  compressionThreshold: 1024 // Compress if > 1KB
}
```

Warming query:
```sql
SELECT id, email, name, role, organization_id
FROM users
WHERE active = true
AND last_login > NOW() - INTERVAL '7 days'
LIMIT 1000
```

### Project Statistics Cache
```javascript
{
  name: 'advanced_projectStats',
  ttl: 1800, // 30 minutes
  warmOnStartup: true,
  warmingInterval: 15, // Every 15 minutes
  compressionThreshold: 2048
}
```

### Image Metadata Cache
```javascript
{
  name: 'advanced_images',
  ttl: 7200, // 2 hours
  warmOnStartup: false, // Too many to warm
  compressionThreshold: 2048,
  maxMemory: 100 // Limit to 100MB
}
```

### Segmentation Results Cache
```javascript
{
  name: 'advanced_segmentation',
  ttl: 86400, // 24 hours
  warmOnStartup: false,
  compressionThreshold: 5120,
  maxMemory: 200 // Limit to 200MB
}
```

## Caching Strategies

### 1. Cache-Aside (Lazy Loading)
Most common pattern - check cache first, fetch if miss.

```typescript
const strategy = strategyFactory.createStrategy('cache-aside', 'users');
const user = await strategy.execute(
  userId.toString(),
  async () => {
    // Fetch from database
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0];
  }
);
```

### 2. Write-Through
Write to cache and database simultaneously.

```typescript
const strategy = strategyFactory.createStrategy('write-through', 'users');
await strategy.execute(
  userId.toString(),
  async () => {
    // Update database and return new data
    const result = await pool.query(
      'UPDATE users SET name = $2 WHERE id = $1 RETURNING *',
      [userId, newName]
    );
    return result.rows[0];
  }
);
```

### 3. Refresh-Ahead
Proactively refresh cache before expiration.

```typescript
const strategy = strategyFactory.createStrategy('refresh-ahead', 'images', {
  refreshRatio: 0.8 // Refresh when 80% of TTL has passed
});
```

### 4. Multi-Level Cache
Uses both in-memory and Redis cache.

```typescript
const strategy = strategyFactory.createStrategy('multi-level', 'users', {
  memoryTTL: 60 // 60 seconds in memory
});
```

### 5. Circuit Breaker
Returns stale cache on failure.

```typescript
const strategy = strategyFactory.createStrategy('circuit-breaker', 'segmentation', {
  failureThreshold: 3,
  resetTimeMs: 30000,
  staleTTL: 86400 // Keep stale data for 24 hours
});
```

### 6. Distributed Lock
Prevents cache stampede.

```typescript
const strategy = strategyFactory.createStrategy('distributed-lock', 'users', {
  lockTTL: 5 // 5 second lock
});
```

## Cache Warming

### Startup Warming
Caches marked with `warmOnStartup: true` are automatically warmed when the application starts.

```typescript
// In startup module
const warmingResults = await cacheManager.warmAllCaches();
```

### Scheduled Warming
Caches with `warmingInterval` are warmed periodically.

```javascript
{
  warmingInterval: 30 // Warm every 30 minutes
}
```

### Manual Warming
Trigger cache warming on demand:

```typescript
await cacheManager.warmCache('advanced_users');
```

### Warming Function
Each cache can have a custom warming function:

```typescript
cacheManager.registerCache(
  config,
  async () => {
    // Return a Map of key-value pairs to cache
    const users = await fetchActiveUsers();
    const dataMap = new Map();
    for (const user of users) {
      dataMap.set(user.id.toString(), user);
    }
    return dataMap;
  }
);
```

## Cache Invalidation

### Pattern-Based Invalidation
Invalidate all keys matching a pattern:

```typescript
// Invalidate all user caches
await cacheManager.invalidate('user:*');

// Invalidate specific project
await cacheManager.invalidate(`project:${projectId}`);
```

### Tag-Based Invalidation
Invalidate all keys with specific tags:

```typescript
// Cache with tags
await cacheManager.set('users', userId, userData, ['user:123', 'role:admin']);

// Invalidate by tags
await cacheManager.invalidateByTags(['role:admin']);
```

### Automatic Invalidation Patterns
Configure automatic invalidation patterns:

```javascript
{
  invalidationPatterns: ['user:*', 'role:*']
}
```

### Distributed Invalidation
Cache invalidations are automatically broadcast to all application instances:

```typescript
// This broadcasts to all instances
await cacheManager.invalidate('user:123', true);

// This only invalidates locally
await cacheManager.invalidate('user:123', false);
```

## Usage Examples

### Get User with Caching
```typescript
async getUserById(userId: number): Promise<User> {
  const strategy = strategyFactory.createStrategy('multi-level', 'users');
  
  return strategy.execute(
    userId.toString(),
    async () => {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0];
    },
    { tags: [`user:${userId}`] }
  );
}
```

### Update User with Cache Invalidation
```typescript
async updateUser(userId: number, data: any): Promise<User> {
  // Update database
  const result = await pool.query(
    'UPDATE users SET name = $2 WHERE id = $1 RETURNING *',
    [userId, data.name]
  );
  
  // Invalidate related caches
  await cacheManager.invalidateByTags([`user:${userId}`]);
  
  return result.rows[0];
}
```

### Get Segmentation with Circuit Breaker
```typescript
async getSegmentationResults(imageId: number): Promise<any> {
  const strategy = strategyFactory.createStrategy('circuit-breaker', 'segmentation', {
    failureThreshold: 3,
    resetTimeMs: 30000
  });
  
  return strategy.execute(
    imageId.toString(),
    async () => {
      // Complex query that might fail
      return await fetchSegmentationData(imageId);
    },
    { 
      staleTTL: 86400 // Keep stale for 24 hours
    }
  );
}
```

## Monitoring and Statistics

### Get Cache Statistics
```typescript
const stats = await cacheManager.getCacheStats();
// Returns Map with stats for each cache:
// {
//   hits: 1000,
//   misses: 100,
//   hitRate: 0.91,
//   size: 1048576,
//   itemCount: 500
// }
```

### Monitor Cache Events
```typescript
cacheManager.on('cacheWarmed', ({ cacheName, itemsWarmed, duration }) => {
  console.log(`Cache ${cacheName} warmed with ${itemsWarmed} items in ${duration}ms`);
});

cacheManager.on('invalidated', ({ pattern, keysDeleted }) => {
  console.log(`Pattern ${pattern} invalidated ${keysDeleted} keys`);
});
```

## Configuration Best Practices

### 1. TTL Configuration
- **Short-lived data** (5-10 minutes): User sessions, real-time stats
- **Medium-lived data** (30-60 minutes): User profiles, project lists
- **Long-lived data** (hours-days): Segmentation results, historical data

### 2. Warming Strategy
- **Warm on startup**: Critical data needed immediately
- **Scheduled warming**: Frequently accessed data
- **No warming**: Large datasets, infrequently accessed data

### 3. Compression Thresholds
- **Small objects** (<1KB): No compression
- **Medium objects** (1-5KB): Compress if frequently accessed
- **Large objects** (>5KB): Always compress

### 4. Memory Limits
Set `maxMemory` for caches that might grow unbounded:
```javascript
{
  maxMemory: 100 // MB
}
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Set memory limits on caches
   - Reduce TTL for large objects
   - Enable compression

2. **Cache Stampede**
   - Use distributed-lock strategy
   - Implement refresh-ahead for critical data

3. **Stale Data**
   - Verify invalidation patterns
   - Check distributed invalidation is working
   - Reduce TTL if needed

4. **Poor Hit Rate**
   - Increase TTL for stable data
   - Implement cache warming
   - Use refresh-ahead strategy

### Debug Logging
Enable debug logging for cache operations:
```typescript
// In logger configuration
{
  level: 'debug',
  // Cache operations will be logged
}
```

### Performance Tuning

1. **Batch Operations**
```typescript
// Instead of multiple gets
const users = await Promise.all(
  userIds.map(id => cacheManager.get('users', id))
);

// Use warming to batch load
await cacheManager.warmCache('users');
```

2. **Compression Tuning**
Monitor compression ratio and adjust thresholds:
```typescript
// Log compression events
cacheManager.on('itemSet', ({ compressed, key }) => {
  if (compressed) {
    logger.info(`Compressed cache item: ${key}`);
  }
});
```

3. **Invalidation Optimization**
Use specific patterns instead of wildcards:
```typescript
// Good - specific
await cacheManager.invalidate(`user:${userId}`);

// Avoid - too broad
await cacheManager.invalidate('user:*');
```

## Migration from Basic Cache

If migrating from the basic cache service:

1. **Update cache keys**: Add `advanced_` prefix to avoid conflicts
2. **Implement warming functions**: For critical data
3. **Configure invalidation patterns**: Based on your data relationships
4. **Choose appropriate strategies**: Based on access patterns
5. **Monitor performance**: Compare hit rates and response times

## Security Considerations

1. **Sensitive Data**: Don't cache passwords, tokens, or PII without encryption
2. **Cache Poisoning**: Validate data before caching
3. **TTL Limits**: Set reasonable TTLs to prevent stale security data
4. **Access Control**: Ensure cache keys don't expose sensitive information

## Future Enhancements

1. **Encryption at Rest**: For sensitive cached data
2. **Cache Analytics**: Detailed usage patterns and optimization suggestions
3. **Auto-Tuning**: ML-based TTL and strategy optimization
4. **Edge Caching**: CDN integration for static assets
5. **GraphQL Integration**: Cache GraphQL query results