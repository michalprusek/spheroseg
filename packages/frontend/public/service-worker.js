/**
 * Service Worker for SpherosegV4
 * Handles push notifications and offline functionality
 */

// Cache version
const CACHE_VERSION = 'v1';
const CACHE_NAME = `spheroseg-${CACHE_VERSION}`;

// Files to cache for offline support
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/sounds/success.mp3',
  '/sounds/error.mp3',
  '/sounds/warning.mp3',
  '/sounds/info.mp3',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('spheroseg-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});

// Push event - show notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let notification;
  try {
    notification = event.data.json();
  } catch (e) {
    notification = {
      title: 'SpherosegV4',
      body: event.data.text(),
    };
  }

  const options = {
    body: notification.body || notification.message,
    icon: notification.icon || '/icon-192.png',
    badge: notification.badge || '/badge-72.png',
    image: notification.image,
    tag: notification.tag || 'spheroseg-notification',
    requireInteraction: notification.requireInteraction || false,
    silent: notification.silent || false,
    vibrate: notification.vibrate || [200, 100, 200],
    data: notification.data || {},
    actions: notification.actions || [],
    timestamp: notification.timestamp || Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(notification.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  // Track notification dismissal
  const data = event.notification.data || {};
  
  if (data.trackDismissal) {
    // Send dismissal event to analytics
    fetch('/api/notifications/dismissed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId: data.id,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Ignore errors
    });
  }
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  try {
    // Get queued notifications from IndexedDB
    const db = await openDB();
    const tx = db.transaction('queued-notifications', 'readonly');
    const store = tx.objectStore('queued-notifications');
    const notifications = await store.getAll();

    // Send each notification
    for (const notification of notifications) {
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notification),
        });

        // Remove from queue
        const deleteTx = db.transaction('queued-notifications', 'readwrite');
        await deleteTx.objectStore('queued-notifications').delete(notification.id);
      } catch (error) {
        console.error('Failed to sync notification:', error);
      }
    }
  } catch (error) {
    console.error('Failed to sync notifications:', error);
  }
}

// Helper to open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('spheroseg-notifications', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('queued-notifications')) {
        db.createObjectStore('queued-notifications', { keyPath: 'id' });
      }
    };
  });
}

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});