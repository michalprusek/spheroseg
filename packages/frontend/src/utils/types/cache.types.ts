/**
 * Cache Management Type Definitions
 */

export interface CacheStats {
  localStorageKeys: number;
  sessionStorageKeys: number;
  indexedDBDatabases: string[];
  clearedItems: number;
}

export interface CacheOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
  stats?: Partial<CacheStats>;
}

export class CacheOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'CacheOperationError';
  }
}

export interface CacheConfig {
  version: string;
  maxSizeBytes?: number;
  expirationMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface CachedItem<T> {
  data: T;
  timestamp: number;
  version: string;
  expiresAt?: number;
}

// Type-safe window extension
declare global {
  interface Window {
    cacheManager?: {
      clearProjectImageCache: (projectId: string) => Promise<CacheOperationResult>;
      clearAllCaches: () => Promise<CacheOperationResult<CacheStats>>;
      getCacheStats: () => CacheStats;
      version: string;
    };
  }
}
