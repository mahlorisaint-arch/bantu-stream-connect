// Bantu Stream Connect Service Worker
// Version: 5.0.0 - EMERGENCY CACHE CLEAR with NO AUTO-RELOAD
// Last updated: 2026-04-10 - Fixed infinite reload loop

const CACHE_NAME = 'bantu-stream-connect-v5';
const STATIC_CACHE = 'bantu-static-v5';
const DYNAMIC_CACHE = 'bantu-dynamic-v5';
const IMAGE_CACHE = 'bantu-images-v5';
const API_CACHE = 'bantu-api-v5';

// Assets to cache on install - verified to exist (WITHOUT nested js/js paths)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/css/home-feed.css',
    '/css/home-feed-ui.css',
    '/css/home-feed-features.css',
    '/css/community-pulse.css',
    '/css/audio-player.css',
    '/js/image-fix.js',
    '/js/home-feed-core.js',
    '/js/home-feed-ui.js',
    '/js/home-feed-features.js',
    '/js/audio-player.js',
    '/js/community-pulse.js',
    '/js/rate-limiter.js',
    '/manifest.json',
    '/assets/icon/bantu_stream_connect_icon_192x192.png',
    '/assets/icon/bantu_stream_connect_icon_512x512.png'
];

// External assets (CORS-enabled)
const EXTERNAL_ASSETS = [
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

// ============================================
// INSTALL: Force clear ALL old caches with NO auto-reload
// ============================================
self.addEventListener('install', event => {
    console.log('🚀 Service Worker: Installing v5 - EMERGENCY CACHE CLEAR...');
    
    // Force clear ALL existing caches before installing
    event.waitUntil(
        caches.keys().then(async cacheNames => {
            console.log('🗑️ Clearing all existing caches...');
            const deletePromises = cacheNames.map(cacheName => {
                console.log(`🗑️ Deleting cache: ${cacheName}`);
                return caches.delete(cacheName);
            });
            await Promise.all(deletePromises);
            console.log('✅ All old caches cleared');
            
            // Now open new caches
            await caches.open(CACHE_NAME);
            await caches.open(STATIC_CACHE);
            await caches.open(DYNAMIC_CACHE);
            await caches.open(IMAGE_CACHE);
            await caches.open(API_CACHE);
            
            return true;
        })
        .then(async () => {
            // Cache critical assets
            const cache = await caches.open(STATIC_CACHE);
            
            // Cache local assets
            const validAssets = [];
            
            for (const url of STATIC_ASSETS) {
                try {
                    // Skip external URLs for HEAD checks
                    if (url.startsWith('http') && !url.startsWith(self.location.origin)) {
                        validAssets.push(url);
                        console.log(`📦 Will cache external: ${url}`);
                        continue;
                    }
                    
                    // For local assets, check if they exist
                    const response = await fetch(url, { 
                        method: 'HEAD',
                        cache: 'no-cache'
                    });
                    
                    if (response.ok) {
                        validAssets.push(url);
                        console.log(`✅ Asset found: ${url}`);
                    } else {
                        console.log(`⚠️ Skipping non-existent: ${url} (${response.status})`);
                    }
                } catch (error) {
                    // If HEAD fails but it's a local asset, try to add it anyway
                    if (!url.startsWith('http') || url.startsWith(self.location.origin)) {
                        validAssets.push(url);
                        console.log(`⚠️ Adding fallback for: ${url}`);
                    } else {
                        console.log(`❌ Skipping unreachable: ${url}`);
                    }
                }
            }
            
            // Cache external assets
            for (const url of EXTERNAL_ASSETS) {
                validAssets.push(url);
                console.log(`📦 Will cache external: ${url}`);
            }
            
            // Cache valid assets
            if (validAssets.length > 0) {
                try {
                    await cache.addAll(validAssets);
                    console.log(`✅ Cached ${validAssets.length} critical assets`);
                } catch (error) {
                    console.log('⚠️ Some assets failed to cache:', error);
                    // Try individually for failed assets
                    for (const url of validAssets) {
                        try {
                            await cache.add(url);
                        } catch (e) {
                            console.log(`⚠️ Failed to cache: ${url}`);
                        }
                    }
                }
            } else {
                console.log('⚠️ No valid assets to cache, continuing anyway');
            }
        })
        .then(() => {
            console.log('✅ Service Worker: Install completed - v5 ready');
            // CRITICAL FIX: Do NOT call skipWaiting() automatically
            // This prevents the infinite reload loop
            // self.skipWaiting() - REMOVED to prevent auto-reload
        })
    );
});

// ============================================
// ACTIVATE: Clean up but DO NOT claim clients immediately
// ============================================
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker: Activating v5...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            console.log('🗑️ Final cache cleanup during activation...');
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete any caches that don't match our current versions
                    if (!cacheName.includes('v5') && 
                        cacheName !== CACHE_NAME && 
                        cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== IMAGE_CACHE && 
                        cacheName !== API_CACHE) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker: Activation completed - v5 active');
            // CRITICAL FIX: Do NOT call clients.claim() automatically
            // This prevents the service worker from taking control immediately
            // and causing potential reload loops
            // return self.clients.claim(); - REMOVED to prevent reload loop
        })
    );
});

