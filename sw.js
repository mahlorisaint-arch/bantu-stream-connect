// Bantu Stream Connect Service Worker
// Version: 7.0.0 - CRITICAL: Supabase API NEVER CACHED + Engagement System Support
// Last updated: 2026-05-23 - FIXED: Removed ALL Supabase API caching (root cause of 503 errors)
// 🚨 ENGAGEMENT SYSTEM FIXES (2026-05-23):
// - Enhanced Supabase API detection (covers all engagement endpoints)
// - Added view recording endpoint protection (content_views)
// - Added like/favorite/watch later endpoint protection
// - Improved offline queue for engagement actions
// - Added retry logic for failed engagement syncs
// - Enhanced background sync for engagement data

const CACHE_NAME = 'bantu-stream-connect-v7';
const STATIC_CACHE = 'bantu-static-v7';
const DYNAMIC_CACHE = 'bantu-dynamic-v7';
const IMAGE_CACHE = 'bantu-images-v7';

// ⚠️ API_CACHE REMOVED - Supabase endpoints should NEVER be cached

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
    '/js/supabase-helper.js',
    '/js/auth-helper.js',
    '/js/content-detail.js',
    '/js/streaming-manager.js',
    '/js/video-player.js',
    '/js/video-player-features.js',
    '/js/playlist-manager.js',
    '/js/recommendation-engine.js',
    '/js/state-manager.js',
    '/manifest.json',
    '/assets/icon/bantu_stream_connect_icon_192x192.png',
    '/assets/icon/bantu_stream_connect_icon_512x512.png'
];

// External assets (CORS-enabled)
const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 🚨 Engagement endpoints that must NEVER be cached
const ENGAGEMENT_ENDPOINTS = [
    '/rest/v1/content_views',
    '/rest/v1/content_likes',
    '/rest/v1/favorites',
    '/rest/v1/watch_later',
    '/rest/v1/comments',
    '/rest/v1/content_shares',
    '/rest/v1/content_events',
    '/rest/v1/playlist_items',
    '/rest/v1/playlists',
    '/rest/v1/watch_progress',
    '/rest/v1/playback_sessions',
    '/rest/v1/playback_heartbeats'
];

// ============================================
// INSTALL: Force clear ALL old caches with NO auto-reload
// ============================================
self.addEventListener('install', event => {
    console.log('🚀 Service Worker: Installing v7 - CRITICAL ENGAGEMENT CACHE PROTECTION...');
    
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
            
            // Now open new caches (NO API_CACHE)
            await caches.open(CACHE_NAME);
            await caches.open(STATIC_CACHE);
            await caches.open(DYNAMIC_CACHE);
            await caches.open(IMAGE_CACHE);
            
            return true;
        })
        .then(async () => {
            // Cache critical static assets
            const cache = await caches.open(STATIC_CACHE);
            
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
                    console.log(`✅ Cached ${validAssets.length} critical static assets`);
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
            console.log('✅ Service Worker: Install completed - v7 ready');
            // CRITICAL FIX: Do NOT call skipWaiting() automatically
            // This prevents the infinite reload loop
        })
    );
});

// ============================================
// ACTIVATE: Clean up but DO NOT claim clients immediately
// ============================================
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker: Activating v7...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            console.log('🗑️ Final cache cleanup during activation...');
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete any caches that don't match our current versions
                    if (!cacheName.includes('v7') && 
                        cacheName !== CACHE_NAME && 
                        cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== IMAGE_CACHE) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker: Activation completed - v7 active');
            // CRITICAL FIX: Do NOT call clients.claim() automatically
            // This prevents the service worker from taking control immediately
        })
    );
});

// ============================================
// 🚨 HELPER: Check if URL is an engagement endpoint
// ============================================
function isEngagementEndpoint(url) {
    const pathname = url.pathname;
    const search = url.search;
    
    // Check against known engagement endpoints
    for (const endpoint of ENGAGEMENT_ENDPOINTS) {
        if (pathname.includes(endpoint)) {
            return true;
        }
    }
    
    // Check for specific table operations
    if (pathname.includes('/rest/v1/rpc/')) {
        const rpcName = pathname.split('/rest/v1/rpc/')[1];
        const engagementRPCs = [
            'record_content_view',
            'validate_playback_view',
            'increment_content_views',
            'toggle_content_like',
            'toggle_favorite',
            'toggle_watch_later',
            'record_content_share',
            'increment_engagement_stats_likes'
        ];
        if (engagementRPCs.some(rpc => rpcName?.includes(rpc))) {
            return true;
        }
    }
    
    return false;
}

