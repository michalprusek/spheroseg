/**
 * LRU (Least Recently Used) Cache implementation
 * Used to prevent unbounded memory growth in component caching
 */

export class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;
  private accessOrder: Map<K, number>;
  private accessCounter: number;

  constructor(maxSize: number = 50) {
    if (maxSize <= 0) {
      throw new Error('Cache size must be positive');
    }

    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = new Map();
    this.accessCounter = 0;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Update access order
      this.accessOrder.set(key, this.accessCounter++);
    }
    return value;
  }

  set(key: K, value: V): void {
    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.accessOrder.set(key, this.accessCounter++);
      return;
    }

    // If cache is full, remove least recently used
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, value);
    this.accessOrder.set(key, this.accessCounter++);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let lruKey: K | undefined;
    let lruAccess = Infinity;

    // Find least recently used key
    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < lruAccess) {
        lruAccess = accessTime;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
    }
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    utilization: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100,
    };
  }

  // Get all keys in order of most to least recently used
  getKeysByUsage(): K[] {
    return Array.from(this.accessOrder.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);
  }
}

// Specialized cache for promises with automatic cleanup
export class PromiseCache<K> {
  private cache: LRUCache<K, Promise<unknown>>;
  private pendingCleanup: Set<K>;

  constructor(maxSize: number = 30) {
    this.cache = new LRUCache(maxSize);
    this.pendingCleanup = new Set();
  }

  async get<T>(key: K, factory: () => Promise<T>): Promise<T> {
    const existing = this.cache.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = factory().then(
      (result) => {
        // Clean up after resolution
        this.scheduleCleanup(key);
        return result;
      },
      (error) => {
        // Remove from cache on error
        this.cache.delete(key);
        throw error;
      },
    );

    this.cache.set(key, promise);
    return promise;
  }

  private scheduleCleanup(key: K): void {
    if (this.pendingCleanup.has(key)) {
      return;
    }

    this.pendingCleanup.add(key);

    // Clean up resolved promises after a delay
    setTimeout(() => {
      this.pendingCleanup.delete(key);
      // Optionally remove from cache after some time
      // this.cache.delete(key);
    }, 60000); // 1 minute
  }

  clear(): void {
    this.cache.clear();
    this.pendingCleanup.clear();
  }

  getStats() {
    return this.cache.getStats();
  }
}