// ============================================
// FETCH: Optimized caching strategies with CORRUPTED PATH BLOCKING
// ============================================
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    
    // Skip non-GET requests and browser extensions
    if (event.request.method !== 'GET' || 
        requestUrl.protocol === 'chrome-extension:' ||
        requestUrl.hostname.includes('extension')) {
        return;
    }
    
    // Skip Supabase realtime connections
    if (requestUrl.pathname.includes('realtime') || 
        requestUrl.pathname.includes('/realtime/v1/')) {
        return;
    }
    
    // ============================================
    // EMERGENCY FIX: Block any requests with corrupted paths
    // This prevents the infinite loop from corrupted asset paths
    // ============================================
    if (requestUrl.pathname.includes('css/js/js/') || 
        requestUrl.pathname.includes('js/js/js/') ||
        requestUrl.pathname.includes('/js/css/') ||
        requestUrl.pathname.includes('/css/js/') ||
        requestUrl.pathname.match(/\/js\/[^/]*\.css/) ||
        requestUrl.pathname.match(/\/css\/[^/]*\.js/)) {
        console.error('🚨 BLOCKED corrupted path request:', requestUrl.pathname);
        event.respondWith(
            new Response('', { status: 404, statusText: 'Not Found - Corrupted Path' })
        );
        return;
    }
    
    // ============================================
    // Supabase API calls - Network First with cache fallback
    // ============================================
    if (requestUrl.hostname.includes('supabase.co')) {
        if (requestUrl.pathname.includes('/rest/v1/')) {
            event.respondWith(
                fetch(event.request)
                    .then(response => {
                        if (response && response.ok) {
                            const responseClone = response.clone();
                            caches.open(API_CACHE).then(cache => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(async () => {
                        const cached = await caches.match(event.request);
                        if (cached) {
                            console.log('📦 Serving cached Supabase response for:', requestUrl.pathname);
                            return cached;
                        }
                        return new Response(
                            JSON.stringify({ error: 'You are offline and this data is not cached' }),
                            { status: 503, headers: { 'Content-Type': 'application/json' } }
                        );
                    })
            );
            return;
        }
    }
    
    // ============================================
    // Strategy 1: Cache First for static assets (CSS, JS, fonts)
    // With stale-while-revalidate but NO forced refresh
    // ============================================
    if (requestUrl.pathname.match(/\.(css|js|json|woff2?|ttf|eot)$/) ||
        requestUrl.hostname.includes('fonts.googleapis.com') ||
        requestUrl.hostname.includes('cdnjs.cloudflare.com')) {
        
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // Return cached response and update in background (stale-while-revalidate)
                    // But DON'T trigger any page reload
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
                }).catch(error => {
                    console.log('Failed to fetch static asset:', error);
                    return new Response('', { status: 404, statusText: 'Not Found' });
                });
            })
        );
        return;
    }
    
    // ============================================
    // Strategy 2: Network First for HTML documents
    // ============================================
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
                .catch(async () => {
                    const cached = await caches.match(event.request);
                    if (cached) {
                        return cached;
                    }
                    const offlinePage = await caches.match('/offline.html');
                    if (offlinePage) {
                        return offlinePage;
                    }
                    return new Response(
                        '<html><body><h1>Offline</h1><p>You are offline and the offline page is not cached.</p></body></html>',
                        { headers: { 'Content-Type': 'text/html' } }
                    );
                })
        );
        return;
    }
    
    // ============================================
    // Strategy 3: Stale-While-Revalidate for API calls
    // ============================================
    if (requestUrl.pathname.includes('/api/')) {
        
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
                        .catch(error => {
                            console.log('API fetch failed:', error);
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            return new Response(
                                JSON.stringify({ error: 'Failed to fetch data' }),
                                { status: 503, headers: { 'Content-Type': 'application/json' } }
                            );
                        });
                    
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }
    
    // ============================================
    // Strategy 4: Cache with Network Fallback for images
    // ============================================
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
                    }).catch(() => {
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }
    
    // ============================================
    // Strategy 5: Network Only for everything else
    // ============================================
    event.respondWith(
        fetch(event.request).catch(error => {
            console.log('Fetch failed:', error);
            return new Response('', { status: 404 });
        })
    );
});

