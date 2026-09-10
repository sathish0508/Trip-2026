// Service Worker for Trip 2026 Expense Tracker PWA
// Network-First Strategy for Instant Over-The-Air Updates without clearing cache
const CACHE_NAME = 'trip2026-cache-v10';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Pass Google Apps Script API calls directly through to network
  if (e.request.url.includes('script.google.com')) {
    return;
  }

  // Network-First Strategy: Always fetch fresh content from server if online
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && e.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache ONLY when device is offline
        return caches.match(e.request);
      })
  );
});
