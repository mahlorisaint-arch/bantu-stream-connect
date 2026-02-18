// Bantu Stream Connect Service Worker
// Version: 3.0.0 - Optimized for Explore Screen Performance

const CACHE_NAME = 'bantu-stream-connect-v3';
const STATIC_CACHE = 'bantu-static-v3';
const DYNAMIC_CACHE = 'bantu-dynamic-v3';
const IMAGE_CACHE = 'bantu-images-v3';
const API_CACHE = 'bantu-api-v3';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/explore-screen.html',
    '/css/explore-screen.css',
    '/css/explore-screen-features.css',
    '/css/content-library-themes.css',
    '/css/content-library-features.css',
    '/js/explore-screen.js',
    '/js/explore-screen-features.js',
    '/js/rate-limiter.js',
    '/js/content-library-themes.js',
    '/js/content-library-features.js',
    '/manifest.json',
    '/assets/icon/bantu_stream_connect_icon_192x192.png',
    '/assets/icon/bantu_stream_connect_icon_512x512.png',
    '/offline.html',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// API endpoints to cache
const API_ENDPOINTS = [
    '/api/content/trending',
    '/api/content/new',
    '/api/content/community-favorites',
    '/api/content/live',
    '/api/creators/featured',
    '/api/stats/community'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing v3...');
    
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch(error => {
                    console.error('Failed to cache static assets:', error);
                    // Continue even if some assets fail
                });
            }),
            caches.open(API_CACHE).then(cache => {
                console.log('Service Worker: Pre-caching API endpoints');
                // Don't block install on API pre-cache
                return Promise.allSettled(
                    API_ENDPOINTS.map(endpoint => 
                        fetch(endpoint).then(response => {
                            if (response.ok) {
                                cache.put(endpoint, response);
                            }
                        }).catch(() => {})
                    )
                );
            })
        ]).then(() => {
            console.log('Service Worker: Install completed');
            return self.skipWaiting();
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
                    // Delete old version caches
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== IMAGE_CACHE && 
                        cacheName !== API_CACHE) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation completed');
            return self.clients.claim();
        })
    );
});

// Fetch event - optimized caching strategies
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    
    // Skip non-GET requests and browser extensions
    if (event.request.method !== 'GET' || 
        requestUrl.protocol === 'chrome-extension:' ||
        requestUrl.hostname.includes('extension')) {
        return;
    }
    
    // Skip Supabase realtime connections
    if (requestUrl.pathname.includes('realtime')) {
        return;
    }
    
    // Strategy 1: Cache First for static assets (CSS, JS, fonts)
    if (requestUrl.pathname.match(/\.(css|js|json|woff2?|ttf|eot)$/) ||
        requestUrl.hostname.includes('fonts.googleapis.com') ||
        requestUrl.hostname.includes('cdnjs.cloudflare.com')) {
        
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // Return cached response and update in background
                    fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse && networkResponse.ok) {
                                caches.open(STATIC_CACHE).then(cache => {
                                    cache.put(event.request, networkResponse);
                                });
                            }
                        })
                        .catch(() => {});
                    
                    return cachedResponse;
                }
                
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(STATIC_CACHE).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }
    
    // Strategy 2: Network First for HTML documents
    if (event.request.destination === 'document' || 
        requestUrl.pathname === '/' || 
        requestUrl.pathname.endsWith('.html')) {
        
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(DYNAMIC_CACHE).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request).then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Return offline page
                        return caches.match('/offline.html');
                    });
                })
        );
        return;
    }
    
    // Strategy 3: Stale-While-Revalidate for API calls
    if (requestUrl.pathname.includes('/api/') || 
        requestUrl.hostname.includes('supabase.co')) {
        
        event.respondWith(
            caches.open(API_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse && networkResponse.ok) {
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            return cachedResponse;
                        });
                    
                    // Return cached response immediately if available
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }
    
    // Strategy 4: Cache with Network Fallback for images
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        // Return cached image and update in background
                        fetch(event.request)
                            .then(networkResponse => {
                                if (networkResponse && networkResponse.ok) {
                                    cache.put(event.request, networkResponse);
                                }
                            })
                            .catch(() => {});
                        
                        return cachedResponse;
                    }
                    
                    return fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }
    
    // Strategy 5: Network Only for everything else
    event.respondWith(fetch(event.request));
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
    
    if (event.tag === 'sync-connectors') {
        event.waitUntil(syncConnectors());
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
        },
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
        actions: data.actions,
        tag: data.tag || 'notification',
        renotify: data.renotify || false,
        silent: data.silent || false,
        requireInteraction: data.requireInteraction || false,
        timestamp: Date.now()
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
        const urlToOpen = event.notification.data?.url || '/';
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                    // Try to focus existing window
                    for (const client of clientList) {
                        if (client.url.includes(urlToOpen) && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    
                    // Open new window
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    }
});

// Periodic sync for background updates
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-content') {
        event.waitUntil(updateCachedContent());
    }
    
    if (event.tag === 'update-community-stats') {
        event.waitUntil(updateCommunityStats());
    }
});

