// Bantu Stream Connect Service Worker
// Version: 2.0.0

const CACHE_NAME = 'bantu-stream-connect-v2';
const STATIC_CACHE = 'bantu-static-v2';
const DYNAMIC_CACHE = 'bantu-dynamic-v2';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/home-feed.css',
    '/css/home-feed-themes.css',
    '/css/home-feed-components.css',
    '/css/home-feed-utilities.css',
    '/js/home-feed-core.js',
    '/js/home-feed-features.js',
    '/js/home-feed-ui.js',
    '/js/home-feed-utils.js',
    '/js/home-feed.js',
    '/manifest.json',
    '/assets/icon/bantu_stream_connect_icon_192x192.png',
    '/assets/icon/bantu_stream_connect_icon_512x512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Install completed');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker: Cache installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('Service Worker: Activation completed');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests and browser extensions
    if (event.request.method !== 'GET' || 
        event.request.url.startsWith('chrome-extension://') ||
        event.request.url.includes('extension')) {
        return;
    }
    
    // Skip Supabase realtime connections
    if (event.request.url.includes('realtime')) {
        return;
    }
    
    const requestUrl = new URL(event.request.url);
    
    // Strategy: Cache First, then Network for static assets
    if (STATIC_ASSETS.some(asset => requestUrl.pathname.includes(asset)) ||
        requestUrl.pathname.endsWith('.css') ||
        requestUrl.pathname.endsWith('.js') ||
        requestUrl.pathname.endsWith('.json')) {
        
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        // Return cached response
                        return cachedResponse;
                    }
                    
                    // Fetch from network
                    return fetch(event.request)
                        .then(networkResponse => {
                            // Don't cache if not successful
                            if (!networkResponse || networkResponse.status !== 200) {
                                return networkResponse;
                            }
                            
                            // Clone response for caching
                            const responseToCache = networkResponse.clone();
                            
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            
                            return networkResponse;
                        })
                        .catch(error => {
                            console.log('Fetch failed:', error);
                            // Return offline page or fallback
                            if (event.request.destination === 'document') {
                                return caches.match('/');
                            }
                            return new Response('Network error', {
                                status: 408,
                                headers: { 'Content-Type': 'text/plain' }
                            });
                        });
                })
        );
    }
    // Strategy: Network First, then Cache for API calls
    else if (requestUrl.pathname.includes('/api/') || 
             requestUrl.hostname.includes('supabase.co')) {
        
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Cache successful API responses
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    
                    return networkResponse;
                })
                .catch(error => {
                    console.log('API fetch failed, trying cache:', error);
                    return caches.match(event.request);
                })
        );
    }
    // Strategy: Cache with Network Update for images
    else if (event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    // Return cached image immediately
                    const fetchPromise = fetch(event.request)
                        .then(networkResponse => {
                            // Update cache with fresh image
                            if (networkResponse && networkResponse.status === 200) {
                                const responseToCache = networkResponse.clone();
                                
                                caches.open(DYNAMIC_CACHE)
                                    .then(cache => {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                            
                            return networkResponse;
                        })
                        .catch(() => {
                            // Ignore fetch errors for images
                        });
                    
                    return cachedResponse || fetchPromise;
                })
        );
    }
});

// Background sync for offline actions
self.addEventListener('sync', event => {
    console.log('Background sync:', event.tag);
    
    if (event.tag === 'sync-content-views') {
        event.waitUntil(syncContentViews());
    }
    
    if (event.tag === 'sync-analytics') {
        event.waitUntil(syncAnalytics());
    }
});

// Push notifications
self.addEventListener('push', event => {
    console.log('Push notification received:', event);
    
    let data = {
        title: 'Bantu Stream Connect',
        body: 'New content available!',
        icon: '/assets/icon/bantu_stream_connect_icon_192x192.png',
        badge: '/assets/icon/badge_72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: '/'
        }
    };
    
    if (event.data) {
        try {
            data = { ...data, ...JSON.parse(event.data.text()) };
        } catch (error) {
            console.log('Push data parse error:', error);
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: data.vibrate,
        data: data.data,
        actions: [
            {
                action: 'view',
                title: 'View'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'view' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                    // Focus existing window if available
                    for (const client of clientList) {
                        if (client.url === '/' && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    
                    // Open new window
                    if (clients.openWindow) {
                        return clients.openWindow(event.notification.data.url || '/');
                    }
                })
        );
    }
});

// Background sync functions
async function syncContentViews() {
    try {
        const db = await openDatabase();
        const views = await getAllFromStore(db, 'pending_views');
        
        if (views.length === 0) return;
        
        const syncPromises = views.map(view => 
            fetch('/api/analytics/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event: 'content_view',
                    properties: {
                        content_id: view.content_id,
                        duration: view.duration
                    },
                    userId: view.user_id
                })
            }).then(response => {
                if (response.ok) {
                    return deleteFromStore(db, 'pending_views', view.id);
                }
                throw new Error('Sync failed');
            })
        );
        
        await Promise.all(syncPromises);
        console.log('Content views synced successfully');
        
    } catch (error) {
        console.error('Content views sync failed:', error);
        throw error;
    }
}

async function syncAnalytics() {
    try {
        const db = await openDatabase();
        const events = await getAllFromStore(db, 'pending_analytics');
        
        if (events.length === 0) return;
        
        const syncPromises = events.map(event =>
            fetch('/api/analytics/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event.data)
            }).then(response => {
                if (response.ok) {
                    return deleteFromStore(db, 'pending_analytics', event.id);
                }
                throw new Error('Sync failed');
            })
        );
        
        await Promise.all(syncPromises);
        console.log('Analytics synced successfully');
        
    } catch (error) {
        console.error('Analytics sync failed:', error);
        throw error;
    }
}

// IndexedDB helper functions
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BantuOfflineDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains('pending_views')) {
                db.createObjectStore('pending_views', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains('pending_analytics')) {
                db.createObjectStore('pending_analytics', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains('cached_content')) {
                db.createObjectStore('cached_content', { keyPath: 'id' });
            }
        };
    });
}

function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function deleteFromStore(db, storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// Periodic sync for background updates
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-content') {
        event.waitUntil(updateCachedContent());
    }
});

async function updateCachedContent() {
    try {
        const response = await fetch('/api/content?limit=20');
        if (!response.ok) throw new Error('Update failed');
        
        const content = await response.json();
        
        // Store updated content in IndexedDB
        const db = await openDatabase();
        const transaction = db.transaction(['cached_content'], 'readwrite');
        const store = transaction.objectStore('cached_content');
        
        const updatePromises = content.data.map(item => 
            store.put({
                id: item.id,
                data: item,
                timestamp: Date.now()
            })
        );
        
        await Promise.all(updatePromises);
        console.log('Cached content updated');
        
        // Send notification if new content is available
        if (content.data.length > 0) {
            self.registration.showNotification('New Content Available', {
                body: `There are ${content.data.length} new items to watch`,
                icon: '/assets/icon/bantu_stream_connect_icon_192x192.png',
                badge: '/assets/icon/badge_72x72.png',
                tag: 'content-update'
            });
        }
        
    } catch (error) {
        console.error('Content update failed:', error);
    }
}

// Message handler for communication with client
self.addEventListener('message', event => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        caches.delete(STATIC_CACHE);
        caches.delete(DYNAMIC_CACHE);
    }
    
    if (event.data.type === 'UPDATE_CONTENT') {
        updateCachedContent();
    }
});

console.log('Service Worker loaded successfully');