// ============================================
// MESSAGE HANDLER: Allow client to trigger cache clearing
// CRITICAL: NO auto-reload on messages
// ============================================
self.addEventListener('message', event => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        // Only skip waiting if explicitly requested by user action
        // This prevents automatic reload loops
        self.skipWaiting();
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                console.log('🗑️ Clearing all caches by client request...');
                return Promise.all(
                    cacheNames.map(cacheName => {
                        console.log(`🗑️ Deleting cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    })
                );
            }).then(() => {
                console.log('✅ All caches cleared');
                if (event.source) {
                    event.source.postMessage({ type: 'CACHE_CLEARED' });
                }
            })
        );
    }
    
    if (event.data.type === 'UPDATE_CONTENT') {
        updateCachedContent();
    }
    
    if (event.data.type === 'PREFETCH_CONTENT') {
        prefetchContent(event.data.contentIds);
    }
    
    if (event.data.type === 'FORCE_RELOAD') {
        // Only reload if explicitly requested by user
        if (event.source) {
            event.source.postMessage({ type: 'RELOAD_REQUESTED' });
        }
    }
});

// ============================================
// BACKGROUND SYNC: For offline actions
// ============================================
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

// ============================================
// PUSH NOTIFICATIONS
// ============================================
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

// ============================================
// NOTIFICATION CLICK HANDLER
// ============================================
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'view' || !event.action) {
        const urlToOpen = event.notification.data?.url || '/';
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                    for (const client of clientList) {
                        if (client.url.includes(urlToOpen) && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    }
});

// ============================================
// PERIODIC SYNC (if supported)
// ============================================
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-content') {
        event.waitUntil(updateCachedContent());
    }
    
    if (event.tag === 'update-community-stats') {
        event.waitUntil(updateCommunityStats());
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

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
                const response = await fetch(endpoint, { cache: 'no-cache' });
                if (response.ok) {
                    await cache.put(endpoint, response.clone());
                    
                    const data = await response.json();
                    await storeContentInDB(endpoint, data);
                }
            } catch (error) {
                console.error(`Failed to update ${endpoint}:`, error);
            }
        });
        
        await Promise.allSettled(updatePromises);
        console.log('Cached content updated');
        
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
        const response = await fetch('/api/stats/community', { cache: 'no-cache' });
        if (response.ok) {
            const cache = await caches.open(API_CACHE);
            await cache.put('/api/stats/community', response.clone());
            
            const stats = await response.json();
            
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
                const response = await fetch(url, { cache: 'no-cache' });
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

// ============================================
// IndexedDB helper functions
// ============================================
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BantuOfflineDB', 2);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            
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
            })
        );
        
        await Promise.allSettled(syncPromises);
        console.log('Content views sync completed');
        
    } catch (error) {
        console.error('Content views sync failed:', error);
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
    }
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

// ============================================
// Clean up expired cache entries periodically
// ============================================
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

console.log('✅ Service Worker v5 loaded - NO AUTO-RELOAD - Home Feed Ready');