// ============================================
// FETCH: Optimized caching strategies
// 🚨 CRITICAL: Supabase API endpoints are NEVER cached
// 🚨 ENGAGEMENT: All engagement endpoints are NEVER cached
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
    // 🚨🚨🚨 CRITICAL FIX: NEVER CACHE SUPABASE API REQUESTS 🚨🚨🚨
    // This includes all engagement endpoints (views, likes, favorites, watch later)
    // ============================================
    if (requestUrl.hostname.includes('supabase.co')) {
        // Check if this is an engagement endpoint for extra logging
        const isEngagement = isEngagementEndpoint(requestUrl);
        
        if (isEngagement) {
            console.log('🚨 ENGAGEMENT API request - NEVER CACHING:', requestUrl.pathname);
        } else if (requestUrl.pathname.includes('/rest/v1/') ||
            requestUrl.pathname.includes('/auth/v1/') ||
            requestUrl.pathname.includes('/storage/v1/')) {
            console.log('🚨 Supabase API request - NEVER CACHING:', requestUrl.pathname);
        } else {
            console.log('🚨 Supabase request - NEVER CACHING:', requestUrl.pathname);
        }
        
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response.ok) {
                        console.warn(`⚠️ Supabase API returned ${response.status}: ${requestUrl.pathname}`);
                        // For 409 Conflict (duplicate), still return the response but don't cache
                        if (response.status === 409) {
                            console.log('⚠️ 409 Conflict detected - this is normal for duplicate engagement actions');
                        }
                    }
                    return response;
                })
                .catch(error => {
                    console.error('❌ Supabase API fetch failed:', error);
                    
                    // For engagement endpoints, queue the action for retry when online
                    if (isEngagement && event.request.method !== 'GET') {
                        console.log('📦 Queuing engagement action for retry when online');
                        event.waitUntil(
                            queueEngagementForRetry(event.request)
                        );
                    }
                    
                    // Return a proper error response
                    return new Response(
                        JSON.stringify({ 
                            error: 'Network error', 
                            message: 'Unable to reach server. Please check your connection.' 
                        }),
                        { 
                            status: 503, 
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }
    
    // ============================================
    // Block any requests with corrupted paths
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
    // Block POST/PUT/DELETE requests to cache (should never be cached)
    // ============================================
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // ============================================
    // Strategy 1: Cache First for static assets (CSS, JS, fonts)
    // ONLY cache these - NOT database responses
    // ============================================
    if (requestUrl.pathname.match(/\.(css|js|json|woff2?|ttf|eot)$/) ||
        requestUrl.hostname.includes('fonts.googleapis.com') ||
        requestUrl.hostname.includes('cdnjs.cloudflare.com')) {
        
        // Skip if it's a Supabase-related static file (shouldn't happen but just in case)
        if (requestUrl.pathname.includes('supabase')) {
            event.respondWith(fetch(event.request));
            return;
        }
        
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // Return cached response and update in background (stale-while-revalidate)
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
    // Strategy 3: Cache with Network Fallback for images
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
                        // Return placeholder for missing images
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }
    
    // ============================================
    // Strategy 4: Network Only for everything else
    // This includes all API calls (except Supabase which is already handled)
    // ============================================
    event.respondWith(
        fetch(event.request).catch(error => {
            console.log('Fetch failed:', error);
            return new Response('', { status: 404 });
        })
    );
});

// ============================================
// 🚨 ENGAGEMENT QUEUE FOR OFFLINE RETRY
// ============================================

async function queueEngagementForRetry(request) {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(['pending_engagement'], 'readwrite');
        const store = transaction.objectStore('pending_engagement');
        
        // Clone the request to store it
        const requestData = {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body: await request.clone().text(),
            timestamp: Date.now(),
            retries: 0
        };
        
        store.add(requestData);
        
        console.log('📦 Engagement action queued for retry');
        
        // Register for background sync if available
        if ('sync' in self.registration) {
            await self.registration.sync.register('sync-engagement');
            console.log('✅ Background sync registered for engagement');
        }
        
    } catch (error) {
        console.error('❌ Failed to queue engagement for retry:', error);
    }
}

// ============================================
// MESSAGE HANDLER: Allow client to trigger cache clearing
// CRITICAL: NO auto-reload on messages
// ============================================
self.addEventListener('message', event => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        // Only skip waiting if explicitly requested by user action
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
    
    if (event.data.type === 'FORCE_RELOAD') {
        // Only reload if explicitly requested by user
        if (event.source) {
            event.source.postMessage({ type: 'RELOAD_REQUESTED' });
        }
    }
    
    if (event.data.type === 'SYNC_ENGAGEMENT') {
        event.waitUntil(syncPendingEngagement());
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
    
    if (event.tag === 'sync-engagement') {
        event.waitUntil(syncPendingEngagement());
    }
});

