const CACHE_NAME = 'bantu-stream-v1';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/content-detail.html',
  '/css/base.css',
  '/css/components.css',
  '/css/content-detail.css',
  '/js/security.js',
  '/js/error-handler.js',
  '/js/state-manager.js',
  '/js/video-player.js',
  '/js/keyboard-navigation.js',
  '/js/sw-register.js',
  '/js/supabase-helper.js',
  '/js/content-detail.js',
  '/manifest.json'
];

const API_CACHE_NAME = 'bantu-api-v1';
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Install completed');
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation completed');
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.pathname.includes('/analytics') || url.pathname.includes('/telemetry')) {
    return;
  }
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  event.respondWith(handleAssetRequest(event.request));
});

async function handleAssetRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      updateCacheInBackground(request);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Fetch failed:', error);
    
    if (request.headers.get('Accept').includes('text/html')) {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    
    return new Response('Network error occurred', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function handleApiRequest(request) {
  const cacheKey = request.url;
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      const responseToCache = networkResponse.clone();
      const responseData = await responseToCache.json();
      const cacheData = {
        data: responseData,
        timestamp: Date.now(),
        url: request.url
      };
      
      await cache.put(
        request,
        new Response(JSON.stringify(cacheData), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] API request failed, trying cache:', error);
    
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      const cacheData = await cachedResponse.json();
      const cacheAge = Date.now() - cacheData.timestamp;
      
      if (cacheAge < MAX_CACHE_AGE) {
        return new Response(JSON.stringify(cacheData.data), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        await cache.delete(request);
      }
    }
    
    return new Response(JSON.stringify({
      error: 'You are offline and no cached data is available',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function updateCacheInBackground(request) {
  caches.open(CACHE_NAME).then((cache) => {
    fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response);
      }
    }).catch(() => {});
  });
}

// Handle background sync
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  try {
    const actions = await getQueuedActions();
    
    for (const action of actions) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        await removeQueuedAction(action.id);
      } catch (error) {
        console.error('[Service Worker] Failed to sync action:', action, error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'New update from Bantu Stream',
    icon: '/assets/logo-192.png',
    badge: '/assets/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      {
        action: 'watch',
        title: 'Watch Now'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Bantu Stream', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();
  
  if (event.action === 'watch') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else {
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});

// Helper functions for IndexedDB
function getQueuedActions() {
  return new Promise((resolve) => {
    const request = indexedDB.open('bantu-offline-queue', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['actions'], 'readonly');
      const store = transaction.objectStore('actions');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result);
      };
      
      getAllRequest.onerror = () => {
        resolve([]);
      };
    };
    
    request.onerror = () => {
      resolve([]);
    };
  });
}

function removeQueuedAction(id) {
  return new Promise((resolve) => {
    const request = indexedDB.open('bantu-offline-queue', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve(true);
      deleteRequest.onerror = () => resolve(false);
    };
    
    request.onerror = () => resolve(false);
  });
}
