/**
 * Unified Cache Service
 *
 * This service consolidates all caching functionality into a single source of truth.
 * It provides a layered caching strategy with memory, localStorage, and IndexedDB.
 */

import { createLogger } from '@/utils/logging/unifiedLogger';

const logger = createLogger('UnifiedCacheService');

// ===========================
// Types and Interfaces
// ===========================

export interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxMemoryItems: number;
  maxStorageSize: number; // In bytes
  enableCompression: boolean;
  enableEncryption: boolean;
  autoCleanup: boolean;
  cleanupInterval: number;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
  size: number;
  hits: number;
  compressed?: boolean;
  encrypted?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  memorySize: number;
  storageSize: number;
  itemCount: number;
}

export enum CacheLayer {
  MEMORY = 'memory',
  LOCAL_STORAGE = 'localStorage',
  INDEXED_DB = 'indexedDB',
}

export interface CacheOptions {
  ttl?: number;
  layer?: CacheLayer | CacheLayer[];
  compress?: boolean;
  encrypt?: boolean;
  priority?: 'high' | 'normal' | 'low';
  tags?: string[];
}

// ===========================
// Default Configuration
// ===========================

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxMemoryItems: 1000,
  maxStorageSize: 50 * 1024 * 1024, // 50MB
  enableCompression: true,
  enableEncryption: false,
  autoCleanup: true,
  cleanupInterval: 60 * 1000, // 1 minute
};

// ===========================
// Cache Service Class
// ===========================