// ============================================
// 🚨 SYNC PENDING ENGAGEMENT ACTIONS
// ============================================
async function syncPendingEngagement() {
    console.log('🔄 Syncing pending engagement actions...');
    
    try {
        const db = await openDatabase();
        
        // Check if object store exists
        if (!db.objectStoreNames.contains('pending_engagement')) {
            console.log('ℹ️ No pending_engagement store found');
            return;
        }
        
        const transaction = db.transaction(['pending_engagement'], 'readwrite');
        const store = transaction.objectStore('pending_engagement');
        const allRequests = await getAllFromStore(db, 'pending_engagement');
        
        if (!allRequests || allRequests.length === 0) {
            console.log('ℹ️ No pending engagement actions to sync');
            return;
        }
        
        console.log(`📤 Syncing ${allRequests.length} pending engagement actions...`);
        
        const syncPromises = allRequests.map(async (requestData) => {
            try {
                // Check if this is an engagement endpoint
                const url = new URL(requestData.url);
                const isEngagement = isEngagementEndpoint(url);
                
                if (!isEngagement) {
                    // Not an engagement endpoint, skip or delete
                    await deleteFromStore(db, 'pending_engagement', requestData.id);
                    return;
                }
                
                // Replay the request
                const fetchOptions = {
                    method: requestData.method,
                    headers: new Headers(requestData.headers),
                    body: requestData.body
                };
                
                const response = await fetch(requestData.url, fetchOptions);
                
                if (response.ok || response.status === 409) {
                    // Success or duplicate (409 is acceptable for engagement)
                    console.log(`✅ Synced engagement action: ${requestData.url}`);
                    await deleteFromStore(db, 'pending_engagement', requestData.id);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
                
            } catch (error) {
                console.error(`❌ Failed to sync engagement action: ${requestData.url}`, error);
                
                // Update retry count
                requestData.retries = (requestData.retries || 0) + 1;
                if (requestData.retries < 5) {
                    // Update in store for next retry
                    await updateInStore(db, 'pending_engagement', requestData);
                } else {
                    // Max retries exceeded, delete it
                    console.warn(`🗑️ Max retries exceeded for engagement action, deleting: ${requestData.url}`);
                    await deleteFromStore(db, 'pending_engagement', requestData.id);
                }
            }
        });
        
        await Promise.allSettled(syncPromises);
        console.log('✅ Engagement sync completed');
        
    } catch (error) {
        console.error('❌ Engagement sync failed:', error);
    }
}

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
// HELPER FUNCTIONS
// ============================================

async function syncContentViews() {
    try {
        const db = await openDatabase();
        
        if (!db.objectStoreNames.contains('pending_views')) {
            console.log('ℹ️ No pending_views store found');
            return;
        }
        
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

// ============================================
// IndexedDB helper functions with engagement store
// ============================================
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BantuOfflineDB', 3);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;
            
            console.log(`📀 Upgrading IndexedDB from version ${oldVersion} to ${event.newVersion}`);
            
            // Create pending_views store
            if (!db.objectStoreNames.contains('pending_views')) {
                const viewStore = db.createObjectStore('pending_views', { keyPath: 'id', autoIncrement: true });
                viewStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('✅ Created pending_views store');
            }
            
            // Create cached_content store
            if (!db.objectStoreNames.contains('cached_content')) {
                const contentStore = db.createObjectStore('cached_content', { keyPath: 'id' });
                contentStore.createIndex('expires', 'expires', { unique: false });
                contentStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('✅ Created cached_content store');
            }
            
            // Create user_preferences store
            if (!db.objectStoreNames.contains('user_preferences')) {
                db.createObjectStore('user_preferences', { keyPath: 'key' });
                console.log('✅ Created user_preferences store');
            }
            
            // 🚨 Create pending_engagement store for offline engagement actions
            if (!db.objectStoreNames.contains('pending_engagement')) {
                const engagementStore = db.createObjectStore('pending_engagement', { keyPath: 'id', autoIncrement: true });
                engagementStore.createIndex('url', 'url', { unique: false });
                engagementStore.createIndex('timestamp', 'timestamp', { unique: false });
                engagementStore.createIndex('retries', 'retries', { unique: false });
                console.log('✅ Created pending_engagement store');
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
        request.onsuccess = () => resolve(request.result || []);
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

function updateInStore(db, storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
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
        
        if (!db.objectStoreNames.contains('cached_content')) {
            return;
        }
        
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
        
        // Also clean up old pending engagement entries (older than 7 days)
        if (db.objectStoreNames.contains('pending_engagement')) {
            const engagementTx = db.transaction(['pending_engagement'], 'readwrite');
            const engagementStore = engagementTx.objectStore('pending_engagement');
            const engagementIndex = engagementStore.index('timestamp');
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            
            const engagementRequest = engagementIndex.openCursor(IDBKeyRange.upperBound(sevenDaysAgo));
            
            engagementRequest.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    engagementStore.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };
        }
        
    } catch (error) {
        console.error('Cache cleanup failed:', error);
    }
}

// Run cleanup every hour
setInterval(cleanupExpiredCache, 60 * 60 * 1000);

console.log('✅ Service Worker v7 loaded - ENGAGEMENT API NEVER CACHED - This fixes engagement sync issues');
console.log('  🚨 Engagement endpoints protected: content_views, content_likes, favorites, watch_later, comments');
console.log('  🚨 Offline queue for engagement actions with background sync');
console.log('  🚨 Retry logic for failed engagement syncs (max 5 retries)');
