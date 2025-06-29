# HTTP Request Caching Consolidation

## Overview

This document describes the consolidation of HTTP request caching functionality into a unified caching service that provides consistent caching behavior across the entire application.

## Problem Statement

The application had multiple inconsistent caching implementations:
1. React Query caching with different configurations
2. Manual localStorage caching in various components
3. Project images cache in memory
4. Ad-hoc caching solutions in different services
5. Inconsistent cache invalidation strategies

## Solution: Unified Cache Service

Created a comprehensive caching solution with:
- Three-layer caching strategy (Memory, LocalStorage, IndexedDB)
- React Query integration via custom hooks
- Consistent TTL management
- Tag-based cache invalidation
- Automatic cleanup and eviction policies

## Architecture

### Cache Service (`unifiedCacheService.ts`)

```typescript
class UnifiedCacheService {
  // Three-layer caching
  private memoryCache: Map<string, CacheEntry> = new Map();
  private db: IDBDatabase | null = null;
  
  // Core methods
  public async get<T>(key: string, options: CacheOptions): Promise<T | null>
  public async set<T>(key: string, value: T, options: CacheOptions): Promise<void>
  public async delete(key: string, layer?: CacheLayer | CacheLayer[]): Promise<void>
  public async clear(layer?: CacheLayer | CacheLayer[]): Promise<void>
  
  // Tag-based operations
  public async getByTag(tag: string): Promise<Map<string, any>>
  public async deleteByTag(tag: string): Promise<void>
  
  // Cache management
  public getStats(): CacheStats
  public configure(config: Partial<CacheConfig>): void
  public async warmUp(data: Array<{key, value, options}>): Promise<void>
}
```

### Cache Layers

1. **Memory Cache** (CacheLayer.MEMORY)
   - Fastest access
   - Limited size (configurable)
   - LRU eviction policy
   - Best for: Frequently accessed small data

2. **LocalStorage** (CacheLayer.LOCAL_STORAGE)
   - Persistent across sessions
   - 5-10MB limit
   - Synchronous API
   - Best for: User preferences, small datasets

3. **IndexedDB** (CacheLayer.INDEXED_DB)
   - Large storage capacity
   - Asynchronous API
   - Supports complex data types
   - Best for: Images, large datasets, binary data

### React Integration (`useUnifiedCache.ts`)

```typescript
// Main hook
export function useUnifiedCache<T>(options: UseCacheOptions<T>): UseCacheReturn<T>

// Specialized hooks
export function useApiCache<T>(endpoint: string, options?: Partial<UseCacheOptions<T>>)
export function useUserCache<T>(userId: string, fetcher: () => Promise<T>, options?)
export function useProjectCache<T>(projectId: string, fetcher: () => Promise<T>, options?)
export function useImageCache(imageId: string, imageUrl: string, options?)

// Management hooks
export function useCacheStats(): CacheStats
export function useCacheManager(): CacheManager
export function useCachedMutation<TData, TVariables>(mutationFn, options?)
```

## Migration Guide

### 1. API Calls

**Before:**
```typescript
// Direct API call with manual caching
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const cached = localStorage.getItem(`api_${endpoint}`);
  if (cached) {
    setData(JSON.parse(cached));
    setLoading(false);
    return;
  }
  
  fetch(endpoint)
    .then(res => res.json())
    .then(data => {
      setData(data);
      localStorage.setItem(`api_${endpoint}`, JSON.stringify(data));
      setLoading(false);
    });
}, [endpoint]);
```

**After:**
```typescript
// Using unified cache hook
const { data, isLoading, error } = useApiCache(endpoint, {
  ttl: 5 * 60 * 1000, // 5 minutes
  layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE]
});
```

### 2. Project Data

**Before:**
```typescript
// Manual project data caching
const projectCache = {};

async function getProjectData(projectId) {
  if (projectCache[projectId]) {
    return projectCache[projectId];
  }
  
  const data = await apiClient.get(`/projects/${projectId}`);
  projectCache[projectId] = data;
  return data;
}
```

**After:**
```typescript
// Using project cache hook
const { data: project, refetch } = useProjectCache(
  projectId,
  () => apiClient.get(`/projects/${projectId}`).then(res => res.data),
  { ttl: 10 * 60 * 1000 }
);
```

### 3. Image Caching

**Before:**
```typescript
// Manual image blob caching
const imageCache = new Map();

async function loadImage(imageId, imageUrl) {
  if (imageCache.has(imageId)) {
    return imageCache.get(imageId);
  }
  
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  imageCache.set(imageId, objectUrl);
  return objectUrl;
}
```

**After:**
```typescript
// Using image cache hook
const { data: imageBlob } = useImageCache(imageId, imageUrl, {
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  layer: [CacheLayer.INDEXED_DB], // Large data goes to IndexedDB
  compress: true
});

// Convert blob to URL when needed
const imageObjectUrl = useMemo(() => {
  return imageBlob ? URL.createObjectURL(imageBlob) : null;
}, [imageBlob]);
```

### 4. Cache Invalidation

**Before:**
```typescript
// Manual cache clearing
function clearProjectCache(projectId) {
  delete projectCache[projectId];
  localStorage.removeItem(`project_${projectId}`);
  queryClient.invalidateQueries(['project', projectId]);
}
```