class UnifiedCacheService {
  private config: CacheConfig = DEFAULT_CONFIG;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memorySize: 0,
    storageSize: 0,
    itemCount: 0,
  };
  private cleanupTimer: NodeJS.Timer | null = null;
  private dbName = 'spheroseg_cache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private tagIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeIndexedDB();
    this.startAutoCleanup();
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeIndexedDB(): Promise<void> {
    try {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB:', request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info('IndexedDB initialized');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt');
          store.createIndex('tags', 'tags', { multiEntry: true });
        }
      };
    } catch (error) {
      logger.error('IndexedDB initialization failed:', error);
    }
  }

  /**
   * Get item from cache
   */
  public async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const layers = this.getLayers(options.layer);

      // Try each layer in order
      for (const layer of layers) {
        const entry = await this.getFromLayer<T>(key, layer);

        if (entry && !this.isExpired(entry)) {
          this.stats.hits++;
          entry.hits++;

          // Promote to higher layers if found in lower layer
          if (layer !== CacheLayer.MEMORY && layers.includes(CacheLayer.MEMORY)) {
            this.setInLayer(key, entry.value, CacheLayer.MEMORY, options);
          }

          return entry.value;
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set item in cache
   */
  public async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const layers = this.getLayers(options.layer);
      const ttl = options.ttl || this.config.defaultTTL;

      // Set in each specified layer
      for (const layer of layers) {
        await this.setInLayer(key, value, layer, { ...options, ttl });
      }

      // Update tags index
      if (options.tags) {
        options.tags.forEach((tag) => {
          if (!this.tagIndex.has(tag)) {
            this.tagIndex.set(tag, new Set());
          }
          this.tagIndex.get(tag)!.add(key);
        });
      }

      logger.debug(`Cached ${key} in layers: ${layers.join(', ')}`);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete item from cache
   */
  public async delete(key: string, layer?: CacheLayer | CacheLayer[]): Promise<void> {
    try {
      const layers = this.getLayers(layer);

      for (const l of layers) {
        await this.deleteFromLayer(key, l);
      }

      // Remove from tag index
      this.tagIndex.forEach((keys) => keys.delete(key));

      logger.debug(`Deleted ${key} from cache`);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Clear cache
   */
  public async clear(layer?: CacheLayer | CacheLayer[]): Promise<void> {
    try {
      const layers = this.getLayers(layer);

      for (const l of layers) {
        await this.clearLayer(l);
      }

      if (!layer || layers.length === 3) {
        this.tagIndex.clear();
        this.stats = {
          hits: 0,
          misses: 0,
          evictions: 0,
          memorySize: 0,
          storageSize: 0,
          itemCount: 0,
        };
      }

      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Get items by tag
   */
  public async getByTag(tag: string): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const keys = this.tagIndex.get(tag);

    if (keys) {
      for (const key of keys) {
        const value = await this.get(key);
        if (value !== null) {
          results.set(key, value);
        }
      }
    }

    return results;
  }

  /**
   * Delete items by tag
   */
  public async deleteByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);

    if (keys) {
      for (const key of keys) {
        await this.delete(key);
      }
      this.tagIndex.delete(tag);
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Configure cache
   */
  public configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    } else {
      this.stopAutoCleanup();
    }

    logger.info('Cache configured:', this.config);
  }

  /**
   * Warm cache with data
   */
  public async warmUp(data: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    logger.info(`Warming up cache with ${data.length} items`);

    for (const item of data) {
      await this.set(item.key, item.value, item.options);
    }
  }

  // ===========================
  // React Query Integration
  // ===========================

  /**
   * Create React Query cache functions
   */
  public createQueryCache(keyPrefix: string, ttl?: number) {
    return {
      get: async (key: string) => {
        return this.get(`${keyPrefix}:${key}`);
      },
      set: async (key: string, value: any) => {
        return this.set(`${keyPrefix}:${key}`, value, { ttl });
      },
      invalidate: async (key: string) => {
        return this.delete(`${keyPrefix}:${key}`);
      },
      invalidatePrefix: async () => {
        const keys = await this.getKeysByPrefix(keyPrefix);
        for (const key of keys) {
          await this.delete(key);
        }
      },
    };
  }

  // ===========================
  // Private Helper Methods
  // ===========================

  private getLayers(layer?: CacheLayer | CacheLayer[]): CacheLayer[] {
    if (!layer) {
      return [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE, CacheLayer.INDEXED_DB];
    }
    return Array.isArray(layer) ? layer : [layer];
  }

  private async getFromLayer<T>(key: string, layer: CacheLayer): Promise<CacheEntry<T> | null> {
    switch (layer) {
      case CacheLayer.MEMORY:
        return (this.memoryCache.get(key) as CacheEntry<T> | undefined) || null;

      case CacheLayer.LOCAL_STORAGE:
        try {
          const item = localStorage.getItem(`cache:${key}`);
          return item ? JSON.parse(item) : null;
        } catch {
          return null;
        }

      case CacheLayer.INDEXED_DB:
        return this.getFromIndexedDB<T>(key);

      default:
        return null;
    }
  }

  private async setInLayer<T>(
    key: string,
    value: T,
    layer: CacheLayer,
    options: CacheOptions & { ttl: number },
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + options.ttl,
      size: this.estimateSize(value),
      hits: 0,
      compressed: options.compress && this.config.enableCompression,
      encrypted: options.encrypt && this.config.enableEncryption,
    };

    // Apply compression/encryption if needed
    if (entry.compressed) {
      entry.value = (await this.compress(value)) as T;
    }
    if (entry.encrypted) {
      entry.value = (await this.encrypt(entry.value)) as T;
    }

    switch (layer) {
      case CacheLayer.MEMORY:
        // Check memory limit
        if (this.memoryCache.size >= this.config.maxMemoryItems) {
          this.evictLRU();
        }
        this.memoryCache.set(key, entry);
        this.stats.memorySize += entry.size;
        break;

      case CacheLayer.LOCAL_STORAGE:
        try {
          localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
        } catch (error) {
          logger.warn('localStorage set failed:', error);
          // Handle quota exceeded
          this.handleStorageQuota();
        }
        break;

      case CacheLayer.INDEXED_DB:
        await this.setInIndexedDB(entry);
        break;
    }

    this.stats.itemCount++;
  }

  private async deleteFromLayer(key: string, layer: CacheLayer): Promise<void> {
    switch (layer) {
      case CacheLayer.MEMORY:
        const entry = this.memoryCache.get(key);
        if (entry) {
          this.stats.memorySize -= entry.size;
          this.memoryCache.delete(key);
          this.stats.itemCount--;
        }
        break;

      case CacheLayer.LOCAL_STORAGE:
        localStorage.removeItem(`cache:${key}`);
        break;

      case CacheLayer.INDEXED_DB:
        await this.deleteFromIndexedDB(key);
        break;
    }
  }

  private async clearLayer(layer: CacheLayer): Promise<void> {
    switch (layer) {
      case CacheLayer.MEMORY:
        this.memoryCache.clear();
        this.stats.memorySize = 0;
        break;

      case CacheLayer.LOCAL_STORAGE:
        const keys = Object.keys(localStorage).filter((k) => k.startsWith('cache:'));
        keys.forEach((k) => localStorage.removeItem(k));
        break;

      case CacheLayer.INDEXED_DB:
        await this.clearIndexedDB();
        break;
    }
  }

  private async getFromIndexedDB<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        logger.error('IndexedDB get error:', request.error);
        resolve(null);
      };
    });
  }

  private async setInIndexedDB<T>(entry: CacheEntry<T>): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('IndexedDB set error:', request.error);
        reject(request.error);
      };
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('IndexedDB delete error:', request.error);
        resolve();
      };
    });
  }

  private async clearIndexedDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('IndexedDB clear error:', request.error);
        resolve();
      };
    });
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private estimateSize(value: any): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 0;
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.deleteFromLayer(oldestKey, CacheLayer.MEMORY);
      this.stats.evictions++;
    }
  }

  private handleStorageQuota(): void {
    // Clear expired items from localStorage
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('cache:'));

    for (const key of keys) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const entry = JSON.parse(item);
          if (this.isExpired(entry)) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  }

  private async getKeysByPrefix(prefix: string): Promise<string[]> {
    const keys: string[] = [];

    // Memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key);
      }
    }

    // LocalStorage
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`cache:${prefix}`))
      .forEach((k) => keys.push(k.replace('cache:', '')));

    // IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.openCursor();

      await new Promise<void>((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            if (cursor.key.toString().startsWith(prefix)) {
              keys.push(cursor.key.toString());
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    }

    return [...new Set(keys)];
  }

  private async compress(value: any): Promise<any> {
    // Placeholder for compression implementation
    // In production, use a library like pako or lz-string
    return value;
  }

  private async encrypt(value: any): Promise<any> {
    // Placeholder for encryption implementation
    // In production, use Web Crypto API
    return value;
  }

  private startAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private async cleanup(): Promise<void> {
    logger.debug('Running cache cleanup');

    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.deleteFromLayer(key, CacheLayer.MEMORY);
      }
    }

    // Clean localStorage
    const lsKeys = Object.keys(localStorage).filter((k) => k.startsWith('cache:'));
    for (const key of lsKeys) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const entry = JSON.parse(item);
          if (this.isExpired(entry)) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    }

    // Clean IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    }
  }
}

// ===========================
// Singleton Instance
// ===========================

const cacheService = new UnifiedCacheService();

// ===========================
// Export Public API
// ===========================

export default cacheService;

// Named exports for convenience
export const {
  get,
  set,
  delete: remove,
  clear,
  getByTag,
  deleteByTag,
  getStats,
  configure,
  warmUp,
  createQueryCache,
} = cacheService;
