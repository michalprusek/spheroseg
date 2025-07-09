/**
 * Request deduplicator to prevent duplicate API calls
 * Especially useful for preventing rate limiting issues
 */

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly CACHE_DURATION = 5000; // 5 seconds

  /**
   * Get a unique key for the request
   */
  private getKey(url: string, method: string = 'GET', body?: any): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyStr}`;
  }

  /**
   * Clean up expired requests
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.CACHE_DURATION) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Execute a request with deduplication
   */
  async execute<T>(
    url: string,
    requestFn: () => Promise<T>,
    options?: {
      method?: string;
      body?: any;
      skipDedup?: boolean;
    },
  ): Promise<T> {
    // Skip deduplication if requested
    if (options?.skipDedup) {
      return requestFn();
    }

    // Clean up old requests
    this.cleanup();

    // Get unique key for this request
    const key = this.getKey(url, options?.method || 'GET', options?.body);

    // Check if we have a pending request
    const pending = this.pendingRequests.get(key);
    if (pending) {
      console.log(`[RequestDeduplicator] Reusing pending request for: ${key}`);
      return pending.promise as Promise<T>;
    }

    // Create new request
    console.log(`[RequestDeduplicator] Creating new request for: ${key}`);
    const promise = requestFn();

    // Store the pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    // Remove from pending when complete
    promise
      .finally(() => {
        this.pendingRequests.delete(key);
      })
      .catch(() => {
        // Ignore errors here, they'll be handled by the caller
      });

    return promise;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }
}

// Export singleton instance
export const requestDeduplicator = new RequestDeduplicator();