**After:**
```typescript
// Using cache manager
const { clearByTag } = useCacheManager();

// Clear all project-related caches
await clearByTag('project-data');

// Or use the hook's built-in invalidation
const { invalidate } = useProjectCache(projectId, fetcher);
await invalidate();
```

## Best Practices

### 1. Choose Appropriate Cache Layers

```typescript
// Small, frequently accessed data → Memory + LocalStorage
useApiCache('/api/user/preferences', {
  layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
  ttl: 30 * 60 * 1000 // 30 minutes
});

// Large binary data → IndexedDB only
useImageCache(imageId, imageUrl, {
  layer: [CacheLayer.INDEXED_DB],
  ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// Critical data → All layers for redundancy
useUserCache(userId, fetchUser, {
  layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE, CacheLayer.INDEXED_DB],
  ttl: 60 * 60 * 1000 // 1 hour
});
```

### 2. Use Tags for Related Data

```typescript
// Tag related data for bulk operations
useProjectCache(projectId, fetchProject, {
  tags: ['project-data', `project-${projectId}`]
});

useApiCache(`/api/projects/${projectId}/images`, {
  tags: ['project-data', `project-${projectId}`, 'images']
});

// Clear all project data at once
await clearByTag(`project-${projectId}`);
```

### 3. Handle Cache Misses Gracefully

```typescript
const { data, error, isLoading } = useApiCache(endpoint, {
  fetcher: async () => {
    // This runs only on cache miss
    const response = await apiClient.get(endpoint);
    return response.data;
  },
  onError: (error) => {
    // Handle fetch errors
    console.error('Failed to fetch data:', error);
    toast.error('Failed to load data');
  }
});
```

### 4. Implement Optimistic Updates

```typescript
const updateProject = useCachedMutation(
  (data) => apiClient.put(`/projects/${projectId}`, data),
  {
    cacheKey: (variables) => `project-${projectId}`,
    optimisticUpdate: (variables) => ({
      ...currentProject,
      ...variables
    }),
    invalidateKeys: [`project-${projectId}`],
    onSuccess: () => toast.success('Project updated')
  }
);
```

## Performance Considerations

### 1. Memory Management

```typescript
// Configure memory limits
cacheService.configure({
  maxMemoryItems: 1000,
  maxStorageSize: 50 * 1024 * 1024, // 50MB
  cleanupInterval: 60 * 1000 // 1 minute
});
```

### 2. Compression for Large Data

```typescript
// Enable compression for large JSON data
useApiCache('/api/large-dataset', {
  compress: true, // Uses built-in compression
  layer: [CacheLayer.INDEXED_DB]
});
```

### 3. Batch Operations

```typescript
// Warm up cache with multiple items
const { warmUp } = useCacheManager();

await warmUp([
  { key: 'user-preferences', value: preferences },
  { key: 'app-config', value: config },
  { key: 'feature-flags', value: flags }
]);
```

## Monitoring and Debugging

### 1. Cache Statistics

```typescript
const stats = useCacheStats();

// Display cache performance
console.log(`Cache hit rate: ${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(2)}%`);
console.log(`Memory usage: ${(stats.memorySize / 1024 / 1024).toFixed(2)}MB`);
console.log(`Total items: ${stats.itemCount}`);
```

### 2. Debug Logging

```typescript
// Enable debug logging
import { createLogger } from '@/utils/logging/unifiedLogger';
const logger = createLogger('CacheDebug');

// Log cache operations
logger.debug('Cache hit', { key, layer, ttl });
logger.debug('Cache miss', { key, reason });
```

## Common Patterns

### 1. Dependent Queries

```typescript
const { data: user } = useUserCache(userId, fetchUser);
const { data: projects } = useApiCache(
  `/api/users/${userId}/projects`,
  {
    enabled: !!user, // Only fetch when user is loaded
    ttl: 5 * 60 * 1000
  }
);
```

### 2. Infinite Queries

```typescript
// Cache paginated data
const { data: page1 } = useApiCache('/api/items?page=1', {
  tags: ['items', 'page-1']
});

const { data: page2 } = useApiCache('/api/items?page=2', {
  tags: ['items', 'page-2'],
  enabled: !!page1 // Load page 2 after page 1
});

// Clear all pages
await clearByTag('items');
```

### 3. Real-time Updates

```typescript
// Update cache when receiving WebSocket events
socket.on('project-updated', (projectId, data) => {
  // Update specific cache entry
  await cacheService.set(`project-${projectId}`, data, {
    tags: ['project-data', `project-${projectId}`]
  });
  
  // Trigger React Query refetch
  queryClient.invalidateQueries(['project', projectId]);
});
```

## Migration Checklist

- [ ] Replace manual localStorage usage with useApiCache
- [ ] Convert project images cache to useProjectCache
- [ ] Update image loading to use useImageCache
- [ ] Replace custom cache invalidation with tag-based clearing
- [ ] Add cache statistics monitoring
- [ ] Configure appropriate TTL values
- [ ] Test cache behavior across different scenarios
- [ ] Update error handling for cache misses
- [ ] Document cache dependencies

## Benefits

1. **Consistency**: Single source of truth for all caching
2. **Performance**: Multi-layer caching with automatic promotion
3. **Reliability**: Graceful degradation when layers fail
4. **Maintainability**: Centralized configuration and monitoring
5. **Scalability**: Easy to add new cache strategies
6. **Developer Experience**: Simple, declarative API