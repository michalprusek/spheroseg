/**
 * Service Worker for Chunk Caching
 * Improves performance by caching JavaScript chunks
 */

const CACHE_NAME = 'spheroseg-chunks-v1';
const CHUNK_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

// Patterns for files to cache
const CACHEABLE_PATTERNS = [
  /\.chunk\.js$/,
  /\.vendor-[^.]+\.js$/,
  /^\/assets\//,
  /\.woff2?$/,
  /\.ttf$/,
];

// Patterns for files to never cache
const SKIP_PATTERNS = [
  /\/api\//,
  /hot-update/,
  /\.map$/,
];

// Install event - preload critical chunks
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Preload critical vendor chunks
      return cache.addAll([
        '/vendor-react.js',
        '/vendor-ui.js',
      ]).catch(() => {
        // Ignore errors for missing files during development
      });
    })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('spheroseg-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      }),
      // Clean up expired entries
      cleanupExpiredCache(),
    ])
  );
  
  // Take control of all clients
  self.clients.claim();
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Check if URL should be cached
  const shouldCache = CACHEABLE_PATTERNS.some((pattern) => pattern.test(url.pathname));
  const shouldSkip = SKIP_PATTERNS.some((pattern) => pattern.test(url.pathname));

  if (!shouldCache || shouldSkip) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached response if available and not expired
      if (cachedResponse) {
        const cachedTime = cachedResponse.headers.get('sw-cached-time');
        if (cachedTime) {
          const age = Date.now() - parseInt(cachedTime, 10);
          if (age < CHUNK_CACHE_DURATION) {
            // Update cache in background for frequently used resources
            if (age > CHUNK_CACHE_DURATION / 2) {
              event.waitUntil(updateCache(request));
            }
            return cachedResponse;
          }
        }
      }

      // Fetch from network
      return fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          event.waitUntil(
            caches.open(CACHE_NAME).then(async (cache) => {
              // Check cache size before adding
              const cacheSize = await estimateCacheSize();
              if (cacheSize > MAX_CACHE_SIZE) {
                await cleanupLRUCache();
              }

              // Add custom header with cache time
              const headers = new Headers(responseToCache.headers);
              headers.set('sw-cached-time', Date.now().toString());

              const modifiedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers,
              });

              cache.put(request, modifiedResponse);
            })
          );

          return response;
        })
        .catch(() => {
          // If network fails, return cached version even if expired
          return cachedResponse || new Response('Network error', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    })
  );
});

// Update cache in background
async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      
      const headers = new Headers(response.headers);
      headers.set('sw-cached-time', Date.now().toString());

      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });

      await cache.put(request, modifiedResponse);
    }
  } catch (error) {
    // Ignore errors in background update
  }
}

// Clean up expired cache entries
async function cleanupExpiredCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  const now = Date.now();

  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const cachedTime = response.headers.get('sw-cached-time');
      if (cachedTime) {
        const age = now - parseInt(cachedTime, 10);
        if (age > CHUNK_CACHE_DURATION) {
          await cache.delete(request);
        }
      }
    }
  }
}

// Clean up least recently used entries
async function cleanupLRUCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  const entries = [];

  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const cachedTime = response.headers.get('sw-cached-time');
      entries.push({
        request,
        time: cachedTime ? parseInt(cachedTime, 10) : 0,
      });
    }
  }

  // Sort by time (oldest first)
  entries.sort((a, b) => a.time - b.time);

  // Remove oldest 25% of entries
  const toRemove = Math.floor(entries.length * 0.25);
  for (let i = 0; i < toRemove; i++) {
    await cache.delete(entries[i].request);
  }
}

// Estimate cache size
async function estimateCacheSize() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  
  // Fallback: count cached entries
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  return requests.length * 100000; // Assume 100KB average per chunk
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'CACHE_STATUS') {
    event.waitUntil(
      Promise.all([
        caches.open(CACHE_NAME).then((cache) => cache.keys()),
        estimateCacheSize(),
      ]).then(([requests, size]) => {
        event.ports[0].postMessage({
          cacheSize: size,
          entryCount: requests.length,
          cacheName: CACHE_NAME,
        });
      })
    );
  }
});