// Message handler for communication with client
self.addEventListener('message', event => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        Promise.all([
            caches.delete(STATIC_CACHE),
            caches.delete(DYNAMIC_CACHE),
            caches.delete(IMAGE_CACHE),
            caches.delete(API_CACHE)
        ]).then(() => {
            console.log('All caches cleared');
        });
    }
    
    if (event.data.type === 'UPDATE_CONTENT') {
        updateCachedContent();
    }
    
    if (event.data.type === 'PREFETCH_CONTENT') {
        prefetchContent(event.data.contentIds);
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
                        duration: view.duration,
                        timestamp: view.timestamp
                    },
                    userId: view.user_id
                })
            }).then(response => {
                if (response.ok) {
                    return deleteFromStore(db, 'pending_views', view.id);
                }
                throw new Error('Sync failed');
            }).catch(error => {
                console.error('View sync failed:', error);
                // Keep in store for retry
            })
        );
        
        await Promise.allSettled(syncPromises);
        console.log('Content views sync completed');
        
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
            }).catch(error => {
                console.error('Analytics sync failed:', error);
            })
        );
        
        await Promise.allSettled(syncPromises);
        console.log('Analytics sync completed');
        
    } catch (error) {
        console.error('Analytics sync failed:', error);
        throw error;
    }
}

async function syncConnectors() {
    try {
        const db = await openDatabase();
        const connectors = await getAllFromStore(db, 'pending_connectors');
        
        if (connectors.length === 0) return;
        
        const syncPromises = connectors.map(connector =>
            fetch('/api/connectors/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: connector.action,
                    creator_id: connector.creator_id,
                    user_id: connector.user_id,
                    timestamp: connector.timestamp
                })
            }).then(response => {
                if (response.ok) {
                    return deleteFromStore(db, 'pending_connectors', connector.id);
                }
                throw new Error('Sync failed');
            }).catch(error => {
                console.error('Connector sync failed:', error);
            })
        );
        
        await Promise.allSettled(syncPromises);
        console.log('Connectors sync completed');
        
    } catch (error) {
        console.error('Connectors sync failed:', error);
        throw error;
    }
}

// Content update functions
async function updateCachedContent() {
    try {
        const endpoints = [
            '/api/content/trending',
            '/api/content/new',
            '/api/content/community-favorites',
            '/api/content/live'
        ];
        
        const cache = await caches.open(API_CACHE);
        
        const updatePromises = endpoints.map(async endpoint => {
            try {
                const response = await fetch(endpoint);
                if (response.ok) {
                    await cache.put(endpoint, response.clone());
                    
                    // Store in IndexedDB for offline access
                    const data = await response.json();
                    await storeContentInDB(endpoint, data);
                }
            } catch (error) {
                console.error(`Failed to update ${endpoint}:`, error);
            }
        });
        
        await Promise.allSettled(updatePromises);
        console.log('Cached content updated');
        
        // Notify clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'CONTENT_UPDATED',
                timestamp: Date.now()
            });
        });
        
    } catch (error) {
        console.error('Content update failed:', error);
    }
}

async function updateCommunityStats() {
    try {
        const response = await fetch('/api/stats/community');
        if (response.ok) {
            const cache = await caches.open(API_CACHE);
            await cache.put('/api/stats/community', response.clone());
            
            const stats = await response.json();
            
            // Notify clients
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'STATS_UPDATED',
                    stats: stats
                });
            });
        }
    } catch (error) {
        console.error('Stats update failed:', error);
    }
}

async function prefetchContent(contentIds) {
    if (!contentIds || contentIds.length === 0) return;
    
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        
        const prefetchPromises = contentIds.map(async id => {
            const url = `/api/content/${id}`;
            try {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                }
            } catch (error) {
                console.error(`Failed to prefetch content ${id}:`, error);
            }
        });
        
        await Promise.allSettled(prefetchPromises);
        console.log(`Prefetched ${contentIds.length} content items`);
        
    } catch (error) {
        console.error('Prefetch failed:', error);
    }
}

async function storeContentInDB(endpoint, data) {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(['cached_content'], 'readwrite');
        const store = transaction.objectStore('cached_content');
        
        store.put({
            id: endpoint,
            data: data,
            timestamp: Date.now(),
            expires: Date.now() + (30 * 60 * 1000) // 30 minutes
        });
        
    } catch (error) {
        console.error('Failed to store content in DB:', error);
    }
}

// IndexedDB helper functions
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BantuOfflineDB', 2);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains('pending_views')) {
                const viewStore = db.createObjectStore('pending_views', { keyPath: 'id', autoIncrement: true });
                viewStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('pending_analytics')) {
                const analyticsStore = db.createObjectStore('pending_analytics', { keyPath: 'id', autoIncrement: true });
                analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('pending_connectors')) {
                const connectorStore = db.createObjectStore('pending_connectors', { keyPath: 'id', autoIncrement: true });
                connectorStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('cached_content')) {
                const contentStore = db.createObjectStore('cached_content', { keyPath: 'id' });
                contentStore.createIndex('expires', 'expires', { unique: false });
                contentStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('user_preferences')) {
                db.createObjectStore('user_preferences', { keyPath: 'key' });
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

// Clean up expired cache entries periodically
async function cleanupExpiredCache() {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(['cached_content'], 'readwrite');
        const store = transaction.objectStore('cached_content');
        const index = store.index('expires');
        const now = Date.now();
        
        const request = index.openCursor(IDBKeyRange.upperBound(now));
        
        request.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            }
        };
        
    } catch (error) {
        console.error('Cache cleanup failed:', error);
    }
}

// Run cleanup every hour
setInterval(cleanupExpiredCache, 60 * 60 * 1000);

console.log('Service Worker v3 loaded successfully - Optimized for Explore Screen');
